/**
 * Shared data contracts for KeepThis.
 * Source of truth: CLAUDE.md section 5 (Data Contracts), 6 (Baseline), 7 (Hybrid Diff Engine), 8 (Gemini AiAnalysis).
 * D-07 governs RouteInfo.routeKey normalization — see route-key.ts.
 */

// ---------------------------------------------------------------------------
// RouteInfo (D-07)
// ---------------------------------------------------------------------------

export type RouteInfo = {
  /** origin + normalized pathname (+ SPA hash route). See route-key.ts. */
  routeKey: string;
  /** Original full URL, unnormalized. */
  fullUrl: string;
  /** Original query string, unnormalized. Null if absent. */
  query: string | null;
  /** Original hash, unnormalized. Null if absent. */
  hash: string | null;
};

// ---------------------------------------------------------------------------
// Guardrail
// ---------------------------------------------------------------------------

/**
 * "must" vs "should" (REV-02~04): surfaced in the Baseline priority toggle,
 * included in the Gemini prompt input once gemini-client.ts exists (step 7 —
 * add the section 8.3 "Guardrails marked must..." addendum there), and shown
 * on result cards as "Must stay" / "Prefer to stay".
 */
export type GuardrailPriority = "must" | "should";

export type EvidenceType = "position" | "visibility" | "count" | "flow" | "visual";

/** Only these two values are allowed (AC-06). */
export type GuardrailSource = "ai_suggested" | "user_written";

export type Guardrail = {
  id: string;
  statement: string;
  priority: GuardrailPriority;
  evidenceTypes: EvidenceType[];
  scope: "route";
  enabled: boolean;
  source: GuardrailSource;
};

// ---------------------------------------------------------------------------
// PageSnapshot (section 6)
// ---------------------------------------------------------------------------

export type ElementFingerprint =
  | { strategy: "testid"; value: string }
  | { strategy: "stable-id"; value: string }
  | { strategy: "role-name"; role: string; accessibleName: string }
  | { strategy: "structural"; path: string; textHash: string };

export type ElementGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Percentage (0-100) of the element's area that intersects the viewport. */
  viewportCoveragePercent: number;
};

export type ElementVisibility = {
  display: string;
  visibility: string;
  opacity: number;
  intersectsViewport: boolean;
};

export type ElementSnapshot = {
  fingerprint: ElementFingerprint;
  tag: string;
  role: string | null;
  /** Accessible name only. Raw text content, input values, and hidden text are never stored. */
  accessibleName: string | null;
  geometry: ElementGeometry;
  visibility: ElementVisibility;
  landmark: string | null;
  headingLevel: 1 | 2 | 3 | 4 | 5 | 6 | null;
  /**
   * Computed CSS `position`. Fixed and sticky elements are pinned to the
   * viewport rather than the document, so their geometry must not be
   * scroll-normalised the way ordinary elements are (see
   * diff/element-predicates.ts). Optional because baselines captured before
   * this field existed simply do not have it; those fall back to "static".
   */
  cssPosition?: string | undefined;
};

export type ContentHierarchyEntry = {
  kind: "heading" | "landmark" | "section";
  label: string;
  order: number;
};

export type ReadinessSignals = {
  documentReadyState: "loading" | "interactive" | "complete";
  ariaBusy: boolean;
  skeletonCandidateCount: number;
  majorNodeCount: number;
};

export type InteractionSummary = {
  buttonCount: number;
  linkCount: number;
  inputCount: number;
  ctaCandidateCount: number;
  navItemCount: number;
};

export type ViewportInfo = {
  width: number;
  height: number;
  devicePixelRatio: number;
  scrollX: number;
  scrollY: number;
};

export type PageSnapshot = {
  schemaVersion: 1;
  route: RouteInfo;
  capturedAt: string;
  viewport: ViewportInfo;
  readiness: ReadinessSignals;
  elements: ElementSnapshot[];
  contentHierarchy: ContentHierarchyEntry[];
  interactionSummary: InteractionSummary;
};

// ---------------------------------------------------------------------------
// BaselineRecord
// ---------------------------------------------------------------------------

export type BaselineRecord = {
  schemaVersion: 1;
  baselineId: string;
  route: RouteInfo;
  createdAt: string;
  screenshot: {
    mimeType: "image/jpeg";
    dataUrl: string;
    width: number;
    height: number;
  };
  snapshot: PageSnapshot;
  guardrails: Guardrail[];
  accessibilityFindings: AccessibilityFinding[];
};

// ---------------------------------------------------------------------------
// Accessibility (Tier 1 — axe-core, separate track from Guardrails/AiAnalysis)
// ---------------------------------------------------------------------------

