/**
 * Every panel state on one page, at the real 400px panel width.
 *
 * Exists because most of these states can't be produced on demand in the
 * browser — the loading state needs a page mid-render, the error states need
 * a failure, and reaching Results costs a Gemini call against a rate-limited
 * free tier. Reviewing the design shouldn't require reproducing the
 * conditions, and comparing all seven side by side is the only way to see
 * whether they actually read as one system.
 *
 * The screens render with fixture data, so this is a design surface, not a
 * functional one: buttons here do nothing. Anything that must be verified as
 * *behaviour* still has to be checked in the extension.
 */
import { AcceptConfirmDialog } from "../sidepanel/components/AcceptConfirmDialog";
import { ErrorBanner } from "../sidepanel/components/ErrorBanner";
import { FixDrawer } from "../sidepanel/components/FixDrawer";
import { IgnoreReasonPicker } from "../sidepanel/components/IgnoreReasonPicker";
import { PanelHeader } from "../sidepanel/components/PanelHeader";
import { StatusPanel } from "../sidepanel/components/StatusPanel";
import { AnalyzingScreen } from "../sidepanel/screens/AnalyzingScreen";
import { BaselineReadyScreen } from "../sidepanel/screens/BaselineReadyScreen";
import { BaselineSavedSheet } from "../sidepanel/screens/BaselineSavedSheet";
import { NoBaselineScreen } from "../sidepanel/screens/NoBaselineScreen";
import { ResultsScreen } from "../sidepanel/screens/ResultsScreen";
import { ScreenShell } from "../sidepanel/components/ScreenShell";
import { LABELS, PROSE } from "../sidepanel/copy";
import {
  accessibilityComparison,
  baseline,
  comparisonContext,
  diff,
  intentAnalysis,
  summaryAnalysis,
} from "./fixtures";
import type { ReactNode } from "react";

const noop = () => undefined;
const noopAsync = async () => true;

/** One 400px panel with its Figma frame name, matching the file's layout. */
function Frame({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section style={{ width: 400, flex: "0 0 auto" }}>
      <p
        style={{
          fontSize: 11,
          color: "#666",
          margin: "0 0 8px",
          fontFamily: "var(--kt-font)",
        }}
      >
        {name}
      </p>
      <div
        style={{
          border: "2px solid var(--kt-border-ink)",
          background: "var(--kt-bg-surface)",
          minHeight: 820,
        }}
      >
        <main style={{ padding: 14 }}>
          <PanelHeader routeLabel="localhost:4173/" />
          {children}
        </main>
      </div>
    </section>
  );
}

