/**
 * Figma "02 · Capturing" / "05 · Checking Intent" / "06 · Checking Summary".
 *
 * A terminal-style log driven by real ANALYSIS_PROGRESS broadcasts from the
 * pipeline — never a predicted sequence. A step only turns [OK] once the
 * service worker reported it finished, and the percentage counts completed
 * steps rather than animating on a timer. If the broadcasts stop arriving
 * (panel reopened mid-run, worker restarted) the log simply stops advancing,
 * which is the honest thing for it to do.
 *
 * The order is also the product's argument in visible form: every step the
 * code measures completes before Gemini is asked to interpret anything.
 */
import { ScreenShell } from "../components/ScreenShell";
import { ANALYSIS_STEPS, ANALYSIS_STEP_LABELS } from "../../shared/analysis-progress";
import { LABELS, PROSE } from "../copy";
import type { AnalysisStepState } from "../app-state";

const LINE: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--kt-size-label)",
  lineHeight: "20px",
  whiteSpace: "pre",
};

export function AnalyzingScreen({ label, steps }: { label: string; steps: AnalysisStepState[] }) {
  const byStep = new Map(steps.map((s) => [s.step, s.status]));
  const doneCount = steps.filter((s) => s.status === "done").length;
  const percent = Math.round((doneCount / ANALYSIS_STEPS.length) * 100);

  return (
    <ScreenShell
      eyebrow={LABELS.sectionAnalysis}
      title={LABELS.titleWorking}
      subtitle={PROSE.workingSubtitle}
    >
      <div style={{ background: "var(--kt-text-primary)", padding: 14 }}>
        <p style={{ ...LINE, color: "var(--kt-bg-surface)" }}>CHECK_CHANGES.LOG</p>

        <div style={{ height: 14, background: "var(--kt-border-strong)", margin: "12px 0" }}>
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              background: "var(--kt-status-success)",
              transition: "width 120ms linear",
            }}
          />
        </div>

        {ANALYSIS_STEPS.map((step) => {
          const status = byStep.get(step);
          const marker = status === "done" ? "[OK]" : status === "running" ? ">>  " : "[  ]";
          const color =
            status === "done"
              ? "var(--kt-status-success)"
              : status === "running"
                ? "var(--kt-bg-surface)"
                : "var(--kt-border-strong)";
          return (
            <p key={step} style={{ ...LINE, color }}>
              {marker} {ANALYSIS_STEP_LABELS[step]}
            </p>
          );
        })}

        <p style={{ ...LINE, color: "var(--kt-bg-surface)", textAlign: "right", marginTop: 10 }}>{percent}%</p>
      </div>

      <p className="kt-meta" style={{ marginTop: "var(--kt-space-16)" }}>
        {label}
      </p>
      <p className="kt-meta" style={{ marginTop: 8 }}>
        {PROSE.baselineSafeOnFailure}
      </p>
    </ScreenShell>
  );
}
