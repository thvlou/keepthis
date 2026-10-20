import { describe, expect, it } from "vitest";
import { formatGuardrailPriorityLabel } from "./guardrail-copy";

describe("formatGuardrailPriorityLabel", () => {
  it("labels must as Must stay", () => {
    expect(formatGuardrailPriorityLabel("must")).toBe("Must stay");
  });

  it("labels should as Prefer to stay", () => {
    expect(formatGuardrailPriorityLabel("should")).toBe("Prefer to stay");
  });
});
