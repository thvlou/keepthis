/**
 * Broadcasts pipeline progress to whatever Side Panel is listening.
 *
 * Fire-and-forget on purpose: the panel may be closed, and
 * chrome.runtime.sendMessage rejects when nothing receives. A progress
 * notice failing to deliver must never take down the analysis the user is
 * actually waiting on, so every failure is swallowed here rather than
 * bubbling into the orchestrator's result.
 */

import { ANALYSIS_PROGRESS_KIND, type AnalysisProgressNotice, type AnalysisStep } from "../shared/analysis-progress";

export function reportProgress(routeKey: string, step: AnalysisStep, status: "running" | "done"): void {
  const notice: AnalysisProgressNotice = { kind: ANALYSIS_PROGRESS_KIND, routeKey, step, status };
  try {
    void chrome.runtime.sendMessage(notice).catch(() => {
      // No listener (panel closed) — nothing to do.
    });
  } catch {
    // Messaging unavailable entirely; the analysis continues regardless.
  }
}
