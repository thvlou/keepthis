/**
 * a11y spec section 5.1 — Check Changes Results screen accessibility
 * comparison. Shown regardless of analysisMode (intent_check/change_summary)
 * since this track is independent of Guardrails.
 *
 * No severity/confidence/Ignore/Accept/Fix here by design (spec section 5.1) —
 * this never shares a list with the Guardrail issue cards.
 *
 * Findings new since the baseline lead and are visible without expanding;
 * pre-existing ones collapse. The split is the point: "this page has a
 * contrast problem" is what any audit tool reports, while "this change
 * introduced three violations that were not here before" needs an approved
 * baseline to say at all, and burying it in a flat list with the former
 * threw away the only differentiated half. Resolved items skip the Learn
 * more link (nothing left to look up).
 */

import { AccessibilityFindingGroups } from "./AccessibilityFindingGroups";
import { Disclosure } from "./Disclosure";
import { LABELS } from "../copy";
import { hasAccessibilityChanges } from "../../diff/accessibility-diff";
import type { AccessibilityComparison } from "../../shared/types";
import { buildIntroducedHeadline, buildPreExistingSummaryLabel, buildResolvedLabel } from "./accessibility-copy";

export function AccessibilityComparisonSection({ comparison }: { comparison: AccessibilityComparison }) {
  if (!hasAccessibilityChanges(comparison)) return null;

  const { newlyIntroduced, resolved, stillPresent } = comparison;

  /*
   * One collapsed row for the whole track, not three stacked blocks.
   *
   * Accessibility answers a different question from the guardrails: axe-core
   * output never reaches Gemini and carries no severity, confidence or Fix
   * (5.1). Rendering it as a filled yellow block gave it the same visual
   * weight as the verdict while its content is English rule text, so it
   * competed with the finding the screen exists to deliver.
   *
   * The new-since-baseline count still leads the summary — that is the half
   * only an approved baseline can report, and a plain audit tool cannot —
   * and the warn tint keeps the row noticeable without expanding it.
   */
  const summary = [
    newlyIntroduced.length > 0 ? `${newlyIntroduced.length} NEW` : null,
    resolved.length > 0 ? `${resolved.length} RESOLVED` : null,
    stillPresent.length > 0 ? `${stillPresent.length} PRE-EXISTING` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Disclosure
      tone={newlyIntroduced.length > 0 ? "warn" : "muted"}
      summary={`${LABELS.accessibility} · ${summary}`}
    >
      {newlyIntroduced.length > 0 && (
        <div>
          <p className="kt-eyebrow" style={{ color: "var(--kt-text-primary)" }}>
            {buildIntroducedHeadline(newlyIntroduced.length)}
          </p>
          <AccessibilityFindingGroups findings={newlyIntroduced} />
        </div>
      )}

      {resolved.length > 0 && (
        <p className="kt-meta" style={{ marginTop: 12, color: "var(--kt-status-success)" }}>
          ✓ {buildResolvedLabel(resolved.length)}
        </p>
      )}

      {stillPresent.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="kt-eyebrow">{buildPreExistingSummaryLabel(stillPresent.length)}</p>
          <AccessibilityFindingGroups findings={stillPresent} muted />
        </div>
      )}
    </Disclosure>
  );
}
