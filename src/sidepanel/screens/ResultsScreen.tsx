/**
 * Figma "07 · Intent Results" and "08 · Change Summary".
 *
 * The two modes share a shell and diverge in the middle: intent_check leads
 * with issue cards, change_summary leads with a measurement table. Both end
 * with the guardrail roster, the demoted raw diff, and the footer Accept —
 * which stays out of the issue cards per D-02/AC-05 (confirmed 2026-08-22).
 */
import { useMemo, useState } from "react";
import { AcceptConfirmDialog } from "../components/AcceptConfirmDialog";
import { AccessibilityComparisonSection } from "../components/AccessibilityComparisonSection";
import { ChangeFactsDisclosure } from "../components/ChangeFactsDisclosure";
import { ComparisonHeader } from "../components/ComparisonHeader";
import { GuardrailEditorList } from "../components/GuardrailEditorList";
import { GuardrailStatusList } from "../components/GuardrailStatusList";
import { IssueCard } from "../components/IssueCard";
import { MetricTable } from "../components/MetricTable";
import { ScreenShell } from "../components/ScreenShell";
import { StatusPanel } from "../components/StatusPanel";
import { UxImpactList } from "../components/UxImpactList";
import { LABELS, PROSE } from "../copy";
import { buildMetricRows } from "../../diff/metric-rows";
import { observeGuardrailCandidates } from "../../diff/observe-baseline";
import { summarizeUxImpact } from "../../diff/summarize-impact";
import type { CheckResult } from "../app-state";
import type { IgnoreReason } from "../../shared/messages";
import type { BaselineRecord, Guardrail } from "../../shared/types";

