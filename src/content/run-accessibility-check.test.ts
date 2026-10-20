import { afterEach, describe, expect, it } from "vitest";
import { isAxeLoaded, runAccessibilityCheck } from "./run-accessibility-check";

function setAxe(axe: unknown) {
  (window as unknown as { axe?: unknown }).axe = axe;
}

/**
 * Mimics chrome.scripting.executeScript({ func }) — see the identical helper
 * in extract-snapshot.test.ts for why a direct call can't catch a
 * self-containment violation (a stray reference to a module-level const).
 */
function simulateInjection<T extends (...args: never[]) => unknown>(fn: T): T {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(`return (${fn.toString()})`)() as T;
}

describe("isAxeLoaded", () => {
  afterEach(() => {
    setAxe(undefined);
  });

  it("is false before axe-core is injected", () => {
    expect(isAxeLoaded()).toBe(false);
  });

  it("is true once window.axe exists", () => {
    setAxe({ run: async () => ({ violations: [] }) });
    expect(isAxeLoaded()).toBe(true);
  });

  it("still works reconstructed exactly as chrome.scripting.executeScript would inject it", () => {
    const injected = simulateInjection(isAxeLoaded);
    expect(injected()).toBe(false);
  });
});

describe("runAccessibilityCheck", () => {
  afterEach(() => {
    setAxe(undefined);
    document.body.innerHTML = "";
  });

  it("returns an empty array when axe-core isn't loaded", async () => {
    expect(await runAccessibilityCheck()).toEqual([]);
  });

  it("still works reconstructed exactly as chrome.scripting.executeScript would inject it", async () => {
    document.body.innerHTML = "<div></div>";
    setAxe({
      run: async () => ({
        violations: [{ id: "label", impact: "serious", description: "d", helpUrl: "u", nodes: [{ target: ["div"] }] }],
      }),
    });
    const injected = simulateInjection(runAccessibilityCheck);
    const findings = await injected();
    expect(findings).toHaveLength(1);
  });

  it("maps axe violations to one finding per affected node", async () => {
    document.body.innerHTML = '<select id="gender"></select><input id="email">';
    setAxe({
      run: async () => ({
        violations: [
          {
            id: "label",
            impact: "serious",
            description: "Form elements must have labels",
            helpUrl: "https://dequeuniversity.com/rules/axe/label",
            nodes: [{ target: ["select#gender"] }, { target: ["input#email"] }],
          },
        ],
      }),
    });

    const findings = await runAccessibilityCheck();
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      ruleId: "label",
      impact: "serious",
      targetSelector: "select#gender",
      description: "Form elements must have labels",
      elementFingerprint: { strategy: "stable-id", value: "gender" },
      matchConfidence: "high",
    });
    expect(findings[1]).toMatchObject({
      ruleId: "label",
      targetSelector: "input#email",
      elementFingerprint: { strategy: "stable-id", value: "email" },
      matchConfidence: "high",
    });
  });

  it("prefers the node's specific failureSummary over the rule's generic description", async () => {
    document.body.innerHTML = '<a class="skip-link" href="#main">Skip to content</a>';
    setAxe({
      run: async () => ({
        violations: [
          {
            id: "color-contrast",
            impact: "serious",
            description: "Ensure the contrast between foreground and background colors meets WCAG 2 AA thresholds",
            helpUrl: "https://dequeuniversity.com/rules/axe/color-contrast",
            nodes: [
              {
                target: [".skip-link"],
                failureSummary:
                  "Fix any of the following:\n  Element has insufficient color contrast of 2.1 (foreground color: #999999, background color: #ffffff, font size: 9pt, font weight: normal). Expected contrast ratio of 4.5:1",
              },
            ],
          },
        ],
      }),
    });

    const [finding] = await runAccessibilityCheck();
    expect(finding?.description).toContain("contrast ratio of 4.5:1");
  });

  it("computes a role+accessible-name fingerprint when the target has no id but a role and text", async () => {
    document.body.innerHTML = "<h2>이번 계절의 기물</h2>";
    setAxe({
      run: async () => ({
        violations: [
          { id: "color-contrast", impact: "moderate", description: "d", helpUrl: "u", nodes: [{ target: ["h2"] }] },
        ],
      }),
    });

    const [finding] = await runAccessibilityCheck();
    expect(finding?.elementFingerprint).toEqual({
      strategy: "role-name",
      role: "heading",
      accessibleName: "이번 계절의 기물",
    });
    expect(finding?.matchConfidence).toBe("medium");
  });

  it("falls back to a low-confidence structural fingerprint when the target selector can't be resolved in the DOM", async () => {
    setAxe({
      run: async () => ({
        violations: [
          {
            id: "color-contrast",
            impact: "minor",
            description: "d",
            helpUrl: "u",
            nodes: [{ target: ["#does-not-exist"] }],
          },
        ],
      }),
    });

    const [finding] = await runAccessibilityCheck();
    expect(finding?.matchConfidence).toBe("low");
    expect(finding?.elementFingerprint).toMatchObject({ strategy: "structural", path: "#does-not-exist" });
  });

  it("defaults a null impact to minor", async () => {
    setAxe({
      run: async () => ({
        violations: [{ id: "region", impact: null, description: "d", helpUrl: "u", nodes: [{ target: ["div"] }] }],
      }),
    });
    const [finding] = await runAccessibilityCheck();
    expect(finding?.impact).toBe("minor");
  });

  it("returns an empty array instead of throwing when axe.run() rejects", async () => {
    setAxe({ run: async () => Promise.reject(new Error("axe crashed")) });
    await expect(runAccessibilityCheck()).resolves.toEqual([]);
  });
});
