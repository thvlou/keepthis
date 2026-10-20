/**
 * Figma "09 · Ignore Dialog".
 *
 * AC-04 fixes the three reasons and defaults to "Intentional change". The
 * closing line is load-bearing rather than reassurance copy: Ignore hides a
 * finding and nothing else, and users reasonably fear that dismissing
 * something silently re-approves the page (D-02 exists precisely because
 * Ignore and Accept are different acts).
 */
import { useState } from "react";
import { LABELS, PROSE } from "../copy";
import type { IgnoreReason } from "../../shared/messages";

const REASONS: Array<{ value: IgnoreReason; label: string }> = [
  { value: "intentional_change", label: PROSE.ignoreReasonIntentional },
  { value: "not_relevant", label: PROSE.ignoreReasonNotRelevant },
  { value: "incorrect_finding", label: PROSE.ignoreReasonIncorrect },
];

export function IgnoreReasonPicker({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: IgnoreReason) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<IgnoreReason>("intentional_change");

  return (
    <div className="kt-box" style={{ marginTop: 12 }}>
      <p className="kt-eyebrow">IGNORE</p>
      <p style={{ margin: "8px 0 10px", fontSize: "var(--kt-size-value)", lineHeight: "var(--kt-line-value)" }}>
        {PROSE.ignoreReasonTitle}
      </p>

      {REASONS.map((r) => (
        <label
          key={r.value}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--kt-size-value)",
            lineHeight: "20px",
          }}
        >
          <input
            type="radio"
            name="ignore-reason"
            checked={reason === r.value}
            onChange={() => setReason(r.value)}
          />
          {r.label}
        </label>
      ))}

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button type="button" className="kt-btn" style={{ flex: 1 }} onClick={onCancel}>
          [ {LABELS.actionCancel} ]
        </button>
        <button
          type="button"
          className="kt-btn kt-btn--primary"
          style={{ flex: 1 }}
          onClick={() => onConfirm(reason)}
        >
          [ {LABELS.actionIgnore.toUpperCase()} ]
        </button>
      </div>

      <p className="kt-meta" style={{ marginTop: 10 }}>
        {PROSE.ignoreKeepsBaseline}
      </p>
    </div>
  );
}
