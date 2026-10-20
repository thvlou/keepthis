import { describe, expect, it } from "vitest";
import { extractSnapshot } from "./extract-snapshot";
import type { RouteInfo } from "../shared/types";

const route: RouteInfo = {
  routeKey: "http://localhost:3000/discover",
  fullUrl: "http://localhost:3000/discover",
  query: null,
  hash: null,
};

/**
 * Mimics chrome.scripting.executeScript({ func }): stringifies fn's source
 * and reconstructs it via `new Function`, which has no access to this
 * module's closure — only true globals like `document`/`window`. A direct
 * call to the imported `extractSnapshot` would still see a module-level
 * const via normal closure and never catch a self-containment violation
 * (see the CANDIDATE_SELECTOR incident this test guards against).
 */
function simulateInjection<T extends (...args: never[]) => unknown>(fn: T): T {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(`return (${fn.toString()})`)() as T;
}

function setFixture() {
  document.body.innerHTML = `
    <nav><a href="/">Home</a></nav>
    <main>
      <h1>Reference content</h1>
      <button data-testid="save-btn">Save</button>
      <div class="card">Card 1</div>
      <div class="card">Card 2</div>
      <input type="password" value="secret" />
    </main>
    <footer>Footer</footer>
  `;
}

describe("extractSnapshot", () => {
  it("runs successfully when reconstructed exactly as chrome.scripting.executeScript would inject it", () => {
    setFixture();
    const injected = simulateInjection(extractSnapshot);
    const snapshot = injected(route);
    expect(snapshot.elements.length).toBeGreaterThan(0);
  });

  it("carries the route through unchanged", () => {
    setFixture();
    const snapshot = extractSnapshot(route);
    expect(snapshot.route).toEqual(route);
    expect(snapshot.schemaVersion).toBe(1);
  });

  it("counts interactive elements", () => {
    setFixture();
    const snapshot = extractSnapshot(route);
    expect(snapshot.interactionSummary.buttonCount).toBe(1);
    expect(snapshot.interactionSummary.linkCount).toBe(1);
    expect(snapshot.interactionSummary.inputCount).toBe(1);
    expect(snapshot.interactionSummary.navItemCount).toBe(1);
  });

  it("fingerprints a data-testid element as testid-strategy", () => {
    setFixture();
    const snapshot = extractSnapshot(route);
    const saveButton = snapshot.elements.find((el) => el.tag === "button");
    expect(saveButton?.fingerprint).toEqual({ strategy: "testid", value: "save-btn" });
  });

  it("falls back to structural fingerprint for untagged elements, distinguishing siblings", () => {
    setFixture();
    const snapshot = extractSnapshot(route);
    const cards = snapshot.elements.filter((el) => el.tag === "div");
    expect(cards).toHaveLength(2);
    expect(cards[0]?.fingerprint.strategy).toBe("structural");
    expect(cards[1]?.fingerprint.strategy).toBe("structural");
    expect(cards[0]?.fingerprint).not.toEqual(cards[1]?.fingerprint);
  });

  it("never derives an accessible name from a password input", () => {
    setFixture();
    const snapshot = extractSnapshot(route);
    const passwordInput = snapshot.elements.find((el) => el.tag === "input");
    expect(passwordInput?.accessibleName).toBeNull();
  });

  it("orders headings and landmark/section entries into contentHierarchy", () => {
    setFixture();
    const snapshot = extractSnapshot(route);
    const kinds = snapshot.contentHierarchy.map((entry) => entry.kind);
    expect(kinds).toContain("heading");
    expect(kinds).toContain("landmark");
    expect(kinds).toContain("section");
  });

  it("records readiness signals consistent with the live document", () => {
    setFixture();
    const snapshot = extractSnapshot(route);
    expect(snapshot.readiness.documentReadyState).toBe(document.readyState);
    expect(snapshot.readiness.ariaBusy).toBe(false);
  });
});
