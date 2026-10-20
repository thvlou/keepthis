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
  before?: string;
  current?: string;
  delta?: string;
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
