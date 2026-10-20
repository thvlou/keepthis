/**
 * Realistic sample data for the UI preview.
 *
 * Values are taken from an actual Check Changes run on the RefLib demo page
 * (devlog day4, "C 사이클 1"), not invented: sentence lengths, guardrail
 * phrasing, and evidence wording are what the panel really receives, so the
 * preview shows layouts under real strain rather than under placeholder text
 * that happens to fit.
 */

import type {
  AccessibilityComparison,
  AccessibilityFinding,
  AiAnalysis,
  BaselineRecord,
  ComparisonContext,
  Guardrail,
  LocalDiff,
} from "../shared/types";

/*
 * The exact axe-core 4.13 output a real page produced: 40 findings, 5 of them
 * byte-identical and the rest a handful of greys repeated at different font
 * sizes. Kept verbatim because this is the case the grouped list exists for —
 * a preview built from two tidy findings would not show the problem.
 */
const CONTRAST_NODES: Array<[string, string, string, string]> = [
  ...Array.from({ length: 18 }, () => ["3.64", "#858688", "#ffffff", "9.0pt (12px)"] as [string, string, string, string]),
  ...Array.from({ length: 8 }, () => ["1.66", "#c1c2c3", "#f7f7f8", "8.3pt (11px)"] as [string, string, string, string]),
  ...Array.from({ length: 7 }, () => ["1.68", "#c7c7c8", "#ffffff", "9.8pt (13px)"] as [string, string, string, string]),
  ["3.57", "#828285", "#f7f7f8", "10.5pt (14px)"],
  ["2.34", "#ff8a3d", "#ffffff", "9.0pt (12px)"],
];

export const rawPageFindings: AccessibilityFinding[] = [
  ...CONTRAST_NODES.map(([ratio, fg, bg, size], index) => ({
    id: `ax-c${index}`,
    ruleId: "color-contrast",
    impact: "serious" as const,
    description: `Fix any of the following: Element has insufficient color contrast of ${ratio} (foreground color: ${fg}, background color: ${bg}, font size: ${size}, font weight: normal). Expected contrast ratio of 4.5:1`,
    helpUrl: "https://dequeuniversity.com/rules/axe/4.13/color-contrast",
    targetSelector: `div:nth-of-type(${index + 1}) > span`,
    elementFingerprint: { strategy: "structural" as const, path: `div>span${index}`, textHash: `h${index}` },
    matchConfidence: "low" as const,
  })),
  ...Array.from({ length: 5 }, (_, index) => ({
    id: `ax-p${index}`,
    ruleId: "aria-prohibited-attr",
    impact: "serious" as const,
    description:
      "Fix all of the following: aria-label attribute cannot be used on a div with no valid role attribute.",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.13/aria-prohibited-attr",
    targetSelector: `div[aria-label]:nth-of-type(${index + 1})`,
    elementFingerprint: { strategy: "structural" as const, path: `div[aria-label]${index}`, textHash: `p${index}` },
    matchConfidence: "low" as const,
  })),
];

export const guardrails: Guardrail[] = [
  {
    id: "observed-0",
    statement: '본문의 주요 액션에 스크롤 없이 닿을 수 있다 (지금: "Save to collection")',
    priority: "must",
    evidenceTypes: ["position", "visibility"],
    scope: "route",
    enabled: true,
    source: "user_written",
  },
  {
    id: "observed-1",
    statement: '본문의 주요 섹션이 페이지에 남아 있다 (지금: "Reference Library")',
    priority: "must",
    evidenceTypes: ["visibility", "flow"],
    scope: "route",
    enabled: true,
    source: "user_written",
  },
  {
    id: "user-1",
    statement: "첫 화면의 컨트롤이 5개를 넘지 않는다 (현재 3개)",
    priority: "should",
    evidenceTypes: ["count"],
    scope: "route",
    enabled: true,
    source: "user_written",
  },
];

export const baseline: BaselineRecord = {
  schemaVersion: 1,
  baselineId: "preview",
  route: {
    routeKey: "http://localhost:4173/",
    fullUrl: "http://localhost:4173/",
    query: null,
    hash: null,
  },
  createdAt: new Date().toISOString(),
  screenshot: { mimeType: "image/jpeg", dataUrl: "", width: 1440, height: 900 },
  snapshot: {
    schemaVersion: 1,
    route: { routeKey: "http://localhost:4173/", fullUrl: "http://localhost:4173/", query: null, hash: null },
    capturedAt: new Date().toISOString(),
    viewport: { width: 1440, height: 900, devicePixelRatio: 1, scrollX: 0, scrollY: 0 },
    readiness: { documentReadyState: "complete", ariaBusy: false, skeletonCandidateCount: 0, majorNodeCount: 120 },
    elements: [],
    contentHierarchy: [],
    interactionSummary: { buttonCount: 1, linkCount: 2, inputCount: 0, ctaCandidateCount: 1, navItemCount: 2 },
  },
  guardrails,
  accessibilityFindings: rawPageFindings,
};

