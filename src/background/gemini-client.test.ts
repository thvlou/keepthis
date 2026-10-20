import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeChanges, recommendGuardrails, validateApiKey } from "./gemini-client";
import type { AiAnalysis, Guardrail, LocalDiff, PageSnapshot } from "../shared/types";

const { getApiKey, getModel } = vi.hoisted(() => ({
  getApiKey: vi.fn(),
  getModel: vi.fn(),
}));

vi.mock("../storage/settings-repository", () => ({
  getApiKey,
  getModel,
  DEFAULT_GEMINI_MODEL: "gemini-2.5-flash",
}));

const diff: LocalDiff = {
  routeKey: "http://localhost:3000/discover",
  viewport: { baseline: { width: 1440, height: 900 }, current: { width: 1440, height: 900 }, comparable: true },
  changes: [],
};

const screenshot = { mimeType: "image/jpeg" as const, dataUrl: "data:image/jpeg;base64,AAAA" };

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

function validAnalysis(overrides: Partial<AiAnalysis> = {}): AiAnalysis {
  return {
    analysisMode: "intent_check",
    analysisStatus: "ok",
    summary: "s",
    issues: [
      {
        id: "i1",
        severity: "high",
        title: "t",
        evidence: [{ evidenceId: "e1", source: "dom", statement: "s" }],
        guardrailId: "g1",
        guardrail: "Reference content stays dominant",
        whyItMatters: "w",
        confidence: "high",
        confidenceReason: "r",
        fixInstruction: "f",
      },
    ],
    preserved: [],
    insufficientEvidenceReasons: [],
    ...overrides,
  };
}

function geminiResponseFor(analysis: unknown) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] } }] };
}

function baseInput() {
  return {
    analysisMode: "intent_check" as const,
    guardrails: [guardrail()],
    diff,
    baselineScreenshot: screenshot,
    currentScreenshot: screenshot,
  };
}

describe("analyzeChanges", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    getApiKey.mockReset();
    getModel.mockReset();
    getApiKey.mockResolvedValue("test-api-key");
    getModel.mockResolvedValue("gemini-2.5-flash");
  });

  it("fails with GEMINI_KEY_MISSING when no key is configured", async () => {
    getApiKey.mockResolvedValue(null);
    const result = await analyzeChanges(baseInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("GEMINI_KEY_MISSING");
  });

  it("returns a validated AiAnalysis on the success path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => geminiResponseFor(validAnalysis()),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeChanges(baseInput());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.summary).toBe("s");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never includes accessibility data in the request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => geminiResponseFor(validAnalysis()),
    });
    vi.stubGlobal("fetch", fetchMock);

    await analyzeChanges(baseInput());
    const [, requestInit] = fetchMock.mock.calls[0] as [string, { body: string; headers: Record<string, string> }];
    expect(requestInit.body).not.toMatch(/accessibilityFindings|AccessibilityComparison/i);
  });

  it("sends the API key as a header, not a query parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => geminiResponseFor(validAnalysis()),
    });
    vi.stubGlobal("fetch", fetchMock);

    await analyzeChanges(baseInput());
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, { body: string; headers: Record<string, string> }];
    expect(url).not.toContain("test-api-key");
    expect(requestInit.headers["x-goog-api-key"]).toBe("test-api-key");
  });

  it("maps 401 to GEMINI_KEY_INVALID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    const result = await analyzeChanges(baseInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("GEMINI_KEY_INVALID");
  });

  it("maps 429 to GEMINI_RATE_LIMITED", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }));
    const result = await analyzeChanges(baseInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("GEMINI_RATE_LIMITED");
  });

  it("leads a rate-limit message with the wait time and keeps the raw detail", async () => {
    // Google buries "Please retry in 29.48747872s" at the end of several
    // sentences of docs URLs — the only part the user can act on.
    const quotaMessage =
      "You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash Please retry in 29.48747872s.";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: quotaMessage } }),
      }),
    );

    const result = await analyzeChanges(baseInput());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("GEMINI_RATE_LIMITED");
      expect(result.error.message.startsWith("Gemini rate limit reached. Try again in about 30 seconds.")).toBe(true);
      expect(result.error.message).toContain("limit: 20");
    }
  });

  it("falls back to a generic wait when the response carries no retry delay", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "Resource has been exhausted." } }),
      }),
    );

    const result = await analyzeChanges(baseInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("Try again shortly.");
  });

  it("maps 500 to GEMINI_SERVER_ERROR", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const result = await analyzeChanges(baseInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("GEMINI_SERVER_ERROR");
  });

  it("maps an aborted fetch to NETWORK_TIMEOUT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })),
    );
    const result = await analyzeChanges(baseInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NETWORK_TIMEOUT");
  });

  it("repairs once on a schema-invalid first response, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => geminiResponseFor({ not: "valid" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => geminiResponseFor(validAnalysis()) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeChanges(baseInput());
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails SCHEMA_VALIDATION_FAILED when the repair attempt also fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => geminiResponseFor({ not: "valid" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeChanges(baseInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("SCHEMA_VALIDATION_FAILED");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a response whose analysisMode disagrees with the locally computed mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => geminiResponseFor(validAnalysis({ analysisMode: "change_summary" })),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeChanges(baseInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("SCHEMA_VALIDATION_FAILED");
  });

  it("reorders issues so a must-linked issue comes before a should-linked one", async () => {
    const guardrails = [guardrail({ id: "must-1", priority: "must" }), guardrail({ id: "should-1", priority: "should" })];
    const analysis = validAnalysis({
      issues: [
        { ...validAnalysis().issues[0]!, id: "should-issue", guardrailId: "should-1" },
        { ...validAnalysis().issues[0]!, id: "must-issue", guardrailId: "must-1" },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => geminiResponseFor(analysis) }),
    );

    const result = await analyzeChanges({ ...baseInput(), guardrails });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.issues.map((i) => i.id)).toEqual(["must-issue", "should-issue"]);
  });
});

