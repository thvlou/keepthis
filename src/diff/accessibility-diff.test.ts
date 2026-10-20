import { describe, expect, it } from "vitest";
import { compareAccessibilityFindings, hasAccessibilityChanges } from "./accessibility-diff";
import type { AccessibilityFinding } from "../shared/types";

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

describe("compareAccessibilityFindings", () => {
  it("classifies a finding present in both as stillPresent", () => {
    const shared = finding();
    const comparison = compareAccessibilityFindings([shared], [shared]);
    expect(comparison.stillPresent).toHaveLength(1);
    expect(comparison.resolved).toHaveLength(0);
    expect(comparison.newlyIntroduced).toHaveLength(0);
  });

  it("classifies a baseline-only finding as resolved", () => {
    const comparison = compareAccessibilityFindings([finding()], []);
    expect(comparison.resolved).toHaveLength(1);
    expect(comparison.stillPresent).toHaveLength(0);
  });

  it("classifies a current-only finding as newlyIntroduced", () => {
    const comparison = compareAccessibilityFindings([], [finding()]);
    expect(comparison.newlyIntroduced).toHaveLength(1);
  });

  it("matches on ruleId + elementFingerprint, not on id", () => {
    const baseline = finding({ id: "old-id" });
    const current = finding({ id: "new-id" });
    const comparison = compareAccessibilityFindings([baseline], [current]);
    expect(comparison.stillPresent).toHaveLength(1);
    expect(comparison.resolved).toHaveLength(0);
    expect(comparison.newlyIntroduced).toHaveLength(0);
  });

  it("still matches a stable-id element whose CSS selector changed (the bug this replaced)", () => {
    // Reproduces the real-world case: adding an unrelated nav bar earlier in
    // the DOM shifted this element's nth-of-type-based selector, but its id
    // attribute (and therefore its fingerprint) never changed.
    const baseline = finding({ targetSelector: "select#gender" });
    const current = finding({ targetSelector: "div:nth-of-type(4)>select#gender" });
    const comparison = compareAccessibilityFindings([baseline], [current]);
    expect(comparison.stillPresent).toHaveLength(1);
    expect(comparison.resolved).toHaveLength(0);
    expect(comparison.newlyIntroduced).toHaveLength(0);
  });

  it("matches a role+accessible-name element across a selector change", () => {
    const baseline = finding({
      targetSelector: "p:nth-of-type(3)",
      elementFingerprint: { strategy: "role-name", role: "heading", accessibleName: "이번 계절의 기물" },
      matchConfidence: "medium",
    });
    const current = finding({
      targetSelector: "p:nth-of-type(4)",
      elementFingerprint: { strategy: "role-name", role: "heading", accessibleName: "이번 계절의 기물" },
      matchConfidence: "medium",
    });
    const comparison = compareAccessibilityFindings([baseline], [current]);
    expect(comparison.stillPresent).toHaveLength(1);
    expect(comparison.resolved).toHaveLength(0);
  });

  it("treats two structural-fallback findings with different fingerprints and selectors as resolved+newlyIntroduced", () => {
    const baseline = finding({
      targetSelector: "div:nth-of-type(3)>span:nth-of-type(1)",
      elementFingerprint: { strategy: "structural", path: "div:nth-of-type(3)>span:nth-of-type(1)", textHash: "a1" },
      matchConfidence: "low",
    });
    const current = finding({
      targetSelector: "div:nth-of-type(4)>span:nth-of-type(1)",
      elementFingerprint: { strategy: "structural", path: "div:nth-of-type(4)>span:nth-of-type(1)", textHash: "b2" },
      matchConfidence: "low",
    });
    const comparison = compareAccessibilityFindings([baseline], [current]);
    expect(comparison.resolved).toHaveLength(1);
    expect(comparison.newlyIntroduced).toHaveLength(1);
  });

  it("does not throw on a legacy baseline finding saved before elementFingerprint existed", () => {
    // Simulates a BaselineRecord written by an older build and read back
    // from chrome.storage.local unchanged — getBaseline() doesn't validate
    // or migrate stored shape, so this can genuinely happen in production.
    const legacyBaseline = finding() as AccessibilityFinding;
    // @ts-expect-error - intentionally simulating data saved before this field existed
    delete legacyBaseline.elementFingerprint;
    const current = finding();

    expect(() => compareAccessibilityFindings([legacyBaseline], [current])).not.toThrow();
    const comparison = compareAccessibilityFindings([legacyBaseline], [current]);
    // Falls back to matching on targetSelector, same as before fingerprints existed.
    expect(comparison.stillPresent).toHaveLength(1);
  });

  it("treats two genuinely different elements (different stable ids and selectors) as resolved+newlyIntroduced", () => {
    const baseline = finding({
      targetSelector: "select#gender",
      elementFingerprint: { strategy: "stable-id", value: "gender" },
    });
    const current = finding({
      targetSelector: "select#shipping-country",
      elementFingerprint: { strategy: "stable-id", value: "shipping-country" },
    });
    const comparison = compareAccessibilityFindings([baseline], [current]);
    expect(comparison.resolved).toHaveLength(1);
    expect(comparison.newlyIntroduced).toHaveLength(1);
  });
});

describe("hasAccessibilityChanges", () => {
  it("is false when all three categories are empty", () => {
    expect(hasAccessibilityChanges({ resolved: [], stillPresent: [], newlyIntroduced: [] })).toBe(false);
  });

  it("is true when any category is non-empty", () => {
    expect(hasAccessibilityChanges({ resolved: [finding()], stillPresent: [], newlyIntroduced: [] })).toBe(true);
  });
});
