/**
 * Step-by-step progress from the analysis pipeline to the Side Panel.
 *
 * A Check Changes call is one request that can take tens of seconds, most of
 * it waiting on Gemini. Without this the panel can only show a spinner, and
 * the analysing screen would have to invent the step list it displays —
 * showing "[OK] LOCAL DIFF CALCULATED" without knowing whether that
 * happened is exactly the fabricated success CLAUDE.md 16 forbids.
 *
 * These are notifications, not requests: the service worker broadcasts and
 * nothing replies, so they deliberately use `kind` rather than the `action`
 * field the request/response map is keyed on. The worker's own onMessage
 * switch therefore ignores them.
 *
 * The order below is the real execution order, and it is also the product's
 * argument made visible: everything the code measures completes before
 * Gemini is asked to interpret any of it.
 */

export const ANALYSIS_STEPS = ["capture", "diff", "accessibility", "gemini", "validate"] as const;

export type AnalysisStep = (typeof ANALYSIS_STEPS)[number];

/** English by the label rule — these render as terminal-style log lines. */
export const ANALYSIS_STEP_LABELS: Record<AnalysisStep, string> = {
  capture: "CURRENT SCREEN CAPTURED",
  diff: "LOCAL DIFF CALCULATED",
  accessibility: "ACCESSIBILITY COMPARED",
  gemini: "GEMINI INTERPRETATION",
  validate: "RESPONSE VALIDATED",
};

export const ANALYSIS_PROGRESS_KIND = "ANALYSIS_PROGRESS" as const;

export type AnalysisProgressNotice = {
  kind: typeof ANALYSIS_PROGRESS_KIND;
  routeKey: string;
  step: AnalysisStep;
  status: "running" | "done";
};

export function isAnalysisProgressNotice(value: unknown): value is AnalysisProgressNotice {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === ANALYSIS_PROGRESS_KIND &&
    ANALYSIS_STEPS.includes((value as { step?: AnalysisStep }).step as AnalysisStep)
  );
}
