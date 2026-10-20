/**
 * Figma "01 · No Baseline" — the entry screen.
 *
 * Status panel first (there is no baseline yet), then the route this would
 * apply to, then the single action. The API key form stays inline per the
 * 9.7 decision: sending a first-time user to a separate settings screen
 * before they can do anything is the depth this flow was meant to remove.
 */
import { ApiKeyInlineForm } from "../components/ApiKeyInlineForm";
import { MetadataList } from "../components/MetadataList";
import { ScreenShell } from "../components/ScreenShell";
import { StatusPanel } from "../components/StatusPanel";
import { LABELS, PROSE } from "../copy";
import type { RouteInfo } from "../../shared/types";

export function NoBaselineScreen({
  routeInfo,
  hasApiKey,
  onSetBaseline,
  onApiKeyChanged,
}: {
  routeInfo: RouteInfo;
  hasApiKey: boolean | null;
  onSetBaseline: () => void;
  onApiKeyChanged: () => void;
}) {
  return (
    <ScreenShell
      eyebrow={LABELS.sectionBaselineNone}
      title={LABELS.titleNoBaseline}
      subtitle={PROSE.noBaselineSubtitle}
    >
      <StatusPanel title={LABELS.titleNoBaseline} message={PROSE.noBaselineStatus} />

      <div style={{ marginTop: "var(--kt-space-22)" }}>
        <MetadataList rows={[{ label: LABELS.metaRoute, value: routeInfo.routeKey.replace(/^https?:\/\//, "") }]} />
      </div>

      <div style={{ marginTop: 44 }}>
        <button
          type="button"
          className="kt-btn kt-btn--primary kt-btn--wide"
          onClick={onSetBaseline}
          disabled={hasApiKey === false}
        >
          {LABELS.actionSetBaseline}
        </button>
      </div>

      {hasApiKey !== null && <ApiKeyInlineForm hasApiKey={hasApiKey} onChanged={onApiKeyChanged} />}
    </ScreenShell>
  );
}
