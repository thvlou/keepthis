/**
 * Figma "Panel Header" (node 10357:1296) — the fixed shell every screen sits
 * under: a black brand bar over a context row showing the route being
 * compared.
 *
 * The route belongs here rather than in the body because it answers "what am
 * I looking at" for every screen state, including the ones with no results
 * to show.
 */
import { LABELS } from "../copy";

export function PanelHeader({ routeLabel }: { routeLabel: string | null }) {
  return (
    <header style={{ border: "1px solid var(--kt-border-ink)", marginBottom: 22 }}>
      <div
        style={{
          background: "var(--kt-text-primary)",
          color: "var(--kt-bg-surface)",
          height: 24,
          display: "flex",
          alignItems: "center",
          paddingLeft: 10,
          fontSize: "var(--kt-size-body)",
          lineHeight: "15px",
        }}
      >
        — {LABELS.appName}
      </div>
      <div
        style={{
          height: 28,
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          fontSize: "var(--kt-size-value)",
          lineHeight: "var(--kt-line-value)",
          color: "var(--kt-text-muted)",
          overflow: "hidden",
        }}
      >
        <span
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={routeLabel ?? undefined}
        >
          {routeLabel ?? "—"}
        </span>
      </div>
    </header>
  );
}
