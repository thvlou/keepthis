/**
 * Gemini 2.5 Flash client (CLAUDE.md section 8). Called only from the
 * service worker — the API key never reaches a content script or the page.
 *
 * Deliberately does NOT accept accessibilityFindings or AccessibilityComparison
 * (AC-A11Y-05, a11y spec section 7): those never leave the extension for
 * Gemini. AnalyzeChangesInput has no field for them.
 */

import { z } from "zod";
import { createAiAnalysisSchema } from "../shared/schemas";
import { createAiSuggestedGuardrail } from "../shared/guardrail-factory";
import { DEFAULT_GEMINI_MODEL, getApiKey, getModel } from "../storage/settings-repository";
import { selectSignificantChanges } from "../diff/select-significant";
import { prioritizeMustViolations } from "./rank-issues";
import type { Result } from "../shared/messages";
import type { AiAnalysis, AnalysisMode, Guardrail, LocalDiff, PageSnapshot } from "../shared/types";

const GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
/**
 * Multimodal requests carry two screenshots plus the diff, and 30s proved
 * too tight in real use — a legitimate analysis aborted mid-flight and
 * surfaced as "The request to Gemini timed out."
 */
const REQUEST_TIMEOUT_MS = 60_000;

/** CLAUDE.md section 8.3, verbatim, plus the REV-03 must/should addendum. */
const SYSTEM_PROMPT = `You are an evidence-constrained UX regression interpreter.

Determine only whether measured changes conflict with the user's guardrails.
Do not judge whether the interface is beautiful, modern, professional, trendy,
or generally well designed. Do not invent pixel values, DOM states, user intent,
or causal prompts. Prefer supplied DOM/layout evidence over visual inference.

Every issue must cite at least one supplied evidence item and one guardrail.
If evidence is visual-only, confidence cannot be high.
If the page appears incomplete, viewports are not comparable, or evidence is
insufficient, return analysisStatus="insufficient_evidence" instead of forcing
an issue. Return at most 3 issues, ordered by user impact.

When a guardrail states a threshold — at least N items, no more than N
controls, and so on — compare the measured current value against N, not
against the baseline value. A count that fell but still satisfies the
threshold is preserved, not violated: a guardrail asking for at least six
items visible is met by six. Evidence that some items crossed the fold does
not by itself decide it; what decides it is the number that remains, measured
against the number the user asked for. Say the current value and the
threshold together so the reader can check the comparison.

When a guardrail names a particular element, only report it violated if the
evidence says something about that element: it moved, it crossed the fold, it
was removed, it changed size, or a count that includes it changed. Evidence
that other elements were inserted, or that a container grew taller, does not
establish that the named element moved. The diff reports a position or
fold-transition item for every element that actually moved, so if there is no
such item for the element the guardrail names, it did not move — say the
guardrail holds and put it in "preserved".

This has been observed going wrong: blocks added near the top of a page were
read as having pushed a button below the fold, and the button had not moved at
all because it sat above the insertion point. Adding something above some
content does not move all content; only the measurements say what moved.

Account for every guardrail you are given. Each one must appear either as an
issue, when the measured changes conflict with it, or in "preserved", when it
still holds. Never leave a guardrail out of both: the user stated it, and
silence about it reads as if it was never checked. If the 3-issue limit stops
you from raising a violated guardrail, still do not list it as preserved.

Whenever you reference a guardrail, copy its id exactly as supplied. Do not
renumber, abbreviate, or invent ids — the result is matched back to the
user's stored guardrails by that exact string.

Fix instructions must preserve explicitly new functionality where possible and
state what to keep, reduce/move, preserve, and not remove.

When the evidence quantifies the gap, carry that number into the instruction
so it is actionable — state how much space must be reclaimed and how many
items must be restored, giving both whenever the evidence supplies both, not
merely that something should fit. Describe the
target in page terms ("within the initial viewport"), never as a raw device
pixel height, which is specific to the screen that happened to be captured.

If the diff contains a readiness change showing the current page has
substantially fewer nodes than the baseline, the page was most likely still
rendering. Elements reported as removed may simply not have appeared yet.
Say so plainly, keep confidence low, and do not write a fix instruction that
assumes they were deliberately deleted — recommend re-checking once the page
has settled instead. Telling someone to restore an element that is merely
still loading causes a wrong edit.

When protected content was pushed out of view because new blocks were
inserted above it, weigh the space that must be reclaimed against the size of
what was added. If those two are close, shrinking the new blocks cannot solve
it without crushing them, and saying "reduce the height and margins" asks for
something the page cannot give. Check that arithmetic before proposing it.

Order the remedies by how little they cost the user:
- move supplementary blocks — recommendations, promotions, related items,
  anything that comments on the primary content rather than being it — below
  the content they supplement. This costs no space at all and keeps the
  feature whole;
- collapse a group of controls into a single control, or put later items
  behind an interaction;
- reduce padding, heights or type size only when the gap is small next to the
  block, and say plainly that it is the weakest of the three.

Offer at least two structurally different options and name what each costs, so
the reader chooses rather than obeys. One lever repeated is not a choice.

Relocating a block only counts as preserving it if it stays findable where it
lands. Sending something to the end of a long page keeps it in the markup and
takes it out of use, which is the outcome the no-deletion rule exists to
prevent. So when you recommend a move, say where it should go and why it is
still reachable there, and use the measurements to place it: if the guardrail
asks for a number of items to stay in view, the moved block belongs directly
after those items, not after everything. Name what the move costs.

If no destination satisfies both the guardrail and the moved feature, say so
plainly. The guardrail and the new feature may genuinely be in tension, and
that is the user's decision to make, not a reason to invent a placement that
quietly buries one of them.

When one insertion violates several guardrails at once, do not write fixes
that pull against each other. Say in each instruction that the same change is
responsible, and describe one remedy that satisfies all of them together, so
that applying any single instruction resolves the whole set rather than
trading one violation for another.

The instruction is copied into a separate coding tool that cannot see the
baseline, this analysis, or the page. Write it to stand alone: name elements
the way they appear in the evidence, state the target in full, and do not
refer to "the issue above" or to anything only this panel knows.

Tightening spacing or shrinking type to satisfy a numeric target is a last
resort. A cramped layout is a different regression, not a fix for this one —
the same reason deleting functionality to meet a count is forbidden below.

Never propose deleting existing navigation, actions, or content in order to
satisfy a numeric budget. Prefer reclaiming space, relocating, collapsing or
restructuring. A fix that removes working functionality to meet a count is
worse than the change it is meant to address; if no such fix exists, say the
guardrail may need adjusting rather than inventing a destructive one.

A guardrail may end with a parenthetical like (지금: "…"). That is an example
captured when the baseline was saved, so the reader knows which element the
sentence points at. It is not a string that has to survive. Pages assemble
headings and labels from the user's own selections, so treat a change in that
text as a state change, not a violation: judge the guardrail by the element's
role and place, and only report a conflict when the element itself is gone,
moved, or reduced.

Output language — the response is shown in a Korean-language panel, so match
what each field is for:
- summary, whyItMatters, confidenceReason, and evidence statements: write in
  Korean. These are read for comprehension.
- title: a short English label in the style of "Primary CTA moved below fold".
  It is rendered as an uppercase heading, which Korean has no form of.
- fixInstruction: write in English. It is copied into a coding tool alongside
  code identifiers and CSS properties.
- Never translate element identifiers, rule ids, CSS values, or numbers.
  Keep the product's own terms ("Baseline", "Guardrail", "fold") as-is.

Guardrails marked "must" represent conditions the user considers critical.
Guardrails marked "should" represent conditions the user prefers but can
tolerate more deviation on. When both are violated, prioritize "must"
violations in severity and ordering.`;

