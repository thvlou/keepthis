/**
 * Figma "10 · Fix Prompt Editor".
 *
 * 9.7: KeepThis cannot run a local CLI (D-03/12.3), so the loop ends at a
 * prompt the user pastes elsewhere. The copy deliberately names no tool —
 * people use different ones, and hard-coding "Claude Code" would read as
 * wrong to everyone else.
 *
 * The prompt itself stays English by the language rule: it is a payload for
 * a coding tool, sitting alongside code identifiers and CSS properties.
 */
import { useState } from "react";
import { LABELS, PROSE } from "../copy";

export function FixDrawer({ initialPrompt, onClose }: { initialPrompt: string; onClose: () => void }) {
  const [text, setText] = useState(initialPrompt);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <div className="kt-box" style={{ marginTop: 12 }}>
      <p className="kt-eyebrow">FIX PROMPT</p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCopied(false);
        }}
        rows={7}
        style={{ width: "100%", marginTop: 8, boxSizing: "border-box", lineHeight: "15px" }}
      />
      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
        <button type="button" className="kt-btn kt-btn--primary" style={{ flex: 1 }} onClick={handleCopy}>
          [ COPY ]
        </button>
        <button type="button" className="kt-btn" style={{ flex: 1 }} onClick={onClose}>
          [ {LABELS.actionClose.toUpperCase()} ]
        </button>
      </div>
      {copied && (
        <p className="kt-meta" style={{ marginTop: 10, color: "var(--kt-status-success)" }}>
          {PROSE.copiedNext}
        </p>
      )}
    </div>
  );
}
