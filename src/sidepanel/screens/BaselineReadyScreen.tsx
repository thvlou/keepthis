/**
 * Figma "04 · Baseline Ready" (node 10363:96).
 *
 * Status panel states the condition, metadata box states the facts, two
 * stacked buttons offer the only two things you can do from here.
 *
 * Deviation from the Figma, agreed 2026-08-22: the frame shows guardrails as
 * a bare count ("02 ENABLED"). A count alone leaves the user unable to check
 * *what* they committed to protect from the screen that exists to tell them
 * the baseline is ready. The count stays in the metadata row as drawn, and
 * the statements sit behind a disclosure directly under it.
 */
import { Disclosure } from "../components/Disclosure";
import { buildGuardrailListLabel } from "../components/accessibility-copy";
import { MetadataList } from "../components/MetadataList";
import { ScreenShell } from "../components/ScreenShell";
import { StatusPanel } from "../components/StatusPanel";
import { LABELS, PROSE } from "../copy";
import type { BaselineRecord } from "../../shared/types";

/** Figma renders counts zero-padded ("02 ENABLED"). */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * "TODAY · 14:32" in the Figma. Anything older gets a date, because
 * "yesterday" stops being useful once a baseline is a week old.
 */
function formatCaptured(iso: string): string {
  const captured = new Date(iso);
  if (Number.isNaN(captured.getTime())) return "—";

  const time = `${String(captured.getHours()).padStart(2, "0")}:${String(captured.getMinutes()).padStart(2, "0")}`;
  const today = new Date();
  const sameDay =
    captured.getFullYear() === today.getFullYear() &&
    captured.getMonth() === today.getMonth() &&
    captured.getDate() === today.getDate();

  if (sameDay) return `TODAY · ${time}`;
  return `${String(captured.getMonth() + 1).padStart(2, "0")}/${String(captured.getDate()).padStart(2, "0")} · ${time}`;
}

export function BaselineReadyScreen({
  baseline,
  onCheckChanges,
  onRecaptureBaseline,
}: {
  baseline: BaselineRecord;
  onCheckChanges: () => void;
  onRecaptureBaseline: () => void;
}) {
  const enabled = baseline.guardrails.filter((g) => g.enabled);
  const { width, height } = baseline.snapshot.viewport;

  return (
    <ScreenShell
      eyebrow={LABELS.sectionBaselineReady}
      title={LABELS.titleBaselineReady}
      subtitle={PROSE.baselineReadySubtitle}
    >
      <StatusPanel
        title={LABELS.titleBaselineReady}
        message={enabled.length > 0 ? PROSE.baselineReadyStatus : PROSE.baselineReadyStatusNoGuardrail}
      />

      <div style={{ marginTop: "var(--kt-space-22)" }}>
        <MetadataList
          rows={[
            { label: LABELS.metaRoute, value: baseline.route.routeKey.replace(/^https?:\/\//, "") },
            { label: LABELS.metaViewport, value: `${width} × ${height}` },
            { label: LABELS.metaGuardrails, value: `${pad(enabled.length)} ENABLED` },
            { label: LABELS.metaCaptured, value: formatCaptured(baseline.createdAt) },
          ]}
        />

        {enabled.length > 0 && (
          <Disclosure summary={buildGuardrailListLabel(enabled.length)}>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {enabled.map((guardrail) => (
                <li
                  key={guardrail.id}
                  style={{
                    fontSize: "var(--kt-size-value)",
                    lineHeight: "var(--kt-line-value)",
                    marginBottom: 6,
                  }}
                >
                  {guardrail.statement}
                  <span style={{ color: "var(--kt-text-muted)" }}>
                    {" · "}
                    {guardrail.priority === "must" ? LABELS.priorityMust : LABELS.priorityShould}
                  </span>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
      </div>

      <div style={{ marginTop: 44 }}>
        <button type="button" className="kt-btn kt-btn--primary kt-btn--wide" onClick={onCheckChanges}>
          {LABELS.actionCheckChanges}
        </button>
      </div>
      <div style={{ marginTop: "var(--kt-space-20)" }}>
        <button type="button" className="kt-btn kt-btn--wide" onClick={onRecaptureBaseline}>
          {LABELS.actionReplaceBaseline}
        </button>
        <p className="kt-meta" style={{ marginTop: 10, textAlign: "center" }}>
          {PROSE.recaptureHint}
        </p>
      </div>
    </ScreenShell>
  );
}
