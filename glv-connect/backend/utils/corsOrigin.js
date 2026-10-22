/**
 * Builds an origin-allow predicate for the CORS middleware.
 *
 * Rules:
 *   - Requests with no Origin header (same-origin, curl, server-to-server) → always allowed.
 *   - An origin explicitly listed in allowedOrigins → allowed.
 *   - Development/test only: localhost and *.up.railway.app → allowed.
 *   - Production with empty allowedOrigins → ALL cross-origin requests are rejected.
 *   - Production with a non-empty list → only listed HTTPS origins; Railway subdomains
 *     are rejected unless they appear explicitly in the list.
 */
function makeOriginChecker(allowedOrigins, isProd) {
  return function isAllowedOrigin(origin) {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    if (!isProd) {
      try {
        const hostname = new URL(origin).hostname;
        if (hostname === "localhost" || hostname === "127.0.0.1") return true;
        if (hostname.endsWith(".up.railway.app")) return true;
      } catch { /* malformed origin — reject */ }
    }
    return false;
  };
}

module.exports = { makeOriginChecker };
