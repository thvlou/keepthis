import { describe, expect, it } from "vitest";
import { computeLocalDiff } from "./compute-diff";
import type { ElementSnapshot, PageSnapshot } from "../shared/types";

const route = {
  routeKey: "http://localhost:3000/discover",
  fullUrl: "http://localhost:3000/discover",
  query: null,
  hash: null,
};

function el(overrides: Partial<ElementSnapshot>): ElementSnapshot {
  return {
    fingerprint: { strategy: "testid", value: "el" },
    tag: "div",
    role: null,
    accessibleName: null,
    geometry: { x: 0, y: 0, width: 100, height: 100, viewportCoveragePercent: 100 },
    visibility: { display: "block", visibility: "visible", opacity: 1, intersectsViewport: true },
    landmark: "main",
    headingLevel: null,
    ...overrides,
  };
}

function snapshot(elements: ElementSnapshot[], overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    schemaVersion: 1,
    route,
    capturedAt: "2026-08-20T00:00:00.000Z",
    viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 },
    readiness: { documentReadyState: "complete", ariaBusy: false, skeletonCandidateCount: 0, majorNodeCount: 50 },
    elements,
    contentHierarchy: [],
    interactionSummary: { buttonCount: 0, linkCount: 0, inputCount: 0, ctaCandidateCount: 0, navItemCount: 0 },
    ...overrides,
  };
}

