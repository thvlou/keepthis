/**
 * Shared by the Baseline-saved sheet and the Results "Add guardrails" editor.
 *
 * The cap counts *checked* guardrails, not rows: only checked ones are
 * saved, and counting rows meant three observed candidates filled the
 * budget and hid the "Add your own" field entirely — unchecking one didn't
 * free the slot either, so writing your own was impossible on any page
 * that produced three candidates.
 *
 * The placeholder carries a real example rather than an abstract
 * instruction: a guardrail has to be an observable relationship (CLAUDE.md
 * 6.1), and showing the shape teaches that faster than describing it.
 */
import { useState } from "react";
import { LABELS, PROSE } from "../copy";
import { GuardrailChecklistItem } from "./GuardrailChecklistItem";
import { InfoTooltip } from "./InfoTooltip";
import type { Guardrail, GuardrailPriority } from "../../shared/types";

const MAX_GUARDRAILS = 5;

const EXAMPLE_PLACEHOLDER = "예) 본문 목록이 필터보다 위에 있다";

export function GuardrailEditorList({
  guardrails,
  onChange,
  onDraftChange,
}: {
  guardrails: Guardrail[];
  onChange: (next: Guardrail[]) => void;
  /** Lets the parent commit text the user typed but never pressed Add on. */
  onDraftChange?: ((draft: string) => void) | undefined;
}) {
  const [draftStatement, setDraftStatement] = useState("");

  function updateDraft(value: string) {
    setDraftStatement(value);
    onDraftChange?.(value);
  }

  const enabledCount = guardrails.filter((g) => g.enabled).length;
  const atCapacity = enabledCount >= MAX_GUARDRAILS;

  function toggleEnabled(id: string) {
    onChange(
      guardrails.map((g) => {
        if (g.id !== id) return g;
        // Don't let a check push the saved set past the cap.
        if (!g.enabled && atCapacity) return g;
        return { ...g, enabled: !g.enabled };
      }),
    );
  }

  function changeStatement(id: string, statement: string) {
    onChange(guardrails.map((g) => (g.id === id ? { ...g, statement } : g)));
  }

  function changePriority(id: string, priority: GuardrailPriority) {
    onChange(guardrails.map((g) => (g.id === id ? { ...g, priority } : g)));
  }

  function addOwn() {
    const statement = draftStatement.trim();
    if (!statement || atCapacity) return;
    const next: Guardrail = {
      id: crypto.randomUUID(),
      statement,
      priority: "must",
      evidenceTypes: [],
      scope: "route",
      enabled: true,
      source: "user_written",
    };
    onChange([...guardrails, next]);
    updateDraft("");
  }

  return (
    <div>
      {/*
        The explanation moved into the tooltip, so the label carries the
        section on its own and is sized to do that.
      */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <p
          className="kt-eyebrow"
          style={{ fontSize: "var(--kt-size-card-title)", lineHeight: "var(--kt-line-card-title)" }}
        >
          {LABELS.sectionGuardrails}
        </p>
        <InfoTooltip
          label={LABELS.guardrailInfoTrigger}
          lines={[PROSE.guardrailWhatIsIt, PROSE.guardrailSectionHint]}
        />
      </div>

      {guardrails.map((guardrail) => (
        <GuardrailChecklistItem
          key={guardrail.id}
          guardrail={guardrail}
          onToggleEnabled={toggleEnabled}
          onChangePriority={changePriority}
          onChangeStatement={changeStatement}
        />
      ))}

      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={draftStatement}
            onChange={(e) => updateDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addOwn();
            }}
            placeholder={EXAMPLE_PLACEHOLDER}
            disabled={atCapacity}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            className="kt-btn kt-btn--compact"
            onClick={addOwn}
            disabled={atCapacity || draftStatement.trim() === ""}
          >
            [ {LABELS.actionAdd.toUpperCase()} ]
          </button>
        </div>

        {atCapacity ? (
          <p className="kt-meta" style={{ marginTop: 8 }}>
            {PROSE.guardrailCapReached}
          </p>
        ) : (
          <p className="kt-meta" style={{ marginTop: 8 }}>
            {PROSE.guardrailInputHint}
          </p>
        )}
      </div>
    </div>
  );
}
