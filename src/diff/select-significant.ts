/**
 * Trims the LocalDiff down to the changes worth sending to Gemini
 * (CLAUDE.md 7.4: "Threshold는 오류 판정이 아니다. AI에 보낼 후보 변화의
 * 양을 줄이는 신호다 … viewport 대비 큰 이동·fold 이탈·Guardrail 관련 요소
 * 변화를 우선한다").
 *
 * Why this is needed: inserting a banner above the header shifts every
 * element in document flow, so a single edit can produce several hundred
 * position entries. Sending all of them made the request exceed the API
 * timeout, and burying the two or three decisive facts in that volume is
 * also the worst possible shape for the model.
 *
 * Only the AI payload is trimmed. The Side Panel keeps rendering the full
 * diff under "Measured changes", so nothing is hidden from the user.
 */

import type { LocalDiff, LocalDiffChange, LocalDiffChangeKind } from "../shared/types";

/** Kept whole: these either gate the analysis or carry the strongest signal. */
const ALWAYS_KEEP: ReadonlySet<LocalDiffChangeKind> = new Set([
  "viewport_mismatch",
  "readiness",
  "fold_transition",
  "visible_count",
  "interactive_count",
  "order",
  "overlay_occlusion",
]);

/** Budget for the remaining, high-volume kinds (position, size, added, removed). */
const REMAINDER_BUDGET = 40;

export type AnalysisDiffPayload = LocalDiff & {
  /** Present when changes were trimmed, so the model knows it sees a subset. */
  omittedChangeCount?: number;
};

function magnitude(change: LocalDiffChange): number {
  const delta = change.delta;
  if (delta && typeof delta === "object") {
    const record = delta as Record<string, unknown>;
    const values = ["x", "y", "width", "height"]
      .map((key) => record[key])
      .filter((value): value is number => typeof value === "number");
    if (values.length > 0) return Math.max(...values.map(Math.abs));
  }
  if (typeof delta === "number") return Math.abs(delta);
  return 0;
}

/**
 * Named elements outrank layout wrappers: a structural-path match is
 * usually the <li> around an <a> that is already in the list, and the
 * model can do nothing useful with an nth-of-type path.
 */
function rankRemainder(a: LocalDiffChange, b: LocalDiffChange): number {
  const namedFirst = (a.matchConfidence === "low" ? 1 : 0) - (b.matchConfidence === "low" ? 1 : 0);
  if (namedFirst !== 0) return namedFirst;
  return magnitude(b) - magnitude(a);
}

export function selectSignificantChanges(diff: LocalDiff): AnalysisDiffPayload {
  const kept: LocalDiffChange[] = [];
  const remainder: LocalDiffChange[] = [];

  for (const change of diff.changes) {
    if (ALWAYS_KEEP.has(change.kind)) kept.push(change);
    else remainder.push(change);
  }

  remainder.sort(rankRemainder);
  const selectedRemainder = remainder.slice(0, REMAINDER_BUDGET);
  const omitted = remainder.length - selectedRemainder.length;

  const payload: AnalysisDiffPayload = {
    ...diff,
    changes: [...kept, ...selectedRemainder],
  };
  if (omitted > 0) payload.omittedChangeCount = omitted;
  return payload;
}
