/**
 * REV-04 — AI-suggested guardrails default to priority "must"; the user can
 * lower a guardrail to "should" afterward. This factory is the one place
 * that default is set, for whatever calls the (not yet built, step 7)
 * Guardrail-recommendation feature to use.
 */

import type { EvidenceType, Guardrail } from "./types";

export function createAiSuggestedGuardrail(input: {
  id: string;
  statement: string;
  evidenceTypes: EvidenceType[];
}): Guardrail {
  return {
    id: input.id,
    statement: input.statement,
    priority: "must",
    evidenceTypes: input.evidenceTypes,
    scope: "route",
    enabled: true,
    source: "ai_suggested",
  };
}
