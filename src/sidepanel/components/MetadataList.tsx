/**
 * Figma "Baseline Metadata" (node 10363:111) — fixed 112px label column,
 * value fills the rest, 19px between rows.
 *
 * The Figma frame closes this box with a 6px green bar. It is omitted here:
 * a filled bar reads as progress, and on a static metadata panel there is no
 * progress to report — it would be decoration pretending to be data. The
 * green bar belongs on the analysing screen, where it tracks real steps.
 */
import type { ReactNode } from "react";

export type MetadataRow = {
  label: string;
  value: string;
};

export function MetadataList({ rows, children }: { rows: MetadataRow[]; children?: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--kt-border-strong)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 19,
      }}
    >
      {rows.map((row) => (
        <div key={row.label} style={{ display: "flex", alignItems: "flex-start" }}>
          <p
            style={{
              flex: "0 0 112px",
              margin: 0,
              fontSize: "var(--kt-size-label)",
              lineHeight: "var(--kt-line-label)",
              color: "var(--kt-text-muted)",
            }}
          >
            {row.label}
          </p>
          <p
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              margin: 0,
              fontSize: "var(--kt-size-value)",
              lineHeight: "15px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={row.value}
          >
            {row.value}
          </p>
        </div>
      ))}
      {children}
    </div>
  );
}
