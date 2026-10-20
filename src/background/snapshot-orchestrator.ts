/**
 * Orchestrates one atomic capture: sanitized DOM/layout snapshot (extracted
 * in-page via chrome.scripting.executeScript) + visible-tab screenshot.
 * CLAUDE.md section 15 step 4: "부분 실패 시 저장하지 않는다" — any failure
 * in either half returns a single failed Result and produces nothing partial
 * for the caller to persist.
 */

import { extractSnapshot } from "../content/extract-snapshot";
import { isAxeLoaded, runAccessibilityCheck } from "../content/run-accessibility-check";
import type { AppError, Result } from "../shared/messages";
import type { AccessibilityFinding, PageSnapshot, RouteInfo } from "../shared/types";

export type CapturedScreenshot = {
  mimeType: "image/jpeg";
  dataUrl: string;
  width: number;
  height: number;
};

export type CapturedState = {
  snapshot: PageSnapshot;
  screenshot: CapturedScreenshot;
  accessibilityFindings: AccessibilityFinding[];
};

async function runExtraction(tabId: number, route: RouteInfo): Promise<Result<PageSnapshot>> {
  let injectionResults: chrome.scripting.InjectionResult<PageSnapshot>[];
  try {
    injectionResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractSnapshot,
      args: [route],
    });
  } catch (err) {
    return {
      ok: false,
      error: { code: "CONTENT_SCRIPT_UNAVAILABLE", message: describeError(err) },
    };
  }

  const snapshot = injectionResults[0]?.result;
  if (!snapshot) {
    return {
      ok: false,
      error: { code: "CONTENT_SCRIPT_UNAVAILABLE", message: "Snapshot extraction returned no result." },
    };
  }
  return { ok: true, data: snapshot };
}

export function checkReadinessGate(snapshot: PageSnapshot): AppError | null {
  if (snapshot.readiness.documentReadyState !== "complete") {
    // User-facing prose, so Korean by the language rule — the technical
    // signal that produced it is named after the plain sentence.
    return { code: "PAGE_NOT_READY", message: "페이지가 아직 다 뜨지 않았습니다. (readyState)" };
  }
  if (snapshot.readiness.ariaBusy) {
    return { code: "PAGE_NOT_READY", message: "페이지가 아직 로딩 중이라고 알리고 있습니다. (aria-busy)" };
  }
  return null;
}

async function captureScreenshot(windowId: number): Promise<Result<CapturedScreenshot>> {
  let dataUrl: string;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 80 });
  } catch (err) {
    return { ok: false, error: { code: "SCREENSHOT_CAPTURE_FAILED", message: describeError(err) } };
  }

  try {
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    bitmap.close();
    return { ok: true, data: { mimeType: "image/jpeg", dataUrl, width, height } };
  } catch (err) {
    return { ok: false, error: { code: "SCREENSHOT_CAPTURE_FAILED", message: describeError(err) } };
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Loads axe-core into the page if it isn't already there. Checked first so a
 * second capture on the same still-open page (e.g. Baseline then an
 * immediate Check Changes) doesn't re-inject the ~500KB bundle.
 */
async function ensureAxeLoaded(tabId: number): Promise<void> {
  try {
    const [loadedCheck] = await chrome.scripting.executeScript({ target: { tabId }, func: isAxeLoaded });
    if (loadedCheck?.result) return;
  } catch {
    // Can't check — fall through and try to inject anyway.
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["axe.min.js"] });
  } catch {
    // File injection failed (e.g. unsupported page). runAccessibilityCheck
    // will find window.axe missing and return [] — Tier 1 spec A11Y-01/A11Y-05:
    // this must never block Baseline save or Check Changes.
  }
}

/**
 * Runs the Tier 1 accessibility check. Never throws and never blocks the
 * caller — a missing/broken axe-core resolves to an empty findings array
 * (A11Y-01, A11Y-05), the same function reused for both Baseline capture and
 * Check Changes (section 4: "동일한 실행 함수를 재사용").
 */
export async function captureAccessibilityFindings(tabId: number): Promise<AccessibilityFinding[]> {
  await ensureAxeLoaded(tabId);
  try {
    const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: runAccessibilityCheck });
    return result?.result ?? [];
  } catch {
    return [];
  }
}

/**
 * Captures the current DOM/layout snapshot, viewport screenshot, and
 * accessibility findings as one unit. Snapshot/screenshot are all-or-nothing
 * (ok:false, nothing for the caller to store, if either fails or the page
 * fails the readiness gate). Accessibility capture is deliberately NOT part
 * of that atomicity — per A11Y-01/A11Y-05 it degrades to an empty array
 * instead of failing the whole capture.
 */
export async function captureCurrentState(
  tabId: number,
  windowId: number,
  route: RouteInfo,
  options: { skipReadinessGate?: boolean } = {},
): Promise<Result<CapturedState>> {
  const snapshotResult = await runExtraction(tabId, route);
  if (!snapshotResult.ok) return snapshotResult;

  // FR-11 "Analyze visible elements only": the caller has already accepted
  // an incomplete/not-ready page and wants a best-effort capture anyway.
  if (!options.skipReadinessGate) {
    const readinessError = checkReadinessGate(snapshotResult.data);
    if (readinessError) return { ok: false, error: readinessError };
  }

  const screenshotResult = await captureScreenshot(windowId);
  if (!screenshotResult.ok) return screenshotResult;

  const accessibilityFindings = await captureAccessibilityFindings(tabId);

  return {
    ok: true,
    data: { snapshot: snapshotResult.data, screenshot: screenshotResult.data, accessibilityFindings },
  };
}
