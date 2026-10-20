/**
 * The measured facts, kept but demoted.
 *
 * The impact statements above answer "what does this mean for the first
 * screen"; this answers "what exactly did the code measure". Keeping it
 * one click away rather than deleting it preserves traceability — every
 * headline should be checkable against the numbers behind it — without
 * making raw pixel deltas the first thing the user reads.
 *
 * Grouped by kind and capped per group: an unfiltered dump ran to 141 rows
 * of near-identical entries in real use, which is not a record anyone can
 * read. Structural-path elements (low match confidence) sort last within
 * their group because they are usually layout wrappers around a named
 * element that is already listed.
 */
import { Disclosure } from "./Disclosure";
import { buildMeasuredChangesLabel } from "./accessibility-copy";
import { COUNTS, PROSE } from "../copy";
import type { LocalDiff, LocalDiffChange, LocalDiffChangeKind } from "../../shared/types";

/** Rows shown per kind before the rest collapse into a count. */
const MAX_ROWS_PER_KIND = 6;

/**
 * Korean, unlike the element ids and numbers inside each group: these are
 * headings a person reads to find what they're looking for, not identifiers
 * they'd search for elsewhere.
 */
const KIND_LABELS: Record<LocalDiffChangeKind, string> = {
  added: "새로 생김",
  removed: "사라짐",
  position: "위치 이동",
  size: "크기 변경",
  visibility: "표시 여부 변경",
  visible_count: "콘텐츠 개수",
  interactive_count: "컨트롤 개수",
  order: "섹션 순서",
  fold_transition: "첫 화면 경계를 넘음",
  overlay_occlusion: "콘텐츠를 가림",
  viewport_mismatch: "화면 크기 불일치",
  readiness: "페이지 로딩 상태",
};

/** describeElement() renders role-name as "role:name"; lead with the name. */
function readableElement(raw: string | undefined): string {
  if (!raw) return "element";
  const roleName = /^([a-z]+):(.+)$/.exec(raw);
  return roleName ? `${roleName[2]} (${roleName[1]})` : raw;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(Math.round(value * 100) / 100);
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return (
      Object.entries(value as Record<string, unknown>)
        .map(([key, val]) => `${key} ${formatValue(val)}`)
        .join(", ") || "—"
    );
  }
  return String(value);
}

function formatDetail(change: LocalDiffChange): string {
  const parts: string[] = [];
  if (change.before !== undefined) parts.push(`${formatValue(change.before)}`);
  if (change.current !== undefined) parts.push(`→ ${formatValue(change.current)}`);
  return parts.join(" ");
}

function groupByKind(changes: LocalDiffChange[]): Array<[LocalDiffChangeKind, LocalDiffChange[]]> {
  const groups = new Map<LocalDiffChangeKind, LocalDiffChange[]>();
  for (const change of changes) {
    const bucket = groups.get(change.kind);
    if (bucket) bucket.push(change);
    else groups.set(change.kind, [change]);
  }
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => {
      const aLow = a.matchConfidence === "low" ? 1 : 0;
      const bLow = b.matchConfidence === "low" ? 1 : 0;
      return aLow - bLow;
    });
  }
  return [...groups.entries()];
}

export function ChangeFactsDisclosure({ diff, description }: { diff: LocalDiff; description: string }) {
  const groups = groupByKind(diff.changes);

  return (
    <Disclosure summary={buildMeasuredChangesLabel(diff.changes.length)}>
      <div>
        {description && (
          <p
            style={{
              fontSize: "var(--kt-size-value)",
              lineHeight: "var(--kt-line-value)",
              color: "var(--kt-text-primary)",
              margin: "0 0 12px",
            }}
          >
            {description}
          </p>
        )}

        {groups.map(([kind, changes]) => {
          const shown = changes.slice(0, MAX_ROWS_PER_KIND);
          const hidden = changes.length - shown.length;
          return (
            <div key={kind} style={{ marginBottom: 10 }}>
              <p className="kt-eyebrow">
                {KIND_LABELS[kind] ?? kind} ({changes.length})
              </p>
              <ul
                style={{
                  paddingLeft: 16,
                  fontSize: "var(--kt-size-note)",
                  lineHeight: "var(--kt-line-note)",
                  color: "var(--kt-text-primary)",
                  margin: "4px 0 0",
                }}
              >
                {shown.map((change) => (
                  <li key={change.evidenceId} style={{ wordBreak: "break-word" }}>
                    {readableElement(change.element ?? change.scope)}
                    {formatDetail(change) && <span style={{ color: "var(--kt-text-muted)" }}> — {formatDetail(change)}</span>}
                  </li>
                ))}
                {hidden > 0 && <li style={{ color: "var(--kt-text-muted)" }}>{COUNTS.andMore(hidden)}</li>}
              </ul>
            </div>
          );
        })}

        {diff.changes.length === 0 && <p className="kt-meta">{PROSE.noMeasuredChanges}</p>}
      </div>
    </Disclosure>
  );
}
