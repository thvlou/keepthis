/**
 * MV3 service worker. Dispatches every MessageAction to a small handler that
 * calls into the already-tested modules (snapshot-orchestrator, storage
 * repositories, check-changes-orchestrator, gemini-client) — business logic
 * lives there, not here.
 */

import { runAnalyzeAgain, runAnalyzeVisibleOnly, runCheckChanges } from "./check-changes-orchestrator";
import { recommendGuardrails, validateApiKey } from "./gemini-client";
import { captureCurrentState } from "./snapshot-orchestrator";
import { buildRouteInfo, isSupportedRoute } from "../shared/route-key";
import { getBaseline, saveBaseline, saveGuardrails } from "../storage/baseline-repository";
import { deleteApiKey, getApiKey, getModel, setApiKey } from "../storage/settings-repository";
import type { AnyMessageRequest, MessageAction, MessageResponse, Result } from "../shared/messages";
import type { BaselineRecord, RouteInfo } from "../shared/types";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // No toolbar action surface in this Chrome version; side panel can still
    // be opened from the extensions menu.
  });
});

type ActiveTabContext = { tabId: number; windowId: number; route: RouteInfo };

/**
 * The manifest grants `<all_urls>` (a Chrome platform requirement for side
 * panel + captureVisibleTab — see the day4 devlog), which is broader than
 * section 1's stated scope. isSupportedRoute() re-enforces that scope in
 * code, so the extension still only ever acts on localhost/127.0.0.1 pages
 * regardless of what the manifest technically permits.
 */
async function getActiveTabContext(): Promise<Result<ActiveTabContext>> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.windowId === undefined || !tab.url) {
    return { ok: false, error: { code: "UNSUPPORTED_PAGE", message: "No active tab available." } };
  }
  if (!isSupportedRoute(tab.url)) {
    return {
      ok: false,
      error: { code: "UNSUPPORTED_PAGE", message: "KeepThis only works on http://localhost or http://127.0.0.1 pages." },
    };
  }
  return { ok: true, data: { tabId: tab.id, windowId: tab.windowId, route: buildRouteInfo(tab.url) } };
}

async function handleGetActiveRoute(): Promise<MessageResponse<"GET_ACTIVE_ROUTE">> {
  const context = await getActiveTabContext();
  if (!context.ok) return context;
  return { ok: true, data: { fullUrl: context.data.route.fullUrl } };
}

async function handleGetBaseline(routeKey: string): Promise<MessageResponse<"GET_BASELINE">> {
  return { ok: true, data: await getBaseline(routeKey) };
}

/**
 * Set as Baseline flow — deliberately inline here rather than in its own
 * orchestrator file (unlike Check Changes): capture + save is a two-step
 * composition, not a multi-source assembly, so a dedicated file would just
 * be indirection. Guardrail recommendation is a separate, later
 * RECOMMEND_GUARDRAILS call so a failed suggestion never blocks this save
 * (section 6.1).
 */
async function handleSaveBaseline(): Promise<MessageResponse<"SAVE_BASELINE">> {
  const context = await getActiveTabContext();
  if (!context.ok) return context;
  const { tabId, windowId, route } = context.data;

  const captureResult = await captureCurrentState(tabId, windowId, route);
  if (!captureResult.ok) return captureResult;

  const baseline: BaselineRecord = {
    schemaVersion: 1,
    baselineId: crypto.randomUUID(),
    route,
    createdAt: new Date().toISOString(),
    screenshot: captureResult.data.screenshot,
    snapshot: captureResult.data.snapshot,
    guardrails: [],
    accessibilityFindings: captureResult.data.accessibilityFindings,
  };

  const saveResult = await saveBaseline(route.routeKey, baseline);
  if (!saveResult.ok) return saveResult;

  return { ok: true, data: baseline };
}

