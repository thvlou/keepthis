/**
 * Session-scoped cache of the last Check Changes current-state capture, so
 * ANALYZE_AGAIN (D-01: "재수집하지 않는다") can resend the same screenshot
 * and diff to Gemini without a fresh capture.
 *
 * chrome.storage.session survives the service worker being idled and
 * restarted by Chrome (a plain in-memory variable would not), but clears
 * when the browser closes — the right lifetime for "this session's last
 * capture", unlike chrome.storage.local (Baseline, kept indefinitely).
 */

import type { CapturedScreenshot } from "./snapshot-orchestrator";
import type { LocalDiff } from "../shared/types";

const CACHE_KEY_PREFIX = "last-check-changes:";

export type CachedCheckChanges = {
  diff: LocalDiff;
  currentScreenshot: CapturedScreenshot;
};

function cacheKey(routeKey: string): string {
  return `${CACHE_KEY_PREFIX}${routeKey}`;
}

/** Never throws — a failed cache write just means a later ANALYZE_AGAIN falls back to ANALYSIS_CACHE_MISSING. */
export async function cacheLastCheckChanges(routeKey: string, data: CachedCheckChanges): Promise<void> {
  try {
    await chrome.storage.session.set({ [cacheKey(routeKey)]: data });
  } catch {
    // Best-effort — see doc comment above.
  }
}

export async function getLastCheckChanges(routeKey: string): Promise<CachedCheckChanges | null> {
  const key = cacheKey(routeKey);
  const stored = await chrome.storage.session.get(key);
  return (stored[key] as CachedCheckChanges | undefined) ?? null;
}