/**
 * Hand-written JSON Schema (not derived from the zod validator) matching
 * section 5.1's shape rules. The mode-conditional rules (guardrailId
 * required only in intent_check, etc.) aren't expressible here — those are
 * enforced afterward by createAiAnalysisSchema, run locally on the response.
 */
const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    analysisMode: { type: "string", enum: ["intent_check", "change_summary"] },
    analysisStatus: { type: "string", enum: ["ok", "insufficient_evidence"] },
    summary: { type: "string" },
    issues: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          title: { type: "string" },
          evidence: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                evidenceId: { type: "string" },
                source: { type: "string", enum: ["dom", "layout", "visual"] },
                statement: { type: "string" },
                before: { type: "string" },
                current: { type: "string" },
                delta: { type: "string" },
              },
              required: ["evidenceId", "source", "statement"],
            },
          },
          guardrailId: {
            type: ["string", "null"],
            description: "Exact id copied from the supplied guardrail list, or null in change_summary mode.",
          },
          guardrail: { type: ["string", "null"] },
          whyItMatters: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          confidenceReason: { type: "string" },
          fixInstruction: { type: "string" },
        },
        required: [
          "id",
          "severity",
          "title",
          "evidence",
          "guardrailId",
          "guardrail",
          "whyItMatters",
          "confidence",
          "confidenceReason",
          "fixInstruction",
        ],
      },
    },
    preserved: {
      type: "array",
      items: {
        type: "object",
        properties: {
          guardrailId: { type: "string", description: "Exact id copied from the supplied guardrail list." },
          statement: { type: "string" },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
        required: ["guardrailId", "statement", "evidenceIds"],
      },
    },
    insufficientEvidenceReasons: { type: "array", items: { type: "string" } },
  },
  required: ["analysisMode", "analysisStatus", "summary", "issues", "preserved", "insufficientEvidenceReasons"],
} as const;

