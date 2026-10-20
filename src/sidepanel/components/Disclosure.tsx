/**
 * The one disclosure control in the panel.
 *
 * Three separate toggles had grown independently — accessibility
 * pre-existing findings, measured changes, the saved guardrail list — each
 * with its own wording, size and mix of Korean and English. Side by side
 * they read as three unrelated links rather than the same affordance, which
 * is what made them look bolted on.
 *
 * The summary is English uppercase like every other structural label: these
 * are scanned to decide whether to open something, not read as prose, and
 * the Latin caps survive DungGeunMo's bitmap grid at label size where Korean
 * would not.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { LABELS } from "../copy";

export function Disclosure({
  summary,
  children,
  tone = "muted",
}: {
  /** English uppercase, e.g. "5 MEASURED CHANGES". */
  summary: string;
  children: ReactNode;
  /** "warn" tints the row for findings that need attention. */
  tone?: "muted" | "warn";
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: "var(--kt-space-16)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "10px 12px",
          background: tone === "warn" ? "var(--kt-state-focus)" : "var(--kt-bg-surface)",
          border: `1px solid ${tone === "warn" ? "var(--kt-border-ink)" : "var(--kt-border-strong)"}`,
          borderRadius: 0,
          font: "inherit",
          fontSize: "var(--kt-size-label)",
          lineHeight: "var(--kt-line-label)",
          color: "var(--kt-text-primary)",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span>{summary}</span>
        <span aria-hidden style={{ color: "var(--kt-text-muted)" }}>
          {open ? `− ${LABELS.actionHide.toUpperCase()}` : `+ ${LABELS.actionView.toUpperCase()}`}
        </span>
      </button>

      {open && (
        <div
          style={{
            border: "1px solid var(--kt-border-strong)",
            borderTop: "none",
            padding: "12px",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
