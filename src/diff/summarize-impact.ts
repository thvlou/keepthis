/**
 * Turns raw LocalDiff changes into first-screen impact statements, ordered
 * by how much they affect what the user can actually see and reach.
 *
 * Why: the raw diff leads with pixel deltas ("shifted 57.5px"), which is a
 * fact, not something a person can act on. The code already knows the more
 * decision-relevant facts — something left the first screen, visible
 * content dropped, controls multiplied — and those belong at the top with
 * the pixel numbers demoted to supporting evidence underneath.
 *
 * This is measurement, not interpretation (CLAUDE.md 0.3). Every headline
 * here is a restatement of a Before/Current/Delta the diff engine computed.
 * Wording stays neutral and factual so it is valid in change_summary mode
 * too, where "regression" / "unintended" / "wrong" are forbidden (AC-02).
 */

import type { LocalDiff, LocalDiffChange } from "../shared/types";

export type UxImpact = {
  /** Leading, human-readable statement of what this means for the first screen. */
  headline: string;
  /** LocalDiffChange.evidenceId values backing the headline. */
  evidenceIds: string[];
  /** Supporting Before → Current lines shown under the headline. */
  evidence: string[];
};

/** Lower sorts first. Ordered by impact on what the user can see and reach. */
const IMPACT_RANK: Record<string, number> = {
  fold_out: 0,
  content_drop: 1,
  control_growth: 2,
  removed: 3,
  order: 4,
  fold_in: 5,
  content_gain: 6,
};

type Draft = UxImpact & { rank: number };

/** Evidence lines shown before collapsing the rest into a count. */
const MAX_EVIDENCE_LINES = 5;

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

/**
 * An element only counts as "named" when it was identified by a testid,
 * a stable id, or role+accessible name. A structural-path match (low
 * confidence) usually means a layout wrapper — e.g. the <li> around a
 * category <a> — which is a separate DOM node but not a separate thing
 * the user perceives. Counting both would double-report one visible item.
 */
function isNamed(change: LocalDiffChange): boolean {
  return change.matchConfidence !== "low";
}

/** describeElement() renders role-name as "role:name"; lead with the name. */
function readableElement(raw: string | undefined): string {
  if (!raw) return "element";
  const roleName = /^([a-z]+):(.+)$/.exec(raw);
  return roleName ? `${roleName[2]} (${roleName[1]})` : raw;
}

function capEvidence(lines: string[], unnamedCount: number): string[] {
  const shown = lines.slice(0, MAX_EVIDENCE_LINES);
  const hidden = lines.length - shown.length;
  const notes: string[] = [];
  if (hidden > 0) notes.push(`외 ${hidden}건`);
  if (unnamedCount > 0) {
    notes.push(`이름 없는 레이아웃 요소 ${unnamedCount}건은 생략했습니다`);
  }
  return [...shown, ...notes];
}

function positionDeltaY(change: LocalDiffChange): number | null {
  const delta = change.delta;
  if (delta && typeof delta === "object" && "y" in delta) {
    return asNumber((delta as { y: unknown }).y);
  }
  return null;
}

function summarizeFoldTransitions(changes: LocalDiffChange[]): Draft[] {
  const movedOut = changes.filter((c) => c.kind === "fold_transition" && c.before === true && c.current === false);
  const movedIn = changes.filter((c) => c.kind === "fold_transition" && c.before === false && c.current === true);
  const drafts: Draft[] = [];

  const summarize = (group: LocalDiffChange[], rank: number, verb: string, transition: string): Draft => {
    const named = group.filter(isNamed);
    const listed = named.length > 0 ? named : group;
    return {
      rank,
      headline:
        listed.length === 1
          ? `요소 1개가 ${verb}`
          : `요소 ${listed.length}개가 ${verb}`,
      evidenceIds: listed.map((c) => c.evidenceId),
      evidence: capEvidence(
        listed.map((c) => `${readableElement(c.element)}: ${transition}`),
        named.length > 0 ? group.length - named.length : 0,
      ),
    };
  };

  if (movedOut.length > 0) {
    drafts.push(summarize(movedOut, IMPACT_RANK.fold_out!, "스크롤 없이 보이지 않게 됐습니다", "첫 화면 안 → 첫 화면 밖"));
  }
  if (movedIn.length > 0) {
    drafts.push(summarize(movedIn, IMPACT_RANK.fold_in!, "이제 스크롤 없이 보입니다", "첫 화면 밖 → 첫 화면 안"));
  }

  return drafts;
}

