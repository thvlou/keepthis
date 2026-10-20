import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheLastCheckChanges, getLastCheckChanges } from "./analysis-cache";
import type { LocalDiff } from "../shared/types";

const routeKey = "http://localhost:3000/discover";

const diff: LocalDiff = {
  routeKey,
  viewport: { baseline: { width: 1440, height: 900 }, current: { width: 1440, height: 900 }, comparable: true },
  changes: [],
};

const currentScreenshot = { mimeType: "image/jpeg" as const, dataUrl: "data:image/jpeg;base64,AAAA", width: 1440, height: 900 };

function createFakeSessionStorage() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => (store.has(key) ? { [key]: store.get(key) } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) store.set(k, v);
    }),
  };
}

describe("analysis-cache", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when nothing has been cached for the route", async () => {
    vi.stubGlobal("chrome", { storage: { session: createFakeSessionStorage() } });
    expect(await getLastCheckChanges(routeKey)).toBeNull();
  });

  it("round-trips the diff and current screenshot", async () => {
    vi.stubGlobal("chrome", { storage: { session: createFakeSessionStorage() } });
    await cacheLastCheckChanges(routeKey, { diff, currentScreenshot });
    expect(await getLastCheckChanges(routeKey)).toEqual({ diff, currentScreenshot });
  });

  it("keeps caches for different routes independent", async () => {
    vi.stubGlobal("chrome", { storage: { session: createFakeSessionStorage() } });
    await cacheLastCheckChanges(routeKey, { diff, currentScreenshot });
    expect(await getLastCheckChanges("http://localhost:3000/other")).toBeNull();
  });

  it("does not throw when the underlying write fails", async () => {
    vi.stubGlobal("chrome", {
      storage: { session: { set: vi.fn().mockRejectedValue(new Error("quota")), get: vi.fn() } },
    });
    await expect(cacheLastCheckChanges(routeKey, { diff, currentScreenshot })).resolves.toBeUndefined();
  });
});
