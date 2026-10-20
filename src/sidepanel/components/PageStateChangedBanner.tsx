/**
 * D-07 / AC-REV-02 — shown instead of ComparisonStatusLine when the baseline
 * and current query strings differ. Not an issue: no severity, confidence,
 * or Fix action. Not yet mounted anywhere (Results screen is step 8).
 */

import type { RouteInfo } from "../../shared/types";
import { formatQueryForDisplay } from "./comparison-copy";

export function PageStateChangedBanner({
  baselineQuery,
  currentQuery,
}: {
  baselineQuery: RouteInfo["query"];
  currentQuery: RouteInfo["query"];
}) {
  return (
    <section>
      <p>Page state changed</p>
      <p>The baseline was captured with a different page state.</p>
      <p>baseline: {formatQueryForDisplay(baselineQuery)}</p>
      <p>current: {formatQueryForDisplay(currentQuery)}</p>
      <p>Some differences may come from this state, not from your edits.</p>
    </section>
  );
}
