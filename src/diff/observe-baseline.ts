/**
 * Code-derived guardrail candidates (no AI involved).
 *
 * Why this exists: writing a guardrail from a blank field asks the user to
 * predict what a future AI edit might break, at the exact moment they know
 * least about it — so most users skipped it, landed in change_summary mode,
 * and never saw the product's actual differentiator. These candidates flip
 * that: the code states what is *already observably true* of the baseline
 * and the user just confirms it with one tap.
 *
 * Every statement here must be:
 *   - observable (CLAUDE.md 6.1: an observable relationship, never an
 *     aesthetic judgement like "looks more professional")
 *   - measurable later by the exact same predicate compute-diff.ts uses,
 *     which is why both import from element-predicates.ts
 *
 * These are proposals only. A Guardrail is created solely from what the
 * user leaves checked, so `source` stays "user_written" — the user is the
 * one asserting it should stay true; the code only drafted the sentence.
 * (AC-06 constrains `source` to ai_suggested / user_written.)
 */

import {
  countInFirstViewport,
  createContentItemPredicate,
  createContentScopePredicate,
  documentY,
  isInFirstViewport,
  isInteractive,
  isRendered,
  SITE_CHROME_LANDMARKS,
  type ViewportContext,
} from "./element-predicates";
import type { ElementSnapshot, EvidenceType, Guardrail, PageSnapshot } from "../shared/types";

/** How many candidates the sheet offers, matching guardrailListSchema.max(3). */
const MAX_CANDIDATES = 3;
/** Candidates beyond this rank are offered unchecked rather than pre-confirmed. */
const PRE_ENABLED_COUNT = 2;

/*
 * Site chrome (SITE_CHROME_LANDMARKS, imported above) is excluded from
 * primary-action candidates: a logo link or nav item is interactive and
 * often the largest thing on screen, but "the logo stays reachable"
 * protects nothing — chrome practically never moves below the fold, so
 * offering it wastes one of three slots.
 */

/**
 * Below this, a "keep at least N visible" guardrail can't detect anything
 * worth detecting: a floor of 1-2 items survives almost any layout change,
 * so it would read as protection while protecting nothing.
 */
const MIN_MEANINGFUL_CONTENT_ITEMS = 3;

/**
 * A control budget with headroom, not the current count.
 *
 * Pinning the ceiling to today's exact count made any single addition a
 * violation: a banner the user deliberately asked for, carrying a link and
 * a dismiss button, took the first screen from 9 to 10 and was reported as
 * a regression — with a fix instruction proposing that navigation be
 * removed to get back under the line. The regression worth catching is a
 * control area ballooning (CLAUDE.md 17.1 goes 3 → 9), not +1.
 */
function controlCeiling(current: number): number {
  return Math.max(current + 2, Math.ceil(current * 1.5));
}

type Candidate = {
  statement: string;
  evidenceTypes: EvidenceType[];
};

/**
 * Accessible names often carry decorative affordance glyphs ("둘러보기 →").
 * They belong on the button, not inside a guardrail sentence.
 */
function cleanName(name: string): string {
  return name.replace(/[\s→➔➜»›>→-⇿]+$/u, "").trim();
}

/**
 * The element a sentence points at, shown as context — never as the rule.
 *
 * Quoting an element's text *as* the rule broke on the first data-driven
 * page it met: a heading assembled from the user's own filter selection
 * ("5년차 프론트엔드 개발자 예상 연봉") became a guardrail that changing a
 * dropdown would violate, with no edit involved at all. The rule clause now
 * names the element by a role that can be re-derived from any snapshot, and
 * the text appears only so the user knows what is being pointed at — the
 * same shape the control budget already used ("…14개를 넘지 않는다 (현재 9개)").
 *
 * This narrows the risk rather than removing it: the captured text still
 * travels to Gemini inside the sentence, so SYSTEM_PROMPT tells it that a
 * "(지금: …)" clause is an example from capture time and not a string that
 * must survive. The underlying cause — text-derived element fingerprints
 * making interpolated content look removed+added — is out of MVP scope.
 */
const MAX_CONTEXT_CHARS = 22;

function nowShowing(name: string): string {
  const clean = cleanName(name);
  const shown = clean.length > MAX_CONTEXT_CHARS ? clean.slice(0, MAX_CONTEXT_CHARS) + "…" : clean;
  return ' (지금: "' + shown + '")';
}

/**
 * A named section heading inside the main content — the most concrete
 * thing on the page a person can point at and say "that has to stay".
 *
 * Preferred over a raw element count: counting everything the snapshot
 * collected inside <main> yields numbers like 53, which is true but not
 * something anyone can reason about, and it turns any single element
 * removal into a violation. A heading is nameable, and compute-diff
 * already detects its removal or displacement through the same
 * role+accessible-name fingerprint.
 */
