import { describe, expect, it } from "vitest";
import { describeElement, matchElements } from "./match-elements";
import type { ElementSnapshot } from "../shared/types";

function makeElement(overrides: Partial<ElementSnapshot> = {}): ElementSnapshot {
  return {
    fingerprint: { strategy: "testid", value: "save-btn" },
    tag: "button",
    role: "button",
    accessibleName: "Save",
    geometry: { x: 0, y: 0, width: 100, height: 40, viewportCoveragePercent: 100 },
    visibility: { display: "block", visibility: "visible", opacity: 1, intersectsViewport: true },
    landmark: "main",
    headingLevel: null,
    ...overrides,
  };
}

describe("matchElements", () => {
  it("matches identical testid elements with high confidence", () => {
    const baseline = [makeElement()];
    const current = [makeElement({ geometry: { x: 0, y: 200, width: 100, height: 40, viewportCoveragePercent: 100 } })];

    const { matched, removed, added } = matchElements(baseline, current);
    expect(matched).toHaveLength(1);
    expect(matched[0]?.matchConfidence).toBe("high");
    expect(removed).toHaveLength(0);
    expect(added).toHaveLength(0);
  });

  it("gives structural fallback matches low confidence", () => {
    const structural = makeElement({
      fingerprint: { strategy: "structural", path: "main>div:nth-of-type(1)", textHash: "abc123" },
    });
    const { matched } = matchElements([structural], [structural]);
    expect(matched[0]?.matchConfidence).toBe("low");
  });

  it("classifies an element only in baseline as removed", () => {
    const baseline = [makeElement({ fingerprint: { strategy: "testid", value: "old-btn" } })];
    const { matched, removed, added } = matchElements(baseline, []);
    expect(matched).toHaveLength(0);
    expect(removed).toHaveLength(1);
    expect(added).toHaveLength(0);
  });

  it("classifies an element only in current as added", () => {
    const current = [makeElement({ fingerprint: { strategy: "testid", value: "new-btn" } })];
    const { matched, removed, added } = matchElements([], current);
    expect(matched).toHaveLength(0);
    expect(removed).toHaveLength(0);
    expect(added).toHaveLength(1);
  });

  it("does not double-match two current elements sharing one fingerprint", () => {
    const baseline = [makeElement()];
    const duplicateFingerprintCurrent = [makeElement(), makeElement()];
    const { matched, added } = matchElements(baseline, duplicateFingerprintCurrent);
    expect(matched).toHaveLength(1);
    expect(added).toHaveLength(1);
  });
});

describe("describeElement", () => {
  it("uses the raw testid value", () => {
    expect(describeElement(makeElement())).toBe("save-btn");
  });

  it("prefixes a stable id with #", () => {
    expect(describeElement(makeElement({ fingerprint: { strategy: "stable-id", value: "main-nav" } }))).toBe("#main-nav");
  });

  it("combines role and accessible name", () => {
    expect(
      describeElement(makeElement({ fingerprint: { strategy: "role-name", role: "link", accessibleName: "Home" } })),
    ).toBe("link:Home");
  });
});