async function handleCheckChanges(): Promise<MessageResponse<"CHECK_CHANGES">> {
  const context = await getActiveTabContext();
  if (!context.ok) return context;
  const { tabId, windowId, route } = context.data;
  return runCheckChanges(tabId, windowId, route);
}

async function handleAnalyzeAgain(): Promise<MessageResponse<"ANALYZE_AGAIN">> {
  const context = await getActiveTabContext();
  if (!context.ok) return context;
  return runAnalyzeAgain(context.data.route);
}

async function handleAnalyzeVisibleOnly(): Promise<MessageResponse<"ANALYZE_VISIBLE_ONLY">> {
  const context = await getActiveTabContext();
  if (!context.ok) return context;
  const { tabId, windowId, route } = context.data;
  return runAnalyzeVisibleOnly(tabId, windowId, route);
}

/**
 * Ignoring a card is UI-only for now: it hides that issue in the Side
 * Panel's own state and never touches storage (AC-04 — baselineId and the
 * Guardrail array must stay unchanged). Persisting the ignore reason itself
 * is FR-15, explicitly P1, so this just acknowledges the action.
 */
async function handleIgnoreIssue(issueId: string): Promise<MessageResponse<"IGNORE_ISSUE">> {
  return { ok: true, data: { issueId } };
}

/**
 * Accept current state (AC-05): replaces screenshot/snapshot/
 * accessibilityFindings with a fresh capture under a new baselineId, but
 * carries the existing Guardrails over unchanged — Accept isn't a Guardrail
 * edit. saveBaseline's single-key write is already atomic (section 9.5), so
 * a failure here leaves the previous baseline exactly as it was.
 */
async function handleAcceptCurrentState(): Promise<MessageResponse<"ACCEPT_CURRENT_STATE">> {
  const context = await getActiveTabContext();
  if (!context.ok) return context;
  const { tabId, windowId, route } = context.data;

  const existing = await getBaseline(route.routeKey);
  if (!existing) {
    return { ok: false, error: { code: "NO_BASELINE", message: "No baseline exists for this route yet." } };
  }

  const captureResult = await captureCurrentState(tabId, windowId, route);
  if (!captureResult.ok) return captureResult;

  const baseline: BaselineRecord = {
    schemaVersion: 1,
    baselineId: crypto.randomUUID(),
    route,
    createdAt: new Date().toISOString(),
    screenshot: captureResult.data.screenshot,
    snapshot: captureResult.data.snapshot,
    guardrails: existing.guardrails,
    accessibilityFindings: captureResult.data.accessibilityFindings,
  };

  const saveResult = await saveBaseline(route.routeKey, baseline);
  if (!saveResult.ok) return saveResult;

  return { ok: true, data: baseline };
}

async function handleSaveGuardrails(
  routeKey: string,
  guardrails: BaselineRecord["guardrails"],
): Promise<MessageResponse<"SAVE_GUARDRAILS">> {
  return saveGuardrails(routeKey, guardrails);
}

/**
 * Returns suggestions only — it does not persist them. The user reviews/
 * edits in the bottom sheet and SAVE_GUARDRAILS commits their final choice
 * (section 6.1: recommending never blocks or auto-commits).
 */
async function handleRecommendGuardrails(routeKey: string): Promise<MessageResponse<"RECOMMEND_GUARDRAILS">> {
  const baseline = await getBaseline(routeKey);
  if (!baseline) {
    return { ok: false, error: { code: "NO_BASELINE", message: "No baseline exists for this route yet." } };
  }
  return recommendGuardrails({ screenshot: baseline.screenshot, snapshot: baseline.snapshot });
}

async function handleGetSettings(): Promise<MessageResponse<"GET_SETTINGS">> {
  const [apiKey, model] = await Promise.all([getApiKey(), getModel()]);
  return {
    ok: true,
    data: { model, hasApiKey: apiKey !== null, apiKeyLastFour: apiKey ? apiKey.slice(-4) : null },
  };
}

