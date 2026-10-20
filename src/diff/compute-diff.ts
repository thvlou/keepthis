/**
 * Hybrid Diff Engine (CLAUDE.md section 7): compares two PageSnapshots and
 * produces only objective, code-computed facts. No interpretation of
 * whether a change is good or bad happens here — that's Gemini's job,
 * against the user's guardrails (section 7.1).
 *
 * Known gap: fixed/sticky overlay occlusion (section 7.3) isn't computed
 * here because extract-snapshot.ts doesn't currently record an element's
 * CSS position (fixed/sticky/static). Adding it would mean extending the
 * snapshot contract (step 2/4), which is out of scope for this pass.
 */

import {
  countInFirstViewport,
  countOnPage,
  createContentItemPredicate,
  documentY,
  isInFirstViewport,
  isInteractive,
  type ViewportContext,
} from "./element-predicates";
import { confidenceForStrategy, describeElement, matchElements } from "./match-elements";
import { isSignificantPositionDelta, isSignificantSizeDelta, THRESHOLDS } from "./thresholds";
import type { ContentHierarchyEntry, ElementSnapshot, LocalDiff, LocalDiffChange, PageSnapshot, ReadinessSignals } from "../shared/types";

function makeEvidenceIdFactory() {
  let counter = 0;
  return () => `diff-${counter++}`;
}

function computeScopedCounts(
  baselineElements: ElementSnapshot[],
  currentElements: ElementSnapshot[],
  baselineViewport: ViewportContext,
  currentViewport: ViewportContext,
  nextEvidenceId: () => string,
): LocalDiffChange[] {
  const changes: LocalDiffChange[] = [];

  const baselineInteractive = countInFirstViewport(baselineElements, baselineViewport, isInteractive);
  const currentInteractive = countInFirstViewport(currentElements, currentViewport, isInteractive);
  if (baselineInteractive !== currentInteractive) {
    changes.push({
      evidenceId: nextEvidenceId(),
      kind: "interactive_count",
      scope: "first_viewport",
      before: baselineInteractive,
      current: currentInteractive,
      delta: currentInteractive - baselineInteractive,
    });
  }

  // Resolved per snapshot so a page without <main> still yields content
  // measurements instead of silently counting zero, and so containers,
  // headings and controls don't inflate a "content items" figure.
  const baselineIsContent = createContentItemPredicate(baselineElements);
  const currentIsContent = createContentItemPredicate(currentElements);

  const baselineMainVisible = countInFirstViewport(baselineElements, baselineViewport, baselineIsContent);
  const currentMainVisible = countInFirstViewport(currentElements, currentViewport, currentIsContent);
  if (baselineMainVisible !== currentMainVisible) {
    changes.push({
      evidenceId: nextEvidenceId(),
      kind: "visible_count",
      scope: "first_viewport",
      element: "main-content-elements",
      before: baselineMainVisible,
      current: currentMainVisible,
      delta: currentMainVisible - baselineMainVisible,
    });
  }

  // Whole-page count, not just above the fold: content deleted outright is
  // a different event from content pushed below the fold, and a guardrail
  // about what stays *on the page* needs evidence measured the same way
  // observe-baseline.ts phrased it.
  const baselineMainTotal = countOnPage(baselineElements, baselineIsContent);
  const currentMainTotal = countOnPage(currentElements, currentIsContent);
  if (baselineMainTotal !== currentMainTotal) {
    changes.push({
      evidenceId: nextEvidenceId(),
      kind: "visible_count",
      scope: "page",
      element: "main-content-elements",
      before: baselineMainTotal,
      current: currentMainTotal,
      delta: currentMainTotal - baselineMainTotal,
    });
  }

  return changes;
}

function computeOrderChange(
  baselineHierarchy: ContentHierarchyEntry[],
  currentHierarchy: ContentHierarchyEntry[],
  nextEvidenceId: () => string,
): LocalDiffChange | null {
  const baselineSeq = baselineHierarchy.map((e) => e.kind).join(",");
  const currentSeq = currentHierarchy.map((e) => e.kind).join(",");
  if (baselineSeq === currentSeq) return null;
  return {
    evidenceId: nextEvidenceId(),
    kind: "order",
    scope: "content_hierarchy",
    before: baselineSeq,
    current: currentSeq,
  };
}

function computeReadinessAnomaly(
  baselineReadiness: ReadinessSignals,
  currentReadiness: ReadinessSignals,
  nextEvidenceId: () => string,
): LocalDiffChange | null {
  if (baselineReadiness.majorNodeCount === 0) return null;
  const ratio = currentReadiness.majorNodeCount / baselineReadiness.majorNodeCount;
  if (ratio >= THRESHOLDS.majorNodeDropRatio) return null;
  return {
    evidenceId: nextEvidenceId(),
    kind: "readiness",
    before: baselineReadiness.majorNodeCount,
    current: currentReadiness.majorNodeCount,
    delta: currentReadiness.majorNodeCount - baselineReadiness.majorNodeCount,
  };
}

