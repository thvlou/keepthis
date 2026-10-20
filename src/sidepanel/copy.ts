/**
 * Every user-facing string in the Side Panel, organised by the language rule
 * confirmed on 2026-08-22 (devlog day4, "한국어 패치 범위 확정").
 *
 * The split is not stylistic — each side does a different job:
 *
 *   LABELS   English. Structural landmarks the eye scans rather than reads
 *            (GUARDRAIL, EVIDENCE, MUST, Fix, Ignore). Short, uppercase-
 *            friendly, and matching the Figma type treatment; Korean has no
 *            uppercase form and would break it.
 *   CODES    English, verbatim. Rule ids and error codes
 *            (aria-prohibited-attr, PAGE_NOT_READY) are strings the user
 *            searches for. Translating them makes them unfindable.
 *   PROSE    Korean. Anything read for comprehension — what happened, why it
 *            matters, what to do next.
 *
 * Gemini-generated prose is covered by the same rule via the output-language
 * instruction in gemini-client.ts, so the two halves stay consistent.
 *
 * Keeping them here rather than inline in JSX is what makes the rule
 * checkable: copy.test.ts asserts no Korean leaks into LABELS and no
 * English-only prose stays in PROSE.
 */

/** Structural labels. English by rule — never translate these. */
export const LABELS = {
  appName: "KeepThis",
  tagline: "Edit with AI. Keep the UX you intended.",

  sectionAnalysis: "ANALYSIS / IN PROGRESS",
  sectionBaselineNone: "BASELINE / NONE",
  sectionBaselineCapturing: "BASELINE / CAPTURING",
  sectionBaselineReady: "BASELINE / READY",
  sectionResultsIntent: "RESULTS / INTENT CHECK",
  sectionResultsSummary: "RESULTS / CHANGE SUMMARY",
  sectionBaseline: "BASELINE / SAVED",
  sectionBaselineReplace: "BASELINE / REPLACE",
  sectionSystemRecovery: "SYSTEM / RECOVERY",

  titleIntentCheck: "CHANGES NEED ATTENTION",
  titleNoConflict: "NO GUARDRAIL CONFLICTS",
  titleChangeSummary: "MEANINGFUL CHANGES",
  titleNoBaseline: "PROTECT WHAT MATTERS",
  titleCapturing: "CAPTURING BASELINE",
  titleBaselineSaved: "BASELINE SAVED",
  titleBaselineReady: "BASELINE READY",
  titleWorking: "WORKING",
  titleUnavailable: "ACTION REQUIRED",
  statusPageNotReady: "PAGE NOT READY",
  guardrailInfoTrigger: "What is a guardrail?",
  titleRequestFailed: "REQUEST FAILED",

  guardrail: "GUARDRAIL",
  evidence: "EVIDENCE",
  confidence: "CONFIDENCE",
  severity: "SEVERITY",
  accessibility: "ACCESSIBILITY",
  guardrailsChecked: "GUARDRAILS CHECKED",
  sectionGuardrails: "GUARDRAILS",
  alsoChanged: "ALSO CHANGED",
  otherChanges: "OTHER CHANGES",
  measuredChanges: "MEASURED CHANGES",
  preserved: "PRESERVED",

  priorityMust: "MUST",
  priorityShould: "SHOULD",

  metric: "METRIC",
  before: "BEFORE",
  current: "CURRENT",
  delta: "DELTA",

  metaRoute: "ROUTE",
  metaViewport: "VIEWPORT",
  metaGuardrails: "GUARDRAILS",
  metaCaptured: "CAPTURED",

  actionReplaceBaseline: "Replace Baseline",

  actionSetBaseline: "Set as Baseline",
  actionCheckChanges: "Check Changes",
  actionRecapture: "Re-capture Baseline",
  actionDone: "Done",
  actionFix: "Fix",
  actionIgnore: "Ignore",
  actionCopyPrompt: "Copy prompt",
  actionClose: "Close",
  actionCancel: "CANCEL",
  actionReplace: "REPLACE",
  actionRetry: "Retry",
  actionVisibleOnly: "Visible Only",
  actionOpenSettings: "Open Settings",
  actionAddGuardrails: "Add Guardrails",
  actionAnalyzeAgain: "Analyze Again",
  actionAdd: "Add",
  actionSave: "Save",
  actionView: "View",
  actionHide: "Hide",
  actionChangeKey: "Change",
} as const;

