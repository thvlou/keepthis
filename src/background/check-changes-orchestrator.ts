/**
 * Composes the Check Changes business flow: load the stored baseline,
 * capture the current state (reusing the atomic pipeline from
 * snapshot-orchestrator.ts), diff both DOM/layout and accessibility, and
 * interpret the result with Gemini.
 *
 * snapshot-orchestrator.ts stays scoped to "capture one atomic state"
 * (step 4's devlog entry). This file is the higher-level flow that composes
 * it with storage, the Local Diff Engine, the accessibility comparison, and
 * gemini-client — kept separate so each stays independently testable.
 */

import { reportProgress } from "./report-progress";
import { cacheLastCheckChanges, getLastCheckChanges } from "./analysis-cache";
import { analyzeChanges } from "./gemini-client";
import { captureCurrentState } from "./snapshot-orchestrator";
import { compareAccessibilityFindings } from "../diff/accessibility-diff";
import { computeLocalDiff } from "../diff/compute-diff";
import { buildComparisonContext } from "../shared/comparison-context";
import { getBaseline } from "../storage/baseline-repository";
import type { Result } from "../shared/messages";
import type { CapturedState } from "./snapshot-orchestrator";
import type {
  AccessibilityComparison,
  AiAnalysis,
  AnalysisMode,
  BaselineRecord,
  ComparisonContext,
  Guardrail,
  LocalDiff,
  RouteInfo,
} from "../shared/types";

export type CheckChangesResult = {
  diff: LocalDiff;
  analysis: AiAnalysis;
  accessibilityComparison: AccessibilityComparison;
  comparisonContext: ComparisonContext;
};

/** D-01: enabled guardrail count decides the mode (AC-01: disabling all of them flips it back). */
export function computeAnalysisMode(guardrails: Guardrail[]): AnalysisMode {
  return guardrails.some((g) => g.enabled) ? "intent_check" : "change_summary";
}

/** Shared by runCheckChanges and runAnalyzeVisibleOnly — they differ only in how the capture happens. */
async function assembleAndAnalyze(
  route: RouteInfo,
  baseline: BaselineRecord,
  capture: CapturedState,
): Promise<Result<CheckChangesResult>> {
  const { snapshot: currentSnapshot, screenshot: currentScreenshot, accessibilityFindings } = capture;

  reportProgress(route.routeKey, "diff", "running");
  const diff = computeLocalDiff(baseline.snapshot, currentSnapshot);
  reportProgress(route.routeKey, "diff", "done");

  reportProgress(route.routeKey, "accessibility", "running");
  const accessibilityComparison = compareAccessibilityFindings(baseline.accessibilityFindings, accessibilityFindings);
  reportProgress(route.routeKey, "accessibility", "done");

  const analysisMode = computeAnalysisMode(baseline.guardrails);
  const comparisonContext = buildComparisonContext(baseline.route, route, diff.viewport.comparable, analysisMode);

  // Everything the code can measure is finished before the model is asked
  // anything — the step order the panel shows is this, not a decoration.
  reportProgress(route.routeKey, "gemini", "running");
  const analysisResult = await analyzeChanges({
    analysisMode,
    guardrails: baseline.guardrails,
    diff,
    baselineScreenshot: baseline.screenshot,
    currentScreenshot,
  });
  if (!analysisResult.ok) return analysisResult;
  reportProgress(route.routeKey, "gemini", "done");

  // analyzeChanges only resolves ok once the response passed schema
  // validation (and any repair retry), so this is a real checkpoint.
  reportProgress(route.routeKey, "validate", "done");

  // Best-effort: lets a later ANALYZE_AGAIN reuse this capture (D-01).
  // Never blocks returning the result the user is waiting on.
  await cacheLastCheckChanges(route.routeKey, { diff, currentScreenshot });

  return {
    ok: true,
    data: { diff, analysis: analysisResult.data, accessibilityComparison, comparisonContext },
  };
}

export async function runCheckChanges(
  tabId: number,
  windowId: number,
  route: RouteInfo,
): Promise<Result<CheckChangesResult>> {
  const baseline = await getBaseline(route.routeKey);
  if (!baseline) {
    return { ok: false, error: { code: "NO_BASELINE", message: "No baseline exists for this route yet." } };
  }

  reportProgress(route.routeKey, "capture", "running");
  const captureResult = await captureCurrentState(tabId, windowId, route);
  if (!captureResult.ok) return captureResult;
  reportProgress(route.routeKey, "capture", "done");

  return assembleAndAnalyze(route, baseline, captureResult.data);
}

function capConfidenceToLow(analysis: AiAnalysis): AiAnalysis {
  return { ...analysis, issues: analysis.issues.map((issue) => ({ ...issue, confidence: "low" })) };
}

/**
 * FR-11 "Analyze visible elements only": the user chose to proceed on an
 * incomplete/not-ready page (section 11.2) instead of retrying. Captures
 * with the readiness gate skipped, then caps every issue's confidence to
 * "low" regardless of what Gemini returned — a code-level guarantee, not a
 * hope that the model complies. The caller labels the whole result "Limited
 * analysis" in the UI.
 */
export async function runAnalyzeVisibleOnly(
  tabId: number,
  windowId: number,
  route: RouteInfo,
): Promise<Result<CheckChangesResult>> {
  const baseline = await getBaseline(route.routeKey);
  if (!baseline) {
    return { ok: false, error: { code: "NO_BASELINE", message: "No baseline exists for this route yet." } };
  }

  reportProgress(route.routeKey, "capture", "running");
  const captureResult = await captureCurrentState(tabId, windowId, route, { skipReadinessGate: true });
  if (!captureResult.ok) return captureResult;
  reportProgress(route.routeKey, "capture", "done");

  const result = await assembleAndAnalyze(route, baseline, captureResult.data);
  if (!result.ok) return result;

  return { ok: true, data: { ...result.data, analysis: capConfidenceToLow(result.data.analysis) } };
}

/**
 * D-01 "Analyze again": re-interprets the last Check Changes capture with
 * the route's current (possibly just-edited) guardrails, without
 * recapturing the page. Fails with ANALYSIS_CACHE_MISSING if there's no
 * cached capture to reuse — the caller should fall back to a fresh
 * Check Changes in that case.
 */
export async function runAnalyzeAgain(route: RouteInfo): Promise<Result<{ analysis: AiAnalysis }>> {
  const baseline = await getBaseline(route.routeKey);
  if (!baseline) {
    return { ok: false, error: { code: "NO_BASELINE", message: "No baseline exists for this route yet." } };
  }

  const cached = await getLastCheckChanges(route.routeKey);
  if (!cached) {
    return {
      ok: false,
      error: {
        code: "ANALYSIS_CACHE_MISSING",
        message: "No prior Check Changes capture is cached for this route. Run Check Changes again.",
      },
    };
  }

  const analysisMode = computeAnalysisMode(baseline.guardrails);
  const analysisResult = await analyzeChanges({
    analysisMode,
    guardrails: baseline.guardrails,
    diff: cached.diff,
    baselineScreenshot: baseline.screenshot,
    currentScreenshot: cached.currentScreenshot,
  });
  if (!analysisResult.ok) return analysisResult;

  return { ok: true, data: { analysis: analysisResult.data } };
}
