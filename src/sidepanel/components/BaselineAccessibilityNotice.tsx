/**
 * a11y spec section 5 — Baseline-saved bottom sheet accessibility notice.
 *
 * No Ignore/Accept/Fix here by design (spec section 5): purely informational.
 *
 * Unlike the Results comparison there is no "new vs pre-existing" split to
 * make at baseline time — every finding is simply what the page has right
 * now — so the whole set goes through one grouped list. Grouping matters
 * most here: this is where a real page first shows what 40 raw axe lines
 * look like in a 400px panel.
 */

import { AccessibilityFindingGroups } from "./AccessibilityFindingGroups";
import { Disclosure } from "./Disclosure";
import type { AccessibilityFinding } from "../../shared/types";
import { buildBaselineNoticeSummaryLabel } from "./accessibility-copy";

export function BaselineAccessibilityNotice({ findings }: { findings: AccessibilityFinding[] }) {
  if (findings.length === 0) return null;

  return (
    <Disclosure tone="warn" summary={buildBaselineNoticeSummaryLabel(findings.length)}>
      <AccessibilityFindingGroups findings={findings} />
    </Disclosure>
  );
}