describe("computeLocalDiff", () => {
  it("reports no changes for two identical snapshots", () => {
    const grid = el({ fingerprint: { strategy: "testid", value: "reference-grid" }, geometry: { x: 0, y: 214, width: 1200, height: 400, viewportCoveragePercent: 100 } });
    const diff = computeLocalDiff(snapshot([grid]), snapshot([grid]));
    expect(diff.viewport.comparable).toBe(true);
    expect(diff.changes).toHaveLength(0);
  });

  it("flags a viewport mismatch and skips element-level diffing", () => {
    const diff = computeLocalDiff(
      snapshot([], { viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 } }),
      snapshot([], { viewport: { width: 800, height: 600, devicePixelRatio: 1, scrollX: 0, scrollY: 0 } }),
    );
    expect(diff.viewport.comparable).toBe(false);
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0]?.kind).toBe("viewport_mismatch");
  });

  it("reproduces the section 17.1 demo scenario: grid pushed down and cards lost from the first viewport", () => {
    const baselineGrid = el({
      fingerprint: { strategy: "testid", value: "reference-grid" },
      geometry: { x: 0, y: 214, width: 1200, height: 600, viewportCoveragePercent: 100 },
    });
    const currentGrid = el({
      fingerprint: { strategy: "testid", value: "reference-grid" },
      geometry: { x: 0, y: 686, width: 1200, height: 600, viewportCoveragePercent: 30 },
    });

    // Coordinates, not the capture-time visibility flag, decide what counts
    // as "in the first screen" — so these fixtures place the cards for real.
    const baselineCards = Array.from({ length: 8 }, (_, i) =>
      el({
        fingerprint: { strategy: "testid", value: `card-${i}` },
        landmark: "main",
        geometry: { x: 0, y: 300 + i * 50, width: 300, height: 40, viewportCoveragePercent: 100 },
      }),
    );
    const currentCards = Array.from({ length: 8 }, (_, i) =>
      el({
        fingerprint: { strategy: "testid", value: `card-${i}` },
        landmark: "main",
        geometry: {
          x: 0,
          y: i < 2 ? 700 + i * 50 : 1000 + i * 50,
          width: 300,
          height: 40,
          viewportCoveragePercent: 100,
        },
      }),
    );

    const baseline = snapshot([baselineGrid, ...baselineCards]);
    const current = snapshot([currentGrid, ...currentCards]);

    const diff = computeLocalDiff(baseline, current);

    const positionChange = diff.changes.find((c) => c.kind === "position" && c.element === "reference-grid");
    expect(positionChange?.delta).toEqual({ x: 0, y: 472 });
    expect(positionChange?.matchConfidence).toBe("high");

    const visibleCountChange = diff.changes.find((c) => c.kind === "visible_count");
    expect(visibleCountChange?.before).toBe(9); // 8 cards + grid, all in main and visible at baseline
    expect(visibleCountChange?.current).toBe(3); // grid + 2 remaining visible cards
    expect(visibleCountChange?.delta).toBe(-6);
  });

  it("marks a removed baseline element and an added current element", () => {
    const removedEl = el({ fingerprint: { strategy: "testid", value: "old-cta" } });
    const addedEl = el({ fingerprint: { strategy: "testid", value: "new-cta" } });

    const diff = computeLocalDiff(snapshot([removedEl]), snapshot([addedEl]));
    const kinds = diff.changes.map((c) => c.kind);
    expect(kinds).toContain("removed");
    expect(kinds).toContain("added");
  });

  it("flags a fold_transition when an element leaves the first screen", () => {
    const baselineEl = el({ geometry: { x: 0, y: 200, width: 300, height: 40, viewportCoveragePercent: 100 } });
    const currentEl = el({ geometry: { x: 0, y: 1400, width: 300, height: 40, viewportCoveragePercent: 0 } });

    const diff = computeLocalDiff(snapshot([baselineEl]), snapshot([currentEl]));
    const foldChange = diff.changes.find((c) => c.kind === "fold_transition");
    expect(foldChange?.before).toBe(true);
    expect(foldChange?.current).toBe(false);
  });

  it("ignores a pure scroll difference between the two captures", () => {
    // Real-world regression: the baseline was captured at the top and the
    // current after scrolling 1311px, which reported every element as moved
    // by exactly -1311px and produced a false guardrail violation.
    const element = el({ geometry: { x: 0, y: 623, width: 300, height: 40, viewportCoveragePercent: 100 } });
    const scrolled = el({ geometry: { x: 0, y: -688, width: 300, height: 40, viewportCoveragePercent: 0 } });

    const diff = computeLocalDiff(
      snapshot([element], { viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 } }),
      snapshot([scrolled], { viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 1311 } }),
    );

    expect(diff.changes).toHaveLength(0);
  });

  it("does not report a sticky header as moved when the captures were scrolled differently", () => {
    // Real-world regression: a sticky header keeps rect.y ~0 at any scroll
    // offset, so scroll-normalising it invented a 1593px move across 81
    // header/nav elements.
    const stickyHeader = (y: number) =>
      el({
        fingerprint: { strategy: "role-name", role: "banner", accessibleName: "DOYO" },
        geometry: { x: 0, y, width: 1440, height: 80, viewportCoveragePercent: 100 },
        cssPosition: "sticky",
      });

    const diff = computeLocalDiff(
      snapshot([stickyHeader(0)], {
        viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 1593 },
      }),
      snapshot([stickyHeader(0)], {
        viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 },
      }),
    );

    expect(diff.changes).toHaveLength(0);
  });

  it("treats an element with no recorded cssPosition as document flow", () => {
    // Baselines saved before cssPosition existed must keep working.
    const legacy = el({ geometry: { x: 0, y: 623, width: 300, height: 40, viewportCoveragePercent: 100 } });
    const scrolled = el({ geometry: { x: 0, y: -688, width: 300, height: 40, viewportCoveragePercent: 0 } });

    const diff = computeLocalDiff(
      snapshot([legacy], { viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 } }),
      snapshot([scrolled], { viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 1311 } }),
    );

    expect(diff.changes).toHaveLength(0);
  });

  it("still detects a real shift when the two captures were scrolled differently", () => {
    const before = el({ geometry: { x: 0, y: 214, width: 300, height: 40, viewportCoveragePercent: 100 } });
    // Document position 686 (=  -314 + 1000), i.e. genuinely pushed down 472px.
    const after = el({ geometry: { x: 0, y: -314, width: 300, height: 40, viewportCoveragePercent: 0 } });

    const diff = computeLocalDiff(
      snapshot([before], { viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 } }),
      snapshot([after], { viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 1000 } }),
    );

    const positionChange = diff.changes.find((c) => c.kind === "position");
    expect(positionChange?.delta).toEqual({ x: 0, y: 472 });
    expect(positionChange?.before).toEqual({ x: 0, y: 214 });
    expect(positionChange?.current).toEqual({ x: 0, y: 686 });
  });

  it("flags a readiness anomaly when major regions drop sharply", () => {
    const diff = computeLocalDiff(
      snapshot([], { readiness: { documentReadyState: "complete", ariaBusy: false, skeletonCandidateCount: 0, majorNodeCount: 100 } }),
      snapshot([], { readiness: { documentReadyState: "complete", ariaBusy: false, skeletonCandidateCount: 5, majorNodeCount: 10 } }),
    );
    const readinessChange = diff.changes.find((c) => c.kind === "readiness");
    expect(readinessChange).toBeDefined();
    expect(readinessChange?.delta).toBe(-90);
  });

  it("flags a content hierarchy order change", () => {
    const diff = computeLocalDiff(
      snapshot([], { contentHierarchy: [{ kind: "heading", label: "H", order: 0 }, { kind: "section", label: "S", order: 1 }] }),
      snapshot([], { contentHierarchy: [{ kind: "section", label: "S", order: 0 }, { kind: "heading", label: "H", order: 1 }] }),
    );
    const orderChange = diff.changes.find((c) => c.kind === "order");
    expect(orderChange).toBeDefined();
  });

  it("ignores position jitter below the significance threshold", () => {
    const baselineEl = el({ geometry: { x: 0, y: 100, width: 100, height: 100, viewportCoveragePercent: 100 } });
    const currentEl = el({ geometry: { x: 0, y: 103, width: 100, height: 100, viewportCoveragePercent: 100 } });

    const diff = computeLocalDiff(snapshot([baselineEl]), snapshot([currentEl]));
    expect(diff.changes.find((c) => c.kind === "position")).toBeUndefined();
  });
});

