/**
 * REV-03 / AC-REV-07: when both "must" and "should" guardrails are violated
 * and there are more than 3 issues, "must" violations must be surfaced first.
 * The Gemini prompt will carry this as an instruction (section 8.3 addendum,
 * to be added once gemini-client.ts exists in step 7), but an LLM's ordering
 * isn't a guarantee — this is the deterministic code-level safeguard on top
 * of it, applied to whatever issues Gemini returns before display.
 */

import type { AnalysisIssue, Guardrail } from "../shared/types";

function priorityRank(issue: AnalysisIssue, guardrailsById: Map<string, Guardrail>): number {
  if (!issue.guardrailId) return 1; // change_summary mode has no guardrail — neutral rank
  return guardrailsById.get(issue.guardrailId)?.priority === "must" ? 0 : 1;
}

export function prioritizeMustViolations(
  issues: AnalysisIssue[],
  guardrails: Guardrail[],
  maxIssues = 3,
): AnalysisIssue[] {
  const guardrailsById = new Map(guardrails.map((g) => [g.id, g]));
  return issues
    .map((issue, index) => ({ issue, index, rank: priorityRank(issue, guardrailsById) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, maxIssues)
    .map((entry) => entry.issue);
}
