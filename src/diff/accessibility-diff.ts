/**
 * Tier 1 accessibility comparison (a11y spec section 3, A11Y-09).
 * Deliberately separate from compute-diff.ts — this is a distinct,
 * code-only comparison track that never reaches Gemini.
 *
 * Primarily matched by ruleId + elementFingerprint (the same identity scheme
 * Local Diff Engine uses for DOM/layout matching — see extract-snapshot.ts /
 * match-elements.ts), not by raw CSS selector. Matching on the selector
 * string alone broke in real usage: inserting an unrelated element earlier
 * in the DOM can shift a later element's CSS path (e.g. an nth-of-type
 * index), which made an unchanged violation double-count as both resolved
 * and newlyIntroduced even though nothing about that element changed.
 *
 * Each finding is also indexed under a secondary ruleId+targetSelector key
 * (see candidateKeys). Two reasons this exists rather than fingerprint alone:
 * 1. A Baseline saved before elementFingerprint existed has no fingerprint at
 *    all — getBaseline() reads chrome.storage.local with no migration or
 *    validation, so old data comes back exactly as it was written. Without
 *    a selector fallback, every finding in such a baseline would compare
 *    against a fresh (fingerprint-bearing) current scan as fully
 *    resolved+newlyIntroduced, even for violations that didn't change.
 * 2. It costs nothing for two normal, already-matching findings — the
 *    fingerprint key already matched, so the selector key is redundant.
 *
 * Known residual limitation: an element with no data-testid, no stable id,
 * and no role+accessible name (a plain text node) falls back to a
 * structural path fingerprint, which can still shift under a DOM insertion
 * at the same nesting level — those findings carry matchConfidence "low"
 * for exactly that reason. The selector-key fallback above also means two
 * *different* low-confidence elements that happen to land on the same
 * positional selector at different times could be mismatched — an accepted,
 * narrow tradeoff confined to that already-low-confidence tier. Not fully
 * solved for the 5-day MVP; a heavier visual/positional match would be
 * needed for that.
 */

import type { AccessibilityComparison, AccessibilityFinding, ElementFingerprint } from "../shared/types";

function isElementFingerprint(value: unknown): value is ElementFingerprint {
  return typeof value === "object" && value !== null && "strategy" in value;
}

function fingerprintKey(fingerprint: ElementFingerprint): string {
  switch (fingerprint.strategy) {
    case "testid":
      return `testid:${fingerprint.value}`;
    case "stable-id":
      return `stable-id:${fingerprint.value}`;
    case "role-name":
      return `role-name:${fingerprint.role}:${fingerprint.accessibleName}`;
    case "structural":
      return `structural:${fingerprint.path}:${fingerprint.textHash}`;
  }
}

function candidateKeys(finding: AccessibilityFinding): string[] {
  const keys = [`${finding.ruleId}::selector:${finding.targetSelector}`];
  if (isElementFingerprint(finding.elementFingerprint)) {
    keys.push(`${finding.ruleId}::${fingerprintKey(finding.elementFingerprint)}`);
  }
  return keys;
}

export function compareAccessibilityFindings(
  baselineFindings: AccessibilityFinding[],
  currentFindings: AccessibilityFinding[],
): AccessibilityComparison {
  const currentKeys = new Set(currentFindings.flatMap(candidateKeys));
  const baselineKeys = new Set(baselineFindings.flatMap(candidateKeys));

  const resolved: AccessibilityFinding[] = [];
  const stillPresent: AccessibilityFinding[] = [];
  const newlyIntroduced: AccessibilityFinding[] = [];

  for (const finding of baselineFindings) {
    const matches = candidateKeys(finding).some((key) => currentKeys.has(key));
    (matches ? stillPresent : resolved).push(finding);
  }
  for (const finding of currentFindings) {
    const matches = candidateKeys(finding).some((key) => baselineKeys.has(key));
    if (!matches) newlyIntroduced.push(finding);
  }

  return { resolved, stillPresent, newlyIntroduced };
}

export function hasAccessibilityChanges(comparison: AccessibilityComparison): boolean {
  return (
    comparison.resolved.length > 0 || comparison.stillPresent.length > 0 || comparison.newlyIntroduced.length > 0
  );
}
