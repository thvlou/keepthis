/**
 * Readiness signals used to gate capture (CLAUDE.md section 6, 11.1).
 * Kept as an independently testable pure function. extract-snapshot.ts
 * duplicates a small inline copy of this logic rather than importing it,
 * because chrome.scripting.executeScript({ func }) stringifies only the
 * injected function's own source — it cannot close over sibling module
 * functions when executed in the target page.
 */

import type { ReadinessSignals } from "../shared/types";

const SKELETON_SELECTOR =
  '[class*="skeleton" i], [class*="placeholder" i], [data-skeleton], [aria-busy="true"]';

export function computeReadiness(doc: Document): ReadinessSignals {
  const ariaBusy = doc.querySelector('[aria-busy="true"]') !== null;
  const skeletonCandidateCount = doc.querySelectorAll(SKELETON_SELECTOR).length;
  const majorNodeCount = doc.body ? doc.body.querySelectorAll("*").length : 0;

  return {
    documentReadyState: doc.readyState,
    ariaBusy,
    skeletonCandidateCount,
    majorNodeCount,
  };
}
