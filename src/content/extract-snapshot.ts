/**
 * Sanitized DOM/layout extraction (CLAUDE.md section 6).
 *
 * extractSnapshot is injected into the target page via
 * chrome.scripting.executeScript({ func: extractSnapshot, args: [route] }).
 * Chrome stringifies only this function's own source and re-evaluates it in
 * the page — it cannot reference variables or functions from this module's
 * outer scope. Every helper is therefore declared *inside* the function body.
 * Only `import type` is used at module scope, which is erased at compile time
 * and adds nothing to the injected source.
 *
 * Explicitly not captured (CLAUDE.md section 6): input values, password
 * fields, hidden text, script/style content, raw data-* attribute values
 * other than data-testid (used only as a stable identity fingerprint).
 */

import type {
  ContentHierarchyEntry,
  ElementFingerprint,
  ElementSnapshot,
  InteractionSummary,
  PageSnapshot,
  ReadinessSignals,
  RouteInfo,
} from "../shared/types";

export function extractSnapshot(route: RouteInfo): PageSnapshot {
  const doc = document;
  const win = window;

  // Must stay inside the function body — see file header. A module-level
  // const here would be undefined once Chrome re-evaluates only this
  // function's stringified source in the page, throwing inside
  // querySelectorAll and surfacing as "Snapshot extraction returned no result."
  const CANDIDATE_SELECTOR = [
    "header",
    "nav",
    "main",
    "footer",
    "aside",
    "[role]",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "button",
    "a[href]",
    "input",
    "select",
    "textarea",
    "article",
    "li",
    '[class*="card" i]',
    "[data-testid]",
  ].join(",");

  const isHidden = (el: Element): boolean => {
    const style = win.getComputedStyle(el);
    return (
      style.display === "none" ||
      style.visibility === "hidden" ||
      el.getAttribute("aria-hidden") === "true"
    );
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

  const getFingerprint = (el: Element, accessibleName: string | null): ElementFingerprint => {
    const testId = el.getAttribute("data-testid");
    if (testId) return { strategy: "testid", value: testId };

    const id = el.id;
    if (id && !looksDynamicId(id) && doc.querySelectorAll(`#${CSS.escape(id)}`).length === 1) {
      return { strategy: "stable-id", value: id };
    }

    const role = getRole(el);
    if (role && accessibleName) {
      return { strategy: "role-name", role, accessibleName };
    }

    const text = isHidden(el) ? "" : (el.textContent ?? "");
    return { strategy: "structural", path: getStructuralPath(el), textHash: hashText(normalizeText(text)) };
  };

  const getLandmark = (el: Element): string | null => {
    const landmarkEl = el.closest('header, nav, main, footer, aside, [role="banner"], [role="navigation"], [role="main"], [role="contentinfo"], [role="complementary"]');
    if (!landmarkEl) return null;
    return getRole(landmarkEl) ?? landmarkEl.tagName.toLowerCase();
  };

  const viewportWidth = win.innerWidth;
  const viewportHeight = win.innerHeight;
  const viewportArea = viewportWidth * viewportHeight;

  const getGeometry = (el: Element) => {
    const rect = el.getBoundingClientRect();
    const overlapWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
    const overlapHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
    const overlapArea = overlapWidth * overlapHeight;
    const elementArea = rect.width * rect.height;
    const coverage = elementArea > 0 ? (overlapArea / elementArea) * 100 : 0;
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      viewportCoveragePercent: viewportArea > 0 ? Math.round(coverage * 100) / 100 : 0,
    };
  };

  const getVisibility = (el: Element, geometry: { width: number; height: number; x: number; y: number }) => {
    const style = win.getComputedStyle(el);
    const intersectsViewport =
      geometry.width > 0 &&
      geometry.height > 0 &&
      geometry.x < viewportWidth &&
      geometry.x + geometry.width > 0 &&
      geometry.y < viewportHeight &&
      geometry.y + geometry.height > 0;
    return {
      display: style.display,
      visibility: style.visibility,
      opacity: Number.parseFloat(style.opacity || "1"),
      intersectsViewport,
    };
  };

  const candidates = Array.from(doc.querySelectorAll(CANDIDATE_SELECTOR));
  const seen = new Set<Element>();
  const elements: ElementSnapshot[] = [];
  const contentHierarchy: ContentHierarchyEntry[] = [];
  let order = 0;

  for (const el of candidates) {
    if (seen.has(el)) continue;
    seen.add(el);

    if (el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;

    const accessibleName = getAccessibleName(el);
    const geometry = getGeometry(el);
    const visibility = getVisibility(el, geometry);
    const role = getRole(el);
    const tag = el.tagName.toLowerCase();
    const headingMatch = /^H([1-6])$/.exec(el.tagName);
    const headingLevel = headingMatch ? (Number(headingMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6) : null;

    elements.push({
      fingerprint: getFingerprint(el, accessibleName),
      tag,
      role,
      accessibleName,
      geometry,
      visibility,
      landmark: getLandmark(el),
      headingLevel,
      // Needed to tell viewport-pinned elements (a sticky header) from
      // document-flow ones when comparing across different scroll offsets.
      cssPosition: win.getComputedStyle(el).position,
    });

    if (headingLevel !== null) {
      contentHierarchy.push({ kind: "heading", label: accessibleName ?? "", order: order++ });
    } else if (role === "banner" || role === "navigation" || role === "main" || role === "contentinfo" || role === "complementary") {
      contentHierarchy.push({ kind: "landmark", label: role, order: order++ });
    } else if (tag === "article" || (el.className && /card/i.test(String(el.className)))) {
      contentHierarchy.push({ kind: "section", label: accessibleName ?? tag, order: order++ });
    }
  }

  const interactionSummary: InteractionSummary = {
    buttonCount: doc.querySelectorAll('button, [role="button"]').length,
    linkCount: doc.querySelectorAll("a[href]").length,
    inputCount: doc.querySelectorAll("input, select, textarea").length,
    ctaCandidateCount: doc.querySelectorAll('button, [role="button"]').length,
    navItemCount: doc.querySelectorAll("nav a[href]").length,
  };

  // Inlined copy of readiness.ts#computeReadiness — see file header for why.
  const readiness: ReadinessSignals = (() => {
    const ariaBusy = doc.querySelector('[aria-busy="true"]') !== null;
    const skeletonCandidateCount = doc.querySelectorAll(
      '[class*="skeleton" i], [class*="placeholder" i], [data-skeleton], [aria-busy="true"]',
    ).length;
    const majorNodeCount = doc.body ? doc.body.querySelectorAll("*").length : 0;
    return { documentReadyState: doc.readyState, ariaBusy, skeletonCandidateCount, majorNodeCount };
  })();

  return {
    schemaVersion: 1,
    route,
    capturedAt: new Date().toISOString(),
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
      devicePixelRatio: win.devicePixelRatio,
      scrollX: win.scrollX,
      scrollY: win.scrollY,
    },
    readiness,
    elements,
    contentHierarchy,
    interactionSummary,
  };
}
