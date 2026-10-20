import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeAnalysisMode, runAnalyzeAgain, runAnalyzeVisibleOnly, runCheckChanges } from "./check-changes-orchestrator";
import type { AiAnalysis, BaselineRecord, Guardrail, PageSnapshot, RouteInfo } from "../shared/types";

const { getBaseline } = vi.hoisted(() => ({ getBaseline: vi.fn() }));
const { captureCurrentState } = vi.hoisted(() => ({ captureCurrentState: vi.fn() }));
const { analyzeChanges } = vi.hoisted(() => ({ analyzeChanges: vi.fn() }));
const { cacheLastCheckChanges, getLastCheckChanges } = vi.hoisted(() => ({
  cacheLastCheckChanges: vi.fn(),
  getLastCheckChanges: vi.fn(),
}));

vi.mock("../storage/baseline-repository", () => ({ getBaseline }));
vi.mock("./snapshot-orchestrator", () => ({ captureCurrentState }));
vi.mock("./gemini-client", () => ({ analyzeChanges }));
vi.mock("./analysis-cache", () => ({ cacheLastCheckChanges, getLastCheckChanges }));

const route: RouteInfo = {
  routeKey: "http://localhost:3000/discover",
  fullUrl: "http://localhost:3000/discover",
  query: null,
  hash: null,
};

function makeSnapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    schemaVersion: 1,
    route,
    capturedAt: "2026-08-20T00:00:00.000Z",
    viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 },
    readiness: { documentReadyState: "complete", ariaBusy: false, skeletonCandidateCount: 0, majorNodeCount: 10 },
    elements: [],
    contentHierarchy: [],
    interactionSummary: { buttonCount: 0, linkCount: 0, inputCount: 0, ctaCandidateCount: 0, navItemCount: 0 },
    ...overrides,
  };
}

function guardrail(overrides: Partial<Guardrail> = {}): Guardrail {
  return {
    id: "g1",
    statement: "Reference content stays dominant",
    priority: "must",
    evidenceTypes: ["position"],
    scope: "route",
    enabled: true,
    source: "user_written",
    ...overrides,
  };
}

