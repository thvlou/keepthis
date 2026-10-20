/**
 * Runtime schema validation (zod) for shared contracts.
 * CLAUDE.md section 16: "AI 응답을 신뢰 경계 밖의 입력으로 취급하고 항상 validate한다."
 * Rules enforced here follow section 5.1 exactly. Do not loosen them to make a
 * malformed Gemini response pass — a failed validation must surface as an
 * error state (retry/repair), never as silently-corrected data.
 */

import { z } from "zod";
import { MESSAGE_ACTIONS, ERROR_CODES } from "./messages";
import type { AnalysisMode } from "./types";

// ---------------------------------------------------------------------------
// RouteInfo
// ---------------------------------------------------------------------------

export const routeInfoSchema = z.object({
  routeKey: z.string().min(1),
  fullUrl: z.string().min(1),
  query: z.string().nullable(),
  hash: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Guardrail
// ---------------------------------------------------------------------------

export const guardrailSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  priority: z.enum(["must", "should"]),
  evidenceTypes: z.array(z.enum(["position", "visibility", "count", "flow", "visual"])),
  scope: z.literal("route"),
  enabled: z.boolean(),
  source: z.enum(["ai_suggested", "user_written"]),
});

/**
 * 6.1 caps *AI recommendations* at 3 and explicitly allows the user to add
 * their own on top ("사용자는 선택 해제·수정·직접 추가 가능"). The original
 * .max(3) here mistakenly applied 5.1's issues.maxItems to guardrails and
 * blocked that. Raised to 5: enough headroom for user-written conditions
 * while staying close to the 3-issue ceiling, so a violated guardrail is
 * unlikely to have no issue card to appear in.
 */
export const guardrailListSchema = z.array(guardrailSchema).max(5);

// ---------------------------------------------------------------------------
// PageSnapshot
// ---------------------------------------------------------------------------

const elementFingerprintSchema = z.discriminatedUnion("strategy", [
  z.object({ strategy: z.literal("testid"), value: z.string() }),
  z.object({ strategy: z.literal("stable-id"), value: z.string() }),
  z.object({ strategy: z.literal("role-name"), role: z.string(), accessibleName: z.string() }),
  z.object({ strategy: z.literal("structural"), path: z.string(), textHash: z.string() }),
]);

const elementSnapshotSchema = z.object({
  fingerprint: elementFingerprintSchema,
  tag: z.string(),
  role: z.string().nullable(),
  accessibleName: z.string().nullable(),
  geometry: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    viewportCoveragePercent: z.number().min(0).max(100),
  }),
  visibility: z.object({
    display: z.string(),
    visibility: z.string(),
    opacity: z.number(),
    intersectsViewport: z.boolean(),
  }),
  landmark: z.string().nullable(),
  headingLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.null()]),
  // Optional: baselines saved before this field existed don't carry it.
  cssPosition: z.string().optional(),
});

export const pageSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  route: routeInfoSchema,
  capturedAt: z.string(),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
    devicePixelRatio: z.number(),
    scrollX: z.number(),
    scrollY: z.number(),
  }),
  readiness: z.object({
    documentReadyState: z.enum(["loading", "interactive", "complete"]),
    ariaBusy: z.boolean(),
    skeletonCandidateCount: z.number().int().nonnegative(),
    majorNodeCount: z.number().int().nonnegative(),
  }),
  elements: z.array(elementSnapshotSchema),
  contentHierarchy: z.array(
    z.object({
      kind: z.enum(["heading", "landmark", "section"]),
      label: z.string(),
      order: z.number().int(),
    }),
  ),
  interactionSummary: z.object({
    buttonCount: z.number().int().nonnegative(),
    linkCount: z.number().int().nonnegative(),
    inputCount: z.number().int().nonnegative(),
    ctaCandidateCount: z.number().int().nonnegative(),
    navItemCount: z.number().int().nonnegative(),
  }),
});

// ---------------------------------------------------------------------------
// Accessibility (Tier 1 — axe-core, separate track from Guardrails/AiAnalysis)
// ---------------------------------------------------------------------------

export const accessibilityFindingSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  impact: z.enum(["critical", "serious", "moderate", "minor"]),
  description: z.string(),
  helpUrl: z.string(),
  targetSelector: z.string(),
  elementFingerprint: elementFingerprintSchema,
  matchConfidence: z.enum(["high", "medium", "low"]),
});

export const accessibilityComparisonSchema = z.object({
  resolved: z.array(accessibilityFindingSchema),
  stillPresent: z.array(accessibilityFindingSchema),
  newlyIntroduced: z.array(accessibilityFindingSchema),
});

// ---------------------------------------------------------------------------
// BaselineRecord
// ---------------------------------------------------------------------------

