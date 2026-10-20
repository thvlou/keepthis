import { describe, expect, it } from "vitest";
import { computeReadiness } from "./readiness";

describe("computeReadiness", () => {
  it("reports not-busy for a plain document", () => {
    document.body.innerHTML = "<main><h1>Ready</h1></main>";
    const readiness = computeReadiness(document);
    expect(readiness.ariaBusy).toBe(false);
    expect(readiness.skeletonCandidateCount).toBe(0);
    expect(readiness.documentReadyState).toBe(document.readyState);
  });

  it("flags aria-busy and skeleton placeholders", () => {
    document.body.innerHTML = `
      <main aria-busy="true">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </main>
    `;
    const readiness = computeReadiness(document);
    expect(readiness.ariaBusy).toBe(true);
    expect(readiness.skeletonCandidateCount).toBeGreaterThanOrEqual(2);
  });
});
