/**
 * 9.7절: API 키가 없으면 별도 Settings 화면으로 보내지 않고 여기서 바로 입력받는다.
 * 키가 이미 있으면 접힌 한 줄로 축소한다.
 *
 * The data warning is not boilerplate — 8.6 requires it to be shown before
 * anything is sent, and it stays visible while the field is open rather than
 * behind a link, because that is the moment the decision is being made.
 */
import { useState } from "react";
import { LABELS, PROSE } from "../copy";
import { sendMessage } from "../send-message";

export function ApiKeyInlineForm({ hasApiKey, onChanged }: { hasApiKey: boolean; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(!hasApiKey);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "invalid" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    const apiKey = value.trim();
    if (!apiKey) return;
    setStatus("checking");
    setErrorMessage(null);
    const result = await sendMessage("SET_API_KEY", { apiKey });
    if (!result.ok) {
      setStatus("error");
      setErrorMessage(result.error.message);
      return;
    }
    if (!result.data.valid) {
      setStatus("invalid");
      return;
    }
    setStatus("idle");
    setValue("");
    setExpanded(false);
    onChanged();
  }

  if (!expanded) {
    return (
      <p className="kt-meta" style={{ marginTop: "var(--kt-space-16)" }}>
        {PROSE.apiKeyConfigured}{" "}
        <button type="button" className="kt-btn--text" onClick={() => setExpanded(true)}>
          {LABELS.actionChangeKey}
        </button>
      </p>
    );
  }

  return (
    <section style={{ marginTop: "var(--kt-space-20)" }}>
      <p className="kt-eyebrow">GEMINI API KEY</p>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="AIza..."
        style={{ width: "100%", marginTop: 8, boxSizing: "border-box" }}
      />
      <button
        type="button"
        className="kt-btn kt-btn--primary"
        onClick={handleSubmit}
        disabled={status === "checking" || value.trim() === ""}
        style={{ marginTop: 10, width: "100%" }}
      >
        [ {status === "checking" ? "CHECKING…" : "SAVE KEY"} ]
      </button>

      {status === "invalid" && (
        <p className="kt-meta" style={{ marginTop: 8, color: "#b00020" }}>
          {PROSE.apiKeyRejected}
        </p>
      )}
      {status === "error" && errorMessage && (
        <p className="kt-meta" style={{ marginTop: 8, color: "#b00020", overflowWrap: "anywhere" }}>
          {errorMessage}
        </p>
      )}

      <p className="kt-meta" style={{ marginTop: 10 }}>
        {PROSE.apiKeyDataWarning}
      </p>
    </section>
  );
}
