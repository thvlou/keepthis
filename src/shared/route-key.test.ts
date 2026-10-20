import { describe, expect, it } from "vitest";
import { buildRouteInfo, isSupportedRoute } from "./route-key";

describe("buildRouteInfo", () => {
  it("drops a trailing slash from the pathname", () => {
    expect(buildRouteInfo("http://localhost:3000/discover/").routeKey).toBe("http://localhost:3000/discover");
  });

  it("excludes the query string from routeKey but keeps it on the record", () => {
    const info = buildRouteInfo("http://localhost:3000/discover?filter=all");
    expect(info.routeKey).toBe("http://localhost:3000/discover");
    expect(info.query).toBe("?filter=all");
  });

  it("includes an SPA hash route (#/) in routeKey", () => {
    expect(buildRouteInfo("http://localhost:3000/#/discover").routeKey).toBe("http://localhost:3000/#/discover");
  });

  it("excludes a plain anchor hash from routeKey", () => {
    expect(buildRouteInfo("http://localhost:3000/discover#results").routeKey).toBe(
      "http://localhost:3000/discover",
    );
  });
});

describe("isSupportedRoute", () => {
  it("accepts http://localhost with any port", () => {
    expect(isSupportedRoute("http://localhost:5173/index.html")).toBe(true);
    expect(isSupportedRoute("http://localhost/")).toBe(true);
  });

  it("accepts http://127.0.0.1", () => {
    expect(isSupportedRoute("http://127.0.0.1:8080/app")).toBe(true);
  });

  it("rejects a non-local host, even under the now-broad <all_urls> permission", () => {
    expect(isSupportedRoute("http://example.com/")).toBe(false);
  });

  it("rejects https on a local host (the product targets http only, per section 1)", () => {
    expect(isSupportedRoute("https://localhost:5173/")).toBe(false);
  });

  it("rejects an unparseable URL instead of throwing", () => {
    expect(isSupportedRoute("not a url")).toBe(false);
  });
});
