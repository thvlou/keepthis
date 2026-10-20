import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureAccessibilityFindings, captureCurrentState } from "./snapshot-orchestrator";
import { isAxeLoaded, runAccessibilityCheck } from "../content/run-accessibility-check";
import type { AccessibilityFinding, PageSnapshot, RouteInfo } from "../shared/types";

const route: RouteInfo = {
  routeKey: "http://localhost:3000/discover",
  fullUrl: "http://localhost:3000/discover",
  query: null,
  hash: null,
};

function makeSnapshot(overrides: Partial<PageSnapshot["readiness"]> = {}): PageSnapshot {
  return {
    schemaVersion: 1,
    route,
    capturedAt: "2026-08-20T00:00:00.000Z",
    viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 },
    readiness: {
      documentReadyState: "complete",
      ariaBusy: false,
      skeletonCandidateCount: 0,
      majorNodeCount: 10,
      ...overrides,
    },
    elements: [],
    contentHierarchy: [],
    interactionSummary: { buttonCount: 0, linkCount: 0, inputCount: 0, ctaCandidateCount: 0, navItemCount: 0 },
  };
}

type StubOptions = {
  snapshotResult?: unknown;
  captureVisibleTabImpl?: () => Promise<string>;
  axeAlreadyLoaded?: boolean;
  axeFindingsResult?: AccessibilityFinding[];
  onAxeFileInject?: () => void;
  axeFileInjectShouldFail?: boolean;
  axeWrapperShouldFail?: boolean;
};

function stubChrome(options: StubOptions = {}) {
  const {
    snapshotResult = makeSnapshot(),
    captureVisibleTabImpl,
    axeAlreadyLoaded = true,
    axeFindingsResult = [],
    onAxeFileInject,
    axeFileInjectShouldFail = false,
    axeWrapperShouldFail = false,
  } = options;

  const executeScript = vi.fn(async (details: { func?: unknown; files?: string[] }) => {
    if (details.files) {
      onAxeFileInject?.();
      if (axeFileInjectShouldFail) throw new Error("cannot inject axe.min.js");
      return [{ result: undefined }];
    }
    if (details.func === isAxeLoaded) {
      return [{ result: axeAlreadyLoaded }];
    }
    if (details.func === runAccessibilityCheck) {
      if (axeWrapperShouldFail) throw new Error("wrapper execution failed");
      return [{ result: axeFindingsResult }];
    }
    return [{ result: snapshotResult }];
  });

  const captureVisibleTab = vi.fn(
    captureVisibleTabImpl ?? (() => Promise.resolve("data:image/jpeg;base64,AAAA")),
  );
  vi.stubGlobal("chrome", {
    scripting: { executeScript },
    tabs: { captureVisibleTab },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(["x"], { type: "image/jpeg" })) }),
  );
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 1440, height: 900, close: vi.fn() }),
  );
  return { executeScript, captureVisibleTab };
}

describe("captureCurrentState", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns snapshot, screenshot, and accessibility findings on the success path", async () => {
    const finding: AccessibilityFinding = {
      id: "a11y-0",
      ruleId: "label",
      impact: "serious",
      description: "d",
      helpUrl: "u",
      targetSelector: "select#gender",
      elementFingerprint: { strategy: "stable-id", value: "gender" },
      matchConfidence: "high",
    };
    stubChrome({ axeFindingsResult: [finding] });
    const result = await captureCurrentState(1, 1, route);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.snapshot.route).toEqual(route);
      expect(result.data.screenshot.mimeType).toBe("image/jpeg");
      expect(result.data.accessibilityFindings).toEqual([finding]);
    }
  });

  it("fails without capturing a screenshot when extraction throws", async () => {
    const { captureVisibleTab, executeScript } = stubChrome();
    executeScript.mockRejectedValueOnce(new Error("no access"));

    const result = await captureCurrentState(1, 1, route);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONTENT_SCRIPT_UNAVAILABLE");
    expect(captureVisibleTab).not.toHaveBeenCalled();
  });

  it("fails the readiness gate without capturing a screenshot", async () => {
    const { captureVisibleTab } = stubChrome({ snapshotResult: makeSnapshot({ documentReadyState: "loading" }) });

    const result = await captureCurrentState(1, 1, route);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PAGE_NOT_READY");
    expect(captureVisibleTab).not.toHaveBeenCalled();
  });

  it("skips the readiness gate and captures anyway when skipReadinessGate is set (FR-11)", async () => {
    stubChrome({ snapshotResult: makeSnapshot({ documentReadyState: "loading" }) });

    const result = await captureCurrentState(1, 1, route, { skipReadinessGate: true });
    expect(result.ok).toBe(true);
  });

  it("discards the snapshot atomically when screenshot capture fails", async () => {
    stubChrome({ captureVisibleTabImpl: () => Promise.reject(new Error("capture failed")) });

    const result = await captureCurrentState(1, 1, route);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("SCREENSHOT_CAPTURE_FAILED");
  });

  it("still succeeds with empty accessibilityFindings when axe.min.js injection fails", async () => {
    stubChrome({ axeAlreadyLoaded: false, axeFileInjectShouldFail: true });

    const result = await captureCurrentState(1, 1, route);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.accessibilityFindings).toEqual([]);
  });

  it("still succeeds with empty accessibilityFindings when the check wrapper fails", async () => {
    stubChrome({ axeWrapperShouldFail: true });

    const result = await captureCurrentState(1, 1, route);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.accessibilityFindings).toEqual([]);
  });
});

describe("captureAccessibilityFindings", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips re-injecting axe.min.js when it's already loaded on the page", async () => {
    const onAxeFileInject = vi.fn();
    stubChrome({ axeAlreadyLoaded: true, onAxeFileInject });

    await captureAccessibilityFindings(1);
    expect(onAxeFileInject).not.toHaveBeenCalled();
  });

  it("injects axe.min.js when it isn't loaded yet", async () => {
    const onAxeFileInject = vi.fn();
    stubChrome({ axeAlreadyLoaded: false, onAxeFileInject });

    await captureAccessibilityFindings(1);
    expect(onAxeFileInject).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array without throwing when axe.min.js injection fails", async () => {
    stubChrome({ axeAlreadyLoaded: false, axeFileInjectShouldFail: true });
    await expect(captureAccessibilityFindings(1)).resolves.toEqual([]);
  });

  it("returns an empty array without throwing when the wrapper execution fails", async () => {
    stubChrome({ axeWrapperShouldFail: true });
    await expect(captureAccessibilityFindings(1)).resolves.toEqual([]);
  });
});
