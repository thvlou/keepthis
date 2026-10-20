import { describe, expect, it } from "vitest";
import { observeGuardrailCandidates } from "./observe-baseline";
import type { ElementSnapshot, PageSnapshot } from "../shared/types";

/**
 * The candidate sentences name an element by role and carry its current text
 * only as context, so these helpers keep the tests asserting the thing they
 * care about — which element got picked — rather than the phrasing.
 */
const actionOn = (name: string) => `본문의 주요 액션에 스크롤 없이 닿을 수 있다 (지금: "${name}")`;
const sectionOn = (name: string) => `본문의 주요 섹션이 페이지에 남아 있다 (지금: "${name}")`;


function element(overrides: Partial<ElementSnapshot> = {}): ElementSnapshot {
  return {
    fingerprint: { strategy: "stable-id", value: "el" },
    tag: "div",
    role: null,
    accessibleName: null,
    geometry: { x: 0, y: 0, width: 100, height: 50, viewportCoveragePercent: 100 },
    visibility: { display: "block", visibility: "visible", opacity: 1, intersectsViewport: true },
    landmark: null,
    headingLevel: null,
    ...overrides,
  };
}

function snapshot(elements: ElementSnapshot[], contentHierarchy: PageSnapshot["contentHierarchy"] = []): PageSnapshot {
  return {
    schemaVersion: 1,
    route: { routeKey: "http://localhost:3000/", fullUrl: "http://localhost:3000/", query: null, hash: null },
    capturedAt: "2026-08-22T00:00:00.000Z",
    viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 },
    readiness: { documentReadyState: "complete", ariaBusy: false, skeletonCandidateCount: 0, majorNodeCount: 100 },
    elements,
    contentHierarchy,
    interactionSummary: { buttonCount: 0, linkCount: 0, inputCount: 0, ctaCandidateCount: 0, navItemCount: 0 },
  };
}

