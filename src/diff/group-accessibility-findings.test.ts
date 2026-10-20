import { describe, expect, it } from "vitest";
import { describeFinding, detailKey, groupAccessibilityFindings } from "./group-accessibility-findings";
import { formatDetail } from "../sidepanel/components/accessibility-rule-copy";
import type { AccessibilityFinding } from "../shared/types";

function finding(overrides: Partial<AccessibilityFinding> = {}): AccessibilityFinding {
  return {
    id: "a11y-0",
    ruleId: "color-contrast",
    impact: "serious",
    description: "",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.13/color-contrast",
    targetSelector: "div > p",
    elementFingerprint: { strategy: "structural", path: "div>p", textHash: "abc" },
    matchConfidence: "low",
    ...overrides,
  };
}

/** Verbatim axe-core 4.13 output captured from a real page. */
const contrast = (ratio: string, fg: string, bg: string, size: string) =>
  `Fix any of the following: Element has insufficient color contrast of ${ratio} (foreground color: ${fg}, background color: ${bg}, font size: ${size}, font weight: normal). Expected contrast ratio of 4.5:1`;

const prohibited =
  "Fix all of the following: aria-label attribute cannot be used on a div with no valid role attribute.";

describe("describeFinding", () => {
  it("reduces a contrast summary to the pair and the ratio", () => {
    expect(describeFinding(finding({ description: contrast("3.64", "#858688", "#ffffff", "9.0pt (12px)") }))).toEqual({
      kind: "contrast",
      foreground: "#858688",
      background: "#ffffff",
      ratio: "3.64",
      required: "4.5",
    });
  });

  it("ignores font size, so one design-system colour is one line", () => {
    const twelve = describeFinding(finding({ description: contrast("3.64", "#858688", "#ffffff", "9.0pt (12px)") }));
    const fifteen = describeFinding(finding({ description: contrast("3.64", "#858688", "#ffffff", "11.3pt (15px)") }));
    expect(detailKey(twelve)).toBe(detailKey(fifteen));
  });

  it("strips axe's boilerplate prefix from rules it does not recognise", () => {
    expect(describeFinding(finding({ ruleId: "aria-prohibited-attr", description: prohibited }))).toEqual({
      kind: "text",
      text: "aria-label attribute cannot be used on a div with no valid role attribute",
    });
  });

  it("falls back to the cleaned sentence when the shape is unfamiliar", () => {
    const description = "Element has insufficient contrast, somehow reworded by a future axe version.";
    expect(describeFinding(finding({ description }))).toEqual({
      kind: "text",
      text: "Element has insufficient contrast, somehow reworded by a future axe version",
    });
  });
});

describe("groupAccessibilityFindings", () => {
  /*
   * The list a real page produced: 40 findings, of which 5 were byte-identical
   * and the rest were a handful of colours repeated at different font sizes.
   */
  it("collapses a real 40-finding page into a readable set", () => {
    const findings = [
      ...Array.from({ length: 5 }, (_, i) =>
        finding({ id: `p-${i}`, ruleId: "aria-prohibited-attr", impact: "serious", description: prohibited }),
      ),
      ...Array.from({ length: 13 }, (_, i) =>
        finding({ id: `c-${i}`, description: contrast("3.64", "#858688", "#ffffff", i % 2 ? "9.0pt (12px)" : "9.8pt (13px)") }),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        finding({ id: `d-${i}`, description: contrast("1.66", "#c1c2c3", "#f7f7f8", "8.3pt (11px)") }),
      ),
      finding({ id: "e-0", description: contrast("2.34", "#ff8a3d", "#ffffff", "9.0pt (12px)") }),
    ];

    const groups = groupAccessibilityFindings(findings);

    expect(groups.map((g) => g.ruleId)).toEqual(["color-contrast", "aria-prohibited-attr"]);

    const [contrastGroup, prohibitedGroup] = groups;
    expect(contrastGroup?.total).toBe(22);
    expect(contrastGroup?.variants.map((v) => `${formatDetail(v.detail)} ×${v.count}`)).toEqual([
      "글자 #858688 / 배경 #ffffff — 대비 3.64, 기준 4.5 ×13",
      "글자 #c1c2c3 / 배경 #f7f7f8 — 대비 1.66, 기준 4.5 ×8",
      "글자 #ff8a3d / 배경 #ffffff — 대비 2.34, 기준 4.5 ×1",
    ]);

    // Five identical sentences become one line with a count.
    expect(prohibitedGroup?.total).toBe(5);
    expect(prohibitedGroup?.variants).toHaveLength(1);
    expect(prohibitedGroup?.variants[0]?.count).toBe(5);
  });

  it("orders by impact before volume, so one critical outranks many minor", () => {
    const groups = groupAccessibilityFindings([
      ...Array.from({ length: 9 }, (_, i) =>
        finding({ id: `m-${i}`, ruleId: "region", impact: "minor", description: "Some region problem" }),
      ),
      finding({ id: "c-0", ruleId: "label", impact: "critical", description: "Form element has no label" }),
    ]);

    expect(groups.map((g) => g.ruleId)).toEqual(["label", "region"]);
  });

  it("reports the worst impact a rule produced", () => {
    const groups = groupAccessibilityFindings([
      finding({ id: "a", ruleId: "label", impact: "moderate", description: "one" }),
      finding({ id: "b", ruleId: "label", impact: "critical", description: "two" }),
    ]);

    expect(groups[0]?.impact).toBe("critical");
  });

  it("returns nothing for no findings", () => {
    expect(groupAccessibilityFindings([])).toEqual([]);
  });
});

