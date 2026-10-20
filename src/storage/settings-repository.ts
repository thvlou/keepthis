/**
 * Settings storage: Gemini API key + model id (CLAUDE.md section 8.1, 8.6).
 *
 * The API key is never held anywhere but chrome.storage.local, read only by
 * the service worker's Gemini client. This file does not encrypt the key —
 * CLAUDE.md 8.6 is explicit that storage.local is plaintext and the product
 * must not claim otherwise.
 */

const API_KEY_STORAGE_KEY = "settings:geminiApiKey";
const MODEL_STORAGE_KEY = "settings:geminiModel";

/**
 * The one place the default model id is set (section 8.1: "상수로 박지 말고
 * 설정 한 곳에서 교체 가능하게 한다"). gemini-2.5-flash was deprecated for new
 * API keys (Google's error: "no longer available to new users"); Google's
 * own error message pointed at gemini-3.6-flash as the replacement.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

/**
 * Restricts chrome.storage.local to trusted contexts (service worker, side
 * panel) so injected content scripts cannot read the API key. Call once from
 * the service worker's onInstalled/onStartup handler.
 */
export async function restrictStorageToTrustedContexts(): Promise<void> {
  try {
    await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  } catch {
    // Chrome < 102 has no setAccessLevel; storage.local keeps its default access.
  }
}

export async function getApiKey(): Promise<string | null> {
  const stored = await chrome.storage.local.get(API_KEY_STORAGE_KEY);
  return (stored[API_KEY_STORAGE_KEY] as string | undefined) ?? null;
}

export async function setApiKey(apiKey: string): Promise<void> {
  await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: apiKey });
}

export async function deleteApiKey(): Promise<void> {
  await chrome.storage.local.remove(API_KEY_STORAGE_KEY);
}

/** Last 4 characters only — for display in the Settings screen (section 8.6). */
export function maskApiKey(apiKey: string): string {
  const lastFour = apiKey.slice(-4);
  return `••••${lastFour}`;
}

export async function getModel(): Promise<string> {
  const stored = await chrome.storage.local.get(MODEL_STORAGE_KEY);
  return (stored[MODEL_STORAGE_KEY] as string | undefined) ?? DEFAULT_GEMINI_MODEL;
}

export async function setModel(model: string): Promise<void> {
  await chrome.storage.local.set({ [MODEL_STORAGE_KEY]: model });
}
