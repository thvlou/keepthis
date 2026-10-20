/**
 * chrome.runtime message action and error code contracts.
 * Content script <-> service worker <-> side panel all communicate through
 * these actions only. See CLAUDE.md section 9.2 (components) and 11.1 (failure conditions).
 */

import type {
  AccessibilityComparison,
  AiAnalysis,
  BaselineRecord,
  ComparisonContext,
  Guardrail,
  LocalDiff,
  PageSnapshot,
} from "./types";

export const MESSAGE_ACTIONS = [
  "GET_ACTIVE_ROUTE",
  "GET_BASELINE",
  "SAVE_BASELINE",
  "RECOMMEND_GUARDRAILS",
  "SAVE_GUARDRAILS",
  "CHECK_CHANGES",
  "ANALYZE_AGAIN",
  "ANALYZE_VISIBLE_ONLY",
  "IGNORE_ISSUE",
  "ACCEPT_CURRENT_STATE",
  "GET_SETTINGS",
  "SET_API_KEY",
  "VALIDATE_API_KEY",
  "DELETE_API_KEY",
  "EXTRACT_SNAPSHOT",
] as const;

export type MessageAction = (typeof MESSAGE_ACTIONS)[number];

/** One entry per failure condition enumerated in CLAUDE.md section 11.1. */
export const ERROR_CODES = [
  "NO_BASELINE",
  "VIEWPORT_MISMATCH",
  "PAGE_NOT_READY",
  "CONTENT_SCRIPT_UNAVAILABLE",
  "SCREENSHOT_CAPTURE_FAILED",
  "STORAGE_QUOTA_EXCEEDED",
  "GEMINI_KEY_MISSING",
  "GEMINI_KEY_INVALID",
  "NETWORK_TIMEOUT",
  "GEMINI_RATE_LIMITED",
  "GEMINI_SERVER_ERROR",
  "SCHEMA_VALIDATION_FAILED",
  "UNSUPPORTED_PAGE",
  /** ANALYZE_AGAIN has no cached prior Check Changes capture to reuse (D-01: it never recaptures). */
  "ANALYSIS_CACHE_MISSING",
  /**
   * chrome.runtime.sendMessage resolved with no usable response — e.g. the
   * service worker has no listener for this action (a stale build still
   * running) or its handler rejected before calling sendResponse.
   */
  "BACKGROUND_UNREACHABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type IgnoreReason = "intentional_change" | "not_relevant" | "incorrect_finding";

export type AppError = {
  code: ErrorCode;
  message: string;
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

// ---------------------------------------------------------------------------
// Per-action request/response payloads
// ---------------------------------------------------------------------------

/**
 * REV-01/A11Y-10: Results screen always needs these alongside the Guardrail
 * analysis — regardless of analysisMode, and whether or not any Guardrail
 * issues were found — so both full-analysis actions return them together.
 * ANALYZE_AGAIN deliberately excludes them: D-01 reuses the same capture, so
 * they're identical to what CHECK_CHANGES already returned.
 */
type FullAnalysisResponse = {
  diff: LocalDiff;
  analysis: AiAnalysis;
  accessibilityComparison: AccessibilityComparison;
  comparisonContext: ComparisonContext;
};

export type MessagePayloadMap = {
  GET_ACTIVE_ROUTE: {
    request: undefined;
    response: { fullUrl: string };
  };
  GET_BASELINE: {
    request: { routeKey: string };
    response: BaselineRecord | null;
  };
  SAVE_BASELINE: {
    request: undefined;
    response: BaselineRecord;
  };
  RECOMMEND_GUARDRAILS: {
    request: { routeKey: string };
    response: Guardrail[];
  };
  SAVE_GUARDRAILS: {
    request: { routeKey: string; guardrails: Guardrail[] };
    response: Guardrail[];
  };
  CHECK_CHANGES: {
    request: { routeKey: string };
    response: FullAnalysisResponse;
  };
  ANALYZE_AGAIN: {
    // No `diff` field: the server re-uses its own session-cached copy of the
    // last Check Changes capture (D-01 — never recaptures the page), so the
    // client doesn't need to round-trip it back.
    request: { routeKey: string };
    response: { analysis: AiAnalysis };
  };
  ANALYZE_VISIBLE_ONLY: {
    request: { routeKey: string };
    response: FullAnalysisResponse;
  };
  IGNORE_ISSUE: {
    request: { routeKey: string; issueId: string; reason: IgnoreReason };
    response: { issueId: string };
  };
  ACCEPT_CURRENT_STATE: {
    request: { routeKey: string };
    response: BaselineRecord;
  };
  GET_SETTINGS: {
    request: undefined;
    response: { model: string; hasApiKey: boolean; apiKeyLastFour: string | null };
  };
  SET_API_KEY: {
    request: { apiKey: string };
    response: { valid: boolean };
  };
  VALIDATE_API_KEY: {
    request: undefined;
    response: { valid: boolean };
  };
  DELETE_API_KEY: {
    request: undefined;
    response: undefined;
  };
  EXTRACT_SNAPSHOT: {
    request: undefined;
    response: PageSnapshot;
  };
};

export type MessageRequest<A extends MessageAction> = {
  action: A;
  payload: MessagePayloadMap[A]["request"];
};

export type MessageResponse<A extends MessageAction> = Result<MessagePayloadMap[A]["response"]>;

/**
 * A true discriminated union over every action (unlike MessageRequest<MessageAction>,
 * which only distributes `payload` into a same-shaped union without correlating it
 * to `action`). Use this for the service worker's onMessage switch so narrowing
 * on `message.action` also narrows `message.payload`.
 */
export type AnyMessageRequest = { [A in MessageAction]: MessageRequest<A> }[MessageAction];
