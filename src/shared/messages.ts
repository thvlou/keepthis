/**
 * chrome.runtime message action and error code contracts.
 * Content script <-> service worker <-> side panel all communicate through
 * these actions only. See CLAUDE.md section 9.2 (components) and 11.1 (failure conditions).
 */

import type { AiAnalysis, BaselineRecord, Guardrail, LocalDiff, PageSnapshot } from "./types";

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
    response: { diff: LocalDiff; analysis: AiAnalysis };
  };
  ANALYZE_AGAIN: {
    request: { routeKey: string; diff: LocalDiff };
    response: { analysis: AiAnalysis };
  };
  ANALYZE_VISIBLE_ONLY: {
    request: { routeKey: string };
    response: { diff: LocalDiff; analysis: AiAnalysis };
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
