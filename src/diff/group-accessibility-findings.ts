/**
 * Collapses raw axe-core findings into something a person can act on.
 *
 * axe reports one finding per offending node, so a page with a single bad
 * grey in its design system produces eighteen findings that differ only in
 * font size, and one wrong `aria-label` pattern repeated in a component
 * produces five byte-identical sentences. Rendering that list verbatim was
 * observed in real use to be unreadable: 40 lines, mostly duplicates, no way
 * to tell how many distinct problems were actually on the page.
 *
 * Grouping is pure code — no AI. Accessibility findings never reach Gemini
 * (AC-A11Y-05), and the answer here does not need interpretation, only
 * arrangement: the same rule, the same colour pair, counted.
 *
 * This module produces *structured* details, not sentences. The wording
 * belongs to the panel (accessibility-rule-copy.ts) — the same split the rest
 * of the codebase keeps between what was measured and how it is said.
 */

import type { AccessibilityFinding, AccessibilityImpact } from "../shared/types";

/**
 * One distinct way a rule failed.
 *
 * `contrast` is separated out because it is the only common rule whose
 * per-node text carries values worth showing: the colour pair and the ratio
 * are what actually gets fixed. Every other rule repeats one sentence.
 */
export type FindingDetail =
  | { kind: "contrast"; foreground: string; background: string; ratio: string; required: string | null }
  | { kind: "text"; text: string };

export type FindingVariant = {
  detail: FindingDetail;
  count: number;
  /** Kept so the group can still link out and so callers can key on a real finding. */
  sample: AccessibilityFinding;
};

export type FindingGroup = {
  ruleId: string;
  helpUrl: string;
  impact: AccessibilityImpact;
  /** Total offending nodes, i.e. what axe would have printed as separate lines. */
  total: number;
  variants: FindingVariant[];
};

const IMPACT_RANK: Record<AccessibilityImpact, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

/*
 * A failureSummary is not one sentence. axe returns a small document:
 *
 *   Fix all of the following:
 *     Element is in tab order and does not have accessible text
 *
 *   Fix any of the following:
 *     Element does not have text that is visible to screen readers
 *     aria-label attribute does not exist or is empty
 *     ...
 *
 * Flattening that into a single line produced a 330-character entry on a real
 * page (Wikipedia, link-name ×17) — collapsed correctly, unreadable anyway.
 * The lines after the first are alternative remedies for the same defect, and
 * the help link carries all of them, so the first condition stands for the
 * group and the rest are dropped.
 */
const SECTION_HEADER = /^Fix\s+(?:all|any)\s+of\s+the\s+following:?$/i;

/** The same header inline, for output that was flattened before reaching us. */
const INLINE_HEADER = /^Fix\s+(?:all|any)\s+of\s+the\s+following:\s*/i;

/** Long enough for axe's real sentences, short enough for a 400px column. */
const MAX_DETAIL_CHARS = 96;

const CONTRAST = /contrast of ([\d.]+)\s*\(foreground color:\s*(#[0-9a-f]{3,8}),\s*background color:\s*(#[0-9a-f]{3,8})/i;
const EXPECTED = /Expected contrast ratio of ([\d.]+):1/i;

/** The first real condition in a failureSummary, with axe's headers removed. */
function firstCondition(description: string): string {
  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !SECTION_HEADER.test(line));
  return (lines[0] ?? description.trim()).replace(INLINE_HEADER, "");
}

/**
 * The distinct-problem detail for one finding. Anything whose shape isn't
 * recognised becomes plain text, so an axe version that rewords its output
 * degrades to "duplicates still collapse" rather than throwing or
 * mislabelling.
 */
export function describeFinding(finding: AccessibilityFinding): FindingDetail {
  const text = firstCondition(finding.description).replace(/\s+/g, " ").trim();

  const contrast = CONTRAST.exec(text);
  if (contrast) {
    const [, ratio, foreground, background] = contrast;
    return {
      kind: "contrast",
      foreground: (foreground ?? "").toLowerCase(),
      background: (background ?? "").toLowerCase(),
      ratio: ratio ?? "",
      required: EXPECTED.exec(text)?.[1] ?? null,
    };
  }

  const trimmed = text.replace(/\.$/, "");
  return {
    kind: "text",
    text: trimmed.length > MAX_DETAIL_CHARS ? `${trimmed.slice(0, MAX_DETAIL_CHARS).trimEnd()}…` : trimmed,
  };
}

/** Stable key for deciding whether two findings are the same problem. */
export function detailKey(detail: FindingDetail): string {
  return detail.kind === "contrast"
    ? `contrast:${detail.foreground}:${detail.background}:${detail.ratio}:${detail.required ?? ""}`
    : `text:${detail.text}`;
}

export function groupAccessibilityFindings(findings: AccessibilityFinding[]): FindingGroup[] {
  const groups = new Map<string, FindingGroup>();

  for (const finding of findings) {
    let group = groups.get(finding.ruleId);
    if (!group) {
      group = {
        ruleId: finding.ruleId,
        helpUrl: finding.helpUrl,
        impact: finding.impact,
        total: 0,
        variants: [],
      };
      groups.set(finding.ruleId, group);
    }

    // A rule's nodes can carry different impacts; the group reports the worst.
    if (IMPACT_RANK[finding.impact] < IMPACT_RANK[group.impact]) group.impact = finding.impact;
    group.total += 1;

    const detail = describeFinding(finding);
    const key = detailKey(detail);
    const variant = group.variants.find((candidate) => detailKey(candidate.detail) === key);
    if (variant) variant.count += 1;
    else group.variants.push({ detail, count: 1, sample: finding });
  }

  for (const group of groups.values()) {
    group.variants.sort((a, b) => b.count - a.count || detailKey(a.detail).localeCompare(detailKey(b.detail)));
  }

  return [...groups.values()].sort(
    (a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact] || b.total - a.total || a.ruleId.localeCompare(b.ruleId),
  );
}
