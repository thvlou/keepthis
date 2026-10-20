/**
 * Figma "08 · Change Summary" metric table — METRIC / BEFORE / CURRENT /
 * DELTA.
 *
 * This replaces a prose list for change_summary mode, and it is a better fit
 * than prose for what that mode is: with no guardrail to interpret against,
 * every row is just a measurement, and a table makes them comparable at a
 * glance instead of asking the reader to parse four sentences. It also keeps
 * the mode honest — a table states values and cannot smuggle in a judgement,
 * which AC-02 forbids here.
 */
import { LABELS } from "../copy";

export type MetricRow = {
  metric: string;
  before: string;
  current: string;
  delta: string;
};

const CELL: React.CSSProperties = {
  fontSize: "var(--kt-size-label)",
  lineHeight: "var(--kt-line-label)",
  padding: "8px 6px",
  textAlign: "left",
  verticalAlign: "top",
};

export function MetricTable({ rows }: { rows: MetricRow[] }) {
  if (rows.length === 0) return null;

  return (
    <table
      className="kt-box"
      style={{ width: "100%", borderCollapse: "collapse", padding: 0, tableLayout: "fixed" }}
    >
      <thead>
        <tr style={{ borderBottom: "1px solid var(--kt-border-strong)" }}>
          <th style={{ ...CELL, color: "var(--kt-text-muted)", width: "40%" }}>{LABELS.metric}</th>
          <th style={{ ...CELL, color: "var(--kt-text-muted)" }}>{LABELS.before}</th>
          <th style={{ ...CELL, color: "var(--kt-text-muted)" }}>{LABELS.current}</th>
          <th style={{ ...CELL, color: "var(--kt-text-muted)" }}>{LABELS.delta}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.metric}>
            <td style={{ ...CELL, wordBreak: "break-word" }}>{row.metric}</td>
            <td style={CELL}>{row.before}</td>
            <td style={CELL}>{row.current}</td>
            <td style={CELL}>{row.delta}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
