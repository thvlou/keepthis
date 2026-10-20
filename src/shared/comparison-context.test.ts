import { describe, expect, it } from "vitest";
import { buildComparisonContext } from "./comparison-context";
import type { RouteInfo } from "./types";

function route(overrides: Partial<RouteInfo> = {}): RouteInfo {
  return {
    routeKey: "http://localhost:3000/discover",
    fullUrl: "http://localhost:3000/discover",
    query: null,
    hash: null,
    ...overrides,
  };
}

describe("buildComparisonContext", () => {
  it("reflects the current routeKey and a comparable viewport", () => {
    const context = buildComparisonContext(route(), route(), true, "intent_check");
    expect(context).toEqual({
      routeKey: "http://localhost:3000/discover",
      viewportComparable: true,
      queryChanged: false,
      analysisMode: "intent_check",
    });
  });

  it("flags a query change between baseline and current", () => {
    const context = buildComparisonContext(
      route({ query: "?filter=none" }),
      route({ query: "?filter=all" }),
      true,
      "change_summary",
    );
    expect(context.queryChanged).toBe(true);
  });

  it("carries a viewport mismatch through unchanged", () => {
    const context = buildComparisonContext(route(), route(), false, "intent_check");
    expect(context.viewportComparable).toBe(false);
  });
});
