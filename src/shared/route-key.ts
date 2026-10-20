/**
 * D-07: routeKey = origin + normalized pathname (+ SPA hash route).
 * See CLAUDE.md section 3.3 and AC-10.
 */

import type { RouteInfo } from "./types";

const SPA_HASH_ROUTE_PREFIXES = ["#/", "#!/"];

function isSpaHashRoute(hash: string): boolean {
  return SPA_HASH_ROUTE_PREFIXES.some((prefix) => hash.startsWith(prefix));
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * Builds a RouteInfo from a URL. origin is lowercased; pathname keeps its
 * original casing. query and hash are stored unnormalized on RouteInfo,
 * separate from the normalized routeKey used for baseline lookup.
 */
export function buildRouteInfo(url: string): RouteInfo {
  const parsed = new URL(url);
  const origin = parsed.origin.toLowerCase();
  const pathname = normalizePathname(parsed.pathname);

  const query = parsed.search ? parsed.search : null;
  const hash = parsed.hash ? parsed.hash : null;

  const routeKey =
    hash && isSpaHashRoute(hash) ? `${origin}${pathname}${hash}` : `${origin}${pathname}`;

  return {
    routeKey,
    fullUrl: url,
    query,
    hash,
  };
}
