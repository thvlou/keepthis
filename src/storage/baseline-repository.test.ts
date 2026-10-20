import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteBaseline, getBaseline, saveBaseline, saveGuardrails } from "./baseline-repository";
import type { BaselineRecord, Guardrail } from "../shared/types";

function createFakeStorage(quotaBytes: number) {
  const store = new Map<string, unknown>();
  const area = {
    QUOTA_BYTES: quotaBytes,
    get: vi.fn(async (keys: string | string[] | null) => {
      const keyList = keys === null ? Array.from(store.keys()) : Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const k of keyList) if (store.has(k)) result[k] = store.get(k);
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) store.set(k, v);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k);
    }),
    getBytesInUse: vi.fn(async () => {
      let total = 0;
      for (const v of store.values()) total += new TextEncoder().encode(JSON.stringify(v)).length;
      return total;
    }),
  };
  return { store, area };
}

function makeBaseline(overrides: Partial<BaselineRecord> = {}): BaselineRecord {
  return {
    schemaVersion: 1,
    baselineId: "baseline-1",
    route: { routeKey: "http://localhost:3000/discover", fullUrl: "http://localhost:3000/discover", query: null, hash: null },
    createdAt: "2026-08-20T00:00:00.000Z",
    screenshot: { mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,AAAA", width: 1440, height: 900 },
    snapshot: {
      schemaVersion: 1,
      route: { routeKey: "http://localhost:3000/discover", fullUrl: "http://localhost:3000/discover", query: null, hash: null },
      capturedAt: "2026-08-20T00:00:00.000Z",
      viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 },
      readiness: { documentReadyState: "complete", ariaBusy: false, skeletonCandidateCount: 0, majorNodeCount: 10 },
      elements: [],
      contentHierarchy: [],
      interactionSummary: { buttonCount: 0, linkCount: 0, inputCount: 0, ctaCandidateCount: 0, navItemCount: 0 },
    },
    guardrails: [],
    accessibilityFindings: [],
    ...overrides,
  };
}

const routeKey = "http://localhost:3000/discover";

describe("baseline-repository", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when no baseline is stored for the route", async () => {
    const { area } = createFakeStorage(1_000_000);
    vi.stubGlobal("chrome", { storage: { local: area } });

    expect(await getBaseline(routeKey)).toBeNull();
  });

  it("round-trips a saved baseline", async () => {
    const { area } = createFakeStorage(1_000_000);
    vi.stubGlobal("chrome", { storage: { local: area } });

    const baseline = makeBaseline();
    const result = await saveBaseline(routeKey, baseline);
    expect(result.ok).toBe(true);
    expect(await getBaseline(routeKey)).toEqual(baseline);
  });

  it("replaces an existing baseline for the same route", async () => {
    const { area } = createFakeStorage(1_000_000);
    vi.stubGlobal("chrome", { storage: { local: area } });

    await saveBaseline(routeKey, makeBaseline({ baselineId: "baseline-1" }));
    await saveBaseline(routeKey, makeBaseline({ baselineId: "baseline-2" }));

    const stored = await getBaseline(routeKey);
    expect(stored?.baselineId).toBe("baseline-2");
  });

  it("replaces accessibilityFindings atomically along with screenshot/snapshot on Accept (AC-A11Y-09)", async () => {
    const { area } = createFakeStorage(1_000_000);
    vi.stubGlobal("chrome", { storage: { local: area } });

    await saveBaseline(
      routeKey,
      makeBaseline({
        baselineId: "before-accept",
        accessibilityFindings: [
          {
            id: "a11y-0",
            ruleId: "label",
            impact: "serious",
            description: "d",
            helpUrl: "u",
            targetSelector: "select#gender",
            elementFingerprint: { strategy: "stable-id", value: "gender" },
            matchConfidence: "high",
          },
        ],
      }),
    );

    await saveBaseline(routeKey, makeBaseline({ baselineId: "after-accept", accessibilityFindings: [] }));

    const stored = await getBaseline(routeKey);
    expect(stored?.baselineId).toBe("after-accept");
    expect(stored?.accessibilityFindings).toEqual([]);
  });

  it("rejects a save that would exceed quota and leaves the existing baseline untouched", async () => {
    // Sized so the first save fits but the larger replacement does not.
    const { area } = createFakeStorage(900);
    vi.stubGlobal("chrome", { storage: { local: area } });

    const original = makeBaseline({ baselineId: "original" });
    const originalSaveResult = await saveBaseline(routeKey, original);
    expect(originalSaveResult.ok).toBe(true);

    const tooBig = makeBaseline({ baselineId: "replacement-that-is-much-too-large-for-the-tiny-test-quota" });
    const result = await saveBaseline(routeKey, tooBig);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("STORAGE_QUOTA_EXCEEDED");

    const stored = await getBaseline(routeKey);
    expect(stored?.baselineId).toBe("original");
  });

  it("deletes a baseline", async () => {
    const { area } = createFakeStorage(1_000_000);
    vi.stubGlobal("chrome", { storage: { local: area } });

    await saveBaseline(routeKey, makeBaseline());
    await deleteBaseline(routeKey);

    expect(await getBaseline(routeKey)).toBeNull();
  });

  it("fails NO_BASELINE when saving guardrails without an existing baseline", async () => {
    const { area } = createFakeStorage(1_000_000);
    vi.stubGlobal("chrome", { storage: { local: area } });

    const guardrails: Guardrail[] = [
      { id: "g1", statement: "Reference content stays dominant", priority: "must", evidenceTypes: ["position"], scope: "route", enabled: true, source: "user_written" },
    ];
    const result = await saveGuardrails(routeKey, guardrails);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_BASELINE");
  });

  it("updates guardrails on an existing baseline without touching other fields", async () => {
    const { area } = createFakeStorage(1_000_000);
    vi.stubGlobal("chrome", { storage: { local: area } });

    await saveBaseline(routeKey, makeBaseline());
    const guardrails: Guardrail[] = [
      { id: "g1", statement: "Save remains easy to reach", priority: "should", evidenceTypes: ["position"], scope: "route", enabled: true, source: "ai_suggested" },
    ];
    const result = await saveGuardrails(routeKey, guardrails);
    expect(result.ok).toBe(true);

    const stored = await getBaseline(routeKey);
    expect(stored?.guardrails).toEqual(guardrails);
    expect(stored?.baselineId).toBe("baseline-1");
  });
});