/*
 * The model is asked to weigh the space it must reclaim against the size of
 * whatever was inserted. It can only do that if the size travels with the
 * evidence — without it, the one remedy needing no arithmetic ("reduce the
 * height and margins") gets proposed even for a block far too large to shrink.
 */
describe("added and removed blocks carry their size", () => {
  it("carries the space an added block occupies", () => {
    const before = snapshot([
      el({ fingerprint: { strategy: "testid", value: "grid" }, tag: "div", geometry: { x: 0, y: 100, width: 900, height: 400, viewportCoveragePercent: 100 } }),
    ]);
    const after = snapshot([
      el({ fingerprint: { strategy: "testid", value: "grid" }, tag: "div", geometry: { x: 0, y: 100, width: 900, height: 400, viewportCoveragePercent: 100 } }),
      el({ fingerprint: { strategy: "testid", value: "trending" }, tag: "section", geometry: { x: 0, y: 520, width: 900, height: 386, viewportCoveragePercent: 100 } }),
    ]);

    const added = computeLocalDiff(before, after).changes.find((c) => c.kind === "added");
    expect(added?.current).toEqual({ width: 900, height: 386 });
  });

  it("carries the space a removed block used to occupy", () => {
    const before = snapshot([
      el({ fingerprint: { strategy: "testid", value: "promo" }, tag: "aside", geometry: { x: 0, y: 0, width: 900, height: 240, viewportCoveragePercent: 100 } }),
    ]);
    const after = snapshot([]);

    const removed = computeLocalDiff(before, after).changes.find((c) => c.kind === "removed");
    expect(removed?.before).toEqual({ width: 900, height: 240 });
  });
});