/*
 * Verbatim axe-core 4.13 output from https://en.wikipedia.org — captured
 * because the first version of this module was written against a page whose
 * summaries happened to be one line each. Wikipedia's are small documents,
 * and flattening them produced a 330-character entry that grouped correctly
 * and was still unreadable. These strings exist so that cannot come back.
 */
const WIKI_LINK_NAME = [
  "Fix all of the following:",
  "  Element is in tab order and does not have accessible text",
  "",
  "Fix any of the following:",
  "  Element does not have text that is visible to screen readers",
  "  aria-label attribute does not exist or is empty",
  "  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty",
  "  Element has no title attribute",
].join("\n");

const WIKI_IMAGE_ALT = [
  "Fix any of the following:",
  "  Element does not have an alt attribute",
  "  aria-label attribute does not exist or is empty",
  "  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty",
  "  Element has no title attribute",
  '  Element\'s default semantics were not overridden with role="none" or role="presentation"',
].join("\n");

const WIKI_CONTRAST = [
  "Fix any of the following:",
  "  Element has insufficient color contrast of 4.05 (foreground color: #3366cc, background color: #ddddff, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1",
].join("\n");

describe("real axe output from a second site", () => {
  it("keeps only the first condition of a multi-line summary", () => {
    expect(describeFinding(finding({ ruleId: "link-name", description: WIKI_LINK_NAME }))).toEqual({
      kind: "text",
      text: "Element is in tab order and does not have accessible text",
    });
    expect(describeFinding(finding({ ruleId: "image-alt", description: WIKI_IMAGE_ALT }))).toEqual({
      kind: "text",
      text: "Element does not have an alt attribute",
    });
  });

  it("still reads contrast values out of a multi-line summary", () => {
    expect(formatDetail(describeFinding(finding({ description: WIKI_CONTRAST })))).toBe(
      "글자 #3366cc / 배경 #ddddff — 대비 4.05, 기준 4.5",
    );
  });

  it("never emits a line too long for the panel", () => {
    const details = [WIKI_LINK_NAME, WIKI_IMAGE_ALT, WIKI_CONTRAST].map((description) =>
      formatDetail(describeFinding(finding({ description }))),
    );
    for (const detail of details) expect(detail.length).toBeLessThanOrEqual(97);
  });

  it("collapses the whole Wikipedia page into four rules", () => {
    const groups = groupAccessibilityFindings([
      ...Array.from({ length: 17 }, (_, i) =>
        finding({ id: `l${i}`, ruleId: "link-name", impact: "serious", description: WIKI_LINK_NAME }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        finding({ id: `i${i}`, ruleId: "image-alt", impact: "critical", description: WIKI_IMAGE_ALT }),
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        finding({ id: `c${i}`, description: WIKI_CONTRAST }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        finding({
          id: `r${i}`,
          ruleId: "aria-allowed-role",
          impact: "minor",
          description: "Fix any of the following:\n  ARIA role button is not allowed for given element",
        }),
      ),
    ]);

    // 30 raw findings, one line each after grouping.
    expect(groups.map((g) => `${g.ruleId} ${g.total} ${g.variants.length}`)).toEqual([
      "image-alt 3 1",
      "link-name 17 1",
      "color-contrast 7 1",
      "aria-allowed-role 3 1",
    ]);
  });
});
