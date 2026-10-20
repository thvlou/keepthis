/**
 * Element matching between two PageSnapshots (CLAUDE.md section 7.2).
 * Priority: data-testid > stable id > role+accessibleName > structural
 * path+textHash. Extraction (extract-snapshot.ts) already picked each
 * element's best available fingerprint using this same priority, so matching
 * here just pairs elements whose fingerprints are equal and derives a match
 * confidence from which strategy produced that fingerprint.
 */

import type { ElementFingerprint, ElementSnapshot, MatchConfidence } from "../shared/types";

export type ElementMatch = {
  baseline: ElementSnapshot;
  current: ElementSnapshot;
  matchConfidence: MatchConfidence;
};

export type MatchResult = {
  matched: ElementMatch[];
  removed: ElementSnapshot[];
  added: ElementSnapshot[];
};

export function fingerprintKey(fp: ElementFingerprint): string {
  switch (fp.strategy) {
    case "testid":
      return `testid:${fp.value}`;
    case "stable-id":
      return `stable-id:${fp.value}`;
    case "role-name":
      return `role-name:${fp.role}:${fp.accessibleName}`;
    case "structural":
      return `structural:${fp.path}:${fp.textHash}`;
  }
}

/**
 * testid/stable-id are explicit, stable identifiers -> high confidence.
 * role+name is stable unless the page has several identical controls -> medium.
 * structural path+text is positional and breaks when siblings are added/removed -> low.
 */
export function confidenceForStrategy(strategy: ElementFingerprint["strategy"]): MatchConfidence {
  switch (strategy) {
    case "testid":
    case "stable-id":
      return "high";
    case "role-name":
      return "medium";
    case "structural":
      return "low";
  }
}

export function describeElement(el: ElementSnapshot): string {
  const fp = el.fingerprint;
  switch (fp.strategy) {
    case "testid":
      return fp.value;
    case "stable-id":
      return `#${fp.value}`;
    case "role-name":
      return `${fp.role}:${fp.accessibleName}`;
    case "structural":
      return `${el.tag}@${fp.path}`;
  }
}

export function matchElements(baselineElements: ElementSnapshot[], currentElements: ElementSnapshot[]): MatchResult {
  const currentByKey = new Map<string, ElementSnapshot[]>();
  for (const el of currentElements) {
    const key = fingerprintKey(el.fingerprint);
    const bucket = currentByKey.get(key);
    if (bucket) bucket.push(el);
    else currentByKey.set(key, [el]);
  }

  const matched: ElementMatch[] = [];
  const removed: ElementSnapshot[] = [];
  const usedCurrent = new Set<ElementSnapshot>();

  for (const baselineEl of baselineElements) {
    const key = fingerprintKey(baselineEl.fingerprint);
    const candidates = currentByKey.get(key);
    const candidate = candidates?.find((c) => !usedCurrent.has(c));
    if (candidate) {
      usedCurrent.add(candidate);
      matched.push({
        baseline: baselineEl,
        current: candidate,
        matchConfidence: confidenceForStrategy(baselineEl.fingerprint.strategy),
      });
    } else {
      removed.push(baselineEl);
    }
  }

  const added = currentElements.filter((el) => !usedCurrent.has(el));

  return { matched, removed, added };
}