function makeBaseline(overrides: Partial<BaselineRecord> = {}): BaselineRecord {
  return {
    schemaVersion: 1,
    baselineId: "baseline-1",
    route,
    createdAt: "2026-08-20T00:00:00.000Z",
    screenshot: { mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,BASELINE", width: 1440, height: 900 },
    snapshot: makeSnapshot(),
    guardrails: [guardrail()],
    accessibilityFindings: [],
    ...overrides,
  };
}

const validAnalysis: AiAnalysis = {
  analysisMode: "intent_check",
  analysisStatus: "ok",
  summary: "s",
  issues: [],
  preserved: [],
  insufficientEvidenceReasons: [],
};

describe("computeAnalysisMode", () => {
  it("is intent_check when at least one guardrail is enabled", () => {
    expect(computeAnalysisMode([guardrail({ enabled: true })])).toBe("intent_check");
  });

  it("is change_summary when there are no enabled guardrails", () => {
    expect(computeAnalysisMode([guardrail({ enabled: false })])).toBe("change_summary");
    expect(computeAnalysisMode([])).toBe("change_summary");
  });
});

describe("runCheckChanges", () => {
  beforeEach(() => {
    getBaseline.mockReset();
    captureCurrentState.mockReset();
    analyzeChanges.mockReset();
    cacheLastCheckChanges.mockReset().mockResolvedValue(undefined);
    getLastCheckChanges.mockReset();
  });

  it("fails with NO_BASELINE when no baseline exists for the route", async () => {
    getBaseline.mockResolvedValue(null);
    const result = await runCheckChanges(1, 1, route);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_BASELINE");
    expect(captureCurrentState).not.toHaveBeenCalled();
  });

  it("propagates a capture failure without calling Gemini", async () => {
    getBaseline.mockResolvedValue(makeBaseline());
    captureCurrentState.mockResolvedValue({ ok: false, error: { code: "PAGE_NOT_READY", message: "not ready" } });

    const result = await runCheckChanges(1, 1, route);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PAGE_NOT_READY");
    expect(analyzeChanges).not.toHaveBeenCalled();
  });

  it("assembles diff, accessibility comparison, and comparison context, then calls Gemini", async () => {
    const baseline = makeBaseline({ guardrails: [guardrail({ enabled: true })] });
    getBaseline.mockResolvedValue(baseline);
    captureCurrentState.mockResolvedValue({
      ok: true,
      data: {
        snapshot: makeSnapshot(),
        screenshot: { mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,CURRENT", width: 1440, height: 900 },
        accessibilityFindings: [],
      },
    });
    analyzeChanges.mockResolvedValue({ ok: true, data: validAnalysis });

    const result = await runCheckChanges(1, 1, route);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.comparisonContext).toEqual({
        routeKey: route.routeKey,
        viewportComparable: true,
        queryChanged: false,
        analysisMode: "intent_check",
      });
      expect(result.data.accessibilityComparison).toEqual({ resolved: [], stillPresent: [], newlyIntroduced: [] });
      expect(result.data.analysis).toEqual(validAnalysis);
    }

    expect(analyzeChanges).toHaveBeenCalledWith(
      expect.objectContaining({ analysisMode: "intent_check", guardrails: baseline.guardrails }),
    );
  });

  it("propagates a Gemini failure", async () => {
    getBaseline.mockResolvedValue(makeBaseline());
    captureCurrentState.mockResolvedValue({
      ok: true,
      data: {
        snapshot: makeSnapshot(),
        screenshot: { mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,CURRENT", width: 1440, height: 900 },
        accessibilityFindings: [],
      },
    });
    analyzeChanges.mockResolvedValue({ ok: false, error: { code: "GEMINI_SERVER_ERROR", message: "boom" } });

    const result = await runCheckChanges(1, 1, route);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("GEMINI_SERVER_ERROR");
  });

  it("computes change_summary mode when the baseline has no enabled guardrails", async () => {
    getBaseline.mockResolvedValue(makeBaseline({ guardrails: [] }));
    captureCurrentState.mockResolvedValue({
      ok: true,
      data: {
        snapshot: makeSnapshot(),
        screenshot: { mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,CURRENT", width: 1440, height: 900 },
        accessibilityFindings: [],
      },
    });
    analyzeChanges.mockResolvedValue({ ok: true, data: { ...validAnalysis, analysisMode: "change_summary" } });

    const result = await runCheckChanges(1, 1, route);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.comparisonContext.analysisMode).toBe("change_summary");
    expect(analyzeChanges).toHaveBeenCalledWith(expect.objectContaining({ analysisMode: "change_summary" }));
  });

  it("caches the diff and current screenshot on success, for a later ANALYZE_AGAIN", async () => {
    const currentScreenshot = {
      mimeType: "image/jpeg" as const,
      dataUrl: "data:image/jpeg;base64,CURRENT",
      width: 1440,
      height: 900,
    };
    getBaseline.mockResolvedValue(makeBaseline());
    captureCurrentState.mockResolvedValue({
      ok: true,
      data: { snapshot: makeSnapshot(), screenshot: currentScreenshot, accessibilityFindings: [] },
    });
    analyzeChanges.mockResolvedValue({ ok: true, data: validAnalysis });

    const result = await runCheckChanges(1, 1, route);
    expect(result.ok).toBe(true);
    expect(cacheLastCheckChanges).toHaveBeenCalledTimes(1);
    const [cachedRouteKey, cachedData] = cacheLastCheckChanges.mock.calls[0] as [string, unknown];
    expect(cachedRouteKey).toBe(route.routeKey);
    expect(cachedData).toMatchObject({ currentScreenshot });
  });
});

describe("runAnalyzeAgain", () => {
  beforeEach(() => {
    getBaseline.mockReset();
    analyzeChanges.mockReset();
    getLastCheckChanges.mockReset();
  });

  it("fails with NO_BASELINE when no baseline exists for the route", async () => {
    getBaseline.mockResolvedValue(null);
    const result = await runAnalyzeAgain(route);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_BASELINE");
  });

  it("fails with ANALYSIS_CACHE_MISSING when there is no cached prior capture", async () => {
    getBaseline.mockResolvedValue(makeBaseline());
    getLastCheckChanges.mockResolvedValue(null);

    const result = await runAnalyzeAgain(route);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("ANALYSIS_CACHE_MISSING");
    expect(analyzeChanges).not.toHaveBeenCalled();
  });

  it("re-runs Gemini with the cached diff/screenshot and the baseline's current guardrails, without recapturing", async () => {
    const cached = {
      diff: { routeKey: route.routeKey, viewport: { baseline: { width: 1440, height: 900 }, current: { width: 1440, height: 900 }, comparable: true }, changes: [] },
      currentScreenshot: { mimeType: "image/jpeg" as const, dataUrl: "data:image/jpeg;base64,CURRENT", width: 1440, height: 900 },
    };
    const baseline = makeBaseline({ guardrails: [guardrail({ enabled: true })] });
    getBaseline.mockResolvedValue(baseline);
    getLastCheckChanges.mockResolvedValue(cached);
    analyzeChanges.mockResolvedValue({ ok: true, data: validAnalysis });

    const result = await runAnalyzeAgain(route);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.analysis).toEqual(validAnalysis);
    expect(analyzeChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisMode: "intent_check",
        guardrails: baseline.guardrails,
        diff: cached.diff,
        currentScreenshot: cached.currentScreenshot,
        baselineScreenshot: baseline.screenshot,
      }),
    );
  });

  it("propagates a Gemini failure", async () => {
    getBaseline.mockResolvedValue(makeBaseline());
    getLastCheckChanges.mockResolvedValue({
      diff: { routeKey: route.routeKey, viewport: { baseline: { width: 1440, height: 900 }, current: { width: 1440, height: 900 }, comparable: true }, changes: [] },
      currentScreenshot: { mimeType: "image/jpeg" as const, dataUrl: "data:image/jpeg;base64,CURRENT", width: 1440, height: 900 },
    });
    analyzeChanges.mockResolvedValue({ ok: false, error: { code: "GEMINI_SERVER_ERROR", message: "boom" } });

    const result = await runAnalyzeAgain(route);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("GEMINI_SERVER_ERROR");
  });
});