describe("observeGuardrailCandidates", () => {
  it("returns nothing observable for an empty page", () => {
    expect(observeGuardrailCandidates(snapshot([]))).toEqual([]);
  });

  /*
   * Regression: a heading assembled from the user's own filter selection
   * ("5년차 프론트엔드 개발자 예상 연봉") used to become the rule itself, so
   * changing a dropdown would violate the guardrail with no edit involved.
   * The rule clause must name the element by role; the captured text may only
   * follow as context.
   */
  it("does not make an element's current text the rule itself", () => {
    const volatile = "5년차 프론트엔드 개발자 예상 연봉";
    const candidates = observeGuardrailCandidates(
      snapshot(
        [
          element({
            tag: "h1",
            headingLevel: 1,
            accessibleName: volatile,
            landmark: "main",
            geometry: { x: 0, y: 200, width: 600, height: 40, viewportCoveragePercent: 100 },
          }),
        ],
        [{ kind: "landmark", label: "main", order: 0 }],
      ),
    );

    const section = candidates.find((c) => c.statement.includes("섹션이 페이지에 남아 있다"));
    expect(section).toBeDefined();
    // The sentence opens with the rule, not with the element's text...
    expect(section?.statement.startsWith("본문의 주요 섹션")).toBe(true);
    // ...and the text is confined to the trailing context clause.
    expect(section?.statement.indexOf(volatile.slice(0, 8))).toBeGreaterThan(
      section!.statement.indexOf("남아 있다"),
    );
  });

  it("truncates a long name in the context clause", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({
          tag: "button",
          accessibleName: "A button label far longer than the context clause should ever print",
          geometry: { x: 0, y: 400, width: 200, height: 60, viewportCoveragePercent: 100 },
        }),
      ]),
    );

    expect(candidates[0]?.statement).toContain("…");
    expect(candidates[0]?.statement.length).toBeLessThan(60);
  });

  it("names the largest first-screen interactive element as the primary action", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({
          tag: "button",
          accessibleName: "Save",
          geometry: { x: 0, y: 400, width: 200, height: 60, viewportCoveragePercent: 100 },
        }),
        element({
          tag: "a",
          accessibleName: "Terms",
          geometry: { x: 0, y: 100, width: 40, height: 12, viewportCoveragePercent: 100 },
        }),
      ]),
    );

    expect(candidates[0]?.statement).toBe(actionOn("Save"));
  });

  it("ignores interactive elements below the fold when picking the primary action", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({
          tag: "button",
          accessibleName: "Huge footer button",
          geometry: { x: 0, y: 3000, width: 900, height: 200, viewportCoveragePercent: 0 },
          visibility: { display: "block", visibility: "visible", opacity: 1, intersectsViewport: false },
        }),
        element({
          tag: "button",
          accessibleName: "Cart",
          geometry: { x: 0, y: 20, width: 80, height: 40, viewportCoveragePercent: 100 },
        }),
      ]),
    );

    expect(candidates[0]?.statement).toBe(actionOn("Cart"));
  });

  it("counts only main-landmark items visible in the first screen", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({ landmark: "main" }),
        element({ landmark: "main" }),
        element({ landmark: "main" }),
        element({
          landmark: "main",
          geometry: { x: 0, y: 2000, width: 100, height: 50, viewportCoveragePercent: 0 },
        }),
        element({ landmark: "contentinfo" }),
      ]),
    );

    expect(candidates.map((c) => c.statement)).toContain(
      "첫 화면에 주요 콘텐츠가 3개 이상 보인다",
    );
  });

  it("names a content section below the fold rather than counting raw elements", () => {
    // Reproduces the real doyo case: a full-bleed hero means the content
    // that matters sits below the fold. The DOM snapshot has it, so the
    // observation must reach it — and name it, because a raw count of
    // everything inside <main> produced "at least 53 items", which is true
    // but not something a person can reason about or act on.
    const belowFold = { display: "block", visibility: "visible", opacity: 1, intersectsViewport: false };
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({
          tag: "h2",
          headingLevel: 2,
          accessibleName: "이번 계절의 기물",
          landmark: "main",
          visibility: belowFold,
          geometry: { x: 0, y: 1800, width: 400, height: 40, viewportCoveragePercent: 0 },
        }),
        ...Array.from({ length: 8 }, () => element({ landmark: "main", visibility: belowFold })),
      ]),
    );

    expect(candidates.map((c) => c.statement)).toContain(sectionOn("이번 계절의 기물"));
  });

  it("prefers the shallowest heading, then the topmost", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({
          tag: "h3",
          headingLevel: 3,
          accessibleName: "Deeper heading",
          landmark: "main",
          geometry: { x: 0, y: 100, width: 200, height: 30, viewportCoveragePercent: 100 },
        }),
        element({
          tag: "h2",
          headingLevel: 2,
          accessibleName: "Section heading",
          landmark: "main",
          geometry: { x: 0, y: 500, width: 200, height: 30, viewportCoveragePercent: 100 },
        }),
      ]),
    );

    expect(candidates.map((c) => c.statement)).toContain(sectionOn("Section heading"));
  });

  it("still finds content on a page with no <main> landmark", () => {
    // Generated markup often skips <main>. A strict landmark==="main" test
    // silently produced zero content candidates on such pages.
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({ tag: "a", role: "link", accessibleName: "Home", landmark: "banner" }),
        element({
          tag: "h2",
          headingLevel: 2,
          accessibleName: "Featured work",
          landmark: null,
          geometry: { x: 0, y: 400, width: 300, height: 40, viewportCoveragePercent: 100 },
        }),
        element({ landmark: null }),
        element({ landmark: null }),
        element({ landmark: null }),
      ]),
    );

    const statements = candidates.map((c) => c.statement);
    expect(statements).toContain(sectionOn("Featured work"));
    expect(statements.join(" ")).toContain("주요 콘텐츠");
  });

  it("does not count site chrome as content when falling back", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({ landmark: "banner" }),
        element({ landmark: "navigation" }),
        element({ landmark: "contentinfo" }),
        element({ landmark: null }),
      ]),
    );

    // Only 1 non-chrome element — below MIN_MEANINGFUL_CONTENT_ITEMS.
    expect(candidates.map((c) => c.statement).join(" ")).not.toContain("주요 콘텐츠");
  });

  it("ignores headings outside the main landmark", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({ tag: "h1", headingLevel: 1, accessibleName: "Site name", landmark: "banner" }),
        element({ tag: "h2", headingLevel: 2, accessibleName: "Footer links", landmark: "contentinfo" }),
      ]),
    );

    expect(candidates.map((c) => c.statement).join(" ")).not.toContain("섹션이 페이지에 남아");
  });

  it("strips decorative trailing glyphs from names used in statements", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({ tag: "button", accessibleName: "기물 둘러보기 →", landmark: "main" }),
      ]),
    );

    expect(candidates[0]?.statement).toBe(actionOn("기물 둘러보기"));
  });

  it("does not count containers, headings or controls as content items", () => {
    // Real-world regression: a demo page showing 7 cards reported "11 main
    // content items" because <main>, the h1, the h2 and the CTA button all
    // sat inside the content area and were counted alongside the cards.
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({ tag: "main", role: "main", landmark: "main" }),
        element({ tag: "h1", headingLevel: 1, accessibleName: "Reference Library", landmark: "main" }),
        element({ tag: "h2", headingLevel: 2, accessibleName: "All references", landmark: "main" }),
        element({ tag: "button", accessibleName: "Save to collection", landmark: "main" }),
        ...Array.from({ length: 7 }, () => element({ tag: "article", landmark: "main" })),
      ]),
    );

    expect(candidates.map((c) => c.statement)).toContain(
      "첫 화면에 주요 콘텐츠가 7개 이상 보인다",
    );
  });

  it("still finds the section heading even though headings are not content items", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({ tag: "h2", headingLevel: 2, accessibleName: "All references", landmark: "main" }),
        ...Array.from({ length: 4 }, () => element({ tag: "article", landmark: "main" })),
      ]),
    );

    expect(candidates.map((c) => c.statement)).toContain(sectionOn("All references"));
  });

  it("skips the content-count guardrail when too little exists to protect", () => {
    // A floor of 1-2 items survives almost any layout change, so offering it
    // would look like protection while detecting nothing.
    const candidates = observeGuardrailCandidates(
      snapshot([element({ landmark: "main" }), element({ landmark: "main" })]),
    );

    expect(candidates.map((c) => c.statement).join(" ")).not.toContain("주요 콘텐츠");
  });

  it("does not offer the site logo or nav links as the primary action", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({
          tag: "a",
          role: "link",
          accessibleName: "도요 홈으로 이동",
          landmark: "banner",
          geometry: { x: 0, y: 0, width: 400, height: 120, viewportCoveragePercent: 100 },
        }),
        element({
          tag: "a",
          role: "link",
          accessibleName: "SHOP",
          landmark: "navigation",
          geometry: { x: 0, y: 40, width: 200, height: 40, viewportCoveragePercent: 100 },
        }),
        element({
          tag: "a",
          role: "link",
          accessibleName: "기물 둘러보기",
          landmark: "main",
          geometry: { x: 0, y: 600, width: 120, height: 40, viewportCoveragePercent: 100 },
        }),
      ]),
    );

    expect(candidates[0]?.statement).toBe(actionOn("기물 둘러보기"));
  });

  it("prefers a real button over a larger link when both are page content", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({
          tag: "a",
          role: "link",
          accessibleName: "Read the full story",
          landmark: "main",
          geometry: { x: 0, y: 100, width: 600, height: 200, viewportCoveragePercent: 100 },
        }),
        element({
          tag: "button",
          accessibleName: "Add to cart",
          landmark: "main",
          geometry: { x: 0, y: 400, width: 100, height: 40, viewportCoveragePercent: 100 },
        }),
      ]),
    );

    expect(candidates[0]?.statement).toBe(actionOn("Add to cart"));
  });

  it("offers no primary action when the first screen holds only site chrome", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({ tag: "a", role: "link", accessibleName: "Home", landmark: "banner" }),
        element({ tag: "a", role: "link", accessibleName: "About", landmark: "navigation" }),
      ]),
    );

    expect(candidates.map((c) => c.statement).join(" ")).not.toContain("스크롤 없이 닿을");
  });

  it("counts first-screen controls the same way compute-diff does", () => {
    const candidates = observeGuardrailCandidates(
      snapshot([
        element({ tag: "button", accessibleName: "A" }),
        element({ tag: "a", accessibleName: "B" }),
        element({ tag: "div", role: "button", accessibleName: "C" }),
        element({ tag: "span" }),
      ]),
    );

    // 3 controls today; ceiling carries headroom so +1 isn't a violation.
    expect(candidates.map((c) => c.statement)).toContain("첫 화면의 컨트롤이 5개를 넘지 않는다 (현재 3개)");
  });

  it("gives the control budget headroom instead of pinning it to today's count", () => {
    // Real-world regression: a ceiling of exactly 9 turned a deliberately
    // added banner (link + dismiss button) into a reported violation, and
    // the fix advice proposed removing navigation to get back under it.
    const controls = Array.from({ length: 9 }, (_, i) =>
      element({ tag: "a", role: "link", accessibleName: `nav-${i}`, landmark: "main" }),
    );
    const [statement] = observeGuardrailCandidates(snapshot(controls))
      .map((c) => c.statement)
      .filter((s) => s.includes("컨트롤"));

    // max(9 + 2, ceil(9 * 1.5)) = 14 — a +1 addition stays inside the budget,
    // while CLAUDE.md 17.1's 3 → 9 explosion still breaks it.
    expect(statement).toBe("첫 화면의 컨트롤이 14개를 넘지 않는다 (현재 9개)");
  });

  it("offers at most 3 candidates and pre-enables only the top 2", () => {
    const candidates = observeGuardrailCandidates(
      snapshot(
        [element({ tag: "button", accessibleName: "Save", landmark: "main" }), element({ landmark: "main" })],
        [
          { kind: "landmark", label: "main", order: 0 },
          { kind: "heading", label: "Title", order: 1 },
        ],
      ),
    );

    expect(candidates.length).toBeLessThanOrEqual(3);
    expect(candidates.filter((c) => c.enabled)).toHaveLength(2);
    expect(candidates.slice(2).every((c) => !c.enabled)).toBe(true);
  });

  it("produces guardrails that satisfy the stored Guardrail contract", () => {
    const [candidate] = observeGuardrailCandidates(
      snapshot([element({ tag: "button", accessibleName: "Save" })]),
    );

    expect(candidate).toMatchObject({
      priority: "must",
      scope: "route",
      // AC-06 constrains source to ai_suggested / user_written; no AI is
      // involved here and the user confirms the statement, so user_written.
      source: "user_written",
    });
    expect(candidate?.id).toBeTruthy();
    expect(candidate?.evidenceTypes.length).toBeGreaterThan(0);
  });

  it("keeps already-saved guardrails untouched by never being consulted for them", () => {
    // Guard against regressing the sheet's contract: observation is only a
    // source of *candidates*, so it must be a pure function of the snapshot.
    const page = snapshot([element({ tag: "button", accessibleName: "Save" })]);
    expect(observeGuardrailCandidates(page)).toEqual(observeGuardrailCandidates(page));
  });
});