function occupiedSize(el: ElementSnapshot): { width: number; height: number } {
  return { width: Math.round(el.geometry.width), height: Math.round(el.geometry.height) };
}

export function computeLocalDiff(baseline: PageSnapshot, current: PageSnapshot): LocalDiff {
  const nextEvidenceId = makeEvidenceIdFactory();
  const comparable =
    baseline.viewport.width === current.viewport.width && baseline.viewport.height === current.viewport.height;

  const viewport = {
    baseline: { width: baseline.viewport.width, height: baseline.viewport.height },
    current: { width: current.viewport.width, height: current.viewport.height },
    comparable,
  };

  if (!comparable) {
    // Section 11.1: baseline/current viewport mismatch makes position and size
    // deltas unreliable, so element-level geometry diffing is skipped entirely.
    return {
      routeKey: current.route.routeKey,
      viewport,
      changes: [
        {
          evidenceId: nextEvidenceId(),
          kind: "viewport_mismatch",
          before: baseline.viewport,
          current: current.viewport,
        },
      ],
    };
  }

  const baselineViewport: ViewportContext = {
    height: baseline.viewport.height,
    scrollY: baseline.viewport.scrollY,
  };
  const currentViewport: ViewportContext = {
    height: current.viewport.height,
    scrollY: current.viewport.scrollY,
  };

  const changes: LocalDiffChange[] = [];
  const { matched, removed, added } = matchElements(baseline.elements, current.elements);

  /*
   * Added and removed blocks carry the space they occupy, not just their name.
   * Without it the model was told to weigh "how much must be reclaimed" against
   * "how big is the thing that was added" and had only the first number — so it
   * fell back to the one remedy that needs no arithmetic ("reduce the height"),
   * even where the block was far too large for shrinking to close the gap.
   */
  for (const el of removed) {
    changes.push({
      evidenceId: nextEvidenceId(),
      kind: "removed",
      element: describeElement(el),
      before: occupiedSize(el),
      matchConfidence: confidenceForStrategy(el.fingerprint.strategy),
    });
  }

  for (const el of added) {
    changes.push({
      evidenceId: nextEvidenceId(),
      kind: "added",
      element: describeElement(el),
      current: occupiedSize(el),
      matchConfidence: confidenceForStrategy(el.fingerprint.strategy),
    });
  }

  for (const { baseline: b, current: c, matchConfidence } of matched) {
    // Document coordinates, not viewport-relative: see element-predicates.ts.
    const baselineTop = documentY(b, baselineViewport);
    const currentTop = documentY(c, currentViewport);
    const dx = c.geometry.x - b.geometry.x;
    const dy = currentTop - baselineTop;
    if (
      isSignificantPositionDelta(dy, current.viewport.height) ||
      isSignificantPositionDelta(dx, current.viewport.width)
    ) {
      changes.push({
        evidenceId: nextEvidenceId(),
        kind: "position",
        element: describeElement(b),
        before: { x: b.geometry.x, y: baselineTop },
        current: { x: c.geometry.x, y: currentTop },
        delta: { x: dx, y: dy },
        matchConfidence,
      });
    }

    const areaBefore = b.geometry.width * b.geometry.height;
    const areaAfter = c.geometry.width * c.geometry.height;
    if (isSignificantSizeDelta(areaBefore, areaAfter)) {
      changes.push({
        evidenceId: nextEvidenceId(),
        kind: "size",
        element: describeElement(b),
        before: { width: b.geometry.width, height: b.geometry.height },
        current: { width: c.geometry.width, height: c.geometry.height },
        delta: { width: c.geometry.width - b.geometry.width, height: c.geometry.height - b.geometry.height },
        matchConfidence,
      });
    }

    // "Reachable without scrolling" must mean the same thing in both
    // snapshots, so this asks where each element sits with the page scrolled
    // to the top rather than trusting the capture-time visibility flag.
    const wasInFirstViewport = isInFirstViewport(b, baselineViewport);
    const isNowInFirstViewport = isInFirstViewport(c, currentViewport);
    if (wasInFirstViewport !== isNowInFirstViewport) {
      changes.push({
        evidenceId: nextEvidenceId(),
        kind: "fold_transition",
        element: describeElement(b),
        before: wasInFirstViewport,
        current: isNowInFirstViewport,
        matchConfidence,
      });
    }
  }

  changes.push(
    ...computeScopedCounts(baseline.elements, current.elements, baselineViewport, currentViewport, nextEvidenceId),
  );

  const orderChange = computeOrderChange(baseline.contentHierarchy, current.contentHierarchy, nextEvidenceId);
  if (orderChange) changes.push(orderChange);

  const readinessChange = computeReadinessAnomaly(baseline.readiness, current.readiness, nextEvidenceId);
  if (readinessChange) changes.push(readinessChange);

  return { routeKey: current.route.routeKey, viewport, changes };
}
