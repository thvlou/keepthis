/**
 * Pure copy-building helpers for the accessibility UI (a11y spec section 5,
 * 5.1). Kept separate from the components so the summary-line logic is
 * testable without a React rendering setup.
 *
 * Wording stays factual about *when* a finding appeared ("since baseline")
 * and never attributes it to a prompt or an edit — CLAUDE.md 4.1 forbids
 * causal claims like "this prompt caused" / "the latest edit broke".
 */

import type { AccessibilityComparison } from "../../shared/types";

function issueWord(count: number): string {
  return count === 1 ? "issue" : "issues";
}

export function buildBaselineNoticeSummary(findingCount: number): string {
  return `${findingCount} accessibility ${issueWord(findingCount)} found`;
}

/*
 * Disclosure summaries are English uppercase: they sit on the same row as
 * VIEW/HIDE and are scanned, not read. See Disclosure.tsx.
 */
export function buildBaselineNoticeSummaryLabel(count: number): string {
  return `${count} ACCESSIBILITY ${count === 1 ? "ISSUE" : "ISSUES"}`;
}

export function buildPreExistingSummaryLabel(count: number): string {
  return `${count} PRE-EXISTING ${count === 1 ? "ISSUE" : "ISSUES"}`;
}

export function buildMeasuredChangesLabel(count: number): string {
  return `${count} MEASURED ${count === 1 ? "CHANGE" : "CHANGES"}`;
}

export function buildGuardrailListLabel(count: number): string {
  return `${count} ${count === 1 ? "GUARDRAIL" : "GUARDRAILS"}`;
}

/**
 * The headline for findings that did not exist at baseline — the only part
 * of this track that a point-in-time audit tool cannot report, so it leads
 * rather than sharing a flat list with pre-existing findings.
 */
export function buildIntroducedHeadline(count: number): string {
  return `${count} new accessibility ${issueWord(count)} since baseline`;
}

export function buildResolvedLabel(count: number): string {
  return `${count} accessibility ${issueWord(count)} resolved`;
}

/** Present in both snapshots: real, but the same thing any audit tool reports. */
export function buildPreExistingLabel(count: number): string {
  return `${count} pre-existing ${issueWord(count)}`;
}

export function buildComparisonSummaryLine(comparison: AccessibilityComparison): string {
  const parts: string[] = [];
  if (comparison.resolved.length > 0) parts.push(`${comparison.resolved.length} resolved`);
  if (comparison.stillPresent.length > 0) parts.push(`${comparison.stillPresent.length} still present`);
  if (comparison.newlyIntroduced.length > 0) parts.push(`${comparison.newlyIntroduced.length} new`);
  return parts.join(", ");
}
