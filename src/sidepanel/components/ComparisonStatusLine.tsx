/**
 * REV-01 — always-shown comparison condition box at the top of the Results
 * screen. Render via ComparisonHeader, not directly — it must not appear
 * together with PageStateChangedBanner (AC-REV-02).
 *
 * Three stacked lines per the Figma, with the comparability line in full
 * ink: whether the two captures can be compared at all decides whether any
 * of the numbers below mean anything.
 */

import { Disclosure } from "./Disclosure";
import type { ComparisonContext } from "../../shared/types";
import { buildComparisonStatusLines } from "./comparison-copy";

export function ComparisonStatusLine({ context }: { context: ComparisonContext }) {
  const lines = buildComparisonStatusLines(context);

  /*
   * Collapsed by default. Comparability is the one line that changes what
   * the numbers below are worth, so it stays on the closed row; the route
   * and mode are confirmed once and then re-read only when something looks
   * wrong. Keeping all three open pushed the actual findings a screenful
   * down on a 400px panel every single time.
   */
  return (
    <Disclosure summary={lines.comparability}>
      <p className="kt-eyebrow" style={{ wordBreak: "break-all" }}>
        {lines.baseline}
      </p>
      <p className="kt-eyebrow" style={{ marginTop: 7 }}>
        {lines.mode}
      </p>
    </Disclosure>
  );
}