export function Preview() {
  return (
    <div style={{ padding: 32, background: "#f5f5f5", minHeight: "100vh" }}>
      <h1 style={{ fontFamily: "var(--kt-font)", fontSize: 22, margin: "0 0 4px" }}>
        KeepThis — UI PREVIEW
      </h1>
      <p style={{ fontFamily: "var(--kt-font)", fontSize: 11, color: "#666", margin: "0 0 24px" }}>
        고정 데이터로 그린 화면입니다. 버튼은 동작하지 않습니다.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "flex-start" }}>
        <Frame name="01 · No Baseline">
          <NoBaselineScreen
            routeInfo={baseline.route}
            hasApiKey
            onSetBaseline={noop}
            onApiKeyChanged={noop}
          />
        </Frame>

        <Frame name="02 · Capturing">
          <AnalyzingScreen
            label={PROSE.analyzingBaseline}
            steps={[{ step: "capture", status: "running" }]}
          />
        </Frame>

        <Frame name="03 · Baseline Saved">
          <BaselineSavedSheet baseline={baseline} onDone={async () => undefined} />
        </Frame>

        <Frame name="04 · Baseline Ready">
          <BaselineReadyScreen baseline={baseline} onCheckChanges={noop} onRecaptureBaseline={noop} />
        </Frame>

        <Frame name="05 · Checking Intent">
          <AnalyzingScreen
            label={PROSE.analyzingCompare}
            steps={[
              { step: "capture", status: "done" },
              { step: "diff", status: "done" },
              { step: "accessibility", status: "done" },
              { step: "gemini", status: "running" },
            ]}
          />
        </Frame>

        <Frame name="07 · Intent Results">
          <ResultsScreen
            baseline={baseline}
            result={{ diff, analysis: intentAnalysis, accessibilityComparison, comparisonContext, limited: false }}
            ignoredIssueIds={[]}
            currentQuery={null}
            onIgnore={noop}
            onAcceptCurrentState={noop}
            onSaveGuardrails={noopAsync}
            onAnalyzeAgain={noop}
          />
        </Frame>

        <Frame name="08 · Change Summary">
          <ResultsScreen
            baseline={{ ...baseline, guardrails: [] }}
            result={{
              diff,
              analysis: summaryAnalysis,
              accessibilityComparison,
              comparisonContext: { ...comparisonContext, analysisMode: "change_summary" },
              limited: false,
            }}
            ignoredIssueIds={[]}
            currentQuery={null}
            onIgnore={noop}
            onAcceptCurrentState={noop}
            onSaveGuardrails={noopAsync}
            onAnalyzeAgain={noop}
          />
        </Frame>

        <Frame name="09 · Ignore Dialog">
          <ScreenShell
            eyebrow={LABELS.sectionResultsIntent}
            title={LABELS.titleIntentCheck}
            subtitle={PROSE.intentCheckSubtitle}
          >
            <IgnoreReasonPicker onConfirm={noop} onCancel={noop} />
          </ScreenShell>
        </Frame>

        <Frame name="10 · Fix Prompt Editor">
          <ScreenShell
            eyebrow={LABELS.sectionResultsIntent}
            title={LABELS.titleIntentCheck}
            subtitle={PROSE.intentCheckSubtitle}
          >
            <FixDrawer initialPrompt={intentAnalysis.issues[0]?.fixInstruction ?? ""} onClose={noop} />
          </ScreenShell>
        </Frame>

        <Frame name="11 · Accept Dialog">
          <ScreenShell
            eyebrow={LABELS.sectionBaselineReplace}
            title={LABELS.titleBaselineReady}
            subtitle={PROSE.baselineReadySubtitle}
          >
            <AcceptConfirmDialog onConfirm={noop} onCancel={noop} />
          </ScreenShell>
        </Frame>

        <Frame name="12 · Blocked (check)">
          <ScreenShell
            eyebrow={LABELS.sectionSystemRecovery}
            title={LABELS.titleUnavailable}
            subtitle={PROSE.unavailableSubtitle}
          >
            <StatusPanel
              title={LABELS.statusPageNotReady}
              message="페이지가 아직 로딩 중이라고 알리고 있습니다. (aria-busy)"
              eyebrow="KEEPTHIS / BLOCKED"
            />
            <p className="kt-meta" style={{ marginTop: 12 }}>
              {PROSE.pageNotReadyHint}
            </p>
            <div style={{ marginTop: 44 }}>
              <button type="button" className="kt-btn kt-btn--primary kt-btn--wide">
                {LABELS.actionRetry}
              </button>
            </div>
            <div style={{ marginTop: "var(--kt-space-20)" }}>
              <button type="button" className="kt-btn kt-btn--wide">
                {LABELS.actionVisibleOnly}
              </button>
            </div>
            <p className="kt-meta" style={{ marginTop: 14, textAlign: "center" }}>
              {PROSE.baselineSafeOnFailure}
            </p>
          </ScreenShell>
        </Frame>

        {/* 기준을 잡는 중에 막힌 경우. 'Visible only'가 없는 것이 이 화면의 요점이다. */}
        <Frame name="13 · Blocked (baseline)">
          <ScreenShell
            eyebrow={LABELS.sectionSystemRecovery}
            title={LABELS.titleUnavailable}
            subtitle={PROSE.unavailableSubtitle}
          >
            <StatusPanel
              title={LABELS.statusPageNotReady}
              message="페이지가 아직 다 뜨지 않았습니다. (readyState)"
              eyebrow="KEEPTHIS / BLOCKED"
            />
            <p className="kt-meta" style={{ marginTop: 12 }}>
              {PROSE.pageNotReadyBaselineHint}
            </p>
            <div style={{ marginTop: 44 }}>
              <button type="button" className="kt-btn kt-btn--primary kt-btn--wide">
                {LABELS.actionRetry}
              </button>
            </div>
            <p className="kt-meta" style={{ marginTop: 14, textAlign: "center" }}>
              {PROSE.baselineSafeOnFailure}
            </p>
          </ScreenShell>
        </Frame>

        <Frame name="14 · Request Failed">
          <ScreenShell
            eyebrow={LABELS.sectionSystemRecovery}
            title={LABELS.titleRequestFailed}
            subtitle={PROSE.errorSubtitle}
          >
            <ErrorBanner message="Try again in about 26 seconds. (rate limit)" onRetry={noop} />
            <p className="kt-meta" style={{ marginTop: 12 }}>
              {PROSE.baselineSafeOnFailure}
            </p>
          </ScreenShell>
        </Frame>
      </div>
    </div>
  );
}