export const diff: LocalDiff = {
  routeKey: "http://localhost:4173/",
  viewport: {
    baseline: { width: 1440, height: 900 },
    current: { width: 1440, height: 900 },
    comparable: true,
  },
  changes: [
    { evidenceId: "d0", kind: "added", element: "filter-bar", matchConfidence: "high" },
    {
      evidenceId: "d1",
      kind: "interactive_count",
      scope: "first_viewport",
      before: 3,
      current: 9,
      delta: 6,
    },
    {
      evidenceId: "d2",
      kind: "visible_count",
      scope: "first_viewport",
      element: "main-content-elements",
      before: 7,
      current: 2,
      delta: -5,
    },
    {
      evidenceId: "d3",
      kind: "position",
      element: "reference-grid",
      before: { x: 40, y: 305.5 },
      current: { x: 40, y: 819 },
      delta: { x: 0, y: 513.5 },
      matchConfidence: "high",
    },
    { evidenceId: "d4", kind: "fold_transition", element: "reference-grid", before: true, current: false },
  ],
};

export const comparisonContext: ComparisonContext = {
  routeKey: "http://localhost:4173/",
  viewportComparable: true,
  queryChanged: false,
  analysisMode: "intent_check",
};

export const intentAnalysis: AiAnalysis = {
  analysisMode: "intent_check",
  analysisStatus: "ok",
  summary:
    "새 필터 바가 상호작용 버튼 6개를 추가하면서 첫 화면 컨트롤이 3개에서 9개로 늘었고, 최대 5개를 유지하기로 한 조건을 넘겼습니다.",
  issues: [
    {
      id: "i1",
      severity: "high",
      title: "FIRST SCREEN CONTROL COUNT EXCEEDS BUDGET",
      evidence: [
        {
          evidenceId: "d1",
          source: "dom",
          statement: "첫 화면의 상호작용 컨트롤이 3개에서 9개로 늘었습니다.",
          before: "3",
          current: "9",
          delta: "+6",
        },
        { evidenceId: "d0", source: "dom", statement: "상단에 filter-bar가 새로 추가됐습니다." },
      ],
      guardrailId: "user-1",
      guardrail: "첫 화면의 컨트롤이 5개를 넘지 않는다 (현재 3개)",
      whyItMatters:
        "첫 화면에 컨트롤이 몰리면 무엇을 먼저 봐야 할지 판단하기 어려워지고, 정해둔 한도를 넘습니다.",
      confidence: "high",
      confidenceReason: "DOM 측정값이 첫 화면 컨트롤 9개를 직접 확인해 줍니다.",
      fixInstruction:
        "Keep the new filtering functionality, but collapse or convert the 6 individual filter buttons into a single dropdown selector to reduce the interactive control count by 5, bringing the total in the first viewport down to 5 or fewer.",
    },
  ],
  preserved: [
    {
      guardrailId: "observed-0",
      statement: '본문의 주요 액션에 스크롤 없이 닿을 수 있다 (지금: "Save to collection")',
      evidenceIds: ["d3"],
    },
  ],
  insufficientEvidenceReasons: [],
};

export const summaryAnalysis: AiAnalysis = {
  analysisMode: "change_summary",
  analysisStatus: "ok",
  summary: "상단에 필터 바가 추가되면서 아래 콘텐츠가 513.5px 밀렸습니다.",
  issues: [],
  preserved: [],
  insufficientEvidenceReasons: [],
};

export const accessibilityComparison: AccessibilityComparison = {
  resolved: [
    {
      id: "a1",
      ruleId: "color-contrast",
      impact: "serious",
      description: "Element has insufficient color contrast of 4.4 (foreground #70706d, background #f3f1ec).",
      helpUrl: "https://dequeuniversity.com/rules/axe/color-contrast",
      targetSelector: ".caption",
      elementFingerprint: { strategy: "stable-id", value: "caption" },
      matchConfidence: "high",
    },
  ],
  stillPresent: [
    {
      id: "a2",
      ruleId: "color-contrast",
      impact: "serious",
      description: "Element has insufficient color contrast of 2.45 (foreground #9a9c97, background #f3f1ec).",
      helpUrl: "https://dequeuniversity.com/rules/axe/color-contrast",
      targetSelector: ".subtitle",
      elementFingerprint: { strategy: "stable-id", value: "subtitle" },
      matchConfidence: "high",
    },
  ],
  newlyIntroduced: [
    {
      id: "a3",
      ruleId: "aria-prohibited-attr",
      impact: "serious",
      description: "aria-label attribute cannot be used on a label with no valid role attribute.",
      helpUrl: "https://dequeuniversity.com/rules/axe/aria-prohibited-attr",
      targetSelector: "#notice-dismiss",
      elementFingerprint: { strategy: "stable-id", value: "notice-dismiss" },
      matchConfidence: "high",
    },
    {
      id: "a4",
      ruleId: "region",
      impact: "moderate",
      description: "Some page content is not contained by landmarks.",
      helpUrl: "https://dequeuniversity.com/rules/axe/region",
      targetSelector: ".filter-bar",
      elementFingerprint: { strategy: "structural", path: "div:nth-of-type(2)", textHash: "a1" },
      matchConfidence: "low",
    },
  ],
};
