import { useEffect, useState } from "react";
import { buildRouteInfo } from "../shared/route-key";
import type { MessageAction, MessagePayloadMap, MessageResponse } from "../shared/messages";

function sendMessage<A extends MessageAction>(
  action: A,
  payload: MessagePayloadMap[A]["request"],
): Promise<MessageResponse<A>> {
  return chrome.runtime.sendMessage({ action, payload });
}

export function App() {
  const [routeKey, setRouteKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    sendMessage("GET_ACTIVE_ROUTE", undefined).then((res) => {
      if (res.ok) {
        setRouteKey(buildRouteInfo(res.data.fullUrl).routeKey);
      } else {
        setErrorMessage(res.error.message);
      }
    });
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 16, fontSize: 14 }}>
      <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>KeepThis</h1>
      <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
        Edit with AI. Keep the UX you intended.
      </p>

      {errorMessage && (
        <p style={{ color: "#b00020", fontSize: 12 }}>{errorMessage}</p>
      )}

      {routeKey && (
        <section style={{ marginTop: 16 }}>
          <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Current route</p>
          <code style={{ fontSize: 12 }}>{routeKey}</code>
        </section>
      )}

      <button disabled style={{ marginTop: 16 }}>
        Set as Baseline
      </button>
    </main>
  );
}