export type AnalyzeChangesInput = {
  analysisMode: AnalysisMode;
  guardrails: Guardrail[];
  diff: LocalDiff;
  baselineScreenshot: { mimeType: "image/jpeg"; dataUrl: string };
  currentScreenshot: { mimeType: "image/jpeg"; dataUrl: string };
};

function dataUrlToBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

/** REV-02/03: priority is surfaced to Gemini as part of the Guardrails input. */
/**
 * Each guardrail is listed with its stored id, because the response has to
 * reference them: issues carry a guardrailId and so do preserved entries,
 * and the Side Panel resolves both back to the saved guardrail by exact id.
 *
 * Omitting the ids (as this did originally) left the model no choice but to
 * invent them, so nothing ever matched — preserved guardrails rendered as
 * "not reported", issue cards couldn't show which guardrail they belonged
 * to, and rank-issues.ts silently treated every issue as non-"must" because
 * its lookup missed. The statements alone read fine, which is why it went
 * unnoticed until the UI started resolving ids.
 */
function formatGuardrailsText(guardrails: Guardrail[], analysisMode: AnalysisMode): string {
  const modeLine = `Analysis mode: ${analysisMode}`;
  const enabled = guardrails.filter((g) => g.enabled);
  if (enabled.length === 0) {
    return `${modeLine}\nNo guardrails are active for this route.`;
  }
  const lines = enabled.map((g) => `- id=${g.id} [${g.priority}] "${g.statement}"`);
  return [
    modeLine,
    "Guardrails (use these exact id values in guardrailId fields):",
    ...lines,
  ].join("\n");
}

/** Input order per section 8.2: rules, guardrails, diff, baseline image, current image, schema (via generationConfig). */
function buildRequestBody(input: AnalyzeChangesInput, repairNote?: string) {
  const parts: Array<Record<string, unknown>> = [
    { text: SYSTEM_PROMPT },
    { text: formatGuardrailsText(input.guardrails, input.analysisMode) },
    // Trimmed per section 7.4 — a single edit above the header shifts every
    // element in flow, and sending hundreds of position entries both times
    // out and buries the decisive facts. The UI still shows the full diff.
    { text: JSON.stringify(selectSignificantChanges(input.diff)) },
    { text: "BASELINE" },
    {
      inlineData: {
        mimeType: input.baselineScreenshot.mimeType,
        data: dataUrlToBase64(input.baselineScreenshot.dataUrl),
      },
    },
    { text: "CURRENT" },
    {
      inlineData: {
        mimeType: input.currentScreenshot.mimeType,
        data: dataUrlToBase64(input.currentScreenshot.dataUrl),
      },
    },
  ];
  if (repairNote) parts.push({ text: repairNote });

  return {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
    },
  };
}

/**
 * Leads with the one actionable fact in a 429: how long to wait.
 *
 * Google's quota message is several sentences of docs URLs and metric names
 * with "Please retry in 29.48747872s" buried at the end — the only part the
 * user can act on, and the hardest to find. Section 8.1 calls for
 * user-driven retry with simple backoff rather than hammering the API, and
 * that only works if the wait is legible. The raw text is kept below so
 * nothing is hidden.
 */
function describeRateLimit(detail: string): string {
  const seconds = /retry in ([\d.]+)s/i.exec(detail)?.[1];
  const wait = seconds ? `Try again in about ${Math.ceil(Number(seconds))} seconds.` : "Try again shortly.";
  return `Gemini rate limit reached. ${wait}\n\n${detail}`;
}

