import { describe, expect, it } from "vitest";
import { buildComparisonStatusLine, formatQueryForDisplay } from "./comparison-copy";
import type { ComparisonContext } from "../../shared/types";

function context(overrides: Partial<ComparisonContext> = {}): ComparisonContext {
  return {
    routeKey: "http://localhost:3000/discover",
    viewportComparable: true,
    queryChanged: false,
    analysisMode: "intent_check",
    ...overrides,
  };
}

describe("buildComparisonStatusLine", () => {
  it("strips the protocol and reports a viewport match", () => {
    expect(buildComparisonStatusLine(context())).toBe(
      "Since baseline · localhost:3000/discover · viewport match · same page state",
    );
  });

  it("reports a viewport mismatch", () => {
    expect(buildComparisonStatusLine(context({ viewportComparable: false }))).toBe(
      "Since baseline · localhost:3000/discover · viewport mismatch · same page state",
    );
  });
});

describe("formatQueryForDisplay", () => {
  it("shows the raw query string when present", () => {
    expect(formatQueryForDisplay("?filter=all")).toBe("?filter=all");
  });

  it("shows a placeholder when there is no query", () => {
    expect(formatQueryForDisplay(null)).toBe("(none)");
  });
});
