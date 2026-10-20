/**
 * Turns the measured diff into the METRIC / BEFORE / CURRENT / DELTA rows the
 * change_summary table shows (Figma 08).
 *
 * Only changes with two comparable scalar values become rows — a table
 * column called BEFORE has to hold something a person can read next to
 * CURRENT. Everything else (added, removed, fold transitions) is already
 * covered by the impact statements and the full measured-changes list, so
 * forcing it into a table would produce empty cells rather than insight.
 */

import type { LocalDiff, LocalDiffChange } from "../shared/types";

export type MetricRow = {
  metric: string;
  before: string;
  current: string;
  delta: string;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function signed(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function metricName(change: LocalDiffChange): string | null {
  switch (change.kind) {
    case "visible_count":
      return change.scope === "page" ? "PAGE CONTENT" : "FIRST-SCREEN CONTENT";
    case "interactive_count":
      return "FIRST-SCREEN CONTROLS";
    case "readiness":
      return "RENDERED NODES";
    case "position":
      return change.element ? `${change.element} Y` : null;
    case "size":
      return change.element ? `${change.element} HEIGHT` : null;
    default:
      return null;
  }
}

/** Pulls the comparable scalar out of a change, or null if there isn't one. */
function scalars(change: LocalDiffChange): { before: number; current: number } | null {
  const before = asNumber(change.before);
  const current = asNumber(change.current);
  if (before !== null && current !== null) return { before, current };

  // position/size carry objects; the vertical axis is the one that matters
  // for fold behaviour, so that is the axis the table reports.
  const beforeY = asNumber((change.before as { y?: unknown } | undefined)?.y);
  const currentY = asNumber((change.current as { y?: unknown } | undefined)?.y);
  if (beforeY !== null && currentY !== null) return { before: beforeY, current: currentY };

  const beforeH = asNumber((change.before as { height?: unknown } | undefined)?.height);
  const currentH = asNumber((change.current as { height?: unknown } | undefined)?.height);
  if (beforeH !== null && currentH !== null) return { before: beforeH, current: currentH };

  return null;
}

const MAX_ROWS = 6;

export function buildMetricRows(diff: LocalDiff): MetricRow[] {
  const rows: MetricRow[] = [];

  for (const change of diff.changes) {
    const metric = metricName(change);
    if (!metric) continue;
    const values = scalars(change);
    if (!values || values.before === values.current) continue;

    const unit = change.kind === "position" || change.kind === "size" ? "PX" : "";
    rows.push({
      metric,
      before: `${Math.round(values.before)}${unit ? ` ${unit}` : ""}`,
      current: `${Math.round(values.current)}${unit ? ` ${unit}` : ""}`,
      delta: signed(values.current - values.before),
    });
    if (rows.length >= MAX_ROWS) break;
  }

  return rows;
}
