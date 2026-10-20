import { describe, expect, it } from "vitest";
import { ANALYSIS_STEPS, ANALYSIS_STEP_LABELS, isAnalysisProgressNotice } from "./analysis-progress";

describe("analysis progress contract", () => {
  it("orders measurement before interpretation", () => {
    // The panel renders this order literally, and it is the product's claim:
    // code measures everything first, the model only interprets afterwards.
    const geminiAt = ANALYSIS_STEPS.indexOf("gemini");
    for (const measured of ["capture", "diff", "accessibility"] as const) {
      expect(ANALYSIS_STEPS.indexOf(measured)).toBeLessThan(geminiAt);
    }
    expect(ANALYSIS_STEPS.indexOf("validate")).toBeGreaterThan(geminiAt);
  });

  it("labels every step", () => {
    for (const step of ANALYSIS_STEPS) {
      expect(ANALYSIS_STEP_LABELS[step]).toBeTruthy();
    }
  });

  it("accepts a well-formed notice", () => {
    expect(
      isAnalysisProgressNotice({
        kind: "ANALYSIS_PROGRESS",
        routeKey: "http://localhost:4173/",
        step: "diff",
        status: "done",
      }),
    ).toBe(true);
  });

  it("rejects request/response messages so the worker's own switch ignores them", () => {
    expect(isAnalysisProgressNotice({ action: "CHECK_CHANGES", payload: {} })).toBe(false);
    expect(isAnalysisProgressNotice(undefined)).toBe(false);
    expect(isAnalysisProgressNotice({ kind: "ANALYSIS_PROGRESS", step: "not-a-step" })).toBe(false);
  });
});
