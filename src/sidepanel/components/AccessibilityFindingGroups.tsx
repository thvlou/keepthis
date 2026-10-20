/**
 * Renders grouped axe-core findings: what the rule checks, how many places
 * failed it, and — where the values matter — one line per distinct failure.
 *
 * The headline used to be the bare rule id, on the reasoning that rewriting
 * axe's prose would mean asserting something axe did not say. In use that was
 * the wrong call: `COLOR-CONTRAST` over `#858688 on #ffffff — 3.64:1 (needs
 * 4.5:1) ×18` reads as disconnected fragments, and this panel is for a
 * designer, not for the person who wrote the rule. Restating a rule in Korean
 * adds no finding — the counts and colour values still come from axe verbatim
 * and the rule id stays on the row so any line can be traced back.
 */

import { groupAccessibilityFindings } from "../../diff/group-accessibility-findings";
import { COUNTS } from "../copy";
import { detailIsRedundant, explainRule, formatDetail } from "./accessibility-rule-copy";
import type { AccessibilityFinding } from "../../shared/types";

/** Beyond this, a single rule's variants become their own wall of text. */
const MAX_VARIANTS = 4;

/**
 * And beyond this, the rules do. axe runs its full default rule set, so the
 * number of rules a page trips is a property of that page, not of anything
 * this panel controls — without a ceiling here the block is bounded only by
 * how bad the site is. Six worst-impact rules, then a count of the rest.
 */
const MAX_GROUPS = 6;

export function AccessibilityFindingGroups({
  findings,
  muted,
}: {
  findings: AccessibilityFinding[];
  muted?: boolean;
}) {
  const allGroups = groupAccessibilityFindings(findings);
  const groups = allGroups.slice(0, MAX_GROUPS);
  const hiddenGroups = allGroups.length - groups.length;

  return (
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.map((group) => {
        const explanation = explainRule(group.ruleId);
        // A single variant the headline already covers is one fact printed twice.
        const worthShowing =
          group.variants.length === 1 && detailIsRedundant(group.ruleId, group.variants[0]!.detail)
            ? []
            : group.variants;
        const shown = worthShowing.slice(0, MAX_VARIANTS);
        const hidden = worthShowing.length - shown.length;

        return (
          <div key={group.ruleId}>
            <p
              style={{
                margin: 0,
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                fontSize: "var(--kt-size-value)",
                lineHeight: "var(--kt-line-value)",
                color: muted ? "var(--kt-text-muted)" : "var(--kt-text-primary)",
                wordBreak: "keep-all",
              }}
            >
              <span>{explanation ?? group.ruleId}</span>
              <span style={{ flex: "0 0 auto" }}>{COUNTS.accessibilityPlaces(group.total)}</span>
            </p>

            <a
              href={group.helpUrl}
              target="_blank"
              rel="noreferrer"
              className="kt-eyebrow"
              style={{ display: "inline-block", marginTop: 2, color: "var(--kt-text-muted)", wordBreak: "break-all" }}
            >
              {group.ruleId} ↗
            </a>

            {shown.length > 0 && (
              <ul style={{ paddingLeft: 14, margin: "4px 0 0" }}>
                {shown.map((variant, index) => (
                  <li
                    key={index}
                    style={{
                      fontSize: "var(--kt-size-note)",
                      lineHeight: "var(--kt-line-note)",
                      color: "var(--kt-text-muted)",
                      marginBottom: 2,
                      wordBreak: "break-word",
                    }}
                  >
                    {formatDetail(variant.detail)}
                    {variant.count > 1 && (
                      <span style={{ whiteSpace: "nowrap" }}> · {COUNTS.accessibilityPlaces(variant.count)}</span>
                    )}
                  </li>
                ))}
                {hidden > 0 && (
                  <li
                    style={{
                      fontSize: "var(--kt-size-note)",
                      lineHeight: "var(--kt-line-note)",
                      color: "var(--kt-text-muted)",
                    }}
                  >
                    {COUNTS.andMore(hidden)}
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}

      {hiddenGroups > 0 && (
        <p
          style={{
            margin: 0,
            fontSize: "var(--kt-size-note)",
            lineHeight: "var(--kt-line-note)",
            color: "var(--kt-text-muted)",
          }}
        >
          {COUNTS.accessibilityMoreRules(hiddenGroups)}
        </p>
      )}
    </div>
  );
}
