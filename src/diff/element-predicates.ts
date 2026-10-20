/**
 * Element classification shared by compute-diff.ts and observe-baseline.ts.
 *
 * These live in one place on purpose: an observed guardrail ("the first
 * screen keeps at most 3 controls") is only meaningful if the later
 * Check Changes measurement counts "controls" the exact same way. If these
 * predicates drifted apart, a guardrail could read as violated purely
 * because two files disagreed on what an interactive element is.
 *
 * Scroll normalisation: ElementSnapshot.geometry comes from
 * getBoundingClientRect(), which is relative to the viewport at the moment
 * of capture. Comparing two snapshots taken at different scroll offsets
 * therefore reports every element as having moved by the scroll delta —
 * observed in real use as a uniform -1311px shift across 141 "changes"
 * when the page simply happened to be scrolled down. Everything positional
 * here converts to document coordinates first, using the scrollY each
 * snapshot already records, so measurements are independent of where the
 * user left the page.
 */

import type { ElementSnapshot } from "../shared/types";

/** The parts of PageSnapshot.viewport needed to place an element in the document. */
export type ViewportContext = { height: number; scrollY: number };

const INTERACTIVE_TAGS = new Set(["button", "a", "input", "select", "textarea"]);

export function isInteractive(el: ElementSnapshot): boolean {
  return INTERACTIVE_TAGS.has(el.tag) || el.role === "button" || el.role === "link";
}

/** Landmarks that hold site chrome rather than this page's own content. */
export const SITE_CHROME_LANDMARKS: ReadonlySet<string> = new Set([
  "banner",
  "navigation",
  "contentinfo",
  "complementary",
]);

export function isMainContent(el: ElementSnapshot): boolean {
  return el.landmark === "main";
}

/**
 * "Inside this page's content area", resolved against the page actually
 * captured.
 *
 * A strict `landmark === "main"` test silently returns nothing on a page
 * with no <main> or role="main" — which is common in generated markup —
 * so every content-based measurement and guardrail candidate would vanish
 * without any error. Falling back to "anything not inside site chrome"
 * keeps those working on plain-<div> pages.
 *
 * Built per snapshot so the same rule is applied consistently to every
 * element in it, and derived identically wherever it is used.
 */
export function createContentScopePredicate(elements: ElementSnapshot[]): (el: ElementSnapshot) => boolean {
  const hasMainLandmark = elements.some(isMainContent);
  if (hasMainLandmark) return isMainContent;
  return (el) => !SITE_CHROME_LANDMARKS.has(el.landmark ?? "");
}

const LANDMARK_TAGS = new Set(["main", "header", "nav", "footer", "aside"]);
const LANDMARK_ROLES = new Set(["banner", "navigation", "main", "contentinfo", "complementary"]);

function isLandmarkContainer(el: ElementSnapshot): boolean {
  return LANDMARK_TAGS.has(el.tag) || LANDMARK_ROLES.has(el.role ?? "");
}

/**
 * A countable content item — the things a person means by "how much
 * content is on screen".
 *
 * Being inside the content area is not enough: <main> itself, the section
 * headings, and the buttons within it all match that scope, so a page
 * showing 7 cards reported "11 main content items". Nobody can check that
 * number against what they see, and it silently mixes controls (already
 * counted separately by isInteractive) into a content measure. Containers,
 * headings and interactive elements are therefore excluded here.
 */
export function createContentItemPredicate(elements: ElementSnapshot[]): (el: ElementSnapshot) => boolean {
  const inContentArea = createContentScopePredicate(elements);
  return (el) =>
    inContentArea(el) && !isLandmarkContainer(el) && el.headingLevel === null && !isInteractive(el);
}

/**
 * Elements CSS pins to the viewport instead of the document. Their
 * getBoundingClientRect() is already the stable frame, so adding scrollY
 * would invent movement: a sticky header captured 1593px down reads as
 * document y=1593 one time and y=0 the next, purely from where the page
 * happened to be scrolled.
 */
const VIEWPORT_PINNED_POSITIONS = new Set(["fixed", "sticky"]);

function isViewportPinned(el: ElementSnapshot): boolean {
  return VIEWPORT_PINNED_POSITIONS.has(el.cssPosition ?? "static");
}

/**
 * Distance from the top of the document, independent of capture-time
 * scroll — except for viewport-pinned elements, where the viewport-relative
 * coordinate is itself the stable one and is returned unchanged.
 */
export function documentY(el: ElementSnapshot, viewport: ViewportContext): number {
  return isViewportPinned(el) ? el.geometry.y : el.geometry.y + viewport.scrollY;
}

/**
 * Would be on screen with the page scrolled to the top — i.e. "reachable
 * without scrolling", which is what the guardrails actually claim.
 *
 * Deliberately not ElementSnapshot.visibility.intersectsViewport: that flag
 * records whether the element was on screen *at capture time*, so a
 * baseline taken at the top and a current taken half-way down would report
 * fold transitions for elements that never moved.
 */
export function isInFirstViewport(el: ElementSnapshot, viewport: ViewportContext): boolean {
  if (!isRendered(el)) return false;
  const top = documentY(el, viewport);
  return top < viewport.height && top + el.geometry.height > 0;
}

/**
 * Actually painted somewhere on the page, whether or not it is above the
 * fold. The DOM snapshot covers the whole document (extract-snapshot.ts
 * walks the entire tree), so this is what distinguishes "exists on the
 * page" from "hidden" — position relative to the fold is a separate
 * question answered by isInFirstViewport.
 */
export function isRendered(el: ElementSnapshot): boolean {
  return (
    el.visibility.display !== "none" && el.visibility.visibility !== "hidden" && el.visibility.opacity > 0
  );
}

export function countInFirstViewport(
  elements: ElementSnapshot[],
  viewport: ViewportContext,
  predicate: (el: ElementSnapshot) => boolean,
): number {
  return elements.filter((el) => predicate(el) && isInFirstViewport(el, viewport)).length;
}

export function countOnPage(elements: ElementSnapshot[], predicate: (el: ElementSnapshot) => boolean): number {
  return elements.filter((el) => predicate(el) && isRendered(el)).length;
}
