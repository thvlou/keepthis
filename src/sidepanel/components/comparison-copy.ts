/**
 * Pure copy-building helpers for REV-01 (comparison condition display).
 * Kept separate from the components so the string logic is testable without
 * a React rendering setup.
 *
 * The Figma renders this as three stacked label lines in a bordered box
 * rather than one run-on sentence, so buildComparisonStatusLines returns
 * them separately. Each answers a different question — which baseline, are
 * the two states comparable, and which mode produced the result — and
 * reading them stacked is what makes that separation visible.
 */

import type { ComparisonContext } from "../../shared/types";

function stripProtocol(routeKey: string): string {
  return routeKey.replace(/^https?:\/\//, "");
}

/** Only ever shown when queryChanged is false — see ComparisonHeader. */
export function buildComparisonStatusLine(context: ComparisonContext): string {
  const viewportPhrase = context.viewportComparable ? "viewport match" : "viewport mismatch";
  return `Since baseline · ${stripProtocol(context.routeKey)} · ${viewportPhrase} · same page state`;
}

export type ComparisonStatusLines = {
  /** Which baseline this is measured against. */
  baseline: string;
  /** Whether the two captures are comparable at all. */
  comparability: string;
  /** Which analysis mode produced the result. */
  mode: string;
};

export function buildComparisonStatusLines(context: ComparisonContext): ComparisonStatusLines {
  return {
    baseline: `SINCE BASELINE · ${stripProtocol(context.routeKey)}`,
    comparability: `${context.viewportComparable ? "VIEWPORT MATCH" : "VIEWPORT MISMATCH"} · SAME PAGE STATE`,
    mode: context.analysisMode === "intent_check" ? "INTENT CHECK" : "CHANGE SUMMARY",
  };
}

export function formatQueryForDisplay(query: string | null): string {
  return query ?? "(none)";
}
