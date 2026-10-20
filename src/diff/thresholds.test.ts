import { describe, expect, it } from "vitest";
import { isSignificantPositionDelta, isSignificantSizeDelta } from "./thresholds";

describe("isSignificantPositionDelta", () => {
  it("ignores small jitter", () => {
    expect(isSignificantPositionDelta(3, 900)).toBe(false);
  });

  it("flags an absolute jump past the pixel floor", () => {
    expect(isSignificantPositionDelta(30, 900)).toBe(true);
  });

  it("flags a smaller-in-pixels move that is still a large fraction of the viewport", () => {
    expect(isSignificantPositionDelta(20, 200)).toBe(true); // 10% of viewport height
  });
});

describe("isSignificantSizeDelta", () => {
  it("ignores small relative resizes", () => {
    expect(isSignificantSizeDelta(1000, 1050)).toBe(false);
  });

  it("flags a large relative resize", () => {
    expect(isSignificantSizeDelta(1000, 1300)).toBe(true);
  });

  it("treats appearing from zero area as significant", () => {
    expect(isSignificantSizeDelta(0, 10)).toBe(true);
  });
});
