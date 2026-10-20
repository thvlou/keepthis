/**
 * Builds ComparisonContext (REV-01) from data that already exists elsewhere —
 * no new collection. Always shown at the top of the Results screen,
 * regardless of analysisMode.
 */

import type { AnalysisMode, ComparisonContext, RouteInfo } from "./types";

export function buildComparisonContext(
  baselineRoute: RouteInfo,
  currentRoute: RouteInfo,
  viewportComparable: boolean,
  analysisMode: AnalysisMode,
): ComparisonContext {
  return {
    routeKey: currentRoute.routeKey,
    viewportComparable,
    queryChanged: baselineRoute.query !== currentRoute.query,
    analysisMode,
  };
}
