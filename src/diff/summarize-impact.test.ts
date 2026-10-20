import { describe, expect, it } from "vitest";
import { summarizeUxImpact } from "./summarize-impact";
import type { LocalDiff, LocalDiffChange } from "../shared/types";

function diff(changes: LocalDiffChange[], comparable = true): LocalDiff {
  return {
    routeKey: "http://localhost:3000/",
    viewport: {
      baseline: { width: 1440, height: 900 },
      current: comparable ? { width: 1440, height: 900 } : { width: 375, height: 812 },
      comparable,
    },
    changes,
  };
}

describe("summarizeUxImpact", () => {
  it("returns nothing when viewports aren't comparable", () => {
    const result = summarizeUxImpact(diff([{ evidenceId: "d0", kind: "viewport_mismatch" }], false));
    expect(result).toEqual([]);
  });

  it("returns nothing for an empty diff", () => {
    expect(summarizeUxImpact(diff([]))).toEqual([]);
  });

  it("leads with content leaving the first screen", () => {
    const result = summarizeUxImpact(
      diff([
        { evidenceId: "d0", kind: "interactive_count", scope: "first_viewport", before: 3, current: 9, delta: 6 },
        { evidenceId: "d1", kind: "fold_transition", element: "#grid", before: true, current: false },
      ]),
    );

    expect(result[0]?.headline).toBe("요소 1개가 스크롤 없이 보이지 않게 됐습니다");
    expect(result[0]?.evidenceIds).toEqual(["d1"]);
  });

  it("ranks a content drop above control growth", () => {
    const result = summarizeUxImpact(
      diff([
        { evidenceId: "d0", kind: "interactive_count", scope: "first_viewport", before: 3, current: 9, delta: 6 },
        {
          evidenceId: "d1",
          kind: "visible_count",
          scope: "first_viewport",
          element: "main-content-elements",
          before: 8,
          current: 2,
          delta: -6,
        },
      ]),
    );

    expect(result.map((r) => r.headline)).toEqual([
      "첫 화면 콘텐츠가 8개에서 2개로 줄었습니다",
      "첫 화면 컨트롤이 3개에서 9개로 늘었습니다",
    ]);
  });

  it("keeps the measured numbers as supporting evidence under each headline", () => {
    const [impact] = summarizeUxImpact(
      diff([
        {
          evidenceId: "d0",
          kind: "visible_count",
          scope: "first_viewport",
          before: 8,
          current: 2,
          delta: -6,
        },
      ]),
    );

    expect(impact?.evidence).toEqual(["스크롤 없이 보이는 콘텐츠: 8 → 2"]);
  });

  it("distinguishes content removed from the page from content pushed below the fold", () => {
    const [pageImpact] = summarizeUxImpact(
      diff([{ evidenceId: "d0", kind: "visible_count", scope: "page", before: 8, current: 2, delta: -6 }]),
    );
    expect(pageImpact?.headline).toBe("페이지 콘텐츠가 8개에서 2개로 줄었습니다");
    expect(pageImpact?.evidence).toEqual(["페이지 전체 콘텐츠: 8 → 2"]);

    const [foldImpact] = summarizeUxImpact(
      diff([{ evidenceId: "d0", kind: "visible_count", scope: "first_viewport", before: 8, current: 2, delta: -6 }]),
    );
    expect(foldImpact?.headline).toBe("첫 화면 콘텐츠가 8개에서 2개로 줄었습니다");
  });

  it("describes content and controls growing as well as shrinking", () => {
    const result = summarizeUxImpact(
      diff([
        { evidenceId: "d0", kind: "visible_count", scope: "first_viewport", before: 2, current: 8, delta: 6 },
        { evidenceId: "d1", kind: "interactive_count", scope: "first_viewport", before: 9, current: 3, delta: -6 },
      ]),
    );

    expect(result.map((r) => r.headline)).toContain("첫 화면 콘텐츠가 2개에서 8개로 늘었습니다");
    expect(result.map((r) => r.headline)).toContain("첫 화면 컨트롤이 9개에서 3개로 줄었습니다");
  });

  it("reports removed elements", () => {
    const result = summarizeUxImpact(
      diff([
        { evidenceId: "d0", kind: "removed", element: "#promo", matchConfidence: "high" },
        { evidenceId: "d1", kind: "removed", element: "#banner", matchConfidence: "high" },
      ]),
    );

    expect(result[0]?.headline).toBe("요소 2개가 페이지에서 사라졌습니다");
    expect(result[0]?.evidenceIds).toEqual(["d0", "d1"]);
  });

  it("does not count layout wrappers alongside the named elements inside them", () => {
    // Reproduces the real doyo case: removing 6 category links reported 13
    // gone, because each <a> and its wrapping <li> were both counted.
    const changes: LocalDiffChange[] = [];
    for (let i = 1; i <= 6; i++) {
      changes.push({
        evidenceId: `d${i * 2}`,
        kind: "removed",
        element: `li@main:nth-of-type(1)>ul:nth-of-type(1)>li:nth-of-type(${i})`,
        matchConfidence: "low",
      });
      changes.push({
        evidenceId: `d${i * 2 + 1}`,
        kind: "removed",
        element: `link:category-${i}`,
        matchConfidence: "medium",
      });
    }

    const [impact] = summarizeUxImpact(diff(changes));
    expect(impact?.headline).toBe("요소 6개가 페이지에서 사라졌습니다");
    expect(impact?.evidence.join(" ")).not.toContain("nth-of-type");
  });

  it("caps the evidence list and says how much was left out", () => {
    const changes: LocalDiffChange[] = Array.from({ length: 8 }, (_, i) => ({
      evidenceId: `d${i}`,
      kind: "removed" as const,
      element: `link:item-${i}`,
      matchConfidence: "medium" as const,
    }));
    changes.push({ evidenceId: "dx", kind: "removed", element: "div@a>b", matchConfidence: "low" });

    const [impact] = summarizeUxImpact(diff(changes));
    expect(impact?.headline).toBe("요소 8개가 페이지에서 사라졌습니다");
    expect(impact?.evidence).toContain("외 3건");
    expect(impact?.evidence).toContain("이름 없는 레이아웃 요소 1건은 생략했습니다");
  });

  it("renders a role-name element with its name first", () => {
    const [impact] = summarizeUxImpact(
      diff([{ evidenceId: "d0", kind: "removed", element: "navigation:기물 카테고리", matchConfidence: "medium" }]),
    );
    expect(impact?.evidence[0]).toBe("기물 카테고리 (navigation): 있음 → 없음");
  });

  it("falls back to counting unnamed elements when nothing is named", () => {
    const [impact] = summarizeUxImpact(
      diff([
        { evidenceId: "d0", kind: "removed", element: "div@a>b", matchConfidence: "low" },
        { evidenceId: "d1", kind: "removed", element: "div@a>c", matchConfidence: "low" },
      ]),
    );
    expect(impact?.headline).toBe("요소 2개가 페이지에서 사라졌습니다");
  });

  it("falls back to the largest position shift only when nothing more consequential exists", () => {
    const [impact] = summarizeUxImpact(
      diff([
        {
          evidenceId: "d0",
          kind: "position",
          element: "#grid",
          before: { x: 0, y: 214 },
          current: { x: 0, y: 686 },
          delta: { x: 0, y: 472 },
        },
      ]),
    );

    expect(impact?.headline).toBe("요소 1개가 아래로 472px 이동했습니다");
  });

  it("does not surface a bare position shift when a fold transition already explains it", () => {
    const result = summarizeUxImpact(
      diff([
        {
          evidenceId: "d0",
          kind: "position",
          element: "#grid",
          before: { x: 0, y: 214 },
          current: { x: 0, y: 686 },
          delta: { x: 0, y: 472 },
        },
        { evidenceId: "d1", kind: "fold_transition", element: "#grid", before: true, current: false },
      ]),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.headline).toBe("요소 1개가 스크롤 없이 보이지 않게 됐습니다");
  });

  it("reproduces the section 17.1 scenario in impact-first order", () => {
    const result = summarizeUxImpact(
      diff([
        {
          evidenceId: "d0",
          kind: "position",
          element: "reference-grid",
          before: { x: 0, y: 214 },
          current: { x: 0, y: 686 },
          delta: { x: 0, y: 472 },
        },
        {
          evidenceId: "d1",
          kind: "visible_count",
          scope: "first_viewport",
          element: "reference-card",
          before: 8,
          current: 2,
          delta: -6,
        },
        { evidenceId: "d2", kind: "interactive_count", scope: "first_viewport", before: 3, current: 9, delta: 6 },
      ]),
    );

    expect(result.map((r) => r.headline)).toEqual([
      "첫 화면 콘텐츠가 8개에서 2개로 줄었습니다",
      "첫 화면 컨트롤이 3개에서 9개로 늘었습니다",
    ]);
  });

  it("uses neutral wording with no AC-02 forbidden terms", () => {
    const result = summarizeUxImpact(
      diff([
        { evidenceId: "d0", kind: "visible_count", scope: "first_viewport", before: 8, current: 2, delta: -6 },
        { evidenceId: "d1", kind: "fold_transition", element: "#grid", before: true, current: false },
        { evidenceId: "d2", kind: "removed", element: "#promo", matchConfidence: "high" },
      ]),
    );

    const text = result.flatMap((r) => [r.headline, ...r.evidence]).join(" ").toLowerCase();
    for (const forbidden of ["회귀", "의도하지 않은", "잘못", "망가", "위반", "regression", "unintended"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
