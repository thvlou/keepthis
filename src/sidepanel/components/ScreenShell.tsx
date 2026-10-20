/**
 * The title block every screen opens with, from the Figma body layout:
 *
 *   RESULTS / INTENT CHECK      <- eyebrow, tells you where you are
 *   CHANGES NEED ATTENTION      <- what happened
 *   의도와 충돌할 가능성이 …       <- what to do about it
 *   ────────────────────────    <- 2px rule, then the content
 *
 * The eyebrow/title/subtitle split is what the results screen was missing:
 * previously a single bold line carried all three jobs, so nothing told the
 * user which mode they were in or what was being asked of them.
 */
import type { ReactNode } from "react";

export function ScreenShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section>
      <p className="kt-eyebrow">{eyebrow}</p>
      <h1 className="kt-title">{title}</h1>
      {subtitle && <p className="kt-subtitle">{subtitle}</p>}
      <div className="kt-rule" />
      <div style={{ marginTop: "var(--kt-space-18)" }}>{children}</div>
    </section>
  );
}
