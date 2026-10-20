/**
 * REV-01/02 — the single entry point for the Results screen's top status
 * area. Renders the always-on comparison status line, or the D-07 page-state
 * banner instead when the query changed — never both (AC-REV-02).
 */

import type { ComparisonContext, RouteInfo } from "../../shared/types";
import { ComparisonStatusLine } from "./ComparisonStatusLine";
import { PageStateChangedBanner } from "./PageStateChangedBanner";

export function ComparisonHeader({
  context,
  baselineQuery,
  currentQuery,
}: {
  context: ComparisonContext;
  baselineQuery: RouteInfo["query"];
  currentQuery: RouteInfo["query"];
}) {
  if (context.queryChanged) {
    return <PageStateChangedBanner baselineQuery={baselineQuery} currentQuery={currentQuery} />;
  }
  return <ComparisonStatusLine context={context} />;
}
