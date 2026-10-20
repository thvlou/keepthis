/**
 * REV-02/03 — one row of the Guardrail checklist (CLAUDE.md 6.1), with the
 * priority toggle exposed.
 *
 * The statement and its priority sit on one line rather than stacked: the
 * priority only means something in relation to the sentence it modifies, and
 * the stacked version made each row read as two separate controls.
 *
 * The statement is editable (FR-03 P0: "선택·수정·직접 추가 가능"), which
 * was missing until a data-driven page produced a candidate no amount of
 * checking or unchecking could fix — a heading assembled from the user's own
 * filter selection. Generalising the sentence has to be possible in place;
 * deleting the candidate and retyping it is not the same affordance.
 *
 * The checkbox deliberately sits outside the editable field rather than
 * sharing a <label> with it: a label wrapping both would toggle the checkbox
 * on every click into the text.
 */

import { useLayoutEffect, useRef } from "react";
import type { Guardrail, GuardrailPriority } from "../../shared/types";
import { formatGuardrailPriorityLabel } from "./guardrail-copy";

export function GuardrailChecklistItem({
  guardrail,
  onToggleEnabled,
  onChangePriority,
  onChangeStatement,
}: {
  guardrail: Guardrail;
  onToggleEnabled: (id: string) => void;
  onChangePriority: (id: string, priority: GuardrailPriority) => void;
  onChangeStatement: (id: string, statement: string) => void;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  // Last value that was safe to keep. An empty statement fails
  // guardrailSchema (statement.min(1)), so blurring an emptied field
  // restores this instead of letting the row reach save in a state the
  // repository would reject.
  const lastNonEmpty = useRef(guardrail.statement);

  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [guardrail.statement]);

  function handleBlur() {
    if (guardrail.statement.trim() === "") {
      onChangeStatement(guardrail.id, lastNonEmpty.current);
      return;
    }
    lastNonEmpty.current = guardrail.statement;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 0",
        borderBottom: "1px solid var(--kt-bg-control)",
      }}
    >
      <input
        type="checkbox"
        checked={guardrail.enabled}
        onChange={() => onToggleEnabled(guardrail.id)}
        aria-label={guardrail.statement}
        style={{ marginTop: 3, flex: "0 0 auto" }}
      />
      <textarea
        ref={fieldRef}
        className="kt-guardrail-statement"
        value={guardrail.statement}
        rows={1}
        onChange={(event) => onChangeStatement(guardrail.id, event.target.value)}
        onBlur={handleBlur}
        style={{ flex: "1 1 auto", minWidth: 0 }}
      />
      <select
        value={guardrail.priority}
        onChange={(event) => onChangePriority(guardrail.id, event.target.value as GuardrailPriority)}
        aria-label={`Priority — ${guardrail.statement}`}
        style={{ flex: "0 0 auto" }}
      >
        <option value="must">{formatGuardrailPriorityLabel("must")}</option>
        <option value="should">{formatGuardrailPriorityLabel("should")}</option>
      </select>
    </div>
  );
}
