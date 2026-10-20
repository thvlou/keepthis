import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GEMINI_MODEL,
  deleteApiKey,
  getApiKey,
  getModel,
  maskApiKey,
  restrictStorageToTrustedContexts,
  setApiKey,
  setModel,
} from "./settings-repository";

function createFakeStorage() {
  const store = new Map<string, unknown>();
  const setAccessLevel = vi.fn(async () => {});
  const area = {
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
    setAccessLevel,
  };
  return { store, area, setAccessLevel };
}

describe("settings-repository", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("has no API key by default", async () => {
    const { area } = createFakeStorage();
    vi.stubGlobal("chrome", { storage: { local: area } });
    expect(await getApiKey()).toBeNull();
  });

  it("round-trips and deletes the API key", async () => {
    const { area } = createFakeStorage();
    vi.stubGlobal("chrome", { storage: { local: area } });

    await setApiKey("AIzaSyTestKeyValue1234");
    expect(await getApiKey()).toBe("AIzaSyTestKeyValue1234");

    await deleteApiKey();
    expect(await getApiKey()).toBeNull();
  });

  it("masks all but the last 4 characters", () => {
    expect(maskApiKey("AIzaSyTestKeyValue1234")).toBe("••••1234");
  });

  it("falls back to the default model until one is set", async () => {
    const { area } = createFakeStorage();
    vi.stubGlobal("chrome", { storage: { local: area } });

    expect(await getModel()).toBe(DEFAULT_GEMINI_MODEL);
    await setModel("gemini-2.5-pro");
    expect(await getModel()).toBe("gemini-2.5-pro");
  });

  it("requests TRUSTED_CONTEXTS access level and tolerates its absence", async () => {
    const { setAccessLevel } = createFakeStorage();
    vi.stubGlobal("chrome", { storage: { local: { setAccessLevel } } });
    await restrictStorageToTrustedContexts();
    expect(setAccessLevel).toHaveBeenCalledWith({ accessLevel: "TRUSTED_CONTEXTS" });

    setAccessLevel.mockRejectedValueOnce(new Error("unsupported"));
    await expect(restrictStorageToTrustedContexts()).resolves.toBeUndefined();
  });
});