/** Google's error responses carry a useful `error.message` (e.g. which model name isn't valid) — surface it instead of just the bare status code. */
async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as { error?: { message?: unknown } })?.error?.message;
    if (typeof message === "string" && message.trim()) return message;
  } catch {
    // Response body wasn't JSON — fall through to the generic status message.
  }
  return `HTTP ${response.status}`;
}

async function callGemini(model: string, apiKey: string, body: unknown): Promise<Result<unknown>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: { code: "NETWORK_TIMEOUT", message: "The request to Gemini timed out." } };
    }
    return {
      ok: false,
      error: { code: "NETWORK_TIMEOUT", message: "Could not reach the Gemini API. Check your network connection." },
    };
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: { code: "GEMINI_KEY_INVALID", message: `The Gemini API key was rejected: ${await readErrorDetail(response)}` },
    };
  }
  if (response.status === 429) {
    return { ok: false, error: { code: "GEMINI_RATE_LIMITED", message: describeRateLimit(await readErrorDetail(response)) } };
  }
  if (response.status >= 500) {
    return {
      ok: false,
      error: { code: "GEMINI_SERVER_ERROR", message: `Gemini server error: ${await readErrorDetail(response)}` },
    };
  }
  if (!response.ok) {
    // Covers 404 (usually an invalid/unavailable model name for this API version/key) and other 4xx.
    return {
      ok: false,
      error: { code: "GEMINI_SERVER_ERROR", message: `Gemini request failed: ${await readErrorDetail(response)}` },
    };
  }

  try {
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, error: { code: "SCHEMA_VALIDATION_FAILED", message: "Gemini response was not valid JSON." } };
  }
}

function extractResponseText(payload: unknown): string | null {
  const text = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]
    ?.content?.parts?.[0]?.text;
  return text ?? null;
}

function parseAndValidate(rawText: string, expectedMode: AnalysisMode): Result<AiAnalysis> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      error: { code: "SCHEMA_VALIDATION_FAILED", message: "Gemini response text was not valid JSON." },
    };
  }

  const result = createAiAnalysisSchema(expectedMode).safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "SCHEMA_VALIDATION_FAILED",
        message: result.error.issues.map((issue) => issue.message).join("; "),
      },
    };
  }
  return { ok: true, data: result.data };
}

function finalizeAnalysis(analysis: AiAnalysis, guardrails: Guardrail[]): AiAnalysis {
  // AC-REV-07 safeguard: Gemini's own ordering isn't guaranteed, so re-sort
  // "must"-linked issues first before returning.
  return { ...analysis, issues: prioritizeMustViolations(analysis.issues, guardrails, 3) };
}

/**
 * Runs one Check Changes analysis. On a schema-invalid response, repairs
 * once (section 5.1: "한 번만 repair 재요청") before surfacing
 * SCHEMA_VALIDATION_FAILED for a Retry state.
 */
export async function analyzeChanges(input: AnalyzeChangesInput): Promise<Result<AiAnalysis>> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { ok: false, error: { code: "GEMINI_KEY_MISSING", message: "No Gemini API key is configured." } };
  }
  const model = (await getModel()) || DEFAULT_GEMINI_MODEL;

  const firstAttempt = await callGemini(model, apiKey, buildRequestBody(input));
  if (!firstAttempt.ok) return firstAttempt;

  const rawText = extractResponseText(firstAttempt.data);
  if (!rawText) {
    return { ok: false, error: { code: "SCHEMA_VALIDATION_FAILED", message: "Gemini response had no content." } };
  }

  const firstValidation = parseAndValidate(rawText, input.analysisMode);
  if (firstValidation.ok) {
    return { ok: true, data: finalizeAnalysis(firstValidation.data, input.guardrails) };
  }

  const repairNote = `Your previous response failed validation: ${firstValidation.error.message}. Return corrected JSON that strictly matches the required schema and the analysisMode "${input.analysisMode}".`;
  const repairAttempt = await callGemini(model, apiKey, buildRequestBody(input, repairNote));
  if (!repairAttempt.ok) return repairAttempt;

  const repairText = extractResponseText(repairAttempt.data);
  if (!repairText) {
    return { ok: false, error: { code: "SCHEMA_VALIDATION_FAILED", message: "Gemini repair response had no content." } };
  }

  const repairValidation = parseAndValidate(repairText, input.analysisMode);
  if (!repairValidation.ok) return repairValidation;
  return { ok: true, data: finalizeAnalysis(repairValidation.data, input.guardrails) };
}

