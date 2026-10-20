/**
 * First-screen impact statements.
 *
 * These are code-measured facts restated in terms of what the user can see
 * and reach, not AI interpretation, so they render identically in both
 * change_summary and intent_check modes.
 *
 * `compact` drops the supporting lines and keeps only the headlines. Used
 * where this list is secondary to something else on screen (issue cards):
 * the headline is the finding, the per-element lines are a drill-down that
 * "Measured changes" already provides in full. Collapsing the whole block
 * behind a toggle instead would bury it at the same depth as the raw diff,
 * losing the distinction between an interpreted fact and a measurement.
 */
import type { UxImpact } from "../../diff/summarize-impact";

export function UxImpactList({ impacts, compact = false }: { impacts: UxImpact[]; compact?: boolean }) {
  if (impacts.length === 0) return null;

  if (compact) {
    return (
      <ul style={{ paddingLeft: 16, margin: "4px 0 0" }}>
        {impacts.map((impact) => (
          <li key={impact.evidenceIds.join(",")} style={{ fontSize: "var(--kt-size-value)", marginBottom: 2 }}>
            {impact.headline}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
      {impacts.map((impact) => (
        <li key={impact.evidenceIds.join(",")} style={{ marginBottom: 10 }}>
          <p style={{ fontSize: "var(--kt-size-body)",  margin: 0 }}>{impact.headline}</p>
          <ul style={{ paddingLeft: 16, margin: "2px 0 0" }}>
            {impact.evidence.map((line, index) => (
              <li key={index} style={{ fontSize: "var(--kt-size-note)", color: "var(--kt-text-muted)" }}>
                {line}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