function findKeyContentSection(
  elements: ElementSnapshot[],
  viewport: ViewportContext,
  isContent: (el: ElementSnapshot) => boolean,
): ElementSnapshot | null {
  const headings = elements.filter(
    (el) =>
      el.headingLevel !== null &&
      isContent(el) &&
      isRendered(el) &&
      el.accessibleName !== null &&
      cleanName(el.accessibleName) !== "",
  );
  if (headings.length === 0) return null;

  // Shallowest heading level wins (h2 outranks h4); ties go to the topmost.
  return headings.reduce((best, el) => {
    if (el.headingLevel !== best.headingLevel) {
      return (el.headingLevel ?? 6) < (best.headingLevel ?? 6) ? el : best;
    }
    return documentY(el, viewport) < documentY(best, viewport) ? el : best;
  });
}

/**
 * The most prominent page action sitting in the first screen. Site chrome
 * is excluded first, then real actions (buttons) are preferred over
 * navigation links, and only then does size decide — largest rendered area
 * wins, earliest on the page breaks ties.
 *
 * Picking purely by size selected the site logo on a real page, which is a
 * technically-true but useless thing to protect. This is a "primary action
 * candidate" in CLAUDE.md 6 terms, not a claim about what the user
 * considers primary, which is why it is offered for confirmation.
 */
function findPrimaryActionCandidate(
  elements: ElementSnapshot[],
  viewport: ViewportContext,
): ElementSnapshot | null {
  const eligible = elements.filter(
    (el) =>
      isInteractive(el) &&
      isInFirstViewport(el, viewport) &&
      el.accessibleName !== null &&
      el.accessibleName !== "" &&
      !SITE_CHROME_LANDMARKS.has(el.landmark ?? ""),
  );
  if (eligible.length === 0) return null;

  const actions = eligible.filter((el) => el.tag === "button" || el.role === "button");
  const pool = actions.length > 0 ? actions : eligible;

  return pool.reduce((best, el) => {
    const bestArea = best.geometry.width * best.geometry.height;
    const elArea = el.geometry.width * el.geometry.height;
    if (elArea !== bestArea) return elArea > bestArea ? el : best;
    return documentY(el, viewport) < documentY(best, viewport) ? el : best;
  });
}

function buildCandidates(snapshot: PageSnapshot): Candidate[] {
  const candidates: Candidate[] = [];
  const viewport: ViewportContext = { height: snapshot.viewport.height, scrollY: snapshot.viewport.scrollY };
  // Two different questions: the section heading must be *inside* the
  // content area (headings are in scope), while the count must exclude
  // headings and containers so it matches what a person sees.
  const isInContentArea = createContentScopePredicate(snapshot.elements);
  const isContentItem = createContentItemPredicate(snapshot.elements);

  const primaryAction = findPrimaryActionCandidate(snapshot.elements, viewport);
  if (primaryAction?.accessibleName) {
    candidates.push({
      statement: `본문의 주요 액션에 스크롤 없이 닿을 수 있다${nowShowing(primaryAction.accessibleName)}`,
      evidenceTypes: ["position", "visibility"],
    });
  }

  // The DOM snapshot covers the whole document, so an observation must not
  // be blind to everything below the fold: on a page that opens with a
  // full-bleed hero, first-viewport measures describe the hero rather than
  // the content the user actually cares about keeping.
  const keySection = findKeyContentSection(snapshot.elements, viewport, isInContentArea);
  if (keySection?.accessibleName) {
    candidates.push({
      statement: `본문의 주요 섹션이 페이지에 남아 있다${nowShowing(keySection.accessibleName)}`,
      evidenceTypes: ["visibility", "flow"],
    });
  }

  const mainVisible = countInFirstViewport(snapshot.elements, viewport, isContentItem);
  if (mainVisible >= MIN_MEANINGFUL_CONTENT_ITEMS) {
    candidates.push({
      statement: `첫 화면에 주요 콘텐츠가 ${mainVisible}개 이상 보인다`,
      evidenceTypes: ["count", "visibility"],
    });
  }

  const controlsVisible = countInFirstViewport(snapshot.elements, viewport, isInteractive);
  if (controlsVisible > 0) {
    candidates.push({
      statement: `첫 화면의 컨트롤이 ${controlCeiling(controlsVisible)}개를 넘지 않는다 (현재 ${controlsVisible}개)`,
      evidenceTypes: ["count"],
    });
  }

  const sectionOrder = snapshot.contentHierarchy.length;
  if (sectionOrder > 1) {
    candidates.push({
      statement: "페이지 섹션의 현재 순서가 유지된다",
      evidenceTypes: ["flow"],
    });
  }

  return candidates;
}

/**
 * Reads a just-captured baseline snapshot and returns guardrail candidates
 * ranked by how directly they protect first-screen usability. Returns []
 * for a snapshot with nothing observable (the sheet then falls back to
 * manual entry, per 6.1 "Baseline 저장은 Guardrail 작성 때문에 막히지 않는다").
 */
export function observeGuardrailCandidates(snapshot: PageSnapshot): Guardrail[] {
  return buildCandidates(snapshot)
    .slice(0, MAX_CANDIDATES)
    .map((candidate, index) => ({
      id: `observed-${index}`,
      statement: candidate.statement,
      priority: "must" as const,
      evidenceTypes: candidate.evidenceTypes,
      scope: "route" as const,
      enabled: index < PRE_ENABLED_COUNT,
      source: "user_written" as const,
    }));
}