async function handleSetApiKey(apiKey: string): Promise<MessageResponse<"SET_API_KEY">> {
  await setApiKey(apiKey);
  const validation = await validateApiKey(apiKey);
  if (!validation.ok) return validation;
  return { ok: true, data: { valid: validation.data } };
}

async function handleValidateApiKey(): Promise<MessageResponse<"VALIDATE_API_KEY">> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { ok: false, error: { code: "GEMINI_KEY_MISSING", message: "No Gemini API key is configured." } };
  }
  const validation = await validateApiKey(apiKey);
  if (!validation.ok) return validation;
  return { ok: true, data: { valid: validation.data } };
}

async function handleDeleteApiKey(): Promise<MessageResponse<"DELETE_API_KEY">> {
  await deleteApiKey();
  return { ok: true, data: undefined };
}

/**
 * chrome.runtime.onMessage requires sendResponse to be called once a
 * listener has returned true — otherwise Chrome closes the port itself and
 * the side panel sees a bare native error ("...message channel closed
 * before a response was received") instead of a normal error Result. A
 * plain `.then(sendResponse)` doesn't guarantee that: if the handler
 * promise rejects (an uncaught exception somewhere in its chain),
 * sendResponse never gets called. This wraps every handler call so a
 * rejection still produces a BACKGROUND_UNREACHABLE Result the side panel
 * already knows how to render.
 */
function respondSafely<A extends MessageAction>(
  promise: Promise<MessageResponse<A>>,
  sendResponse: (response: MessageResponse<A>) => void,
): void {
  promise.then(sendResponse).catch((err: unknown) => {
    console.error("KeepThis: message handler rejected before responding", err);
    sendResponse({
      ok: false,
      error: {
        code: "BACKGROUND_UNREACHABLE",
        message: err instanceof Error ? err.message : "The background handler failed unexpectedly.",
      },
    });
  });
}

chrome.runtime.onMessage.addListener((message: AnyMessageRequest, _sender, sendResponse) => {
  switch (message?.action) {
    case "GET_ACTIVE_ROUTE":
      respondSafely(handleGetActiveRoute(), sendResponse);
      return true;
    case "GET_BASELINE":
      respondSafely(handleGetBaseline(message.payload.routeKey), sendResponse);
      return true;
    case "SAVE_BASELINE":
      respondSafely(handleSaveBaseline(), sendResponse);
      return true;
    case "CHECK_CHANGES":
      respondSafely(handleCheckChanges(), sendResponse);
      return true;
    case "ANALYZE_AGAIN":
      respondSafely(handleAnalyzeAgain(), sendResponse);
      return true;
    case "ANALYZE_VISIBLE_ONLY":
      respondSafely(handleAnalyzeVisibleOnly(), sendResponse);
      return true;
    case "IGNORE_ISSUE":
      respondSafely(handleIgnoreIssue(message.payload.issueId), sendResponse);
      return true;
    case "ACCEPT_CURRENT_STATE":
      respondSafely(handleAcceptCurrentState(), sendResponse);
      return true;
    case "SAVE_GUARDRAILS":
      respondSafely(handleSaveGuardrails(message.payload.routeKey, message.payload.guardrails), sendResponse);
      return true;
    case "RECOMMEND_GUARDRAILS":
      respondSafely(handleRecommendGuardrails(message.payload.routeKey), sendResponse);
      return true;
    case "GET_SETTINGS":
      respondSafely(handleGetSettings(), sendResponse);
      return true;
    case "SET_API_KEY":
      respondSafely(handleSetApiKey(message.payload.apiKey), sendResponse);
      return true;
    case "VALIDATE_API_KEY":
      respondSafely(handleValidateApiKey(), sendResponse);
      return true;
    case "DELETE_API_KEY":
      respondSafely(handleDeleteApiKey(), sendResponse);
      return true;
    default:
      return false;
  }
});
