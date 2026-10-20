import { describe, expect, it } from "vitest";
import { COUNTS, LABELS, PROSE } from "./copy";

const HANGUL = /[ㄱ-ㆎ가-힣]/;

describe("language rule (devlog day4, 한국어 패치 범위 확정)", () => {
  it("keeps every structural label in English", () => {
    // Labels are scanned, not read, and the Figma type treatment relies on
    // uppercase — which Korean has no form of.
    for (const [key, value] of Object.entries(LABELS)) {
      expect(HANGUL.test(value), `LABELS.${key} contains Hangul: ${value}`).toBe(false);
    }
  });

  it("writes every explanatory string in Korean", () => {
    // Prose is read for comprehension, so it follows the user's language.
    for (const [key, value] of Object.entries(PROSE)) {
      expect(HANGUL.test(value), `PROSE.${key} has no Hangul: ${value}`).toBe(true);
    }
  });

  it("keeps product identity and technical terms untranslated inside prose", () => {
    // "Baseline" and "Guardrail" are the product's own vocabulary and appear
    // in the results the user will paste elsewhere — translating them would
    // break the link between the UI and everything else they read.
    expect(PROSE.acceptDialogBody).toContain("Baseline");
    expect(PROSE.acceptDialogNote).toContain("Guardrail");
  });

  it("formats counted prose with the number in place", () => {
    expect(COUNTS.accessibilityNew(3)).toContain("3");
    expect(HANGUL.test(COUNTS.accessibilityNew(3))).toBe(true);
    expect(COUNTS.accessibilityResolved(1)).toContain("1");
  });

  it("pads the issue counter to the Figma's two-digit form", () => {
    expect(COUNTS.issueCounter(1, 3)).toBe("ISSUE 01 / 03");
  });

  it("never claims a prompt or an edit caused something (CLAUDE.md 4.1)", () => {
    const all = [...Object.values(PROSE), ...Object.values(LABELS)].join(" ").toLowerCase();
    for (const forbidden of ["prompt caused", "ai가 망가", "때문에 깨졌", "claude가"]) {
      expect(all).not.toContain(forbidden);
    }
  });
});