// ---------------------------------------------------------------------------
// Guardrail recommendation (FR-03) — a separate, simpler Gemini interaction:
// one screenshot, no diff, no repair retry (not specified for this action).
// A failure here must never block Baseline save (section 6.1) — callers get
// a plain Result and fall back to manual/static guardrail entry.
// ---------------------------------------------------------------------------

const GUARDRAIL_RECOMMENDATION_PROMPT = `You are helping a user define UX guardrails for a webpage they just marked
as their approved baseline.

Suggest up to 3 short, observable guardrail statements describing
relationships that should hold true going forward. Do not use aesthetic or
quality adjectives (e.g. "prettier", "more professional", "modern", "trendy",
"senior-level"). Every statement must describe an observable relationship
between elements, regions, or a user flow — relative size, position,
reachability, or step order — that could be checked against a future
screenshot. Base suggestions only on what is visible in the provided
screenshot and summarized page structure; do not invent elements that are
not present.`;

const GUARDRAIL_SUGGESTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    guardrails: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          statement: { type: "string" },
          evidenceTypes: {
            type: "array",
            items: { type: "string", enum: ["position", "visibility", "count", "flow", "visual"] },
          },
        },
        required: ["statement", "evidenceTypes"],
      },
    },
  },
  required: ["guardrails"],
} as const;

const guardrailSuggestionResponseSchema = z.object({
  guardrails: z
    .array(
      z.object({
        statement: z.string().min(1),
        evidenceTypes: z.array(z.enum(["position", "visibility", "count", "flow", "visual"])),
      }),
    )
    .max(3),
});

export type RecommendGuardrailsInput = {
  screenshot: { mimeType: "image/jpeg"; dataUrl: string };
  snapshot: PageSnapshot;
};

function buildGuardrailRecommendationBody(input: RecommendGuardrailsInput) {
  const structureSummary = JSON.stringify({
    contentHierarchy: input.snapshot.contentHierarchy,
    interactionSummary: input.snapshot.interactionSummary,
  });

  return {
    contents: [
      {
        role: "user",
        parts: [
          { text: GUARDRAIL_RECOMMENDATION_PROMPT },
          { text: structureSummary },
          {
            inlineData: {
              mimeType: input.screenshot.mimeType,
              data: dataUrlToBase64(input.screenshot.dataUrl),
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: GUARDRAIL_SUGGESTION_JSON_SCHEMA,
    },
  };
}

export async function recommendGuardrails(input: RecommendGuardrailsInput): Promise<Result<Guardrail[]>> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { ok: false, error: { code: "GEMINI_KEY_MISSING", message: "No Gemini API key is configured." } };
  }
  const model = (await getModel()) || DEFAULT_GEMINI_MODEL;

  const attempt = await callGemini(model, apiKey, buildGuardrailRecommendationBody(input));
  if (!attempt.ok) return attempt;

  const rawText = extractResponseText(attempt.data);
  if (!rawText) {
    return { ok: false, error: { code: "SCHEMA_VALIDATION_FAILED", message: "Gemini response had no content." } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      error: { code: "SCHEMA_VALIDATION_FAILED", message: "Gemini response text was not valid JSON." },
    };
  }

  const validated = guardrailSuggestionResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      error: {
        code: "SCHEMA_VALIDATION_FAILED",
        message: validated.error.issues.map((issue) => issue.message).join("; "),
      },
    };
  }

  // REV-04: AI-suggested guardrails default to "must" regardless of what the
  // model returned — createAiSuggestedGuardrail is the one place that's set.
  return {
    ok: true,
    data: validated.data.guardrails.map((suggestion, index) =>
      createAiSuggestedGuardrail({
        id: `ai-guardrail-${index}`,
        statement: suggestion.statement,
        evidenceTypes: suggestion.evidenceTypes,
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
// API key validation (FR-12) — used by both SET_API_KEY (validate right
// after saving) and VALIDATE_API_KEY. Lists models instead of generating
// content: it's the cheapest call that still confirms the key is accepted.
// ---------------------------------------------------------------------------

export async function validateApiKey(apiKey: string): Promise<Result<boolean>> {
  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT_BASE}?pageSize=1`, {
      headers: { "x-goog-api-key": apiKey },
    });
  } catch {
    return {
      ok: false,
      error: { code: "NETWORK_TIMEOUT", message: "Could not reach the Gemini API. Check your network connection." },
    };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: true, data: false };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: { code: "GEMINI_SERVER_ERROR", message: `Gemini returned an unexpected status (${response.status}).` },
    };
  }
  return { ok: true, data: true };
}
