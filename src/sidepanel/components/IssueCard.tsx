/**
 * Figma "Issue Card" (node 10358:1332) — a yellow title band carrying the
 * finding and its priority, then label/value rows for the reasoning.
 *
 * Actions are [ IGNORE ] [ FIX ] only. The Figma frame also drew an
 * [ ACCEPT ] here, but CLAUDE.md 3.2 (D-02) and AC-05 place Accept in the
 * results footer instead: it replaces the whole baseline, not just this
 * issue, and sitting inside a card reads as "accept this finding". Confirmed
 * with the designer 2026-08-22 — the card keeps two actions.
 */
import { useState } from "react";
import { FixDrawer } from "./FixDrawer";
import { IgnoreReasonPicker } from "./IgnoreReasonPicker";
import { COUNTS, LABELS } from "../copy";
import type { IgnoreReason } from "../../shared/messages";
import type { AnalysisIssue, Guardrail } from "../../shared/types";

export function IssueCard({
  issue,
  guardrail,
  index,
  total,
  onIgnore,
}: {
  issue: AnalysisIssue;
  guardrail: Guardrail | null;
  index: number;
  total: number;
  onIgnore: (issueId: string, reason: IgnoreReason) => void;
}) {
  const [showIgnorePicker, setShowIgnorePicker] = useState(false);
  const [showFix, setShowFix] = useState(false);

  return (
    <article className="kt-card" style={{ marginTop: "var(--kt-space-20)" }}>
      <div className="kt-band" style={{ minHeight: 52, gap: 10 }}>
        <p
          style={{
            margin: 0,
            fontSize: "var(--kt-size-card-title)",
            lineHeight: "var(--kt-line-card-title)",
            padding: "8px 0",
            wordBreak: "break-word",
          }}
        >
          {issue.title}
        </p>
        {guardrail && (
          <span className="kt-badge">
            {guardrail.priority === "must" ? LABELS.priorityMust : LABELS.priorityShould}
          </span>
        )}
      </div>

      <div style={{ padding: "6px var(--kt-body-pad) 10px" }}>
        {issue.guardrail && (
          <div className="kt-row" style={{ marginTop: 10 }}>
            <p className="kt-row-label">{LABELS.guardrail}</p>
            <p className="kt-row-value">{issue.guardrail}</p>
          </div>
        )}

        <div className="kt-row" style={{ marginTop: 10 }}>
          <p className="kt-row-label">{LABELS.evidence}</p>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            {issue.evidence.map((evidence) => (
              <p
                key={evidence.evidenceId}
                style={{
                  margin: 0,
                  fontSize: "var(--kt-size-value)",
                  lineHeight: "var(--kt-line-value)",
                  wordBreak: "break-word",
                }}
              >
                {evidence.statement}
                {evidence.delta ? ` (${evidence.delta})` : null}
              </p>
            ))}
          </div>
        </div>

        <p style={{ margin: "12px 0 0", fontSize: "var(--kt-size-body)", lineHeight: "var(--kt-line-body)" }}>
          {issue.whyItMatters}
        </p>

        {/*
          Confidence and its reason on one expandable row. The reason
          matters when someone doubts the finding, not on every read — two
          permanent lines for it competed with whyItMatters, which is the
          sentence the card exists to deliver.
        */}
        <details style={{ marginTop: 12 }}>
          <summary
            className="kt-meta"
            style={{ cursor: "pointer", listStyle: "none" }}
            title={issue.confidenceReason}
          >
            {LABELS.confidence} · {issue.confidence.toUpperCase()} · {LABELS.severity} ·{" "}
            {issue.severity.toUpperCase()}
          </summary>
          <p className="kt-meta" style={{ marginTop: 6 }}>
            {issue.confidenceReason}
          </p>
        </details>

        <div className="kt-divider" style={{ margin: "16px 0" }} />

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="kt-btn" onClick={() => setShowIgnorePicker((v) => !v)}>
            [ {LABELS.actionIgnore.toUpperCase()} ]
          </button>
          {issue.fixInstruction && (
            <button type="button" className="kt-btn kt-btn--primary" onClick={() => setShowFix((v) => !v)}>
              [ {LABELS.actionFix.toUpperCase()} ]
            </button>
          )}
        </div>

        {showIgnorePicker && (
          <IgnoreReasonPicker
            onConfirm={(reason) => {
              onIgnore(issue.id, reason);
              setShowIgnorePicker(false);
            }}
            onCancel={() => setShowIgnorePicker(false)}
          />
        )}

        {showFix && <FixDrawer initialPrompt={issue.fixInstruction} onClose={() => setShowFix(false)} />}

        <p className="kt-meta" style={{ marginTop: 14 }}>
          {COUNTS.issueCounter(index, total)}
        </p>
      </div>
    </article>
  );
}
