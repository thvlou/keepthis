import type { MessageAction, MessagePayloadMap, MessageResponse } from "../shared/messages";

/**
 * Wraps chrome.runtime.sendMessage so every caller can safely read `.ok`
 * without checking for undefined first. A raw sendMessage call resolves to
 * undefined (not a rejection) when no listener responds — e.g. a stale
 * service worker build that doesn't know this action yet — and reading
 * `.ok` on that crashes with an uncaught TypeError. This normalizes that
 * into a proper Result instead.
 */
export async function sendMessage<A extends MessageAction>(
  action: A,
  payload: MessagePayloadMap[A]["request"],
): Promise<MessageResponse<A>> {
  let response: unknown;
  try {
    response = await chrome.runtime.sendMessage({ action, payload });
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "BACKGROUND_UNREACHABLE",
        message: describeUnreachable(err),
      },
    };
  }

  if (!response || typeof response !== "object" || !("ok" in response)) {
    return {
      ok: false,
      error: {
        code: "BACKGROUND_UNREACHABLE",
        message:
          "No response from the extension's background process. Reload the extension in chrome://extensions and try again.",
      },
    };
  }

  return response as MessageResponse<A>;
}

function describeUnreachable(err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `Could not reach the extension's background process (${detail}). Reload the extension in chrome://extensions and try again.`;
}