export function ResultsScreen({
  baseline,
  result,
  ignoredIssueIds,
  currentQuery,
  onIgnore,
  onAcceptCurrentState,
  onSaveGuardrails,
  onAnalyzeAgain,
}: {
  baseline: BaselineRecord;
  result: CheckResult;
  ignoredIssueIds: string[];
  currentQuery: string | null;
  onIgnore: (issueId: string, reason: IgnoreReason) => void;
  onAcceptCurrentState: () => void;
  onSaveGuardrails: (guardrails: Guardrail[]) => Promise<boolean>;
  onAnalyzeAgain: () => void;
}) {
  const [showAccept, setShowAccept] = useState(false);
  const [editingGuardrails, setEditingGuardrails] = useState(false);
  const [draftGuardrails, setDraftGuardrails] = useState<Guardrail[]>(() =>
    baseline.guardrails.length > 0 ? baseline.guardrails : observeGuardrailCandidates(baseline.snapshot),
  );
  const [savingGuardrails, setSavingGuardrails] = useState(false);

  const { analysis, accessibilityComparison, comparisonContext, diff } = result;
  const hasEnabledGuardrails = baseline.guardrails.some((g) => g.enabled);
  const visibleIssues = analysis.issues.filter((issue) => !ignoredIssueIds.includes(issue.id));
  const isSummaryMode = comparisonContext.analysisMode === "change_summary";
  const insufficient = analysis.analysisStatus === "insufficient_evidence";

  const impacts = useMemo(() => summarizeUxImpact(diff), [diff]);
  const metricRows = useMemo(() => buildMetricRows(diff), [diff]);
  const uncoveredImpacts = useMemo(() => {
    const cited = new Set(visibleIssues.flatMap((issue) => issue.evidence.map((e) => e.evidenceId)));
    return impacts.filter((impact) => !impact.evidenceIds.some((id) => cited.has(id)));
  }, [impacts, visibleIssues]);

  async function handleSaveGuardrails() {
    setSavingGuardrails(true);
    const success = await onSaveGuardrails(draftGuardrails.filter((g) => g.enabled));
    setSavingGuardrails(false);
    if (success) setEditingGuardrails(false);
  }

  function cancelEditingGuardrails() {
    setDraftGuardrails(
      baseline.guardrails.length > 0 ? baseline.guardrails : observeGuardrailCandidates(baseline.snapshot),
    );
    setEditingGuardrails(false);
  }

  const eyebrow = isSummaryMode ? LABELS.sectionResultsSummary : LABELS.sectionResultsIntent;
  const title = insufficient
    ? LABELS.titleUnavailable
    : isSummaryMode
      ? LABELS.titleChangeSummary
      : visibleIssues.length > 0
        ? LABELS.titleIntentCheck
        : LABELS.titleNoConflict;
  const subtitle = insufficient
    ? PROSE.unavailableSubtitle
    : isSummaryMode
      ? PROSE.changeSummarySubtitle
      : visibleIssues.length > 0
        ? PROSE.intentCheckSubtitle
        : PROSE.noConflictSubtitle;

  /*
   * The verdict, before any detail. This screen is opened repeatedly during
   * an edit loop and the first question is always the same — did anything I
   * care about break? Previously that took reading down past the comparison
   * box and the accessibility section to find out.
   */
  const verdict = insufficient
    ? { title: "INCONCLUSIVE", message: analysis.summary }
    : isSummaryMode
      ? { title: `${metricRows.length} CHANGES`, message: PROSE.changeSummarySubtitle }
      : visibleIssues.length > 0
        ? {
            title: `${visibleIssues.length} ${visibleIssues.length === 1 ? "CONFLICT" : "CONFLICTS"}`,
            message: analysis.summary,
          }
        : { title: "NO CONFLICTS", message: PROSE.noConflictSubtitle };

  return (
    <ScreenShell eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <StatusPanel title={verdict.title} message={verdict.message} eyebrow="KEEPTHIS / RESULT" />

      {result.limited && (
        <p className="kt-meta" style={{ marginTop: 10, color: "var(--kt-text-primary)" }}>
          {PROSE.limitedAnalysis}
        </p>
      )}

      <ComparisonHeader
        context={comparisonContext}
        baselineQuery={baseline.route.query}
        currentQuery={currentQuery}
      />

      {insufficient ? (
        <div style={{ marginTop: "var(--kt-space-20)" }}>
          <p style={{ margin: 0, fontSize: "var(--kt-size-body)" }}>{analysis.summary}</p>
          <ul style={{ paddingLeft: 16, fontSize: "var(--kt-size-value)", marginTop: 8 }}>
            {analysis.insufficientEvidenceReasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : isSummaryMode ? (
        <div style={{ marginTop: "var(--kt-space-20)" }}>
          <p className="kt-meta" style={{ marginBottom: 12 }}>
            {PROSE.changeSummaryNotice}
          </p>

          {metricRows.length > 0 ? (
            <MetricTable rows={metricRows} />
          ) : (
            <p style={{ margin: 0, fontSize: "var(--kt-size-body)" }}>{analysis.summary}</p>
          )}

          {editingGuardrails ? (
            <div style={{ marginTop: "var(--kt-space-16)" }}>
              <GuardrailEditorList guardrails={draftGuardrails} onChange={setDraftGuardrails} />
              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="kt-btn kt-btn--primary"
                  onClick={handleSaveGuardrails}
                  disabled={savingGuardrails}
                >
                  [ {LABELS.actionSave.toUpperCase()} ]
                </button>
                <button type="button" className="kt-btn" onClick={cancelEditingGuardrails}>
                  [ {LABELS.actionCancel} ]
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: "var(--kt-space-16)" }}>
              <button
                type="button"
                className="kt-btn kt-btn--primary"
                style={{ width: "100%" }}
                onClick={hasEnabledGuardrails ? onAnalyzeAgain : () => setEditingGuardrails(true)}
              >
                {hasEnabledGuardrails ? LABELS.actionAnalyzeAgain : LABELS.actionAddGuardrails}
              </button>
              <p className="kt-meta" style={{ marginTop: 10 }}>
                {PROSE.fixNeedsGuardrail}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {visibleIssues.map((issue, index) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              guardrail={baseline.guardrails.find((g) => g.id === issue.guardrailId) ?? null}
              index={index + 1}
              total={visibleIssues.length}
              onIgnore={onIgnore}
            />
          ))}
          {visibleIssues.length === 0 && (
            <p style={{ marginTop: "var(--kt-space-20)", fontSize: "var(--kt-size-body)" }}>
              {analysis.summary}
            </p>
          )}
        </div>
      )}

      {uncoveredImpacts.length > 0 && !isSummaryMode && (
        <div style={{ marginTop: "var(--kt-space-22)" }}>
          <p className="kt-eyebrow">{LABELS.alsoChanged}</p>
          <UxImpactList impacts={uncoveredImpacts} compact={visibleIssues.length > 0} />
        </div>
      )}

      <GuardrailStatusList guardrails={baseline.guardrails} analysis={analysis} />

      {/*
        Reference material, in descending order of how often it is opened:
        the accessibility track (a separate question), then the raw diff.
      */}
      <AccessibilityComparisonSection comparison={accessibilityComparison} />

      <ChangeFactsDisclosure diff={diff} description={analysis.summary} />

      <footer style={{ marginTop: "var(--kt-space-22)" }}>
        {showAccept ? (
          <AcceptConfirmDialog
            onConfirm={() => {
              setShowAccept(false);
              onAcceptCurrentState();
            }}
            onCancel={() => setShowAccept(false)}
          />
        ) : (
          <button
            type="button"
            className="kt-btn"
            style={{ width: "100%" }}
            onClick={() => setShowAccept(true)}
          >
            [ ACCEPT CURRENT STATE ]
          </button>
        )}
      </footer>
    </ScreenShell>
  );
}