describe("guardrail ids in the request", () => {
  beforeEach(() => {
    getApiKey.mockResolvedValue("key");
    getModel.mockResolvedValue("gemini-3.6-flash");
  });

  it("sends each guardrail's stored id so the response can reference it", async () => {
    // Without the ids the model has to invent guardrailId values, so nothing
    // matches the stored guardrails: preserved entries render as "not
    // reported" and rank-issues can't tell must from should.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => geminiResponseFor(validAnalysis()),
    });
    vi.stubGlobal("fetch", fetchMock);

    await analyzeChanges({
      diff,
      guardrails: [guardrail({ id: "observed-0" }), guardrail({ id: "user-abc", priority: "should" })],
      analysisMode: "intent_check",
      baselineScreenshot: screenshot,
      currentScreenshot: screenshot,
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    const promptText = body.contents[0].parts.map((p: { text?: string }) => p.text ?? "").join("\n");
    expect(promptText).toContain("id=observed-0");
    expect(promptText).toContain("id=user-abc");
  });

  it("omits disabled guardrails from the list entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => geminiResponseFor(validAnalysis()),
    });
    vi.stubGlobal("fetch", fetchMock);

    await analyzeChanges({
      diff,
      guardrails: [guardrail({ id: "on" }), guardrail({ id: "off", enabled: false })],
      analysisMode: "intent_check",
      baselineScreenshot: screenshot,
      currentScreenshot: screenshot,
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    const promptText = body.contents[0].parts.map((p: { text?: string }) => p.text ?? "").join("\n");
    expect(promptText).toContain("id=on");
    expect(promptText).not.toContain("id=off");
  });
});

describe("recommendGuardrails", () => {
  const snapshot: PageSnapshot = {
    schemaVersion: 1,
    route: { routeKey: "http://localhost:3000/discover", fullUrl: "http://localhost:3000/discover", query: null, hash: null },
    capturedAt: "2026-08-20T00:00:00.000Z",
    viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 },
    readiness: { documentReadyState: "complete", ariaBusy: false, skeletonCandidateCount: 0, majorNodeCount: 10 },
    elements: [],
    contentHierarchy: [],
    interactionSummary: { buttonCount: 0, linkCount: 0, inputCount: 0, ctaCandidateCount: 0, navItemCount: 0 },
  };

  beforeEach(() => {
    vi.unstubAllGlobals();
    getApiKey.mockReset();
    getModel.mockReset();
    getApiKey.mockResolvedValue("test-api-key");
    getModel.mockResolvedValue("gemini-2.5-flash");
  });

  function guardrailResponse(guardrails: Array<{ statement: string; evidenceTypes: string[] }>) {
    return geminiResponseFor({ guardrails });
  }

  it("fails with GEMINI_KEY_MISSING when no key is configured", async () => {
    getApiKey.mockResolvedValue(null);
    const result = await recommendGuardrails({ screenshot, snapshot });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("GEMINI_KEY_MISSING");
  });

  it("maps suggestions to Guardrails defaulting to must/ai_suggested/enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => guardrailResponse([{ statement: "Reference content stays dominant", evidenceTypes: ["position"] }]),
      }),
    );

    const result = await recommendGuardrails({ screenshot, snapshot });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        statement: "Reference content stays dominant",
        priority: "must",
        source: "ai_suggested",
        enabled: true,
        scope: "route",
      });
    }
  });

  it("fails SCHEMA_VALIDATION_FAILED without a repair retry when more than 3 guardrails are returned", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () =>
        guardrailResponse([
          { statement: "a", evidenceTypes: [] },
          { statement: "b", evidenceTypes: [] },
          { statement: "c", evidenceTypes: [] },
          { statement: "d", evidenceTypes: [] },
        ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await recommendGuardrails({ screenshot, snapshot });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("SCHEMA_VALIDATION_FAILED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails SCHEMA_VALIDATION_FAILED on invalid JSON text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }),
      }),
    );

    const result = await recommendGuardrails({ screenshot, snapshot });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("SCHEMA_VALIDATION_FAILED");
  });
});

describe("validateApiKey", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns valid:true on a 200 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const result = await validateApiKey("some-key");
    expect(result).toEqual({ ok: true, data: true });
  });

  it("returns valid:false on 401/403 without treating it as a Result error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const result = await validateApiKey("bad-key");
    expect(result).toEqual({ ok: true, data: false });
  });

  it("fails with GEMINI_SERVER_ERROR on other non-ok statuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const result = await validateApiKey("some-key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("GEMINI_SERVER_ERROR");
  });

  it("fails with NETWORK_TIMEOUT when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await validateApiKey("some-key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NETWORK_TIMEOUT");
  });

  it("sends the key as a header, not a query parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    await validateApiKey("test-api-key");
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).not.toContain("test-api-key");
    expect(requestInit.headers["x-goog-api-key"]).toBe("test-api-key");
  });
});
