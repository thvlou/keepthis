/**
 * Noise-filtering thresholds for the Local Diff Engine (CLAUDE.md section 7.4).
 * "Threshold는 오류 판정이 아니다. AI에 보낼 후보 변화의 양을 줄이는 신호다." —
 * these decide whether a raw geometry delta is worth surfacing as a change
 * candidate at all, not whether it's a regression. That judgment is Gemini's
 * (against the user's guardrails), not the diff engine's.
 */

export const THRESHOLDS = {
  /** Below this, a position shift is treated as layout jitter, not a candidate change. */
  minPositionDeltaPx: 24,
  /** ...or if the shift is at least this fraction of the relevant viewport dimension. */
  minPositionDeltaViewportFraction: 0.05,
  /** Minimum relative area change to count as a significant resize. */
  minSizeDeltaFraction: 0.15,
  /** current.majorNodeCount below this fraction of baseline's flags a possible missing-region anomaly. */
  majorNodeDropRatio: 0.5,
};

export function isSignificantPositionDelta(deltaPx: number, viewportDimension: number): boolean {
  if (viewportDimension <= 0) return Math.abs(deltaPx) >= THRESHOLDS.minPositionDeltaPx;
  return (
    Math.abs(deltaPx) >= THRESHOLDS.minPositionDeltaPx ||
    Math.abs(deltaPx) / viewportDimension >= THRESHOLDS.minPositionDeltaViewportFraction
  );
}

export function isSignificantSizeDelta(areaBefore: number, areaAfter: number): boolean {
  if (areaBefore === 0) return areaAfter > 0;
  return Math.abs(areaAfter - areaBefore) / areaBefore >= THRESHOLDS.minSizeDeltaFraction;
}
