/**
 * Generic error display. Never invents a message — always the AppError's own
 * text.
 *
 * API error bodies carry long unbroken URLs, which pushed the whole Side
 * Panel into horizontal scrolling. Breaking anywhere keeps the panel's own
 * layout intact regardless of what an upstream service sends back.
 */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: (() => void) | undefined }) {
  return (
    <section style={{ marginTop: 12, padding: 8, border: "1px solid var(--kt-border-ink)", background: "var(--kt-state-focus)" }}>
      <p
        style={{
          margin: 0,
          fontSize: "var(--kt-size-value)",
          color: "var(--kt-text-primary)",
          overflowWrap: "anywhere",
          whiteSpace: "pre-wrap",
        }}
      >
        {message}
      </p>
      {onRetry && (
        <button type="button" className="kt-btn" onClick={onRetry} style={{ marginTop: 10 }}>
          [ RETRY ]
        </button>
      )}
    </section>
  );
}
