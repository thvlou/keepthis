import { ApiKeyInlineForm } from "./components/ApiKeyInlineForm";
import { ErrorBanner } from "./components/ErrorBanner";
import { PanelHeader } from "./components/PanelHeader";
import { ScreenShell } from "./components/ScreenShell";
import { StatusPanel } from "./components/StatusPanel";
import { AnalyzingScreen } from "./screens/AnalyzingScreen";
import { BaselineReadyScreen } from "./screens/BaselineReadyScreen";
import { BaselineSavedSheet } from "./screens/BaselineSavedSheet";
import { NoBaselineScreen } from "./screens/NoBaselineScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { LABELS, PROSE } from "./copy";
import { useAppController } from "./useAppController";

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export function App() {
  const { routeInfo, hasApiKey, rootError, screen, actions } = useAppController();

  return (
    <main style={{ padding: 14 }}>
      <PanelHeader routeLabel={routeInfo ? stripProtocol(routeInfo.routeKey) : null} />

      {!routeInfo && rootError && <ErrorBanner message={rootError} onRetry={actions.refreshActiveRoute} />}

      {((!routeInfo && !rootError) || (routeInfo && screen.kind === "loading")) && (
        <p className="kt-meta">{PROSE.loading}</p>
      )}

      {routeInfo && screen.kind === "no_baseline" && (
        <NoBaselineScreen
          routeInfo={routeInfo}
          hasApiKey={hasApiKey}
          onSetBaseline={actions.setAsBaseline}
          onApiKeyChanged={actions.refreshSettings}
        />
      )}

      {screen.kind === "baseline_saved" && (
        <BaselineSavedSheet baseline={screen.baseline} onDone={actions.finishBaselineSetup} />
      )}

      {screen.kind === "baseline_ready" && (
        <BaselineReadyScreen
          baseline={screen.baseline}
          onCheckChanges={actions.checkChanges}
          onRecaptureBaseline={actions.setAsBaseline}
        />
      )}

      {screen.kind === "analyzing" && <AnalyzingScreen label={screen.label} steps={screen.steps} />}

      {screen.kind === "results" && (
        <ResultsScreen
          baseline={screen.baseline}
          result={screen.result}
          ignoredIssueIds={screen.ignoredIssueIds}
          currentQuery={routeInfo?.query ?? null}
          onIgnore={actions.ignoreIssue}
          onAcceptCurrentState={actions.acceptCurrentState}
          onSaveGuardrails={actions.saveGuardrails}
          onAnalyzeAgain={actions.analyzeAgain}
        />
      )}

      {/* Figma "12 · Error States": the cause and the next actions share one screen. */}
      {screen.kind === "unavailable" && (
        <ScreenShell
          eyebrow={LABELS.sectionSystemRecovery}
          title={LABELS.titleUnavailable}
          subtitle={PROSE.unavailableSubtitle}
        >
          <StatusPanel title={LABELS.statusPageNotReady} message={screen.message} eyebrow="KEEPTHIS / BLOCKED" />
          <p className="kt-meta" style={{ marginTop: 12 }}>
            {screen.canAnalyzeVisibleOnly ? PROSE.pageNotReadyHint : PROSE.pageNotReadyBaselineHint}
          </p>
          <div style={{ marginTop: 44 }}>
            <button
              type="button"
              className="kt-btn kt-btn--primary kt-btn--wide"
              onClick={screen.canAnalyzeVisibleOnly ? actions.checkChanges : actions.setAsBaseline}
            >
              {LABELS.actionRetry}
            </button>
          </div>
          {screen.canAnalyzeVisibleOnly && (
            <div style={{ marginTop: "var(--kt-space-20)" }}>
              <button type="button" className="kt-btn kt-btn--wide" onClick={actions.analyzeVisibleOnly}>
                {LABELS.actionVisibleOnly}
              </button>
            </div>
          )}
          <p className="kt-meta" style={{ marginTop: 14, textAlign: "center" }}>
            {PROSE.baselineSafeOnFailure}
          </p>
        </ScreenShell>
      )}

      {screen.kind === "error" && (
        <ScreenShell
          eyebrow={LABELS.sectionSystemRecovery}
          title={LABELS.titleRequestFailed}
          subtitle={PROSE.errorSubtitle}
        >
          <ErrorBanner message={screen.message} onRetry={screen.retry} />
          <p className="kt-meta" style={{ marginTop: 12 }}>
            {PROSE.baselineSafeOnFailure}
          </p>
          {screen.code === "GEMINI_KEY_MISSING" && hasApiKey !== null && (
            <ApiKeyInlineForm hasApiKey={hasApiKey} onChanged={actions.refreshSettings} />
          )}
        </ScreenShell>
      )}
    </main>
  );
}