describe("runAnalyzeVisibleOnly", () => {
  beforeEach(() => {
    getBaseline.mockReset();
    captureCurrentState.mockReset();
    analyzeChanges.mockReset();
    cacheLastCheckChanges.mockReset().mockResolvedValue(undefined);
  });

  it("captures with the readiness gate skipped", async () => {
    getBaseline.mockResolvedValue(makeBaseline());
    captureCurrentState.mockResolvedValue({
      ok: true,
      data: {
        snapshot: makeSnapshot(),
        screenshot: { mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,CURRENT", width: 1440, height: 900 },
        accessibilityFindings: [],
      },
    });
    analyzeChanges.mockResolvedValue({ ok: true, data: validAnalysis });

    await runAnalyzeVisibleOnly(1, 1, route);
    expect(captureCurrentState).toHaveBeenCalledWith(1, 1, route, { skipReadinessGate: true });
  });

  it("forces every issue's confidence to low regardless of what Gemini returned", async () => {
    getBaseline.mockResolvedValue(makeBaseline());
    captureCurrentState.mockResolvedValue({
      ok: true,
      data: {
        snapshot: makeSnapshot(),
        screenshot: { mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,CURRENT", width: 1440, height: 900 },
        accessibilityFindings: [],
      },
    });
    analyzeChanges.mockResolvedValue({
      ok: true,
      data: {
        ...validAnalysis,
        issues: [
          {
            id: "i1",
            severity: "high",
            title: "t",
            evidence: [{ evidenceId: "e1", source: "dom", statement: "s" }],
            guardrailId: "g1",
            guardrail: "g",
            whyItMatters: "w",
            confidence: "high",
            confidenceReason: "r",
            fixInstruction: "f",
          },
        ],
      },
    });

    const result = await runAnalyzeVisibleOnly(1, 1, route);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.analysis.issues[0]?.confidence).toBe("low");
  });

  it("fails with NO_BASELINE when no baseline exists for the route", async () => {
    getBaseline.mockResolvedValue(null);
    const result = await runAnalyzeVisibleOnly(1, 1, route);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NO_BASELINE");
    expect(captureCurrentState).not.toHaveBeenCalled();
  });
});
