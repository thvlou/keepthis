import type { AnalysisStep } from "../shared/analysis-progress";
import type { AccessibilityComparison, AiAnalysis, BaselineRecord, ComparisonContext, Guardrail, LocalDiff } from "../shared/types";

export type AnalysisStepState = { step: AnalysisStep; status: "running" | "done" };

export type CheckResult = {
  diff: LocalDiff;
  analysis: AiAnalysis;
  accessibilityComparison: AccessibilityComparison;
  comparisonContext: ComparisonContext;
  /** True when produced by ANALYZE_VISIBLE_ONLY (section 11.2) — UI shows a "Limited analysis" note. */
  limited: boolean;
};

export type ScreenState =
  | { kind: "loading" }
  | { kind: "no_baseline" }
  | { kind: "baseline_saved"; baseline: BaselineRecord }
  | { kind: "baseline_ready"; baseline: BaselineRecord }
  /** `steps` is filled from real ANALYSIS_PROGRESS notices, never predicted. */
  | { kind: "analyzing"; label: string; steps: AnalysisStepState[] }
  | { kind: "results"; baseline: BaselineRecord; result: CheckResult; ignoredIssueIds: string[] }
  /**
   * Blocked before anything ran. `canAnalyzeVisibleOnly` is false when the
   * blocked action was capturing a baseline: analysing only what's visible
   * is a way to interpret a half-rendered page, not a way to store one as
   * the reference every later check is measured against.
   */
  | { kind: "unavailable"; message: string; canAnalyzeVisibleOnly: boolean }
  | { kind: "error"; code: string; message: string; retry?: () => void };

export function getBaselineFromScreen(screen: ScreenState | undefined): BaselineRecord | null {
  if (!screen) return null;
  switch (screen.kind) {
    case "baseline_saved":
    case "baseline_ready":
    case "results":
      return screen.baseline;
    default:
      return null;
  }
}

/** Returns a copy of `screen` with its baseline's guardrails replaced, or null if this screen kind has no baseline. */
export function withGuardrails(screen: ScreenState, guardrails: Guardrail[]): ScreenState | null {
  switch (screen.kind) {
    case "baseline_saved":
    case "baseline_ready":
      return { ...screen, baseline: { ...screen.baseline, guardrails } };
    case "results":
      return { ...screen, baseline: { ...screen.baseline, guardrails } };
    default:
      return null;
  }
}
