/**
 * Manual, human-readable check for the Local Diff Engine (6단계).
 * Run with: npm run demo:diff
 *
 * Reproduces the CLAUDE.md section 17.1 "정상 사례": a reference grid at
 * y=214 with 8 visible cards gets pushed to y=686 with only 2 cards left
 * visible, after filters/recommendations are added. No CSS errors — the
 * diff engine should still surface this as a meaningful set of changes.
 */

import { computeLocalDiff } from "../src/diff/compute-diff";
import type { ElementSnapshot, PageSnapshot } from "../src/shared/types";

const route = {
  routeKey: "http://localhost:3000/discover",
  fullUrl: "http://localhost:3000/discover",
  query: null,
  hash: null,
};

function card(index: number, visible: boolean): ElementSnapshot {
  return {
    fingerprint: { strategy: "testid", value: `card-${index}` },
    tag: "div",
    role: null,
    accessibleName: `Card ${index}`,
    geometry: { x: 0, y: 0, width: 280, height: 180, viewportCoveragePercent: visible ? 100 : 0 },
    visibility: { display: "block", visibility: "visible", opacity: 1, intersectsViewport: visible },
    landmark: "main",
    headingLevel: null,
  };
}

function grid(y: number, coveragePercent: number): ElementSnapshot {
  return {
    fingerprint: { strategy: "testid", value: "reference-grid" },
    tag: "div",
    role: null,
    accessibleName: null,
    geometry: { x: 0, y, width: 1200, height: 600, viewportCoveragePercent: coveragePercent },
    visibility: { display: "block", visibility: "visible", opacity: 1, intersectsViewport: true },
    landmark: "main",
    headingLevel: null,
  };
}

function snapshot(elements: ElementSnapshot[]): PageSnapshot {
  return {
    schemaVersion: 1,
    route,
    capturedAt: "2026-08-20T00:00:00.000Z",
    viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 },
    readiness: { documentReadyState: "complete", ariaBusy: false, skeletonCandidateCount: 0, majorNodeCount: 50 },
    elements,
    contentHierarchy: [],
    interactionSummary: { buttonCount: 3, linkCount: 5, inputCount: 0, ctaCandidateCount: 3, navItemCount: 4 },
  };
}

const baseline = snapshot([grid(214, 100), ...Array.from({ length: 8 }, (_, i) => card(i, true))]);
const current = snapshot([grid(686, 30), ...Array.from({ length: 8 }, (_, i) => card(i, i < 2))]);

const diff = computeLocalDiff(baseline, current);

console.log(JSON.stringify(diff, null, 2));
