import { describe, expect, it } from "vitest";
import { selectSignificantChanges } from "./select-significant";
import type { LocalDiff, LocalDiffChange } from "../shared/types";

function diff(changes: LocalDiffChange[]): LocalDiff {
  return {
    routeKey: "http://localhost:3000/",
    viewport: {
      baseline: { width: 1440, height: 900 },
      current: { width: 1440, height: 900 },
      comparable: true,
    },
    changes,
  };
}

function position(id: string, dy: number, matchConfidence: "high" | "medium" | "low" = "high"): LocalDiffChange {
  return {
    evidenceId: id,
    kind: "position",
    element: `#${id}`,
    before: { x: 0, y: 0 },
    current: { x: 0, y: dy },
    delta: { x: 0, y: dy },
    matchConfidence,
  };
}

describe("selectSignificantChanges", () => {
  it("passes a small diff through untouched", () => {
    const original = diff([position("a", 10), { evidenceId: "b", kind: "order", before: "x", current: "y" }]);
    const result = selectSignificantChanges(original);
    expect(result.changes).toHaveLength(2);
    expect(result.omittedChangeCount).toBeUndefined();
  });

  it("keeps every fold transition and scoped count regardless of volume", () => {
    const changes: LocalDiffChange[] = [
      ...Array.from({ length: 200 }, (_, i) => position(`p${i}`, i)),
      { evidenceId: "fold", kind: "fold_transition", element: "#cta", before: true, current: false },
      { evidenceId: "count", kind: "visible_count", scope: "first_viewport", before: 8, current: 2, delta: -6 },
      { evidenceId: "controls", kind: "interactive_count", scope: "first_viewport", before: 3, current: 9, delta: 6 },
    ];

    const result = selectSignificantChanges(diff(changes));
    const ids = result.changes.map((c) => c.evidenceId);
    expect(ids).toContain("fold");
    expect(ids).toContain("count");
    expect(ids).toContain("controls");
  });

  it("caps the high-volume remainder and reports how much was left out", () => {
    const result = selectSignificantChanges(diff(Array.from({ length: 200 }, (_, i) => position(`p${i}`, i))));
    expect(result.changes.length).toBeLessThan(200);
    expect(result.omittedChangeCount).toBe(200 - result.changes.length);
  });

  it("keeps the largest shifts when it has to choose", () => {
    const changes = [position("small", 10), ...Array.from({ length: 60 }, (_, i) => position(`p${i}`, 20 + i)), position("huge", 5000)];
    const result = selectSignificantChanges(diff(changes));
    const ids = result.changes.map((c) => c.evidenceId);
    expect(ids).toContain("huge");
    expect(ids).not.toContain("small");
  });

  it("prefers named elements over structural-path wrappers", () => {
    const changes = [
      ...Array.from({ length: 60 }, (_, i) => position(`wrapper${i}`, 9999, "low")),
      position("named", 5, "medium"),
    ];
    const result = selectSignificantChanges(diff(changes));
    expect(result.changes.map((c) => c.evidenceId)).toContain("named");
  });

  it("never drops the gating kinds that stop an analysis", () => {
    const changes: LocalDiffChange[] = [
      ...Array.from({ length: 200 }, (_, i) => position(`p${i}`, i)),
      { evidenceId: "vp", kind: "viewport_mismatch" },
      { evidenceId: "ready", kind: "readiness", before: 100, current: 10, delta: -90 },
    ];
    const ids = selectSignificantChanges(diff(changes)).changes.map((c) => c.evidenceId);
    expect(ids).toContain("vp");
    expect(ids).toContain("ready");
  });

  it("preserves routeKey and viewport comparability", () => {
    const original = diff([position("a", 10)]);
    const result = selectSignificantChanges(original);
    expect(result.routeKey).toBe(original.routeKey);
    expect(result.viewport).toEqual(original.viewport);
  });
});
