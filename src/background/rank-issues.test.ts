import { describe, expect, it } from "vitest";
import { prioritizeMustViolations } from "./rank-issues";
import type { AnalysisIssue, Guardrail } from "../shared/types";

function guardrail(id: string, priority: Guardrail["priority"]): Guardrail {
  return { id, statement: "s", priority, evidenceTypes: [], scope: "route", enabled: true, source: "user_written" };
}

function issue(id: string, guardrailId: string | null): AnalysisIssue {
  return {
    id,
    severity: "high",
    title: id,
    evidence: [{ evidenceId: "e1", source: "dom", statement: "s" }],
    guardrailId,
    guardrail: guardrailId,
    whyItMatters: "w",
    confidence: "high",
    confidenceReason: "r",
    fixInstruction: "f",
  };
}

describe("prioritizeMustViolations", () => {
  const guardrails = [guardrail("must-1", "must"), guardrail("should-1", "should")];

  it("moves must-linked issues before should-linked issues", () => {
    const issues = [issue("a", "should-1"), issue("b", "must-1")];
    const result = prioritizeMustViolations(issues, guardrails);
    expect(result.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("preserves relative order among issues of the same priority", () => {
    const issues = [issue("a", "must-1"), issue("b", "must-1")];
    const result = prioritizeMustViolations(issues, guardrails);
    expect(result.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("truncates to maxIssues after prioritizing, dropping should-linked issues first", () => {
    const issues = [issue("a", "should-1"), issue("b", "must-1"), issue("c", "should-1"), issue("d", "must-1")];
    const result = prioritizeMustViolations(issues, guardrails, 3);
    expect(result.map((i) => i.id)).toEqual(["b", "d", "a"]);
  });

  it("treats change_summary issues (no guardrailId) as neutral priority", () => {
    const issues = [issue("a", null), issue("b", "must-1")];
    const result = prioritizeMustViolations(issues, guardrails);
    expect(result.map((i) => i.id)).toEqual(["b", "a"]);
  });
});
