/**
 * Every guardrail that was in force for this check, with what came back
 * for it.
 *
 * Previously the results only listed violations (issue cards) and holds
 * (AiAnalysis.preserved). A guardrail the model simply didn't report on
 * appeared nowhere at all — observed in real use, where a guardrail about
 * first-screen control count went unmentioned even though the diff had
 * measured that count changing from 3 to 9. Silently dropping one of the
 * user's own stated conditions is a trust problem: they should be able to
 * see that all of them were considered, and notice when one wasn't.
 *
 * Status is derived in code, never asked of the model.
 */

import { COUNTS, LABELS } from "../copy";
import type { AiAnalysis, Guardrail } from "../../shared/types";

type Status = "violated" | "held" | "unreported";

function statusOf(guardrail: Guardrail, analysis: AiAnalysis): Status {
  if (analysis.issues.some((issue) => issue.guardrailId === guardrail.id)) return "violated";
  if (analysis.preserved.some((entry) => entry.guardrailId === guardrail.id)) return "held";
  return "unreported";
}

const MARKS: Record<Status, { icon: string; color: string; label: string }> = {
  violated: { icon: "⚠", color: "var(--kt-text-primary)", label: "Needs attention" },
  held: { icon: "✓", color: "var(--kt-status-success)", label: "Held" },
  unreported: { icon: "–", color: "var(--kt-text-muted)", label: "Not reported" },
};

export function GuardrailStatusList({
  guardrails,
  analysis,
}: {
  guardrails: Guardrail[];
  analysis: AiAnalysis;
}) {
  const active = guardrails.filter((g) => g.enabled);
  if (active.length === 0) return null;

  const unreported = active.filter((g) => statusOf(g, analysis) === "unreported").length;

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: "var(--kt-size-value)",  margin: 0 }}>{LABELS.guardrailsChecked}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0" }}>
        {active.map((guardrail) => {
          const mark = MARKS[statusOf(guardrail, analysis)];
          return (
            <li key={guardrail.id} style={{ fontSize: "var(--kt-size-value)", marginBottom: 2 }}>
              <span style={{ color: mark.color }} title={mark.label}>
                {mark.icon}
              </span>{" "}
              {guardrail.statement}
            </li>
          );
        })}
      </ul>
      {unreported > 0 && (
        <p style={{ fontSize: "var(--kt-size-note)", color: "var(--kt-text-muted)", margin: "4px 0 0" }}>
          {COUNTS.guardrailsUnreported(unreported)}
        </p>
      )}
    </div>
  );
}
