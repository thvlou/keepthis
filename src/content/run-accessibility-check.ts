/**
 * Tier 1 Accessibility Check (axe-core spec section 4).
 *
 * Both functions are injected via chrome.scripting.executeScript({ func })
 * and must stay self-contained for the same reason as extract-snapshot.ts —
 * only their own source is stringified into the page, so they can only
 * reference page globals (window.axe), never imports from this module.
 *
 * axe-core itself is NOT imported here. It's injected separately as a
 * prebuilt file (dist/axe.min.js, copied from node_modules by
 * scripts/copy-axe.mjs) so it registers window.axe in the page before
 * runAccessibilityCheck runs.
 */

import type { AccessibilityFinding, ElementFingerprint, MatchConfidence } from "../shared/types";

export function isAxeLoaded(): boolean {
  return typeof (window as unknown as { axe?: unknown }).axe !== "undefined";
}

type AxeNode = { target: string[]; failureSummary?: string };
type AxeViolation = {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  description: string;
  helpUrl: string;
  nodes: AxeNode[];
};
type AxeResults = { violations: AxeViolation[] };
type AxeGlobal = { run: () => Promise<AxeResults> };

/**
 * Runs axe-core against the current page and maps violations down to the
 * fields BaselineRecord.accessibilityFindings actually stores (section 3) —
 * never the raw axe output. Returns [] (never throws) if axe isn't loaded
 * or axe.run() fails, per A11Y-01/A11Y-05: a check failure must not block
 * Baseline save or Check Changes.
 */
export async function runAccessibilityCheck(): Promise<AccessibilityFinding[]> {
  const axe = (window as unknown as { axe?: AxeGlobal }).axe;
  if (!axe) return [];

  const doc = document;
  const win = window;

  // Self-contained duplicate of extract-snapshot.ts's element identity
  // fingerprint (data-testid -> stable id -> role+accessible name ->
  // structural path+text hash) — see that file's header for why this can't
  // just be imported. Reused here so accessibility findings survive an
  // unrelated DOM insertion elsewhere on the page the same way Local Diff
  // Engine element matching does; see accessibility-diff.ts for what this
  // replaced (raw CSS-selector matching, which broke exactly this way).

  const isHidden = (el: Element): boolean => {
    const style = win.getComputedStyle(el);
    return style.display === "none" || style.visibility === "hidden" || el.getAttribute("aria-hidden") === "true";
  };

  const hashText = (text: string): string => {
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 33) ^ text.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  };

  const normalizeText = (text: string): string => text.trim().replace(/\s+/g, " ").slice(0, 80);

  const getAccessibleName = (el: Element): string | null => {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return normalizeText(ariaLabel);

    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const labelEl = doc.getElementById(labelledBy);
      if (labelEl && !isHidden(labelEl)) return normalizeText(labelEl.textContent ?? "");
    }

    if (el.tagName === "IMG") {
      const alt = el.getAttribute("alt");
      return alt ? normalizeText(alt) : null;
    }

    if (isHidden(el)) return null;
    if (el.tagName === "INPUT" && (el as HTMLInputElement).type === "password") return null;
    if (el.tagName === "INPUT" && (el as HTMLInputElement).type === "hidden") return null;

    const text = el.textContent ?? "";
    return text.trim() ? normalizeText(text) : null;
  };

  const IMPLICIT_ROLES: Record<string, string> = {
    A: "link",
    BUTTON: "button",
    NAV: "navigation",
    HEADER: "banner",
    FOOTER: "contentinfo",
    MAIN: "main",
    ASIDE: "complementary",
    H1: "heading",
    H2: "heading",
    H3: "heading",
    H4: "heading",
    H5: "heading",
    H6: "heading",
  };

  const getRole = (el: Element): string | null => {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit;
    return IMPLICIT_ROLES[el.tagName] ?? null;
  };

  const getStructuralPath = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    let depth = 0;
    while (node && node !== doc.body && depth < 6) {
      const parent: Element | null = node.parentElement;
      if (!parent) break;
      const sameTagSiblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      const index = sameTagSiblings.indexOf(node) + 1;
      parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${index})`);
      node = parent;
      depth++;
    }
    return parts.join(">");
  };

  const looksDynamicId = (id: string): boolean => /^[0-9a-f]{6,}$/i.test(id) || /^\d+$/.test(id);

  const getFingerprint = (el: Element): ElementFingerprint => {
    const testId = el.getAttribute("data-testid");
    if (testId) return { strategy: "testid", value: testId };

    const id = el.id;
    if (id && !looksDynamicId(id) && doc.querySelectorAll(`#${CSS.escape(id)}`).length === 1) {
      return { strategy: "stable-id", value: id };
    }

    const accessibleName = getAccessibleName(el);
    const role = getRole(el);
    if (role && accessibleName) {
      return { strategy: "role-name", role, accessibleName };
    }

    const text = isHidden(el) ? "" : (el.textContent ?? "");
    return { strategy: "structural", path: getStructuralPath(el), textHash: hashText(normalizeText(text)) };
  };

  const confidenceFor = (fingerprint: ElementFingerprint): MatchConfidence => {
    if (fingerprint.strategy === "testid" || fingerprint.strategy === "stable-id") return "high";
    if (fingerprint.strategy === "role-name") return "medium";
    return "low";
  };

  const resolveIdentity = (target: string[]): { fingerprint: ElementFingerprint; matchConfidence: MatchConfidence } => {
    try {
      const selector = target.join(" ");
      const el = selector ? doc.querySelector(selector) : null;
      if (el) {
        const fingerprint = getFingerprint(el);
        return { fingerprint, matchConfidence: confidenceFor(fingerprint) };
      }
    } catch {
      // Selector axe reported isn't resolvable in this DOM (e.g. crosses a
      // shadow boundary) — fall through to the degraded fallback below.
    }
    // Element couldn't be resolved live; fall back to the raw selector
    // string so matching still degrades gracefully instead of throwing.
    return {
      fingerprint: { strategy: "structural", path: target.join(" "), textHash: "" },
      matchConfidence: "low",
    };
  };

  try {
    const results = await axe.run();
    const findings: AccessibilityFinding[] = [];
    let counter = 0;
    for (const violation of results.violations) {
      for (const node of violation.nodes) {
        const { fingerprint, matchConfidence } = resolveIdentity(node.target);
        findings.push({
          id: `a11y-${counter++}`,
          ruleId: violation.id,
          impact: violation.impact ?? "minor",
          // failureSummary is per-node and concrete (e.g. actual vs required
          // contrast ratio); violation.description is the same generic rule
          // text for every node, which read as unhelpfully vague in practice.
          description: node.failureSummary ?? violation.description,
          helpUrl: violation.helpUrl,
          targetSelector: node.target.join(" "),
          elementFingerprint: fingerprint,
          matchConfidence,
        });
      }
    }
    return findings;
  } catch {
    return [];
  }
}