export const baselineRecordSchema = z.object({
  schemaVersion: z.literal(1),
  baselineId: z.string().min(1),
  route: routeInfoSchema,
  createdAt: z.string(),
  screenshot: z.object({
    mimeType: z.literal("image/jpeg"),
    dataUrl: z.string().min(1),
    width: z.number(),
    height: z.number(),
  }),
  snapshot: pageSnapshotSchema,
  guardrails: guardrailListSchema,
  accessibilityFindings: z.array(accessibilityFindingSchema),
});

// ---------------------------------------------------------------------------
// LocalDiff
// ---------------------------------------------------------------------------

const localDiffChangeKindSchema = z.enum([
  "added",
  "removed",
  "position",
  "size",
  "visibility",
  "visible_count",
  "interactive_count",
  "order",
  "fold_transition",
  "overlay_occlusion",
  "viewport_mismatch",
  "readiness",
]);

export const localDiffChangeSchema = z.object({
  evidenceId: z.string().min(1),
  kind: localDiffChangeKindSchema,
  element: z.string().optional(),
  scope: z.string().optional(),
  before: z.unknown().optional(),
  current: z.unknown().optional(),
  delta: z.unknown().optional(),
  matchConfidence: z.enum(["high", "medium", "low"]).optional(),
});

export const localDiffSchema = z.object({
  routeKey: z.string().min(1),
  viewport: z.object({
    baseline: z.object({ width: z.number(), height: z.number() }),
    current: z.object({ width: z.number(), height: z.number() }),
    comparable: z.boolean(),
  }),
  changes: z.array(localDiffChangeSchema),
});

// ---------------------------------------------------------------------------
// AiAnalysis (Gemini response contract — section 5.1)
// ---------------------------------------------------------------------------

const analysisEvidenceSchema = z.object({
  evidenceId: z.string().min(1),
  source: z.enum(["dom", "layout", "visual"]),
  statement: z.string().min(1),
  before: z.string().optional(),
  current: z.string().optional(),
  delta: z.string().optional(),
});

const analysisIssueSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]),
  title: z.string().min(1),
  evidence: z.array(analysisEvidenceSchema).min(1),
  guardrailId: z.string().nullable(),
  guardrail: z.string().nullable(),
  whyItMatters: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  confidenceReason: z.string().min(1),
  fixInstruction: z.string(),
});

const preservedGuardrailSchema = z.object({
  guardrailId: z.string().min(1),
  statement: z.string().min(1),
  evidenceIds: z.array(z.string()),
});

const aiAnalysisBaseSchema = z.object({
  analysisMode: z.enum(["intent_check", "change_summary"]),
  analysisStatus: z.enum(["ok", "insufficient_evidence"]),
  summary: z.string().min(1),
  issues: z.array(analysisIssueSchema).max(3),
  preserved: z.array(preservedGuardrailSchema),
  insufficientEvidenceReasons: z.array(z.string()),
});

/**
 * Builds the AiAnalysis validator for one Check Changes call.
 *
 * expectedMode must be the locally computed analysisMode (D-01) — the
 * response is rejected if it disagrees, per section 5.1: "응답이 다른 값을
 * 돌려주면 schema 오류로 처리한다."
 *
 * Also enforces, per mode:
 * - intent_check: every issue must carry a non-null guardrailId/guardrail
 *   and a non-empty fixInstruction.
 * - change_summary: every issue's guardrailId/guardrail must be null and
 *   fixInstruction must be empty (no per-issue Fix is generated).
 */
export function createAiAnalysisSchema(expectedMode: AnalysisMode) {
  return aiAnalysisBaseSchema.superRefine((data, ctx) => {
    if (data.analysisMode !== expectedMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["analysisMode"],
        message: `analysisMode mismatch: expected "${expectedMode}", received "${data.analysisMode}"`,
      });
      return;
    }

    data.issues.forEach((issue, index) => {
      if (expectedMode === "intent_check") {
        if (issue.guardrailId === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["issues", index, "guardrailId"],
            message: "guardrailId is required in intent_check mode",
          });
        }
        if (issue.fixInstruction.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["issues", index, "fixInstruction"],
            message: "fixInstruction is required in intent_check mode",
          });
        }
      } else {
        if (issue.guardrailId !== null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["issues", index, "guardrailId"],
            message: "guardrailId must be null in change_summary mode",
          });
        }
        if (issue.fixInstruction.trim().length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["issues", index, "fixInstruction"],
            message: "fixInstruction must be empty in change_summary mode",
          });
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Message envelope schemas
// ---------------------------------------------------------------------------

export const messageActionSchema = z.enum(MESSAGE_ACTIONS);
export const errorCodeSchema = z.enum(ERROR_CODES);

export const appErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
});