function summarizeCountChange(change: LocalDiffChange, kind: "content" | "control"): Draft | null {
  const before = asNumber(change.before);
  const current = asNumber(change.current);
  if (before === null || current === null || before === current) return null;

  const dropped = current < before;
  if (kind === "content") {
    const wholePage = change.scope === "page";
    return {
      rank: dropped ? IMPACT_RANK.content_drop! : IMPACT_RANK.content_gain!,
      headline: wholePage
        ? dropped
          ? `페이지 콘텐츠가 ${before}개에서 ${current}개로 줄었습니다`
          : `페이지 콘텐츠가 ${before}개에서 ${current}개로 늘었습니다`
        : dropped
          ? `첫 화면 콘텐츠가 ${before}개에서 ${current}개로 줄었습니다`
          : `첫 화면 콘텐츠가 ${before}개에서 ${current}개로 늘었습니다`,
      evidenceIds: [change.evidenceId],
      evidence: [
        wholePage
          ? `페이지 전체 콘텐츠: ${before} → ${current}`
          : `스크롤 없이 보이는 콘텐츠: ${before} → ${current}`,
      ],
    };
  }

  return {
    rank: IMPACT_RANK.control_growth!,
    headline: dropped
      ? `첫 화면 컨트롤이 ${before}개에서 ${current}개로 줄었습니다`
      : `첫 화면 컨트롤이 ${before}개에서 ${current}개로 늘었습니다`,
    evidenceIds: [change.evidenceId],
    evidence: [`스크롤 없이 보이는 버튼·링크·입력: ${before} → ${current}`],
  };
}

function summarizeRemovals(changes: LocalDiffChange[]): Draft | null {
  const removed = changes.filter((c) => c.kind === "removed");
  if (removed.length === 0) return null;

  const named = removed.filter(isNamed);
  const unnamedCount = removed.length - named.length;
  // Headline counts named elements when there are any, so removing six
  // category links reads as "6 gone", not "13 gone" once their wrapper
  // <li>s are counted too.
  const listed = named.length > 0 ? named : removed;
  const count = listed.length;

  return {
    rank: IMPACT_RANK.removed!,
    headline: count === 1 ? "요소 1개가 페이지에서 사라졌습니다" : `요소 ${count}개가 페이지에서 사라졌습니다`,
    evidenceIds: listed.map((c) => c.evidenceId),
    evidence: capEvidence(
      listed.map((c) => `${readableElement(c.element)}: 있음 → 없음`),
      named.length > 0 ? unnamedCount : 0,
    ),
  };
}

/**
 * Position shifts only earn a headline when nothing more consequential
 * already explains them — a 472px shift that also pushed content out of
 * the first screen is better described by that fold transition.
 */
function summarizeLargestShift(changes: LocalDiffChange[]): Draft | null {
  let largest: { change: LocalDiffChange; dy: number } | null = null;
  for (const change of changes) {
    if (change.kind !== "position") continue;
    const dy = positionDeltaY(change);
    if (dy === null) continue;
    if (!largest || Math.abs(dy) > Math.abs(largest.dy)) largest = { change, dy };
  }
  if (!largest) return null;

  const direction = largest.dy > 0 ? "아래로" : "위로";
  const shifted = changes.filter((c) => c.kind === "position").length;
  return {
    rank: IMPACT_RANK.order! + 1,
    headline:
      shifted === 1
        ? `요소 1개가 ${direction} ${Math.round(Math.abs(largest.dy))}px 이동했습니다`
        : `요소 ${shifted}개가 이동했고, 가장 큰 이동은 ${direction} ${Math.round(Math.abs(largest.dy))}px입니다`,
    evidenceIds: [largest.change.evidenceId],
    evidence: [`${readableElement(largest.change.element)}: ${direction} ${Math.round(Math.abs(largest.dy))}px`],
  };
}

/**
 * Returns first-screen impact statements, most consequential first.
 * Empty when the diff holds nothing that changes what the user sees or
 * reaches — the caller then falls back to the plain change description.
 */
export function summarizeUxImpact(diff: LocalDiff): UxImpact[] {
  if (!diff.viewport.comparable) return [];

  const drafts: Draft[] = [...summarizeFoldTransitions(diff.changes)];

  for (const change of diff.changes) {
    if (change.kind === "visible_count") {
      const draft = summarizeCountChange(change, "content");
      if (draft) drafts.push(draft);
    } else if (change.kind === "interactive_count") {
      const draft = summarizeCountChange(change, "control");
      if (draft) drafts.push(draft);
    }
  }

  const removals = summarizeRemovals(diff.changes);
  if (removals) drafts.push(removals);

  if (diff.changes.some((c) => c.kind === "order")) {
    const orderChange = diff.changes.find((c) => c.kind === "order")!;
    drafts.push({
      rank: IMPACT_RANK.order!,
      headline: "페이지 섹션 순서가 바뀌었습니다",
      evidenceIds: [orderChange.evidenceId],
      evidence: ["기준과 섹션 순서가 다릅니다"],
    });
  }

  // Only surface a bare position shift when nothing above already covers it.
  if (drafts.length === 0) {
    const shift = summarizeLargestShift(diff.changes);
    if (shift) drafts.push(shift);
  }

  return drafts.sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...impact }) => impact);
}
