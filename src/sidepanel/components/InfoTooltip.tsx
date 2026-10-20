/**
 * A small `[ ? ]` beside a section label that opens a short explanation
 * next to it.
 *
 * Exists so an explanation can be available without being permanently on
 * screen. The guardrail list carried two lines of standing help text, which
 * pushed the thing being explained further down every time the panel opened
 * — help that only matters once should not cost vertical space forever.
 *
 * Dismisses on a second click, on Escape, and on any pointer press outside
 * it: a popover that can only be closed by finding the same tiny button
 * again is worse than no popover.
 */

import { useEffect, useRef, useState } from "react";

export function InfoTooltip({ label, lines }: { label: string; lines: string[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} style={{ position: "relative", display: "inline-flex", flex: "0 0 auto" }}>
      <button
        type="button"
        className="kt-info-trigger"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((prev) => !prev)}
      >
        ?
      </button>

      {open && (
        <span role="note" className="kt-info-bubble">
          {lines.map((line) => (
            <span key={line} style={{ display: "block" }}>
              {line}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