/**
 * Explanatory prose. Korean by rule — this is what gets read, not scanned.
 *
 * Written as Korean, not translated from English. The first pass read as
 * literal translation ("확정된 UX 회귀가 아닙니다") and users had to decode
 * it; these say the same thing the way someone would actually say it.
 *
 * `Baseline` and `Guardrail` stay untranslated on purpose. They are the
 * product's own nouns and appear in the labels right next to this text —
 * swapping in 기준/규칙 here would leave the reader mapping two words onto
 * one concept.
 */
export const PROSE = {
  loading: "불러오는 중입니다.",

  intentCheckSubtitle: "지키기로 한 것과 어긋난 변경이 있습니다.",
  noConflictSubtitle: "지키기로 한 것은 모두 그대로입니다. 그 밖에 달라진 점은 아래에 있습니다.",
  changeSummarySubtitle: "지킬 기준을 정하지 않아서, 달라진 것만 그대로 보여줍니다.",
  changeSummaryNotice:
    "Guardrail을 정하지 않았습니다. 아래는 무엇이 달라졌는지일 뿐, 문제라고 판단한 것은 아닙니다.",
  fixNeedsGuardrail: "Guardrail을 추가하면 수정 프롬프트를 만들어 드립니다.",

  noBaselineSubtitle: "AI에게 수정을 맡기기 전에, 지금 화면을 기준으로 잡아두세요.",
  noBaselineStatus: "이 페이지는 아직 기준이 없습니다.",
  capturingStatus: "화면과 구조를 저장하고 있습니다.",
  workingSubtitle: "끝날 때까지 이 탭을 그대로 두세요.",

  baselineSavedSubtitle: "지금 이 화면에서 실제로 확인된 것들입니다. 앞으로도 이대로여야 하는 것만 남기세요.",
  baselineNoGuardrailPrompt: "앞으로도 이대로여야 하는 게 있나요?",
  baselineReadySubtitle: "AI로 수정한 뒤 Check Changes를 누르면 기준과 비교해 드립니다.",
  /*
   * Deliberately not "지금 이 화면이 기준입니다": this screen is where the
   * user sits *before* going off to edit the page, and comes back to after.
   * By then the page on screen is no longer the baseline — saying it is
   * would be wrong at exactly the moment it matters most.
   */
  // 저장 직후 시트와 나중에 다시 들어온 화면은 시제가 다르다 — 앞은 방금 일어난
  // 일이고, 뒤는 유지되고 있는 상태다.
  baselineSavedStatus: "기준이 저장되었습니다. 지금 이 화면이 앞으로의 비교 기준이 됩니다.",
  baselineReadyStatus: "기준이 저장돼 있습니다. 수정한 뒤 돌아와서 확인하세요.",
  baselineReadyStatusNoGuardrail:
    "기준은 저장됐지만 지킬 조건이 없습니다. 지금 확인하면 달라진 것만 보여드립니다.",
  recaptureHint: "지금 화면으로 기준을 바꾸고 Guardrail을 다시 고릅니다.",
  guardrailListToggle: "지키기로 한 것 보기",

  // Tooltip body, two lines: what a guardrail is, then what happens to it.
  guardrailWhatIsIt: "앞으로 이 화면에서 지켜져야 할 기준입니다.",
  guardrailSectionHint: "체크한 것만 저장되고, 다음 검사부터 이 조건과 비교합니다.",
  guardrailInputHint: "눈으로 확인할 수 있는 조건을 적어주세요. 위치, 개수, 사라지면 안 되는 것처럼요.",
  guardrailCapReached: "최대 5개까지 고를 수 있습니다. 추가하려면 하나를 해제하세요.",

  acceptDialogBody: "지금 화면을 새 Baseline으로 바꿉니다. 이전 기준은 되돌릴 수 없습니다.",
  acceptDialogNote: "지키기로 한 Guardrail은 그대로 남습니다.",

  errorSubtitle: "요청이 끝나지 못했습니다. 아래 이유를 보고 다시 시도해주세요.",
  unavailableSubtitle: "왜 멈췄는지와 다음에 할 수 있는 것을 함께 보여드립니다.",
  pageNotReadyHint: "화면이 다 뜬 뒤에 다시 시도하거나, 지금 보이는 것만 분석할 수 있습니다.",
  // 기준을 잡는 중에는 "보이는 것만" 선택지를 주지 않는다 — 덜 그려진 화면을
  // 앞으로의 모든 비교 기준으로 저장하게 되기 때문이다.
  pageNotReadyBaselineHint: "덜 그려진 화면을 기준으로 저장하면 이후 비교가 전부 어긋납니다. 화면이 다 뜬 뒤에 다시 저장해주세요.",
  baselineSafeOnFailure: "문제가 생겨도 저장된 기준은 그대로 남습니다.",
  limitedAnalysis: "화면이 완전하지 않은 상태에서 분석했습니다. 신뢰도는 '낮음'으로 고정됩니다.",

  copiedNext: "복사했습니다. 수정을 적용한 뒤 다시 Check Changes를 눌러주세요.",

  noMeasuredChanges: "DOM이나 레이아웃에서 달라진 점이 없습니다.",

  apiKeyConfigured: "API 키가 등록돼 있습니다.",
  apiKeyRejected: "Gemini가 이 키를 거부했습니다. 다시 확인해 주세요.",
  apiKeyDataWarning:
    "키는 확장의 백그라운드에서만 쓰이고, 분석할 때 현재 화면과 Baseline 이미지가 Google Gemini로 전송됩니다. 무료 티어에서는 전송한 내용이 제품 개선에 쓰일 수 있으니 사내 비공개 화면이나 개인정보가 있는 페이지에는 사용하지 마세요.",

  ignoreReasonTitle: "이 항목을 숨기는 이유를 골라주세요.",
  ignoreReasonIntentional: "의도한 변경이에요",
  ignoreReasonNotRelevant: "지금은 상관없어요",
  ignoreReasonIncorrect: "잘못 짚었어요",
  ignoreKeepsBaseline: "숨기기만 할 뿐, 기준과 Guardrail은 그대로입니다.",

  analyzingBaseline: "지금 화면을 저장하고 있습니다.",
  analyzingCompare: "저장해 둔 기준과 맞춰보고 있습니다.",
  analyzingVisibleOnly: "지금 보이는 것만 분석하고 있습니다.",
  analyzingAgain: "같은 변화를 Guardrail 기준으로 다시 살펴보고 있습니다.",
} as const;

/** Counts and units that mix a number with Korean prose. */
export const COUNTS = {
  accessibilityNew: (n: number) => `이번 수정으로 새로 생긴 접근성 문제 ${n}건`,
  accessibilityResolved: (n: number) => `접근성 문제 ${n}건이 해결됐습니다`,
  accessibilityPreExisting: (n: number) => `원래 있던 문제 ${n}건`,
  accessibilityFound: (n: number) => `접근성 문제 ${n}건`,
  guardrailsUnreported: (n: number) => `${n}건은 분석 결과에 나오지 않았습니다.`,
  measuredChanges: (n: number) => `측정된 변화 ${n}건`,
  andMore: (n: number) => `외 ${n}건`,
  // "곳" not "건": these count places on the page that failed one rule, and
  // the user said it that way themselves ("×18곳").
  accessibilityPlaces: (n: number) => `${n}곳`,
  accessibilityMoreRules: (n: number) => `다른 규칙 ${n}개가 더 있습니다`,
  unnamedElements: (n: number) => `이름 없는 레이아웃 요소 ${n}건은 생략했습니다.`,
  issueCounter: (index: number, total: number) => `ISSUE ${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
} as const;
