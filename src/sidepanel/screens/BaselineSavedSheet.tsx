/**
 * CLAUDE.md 6.1절 저장 직후 bottom sheet. Done은 추천/접근성 상태와 무관하게
 * 항상 눌러서 진행할 수 있다 (AC-A11Y-03, 6.1절 "Baseline 저장은 Guardrail
 * 작성 때문에 막히지 않는다").
 *
 * Guardrail candidates come from observe-baseline.ts, not from Gemini: they
 * are computed from the snapshot that was just captured, so they appear
 * instantly, cannot fail on a network error, and state something already
 * true of this page rather than asking the user to predict what a future
 * edit might break. See that file's header for the full rationale.
 */
import { useMemo, useState } from "react";
import { BaselineAccessibilityNotice } from "../components/BaselineAccessibilityNotice";
import { GuardrailEditorList } from "../components/GuardrailEditorList";
import { ScreenShell } from "../components/ScreenShell";
import { StatusPanel } from "../components/StatusPanel";
import { LABELS, PROSE } from "../copy";
import { observeGuardrailCandidates } from "../../diff/observe-baseline";
import type { BaselineRecord, Guardrail } from "../../shared/types";

export function BaselineSavedSheet({
  baseline,
  onDone,
}: {
  baseline: BaselineRecord;
  onDone: (guardrails: Guardrail[]) => Promise<void>;
}) {
  const initialGuardrails = useMemo(
    () => (baseline.guardrails.length > 0 ? baseline.guardrails : observeGuardrailCandidates(baseline.snapshot)),
    [baseline],
  );
  const [guardrails, setGuardrails] = useState<Guardrail[]>(initialGuardrails);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleDone() {
    setSaving(true);
    // Text typed into "Add your own" but never submitted still counts: losing
    // it on Done is silent data loss, and the user has no way to tell their
    // guardrail never made it until a later check comes back without it.
    const typed = draft.trim();
    const withDraft =
      typed && guardrails.filter((g) => g.enabled).length < 5
        ? [
            ...guardrails,
            {
              id: crypto.randomUUID(),
              statement: typed,
              priority: "must" as const,
              evidenceTypes: [],
              scope: "route" as const,
              enabled: true,
              source: "user_written" as const,
            },
          ]
        : guardrails;

    // Only what the user left checked becomes a guardrail — an unconfirmed
    // observation is a suggestion, not something they asked us to protect.
    await onDone(withDraft.filter((g) => g.enabled));
    setSaving(false);
  }

  return (
    <ScreenShell
      eyebrow={LABELS.sectionBaseline}
      title={LABELS.titleBaselineSaved}
      subtitle={guardrails.length > 0 ? PROSE.baselineSavedSubtitle : PROSE.baselineNoGuardrailPrompt}
    >
      <StatusPanel title={LABELS.titleBaselineSaved} message={PROSE.baselineSavedStatus} />

      <div style={{ marginTop: "var(--kt-space-16)" }}>
        <BaselineAccessibilityNotice findings={baseline.accessibilityFindings} />
      </div>

      <div style={{ marginTop: "var(--kt-space-20)" }}>
        <GuardrailEditorList guardrails={guardrails} onChange={setGuardrails} onDraftChange={setDraft} />
      </div>

      <div style={{ marginTop: 44 }}>
        <button
          type="button"
          className="kt-btn kt-btn--primary kt-btn--wide"
          onClick={handleDone}
          disabled={saving}
        >
          {LABELS.actionDone}
        </button>
      </div>
    </ScreenShell>
  );
}