export type AccessibilityImpact = "critical" | "serious" | "moderate" | "minor";

export type AccessibilityFinding = {
  id: string;
  /** axe-core rule id, e.g. "label", "color-contrast". */
  ruleId: string;
  impact: AccessibilityImpact;
  description: string;
  helpUrl: string;
  /** CSS selector of the offending element, as reported by axe-core. */
  targetSelector: string;
  /**
   * Element identity used to match this finding across baseline/current,
   * computed the same way as PageSnapshot element fingerprints (section 7.2)
   * so an unrelated DOM insertion elsewhere on the page doesn't make a
   * still-present violation look resolved+newlyIntroduced.
   */
  elementFingerprint: ElementFingerprint;
  matchConfidence: MatchConfidence;
};

/**
 * Baseline vs Current accessibilityFindings, matched by ruleId+elementFingerprint.
 * Computed entirely in code (src/diff/accessibility-diff.ts) — never sent to
 * or judged by Gemini.
 */
export type AccessibilityComparison = {
  resolved: AccessibilityFinding[];
  stillPresent: AccessibilityFinding[];
  newlyIntroduced: AccessibilityFinding[];
};

// ---------------------------------------------------------------------------
// LocalDiff (section 7)
// ---------------------------------------------------------------------------

export type MatchConfidence = "high" | "medium" | "low";

export type LocalDiffChangeKind =
  | "added"
  | "removed"
  | "position"
  | "size"
  | "visibility"
  | "visible_count"
  | "interactive_count"
  | "order"
  | "fold_transition"
  | "overlay_occlusion"
  | "viewport_mismatch"
  | "readiness";

export type LocalDiffChange = {
  /** Stable id referenced by AiAnalysis.issues[].evidence[].evidenceId. */
  evidenceId: string;
  kind: LocalDiffChangeKind;
  /** Human-readable element identifier (derived from ElementFingerprint), when applicable. */
  element?: string;
  /** Named scope such as "first_viewport", when the change is scoped rather than per-element. */
  scope?: string;
  before?: unknown;
  current?: unknown;
  delta?: unknown;
  matchConfidence?: MatchConfidence;
};

export type LocalDiff = {
  routeKey: string;
  viewport: {
    baseline: { width: number; height: number };
    current: { width: number; height: number };
    comparable: boolean;
  };
  changes: LocalDiffChange[];
};

// ---------------------------------------------------------------------------
// AiAnalysis (Gemini response contract, section 5 / 8)
// ---------------------------------------------------------------------------

export type AnalysisMode = "intent_check" | "change_summary";
export type AnalysisStatus = "ok" | "insufficient_evidence";
export type Severity = "high" | "medium" | "low";
export type Confidence = "high" | "medium" | "low";
export type EvidenceSource = "dom" | "layout" | "visual";

export type AnalysisEvidence = {
  /** Must match a LocalDiffChange.evidenceId, or a visual evidence id, when source !== "visual"-only. */
  evidenceId: string;
  source: EvidenceSource;
  statement: string;
  // Explicit `| undefined` (not just `?:`) so this matches zod's inferred
  // type for optional fields under exactOptionalPropertyTypes — the schema
  // validation result in gemini-client.ts is assigned directly to AiAnalysis.
  before?: string | undefined;
  current?: string | undefined;
  delta?: string | undefined;
};

export type AnalysisIssue = {
  id: string;
  severity: Severity;
  title: string;
  evidence: AnalysisEvidence[];
  /** Null only in change_summary mode. */
  guardrailId: string | null;
  /** Null only in change_summary mode. */
  guardrail: string | null;
  whyItMatters: string;
  confidence: Confidence;
  confidenceReason: string;
  /** Empty in change_summary mode: no per-issue Fix is generated. */
  fixInstruction: string;
};

export type PreservedGuardrail = {
  guardrailId: string;
  statement: string;
  evidenceIds: string[];
};

export type AiAnalysis = {
  analysisMode: AnalysisMode;
  analysisStatus: AnalysisStatus;
  summary: string;
  /** Max 3 items (section 5.1). */
  issues: AnalysisIssue[];
  preserved: PreservedGuardrail[];
  insufficientEvidenceReasons: string[];
};

// ---------------------------------------------------------------------------
// ComparisonContext (REV-01) — no new data collection, composed from
// RouteInfo, LocalDiff.viewport.comparable, and analysisMode, all of which
// already exist. Always shown at the top of the Results screen.
// ---------------------------------------------------------------------------

export type ComparisonContext = {
  routeKey: string;
  viewportComparable: boolean;
  queryChanged: boolean;
  analysisMode: AnalysisMode;
};
