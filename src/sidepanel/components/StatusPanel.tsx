/**
 * Figma "Status Panel" (node 10357:1320) — "Semantic status summary for
 * ready, loading, and error states."
 *
 * A yellow, heavily-bordered block that states where the user stands before
 * any detail follows. It replaces the loose sentences the panel used to open
 * with: "No guardrails — Check Changes will show objective changes only" was
 * a fact buried in body text, and the same fact in a status block reads as
 * the screen's headline condition instead.
 */
import type { ReactNode } from "react";

export function StatusPanel({
  title,
  message,
  eyebrow = "KEEPTHIS / STATUS",
  children,
}: {
  title: string;
  message: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--kt-state-focus)",
        border: "2px solid var(--kt-border-ink)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p className="kt-eyebrow">{eyebrow}</p>
      <p style={{ margin: 0, fontSize: 15, lineHeight: "21px" }}>{title}</p>
      <p
        style={{
          margin: 0,
          fontSize: "var(--kt-size-value)",
          lineHeight: "var(--kt-line-value)",
          wordBreak: "break-word",
        }}
      >
        {message}
      </p>
      {children}
    </section>
  );
}
