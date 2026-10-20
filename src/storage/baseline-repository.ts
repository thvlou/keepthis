/**
 * Baseline storage (CLAUDE.md section 9.5, FR-02, FR-09, AC-05).
 *
 * MVP supports exactly one BaselineRecord per routeKey, stored under its own
 * chrome.storage.local key. A single storage.local.set() call for one key is
 * all-or-nothing — "Updates that would cause this limit to be exceeded fail
 * immediately" — so replacing a baseline is naturally atomic: if the new
 * write fails (quota or otherwise), the previous value is left untouched.
 * We additionally pre-check size against QUOTA_BYTES *before* calling set()
 * per section 9.5 ("저장 전 getBytesInUse 또는 직렬화 크기로 quota 점검"),
 * so a doomed write never gets attempted in the first place.
 */

import type { AppError, Result } from "../shared/messages";
import type { BaselineRecord, Guardrail } from "../shared/types";

const KEY_PREFIX = "baseline:";

function storageKey(routeKey: string): string {
  return `${KEY_PREFIX}${routeKey}`;
}

function byteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export async function getBaseline(routeKey: string): Promise<BaselineRecord | null> {
  const key = storageKey(routeKey);
  const stored = await chrome.storage.local.get(key);
  return (stored[key] as BaselineRecord | undefined) ?? null;
}

/**
 * Creates or replaces the single baseline for routeKey. Never deletes an
 * existing baseline before the new one is confirmed written (section 11:
 * "어떤 오류에서도 기존 Baseline을 삭제하거나 덮어쓰지 않는다").
 */
export async function saveBaseline(routeKey: string, baseline: BaselineRecord): Promise<Result<void>> {
  const key = storageKey(routeKey);
  const newSize = byteSize(baseline);
  const quotaBytes = chrome.storage.local.QUOTA_BYTES;

  const [bytesInUse, existing] = await Promise.all([
    chrome.storage.local.getBytesInUse(),
    chrome.storage.local.get(key),
  ]);
  const existingSize = existing[key] !== undefined ? byteSize(existing[key]) : 0;
  const projectedUsage = bytesInUse - existingSize + newSize;

  if (projectedUsage > quotaBytes) {
    return {
      ok: false,
      error: {
        code: "STORAGE_QUOTA_EXCEEDED",
        message: `Saving this baseline would use ${projectedUsage} bytes of ${quotaBytes} available.`,
      },
    };
  }

  try {
    await chrome.storage.local.set({ [key]: baseline });
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: describeStorageError(err) };
  }
}

export async function deleteBaseline(routeKey: string): Promise<void> {
  await chrome.storage.local.remove(storageKey(routeKey));
}

/**
 * Replaces just the guardrails array on an existing baseline. Fails with
 * NO_BASELINE rather than creating a bare guardrails-only record — guardrails
 * are only ever a field of a BaselineRecord (section 5).
 */
export async function saveGuardrails(routeKey: string, guardrails: Guardrail[]): Promise<Result<Guardrail[]>> {
  const existing = await getBaseline(routeKey);
  if (!existing) {
    return {
      ok: false,
      error: { code: "NO_BASELINE", message: "Cannot save guardrails without a baseline for this route." },
    };
  }

  const updateResult = await saveBaseline(routeKey, { ...existing, guardrails });
  if (!updateResult.ok) return updateResult;
  return { ok: true, data: guardrails };
}

function describeStorageError(err: unknown): AppError {
  return {
    code: "STORAGE_QUOTA_EXCEEDED",
    message: err instanceof Error ? err.message : String(err),
  };
}
