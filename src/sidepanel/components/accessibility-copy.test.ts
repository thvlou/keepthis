import { describe, expect, it } from "vitest";
import {
  buildBaselineNoticeSummary,
  buildComparisonSummaryLine,
  buildIntroducedHeadline,
  buildPreExistingLabel,
  buildResolvedLabel,
} from "./accessibility-copy";
import type { AccessibilityComparison, AccessibilityFinding } from "../../shared/types";

function finding(overrides: Partial<AccessibilityFinding> = {}): AccessibilityFinding {
  return {
    id: "a11y-0",
    ruleId: "label",
    impact: "serious",
    description: "Form element does not have an associated label",
    helpUrl: "https://dequeuniversity.com/rules/axe/label",
    targetSelector: "select#gender",
    elementFingerprint: { strategy: "stable-id", value: "gender" },
    matchConfidence: "high",
    ...overrides,
  };
}

describe("buildBaselineNoticeSummary", () => {
  it("uses singular wording for exactly one issue", () => {
    expect(buildBaselineNoticeSummary(1)).toBe("1 accessibility issue found");
  });

  it("uses plural wording for more than one issue", () => {
    expect(buildBaselineNoticeSummary(2)).toBe("2 accessibility issues found");
  });
});

describe("buildIntroducedHeadline", () => {
  it("counts findings that did not exist at baseline", () => {
    expect(buildIntroducedHeadline(3)).toBe("3 new accessibility issues since baseline");
    expect(buildIntroducedHeadline(1)).toBe("1 new accessibility issue since baseline");
  });

  it("does not attribute the findings to a prompt or an edit (CLAUDE.md 4.1)", () => {
    const text = buildIntroducedHeadline(2).toLowerCase();
    for (const forbidden of ["prompt", "caused", "broke", "your change", "ai "]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("buildResolvedLabel / buildPreExistingLabel", () => {
  it("pluralises both labels", () => {
    expect(buildResolvedLabel(1)).toBe("1 accessibility issue resolved");
    expect(buildResolvedLabel(2)).toBe("2 accessibility issues resolved");
    expect(buildPreExistingLabel(1)).toBe("1 pre-existing issue");
    expect(buildPreExistingLabel(2)).toBe("2 pre-existing issues");
  });
});

describe("buildComparisonSummaryLine", () => {
  it("joins only the non-zero categories", () => {
    const comparison: AccessibilityComparison = {
      resolved: [finding()],
      stillPresent: [finding(), finding()],
      newlyIntroduced: [],
    };
    expect(buildComparisonSummaryLine(comparison)).toBe("1 resolved, 2 still present");
  });

  it("includes the new count when present", () => {
    const comparison: AccessibilityComparison = {
      resolved: [],
      stillPresent: [],
      newlyIntroduced: [finding()],
    };
    expect(buildComparisonSummaryLine(comparison)).toBe("1 new");
  });

  it("returns an empty string when nothing changed", () => {
    const comparison: AccessibilityComparison = { resolved: [], stillPresent: [], newlyIntroduced: [] };
    expect(buildComparisonSummaryLine(comparison)).toBe("");
  });
});
