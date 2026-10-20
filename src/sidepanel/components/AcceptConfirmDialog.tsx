/**
 * Figma "11 · Accept Dialog" (Confirmation Dialog, node 10365:192).
 *
 * AC-05 requires the confirmation to state that the whole page state becomes
 * the new baseline, not just the issues shown. The Figma reinforces that
 * with a highlighted line for what does *not* change (guardrails), which is
 * the part users are most likely to assume wrongly.
 */
import { LABELS, PROSE } from "../copy";

export function AcceptConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="kt-card" style={{ marginTop: 12 }}>
      <div
        style={{
          background: "var(--kt-text-primary)",
          color: "var(--kt-bg-surface)",
          padding: "6px 14px",
          fontSize: "var(--kt-size-label)",
          lineHeight: "var(--kt-line-label)",
        }}
      >
        ACCEPT CURRENT STATE
      </div>
      <div style={{ padding: 14 }}>
        <p style={{ margin: 0, fontSize: "var(--kt-size-body)", lineHeight: "var(--kt-line-body)" }}>
          {PROSE.acceptDialogBody}
        </p>
        <p
          style={{
            margin: "12px 0 0",
            padding: "8px 10px",
            background: "var(--kt-state-focus)",
            border: "1px solid var(--kt-border-strong)",
            fontSize: "var(--kt-size-value)",
            lineHeight: "var(--kt-line-value)",
          }}
        >
          {PROSE.acceptDialogNote}
        </p>
        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button type="button" className="kt-btn" style={{ flex: 1 }} onClick={onCancel}>
            [ {LABELS.actionCancel} ]
          </button>
          <button type="button" className="kt-btn kt-btn--primary" style={{ flex: 1 }} onClick={onConfirm}>
            [ {LABELS.actionReplace} ]
          </button>
        </div>
      </div>
    </div>
  );
}
