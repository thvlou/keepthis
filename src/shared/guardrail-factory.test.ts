import { describe, expect, it } from "vitest";
import { createAiSuggestedGuardrail } from "./guardrail-factory";

describe("createAiSuggestedGuardrail", () => {
  it("defaults priority to must", () => {
    const guardrail = createAiSuggestedGuardrail({ id: "g1", statement: "Reference content stays dominant", evidenceTypes: ["position"] });
    expect(guardrail.priority).toBe("must");
  });

  it("is always ai_suggested, enabled, and route-scoped", () => {
    const guardrail = createAiSuggestedGuardrail({ id: "g1", statement: "s", evidenceTypes: [] });
    expect(guardrail.source).toBe("ai_suggested");
    expect(guardrail.enabled).toBe(true);
    expect(guardrail.scope).toBe("route");
  });
});
