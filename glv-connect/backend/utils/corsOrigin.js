/**
 * CORS origin policy utilities.
 *
 * validateAndNormalizeOrigins(origins, isProd)
 *   Called once at startup. Validates that every configured origin is safe to
 *   trust. In production, any origin that is not a canonical https: URL causes
 *   a FATAL error (caller should exit 1). In dev/test, invalid entries are
 *   silently dropped and a warning is printed.
 *
 * makeOriginChecker(allowedOrigins, isProd)
 *   Returns an origin-allow predicate for the CORS middleware. Pass the output
 *   of validateAndNormalizeOrigins as `allowedOrigins`.
 *
 * Rules enforced at check time:
 *   - No Origin header (same-origin, curl, server-to-server) → always allowed.
 *   - Incoming origin must use the https: scheme to be checked against the list;
 *     an http: origin is never allowed even if it somehow appears in the list.
 *   - A validated https: origin that is explicitly listed → allowed.
 *   - Dev/test only: localhost (http/https), 127.0.0.1, and *.up.railway.app
 *     are auto-allowed regardless of the list.
 *   - Production with empty list → ALL cross-origin requests are rejected.
 *   - Production with non-empty list → only listed HTTPS origins; Railway
 *     subdomains are rejected unless they appear explicitly in the list.
 */

"use strict";

/**
 * Validates and normalises an array of raw origin strings at startup.
 *
 * @param {string[]} origins   Raw values from ALLOWED_ORIGINS env var.
 * @param {boolean}  isProd    true → production mode.
 * @returns {string[]}         Array of canonical, safe https: origins.
 * @throws {Error}             In production if any origin is invalid or non-HTTPS.
 */
function validateAndNormalizeOrigins(origins, isProd) {
  const valid = [];
  for (const raw of origins) {
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      const msg = `[CORS] FATAL: configured origin is not a valid URL: "${raw}"`;
      if (isProd) throw new Error(msg);
      console.warn(msg + " — skipping (non-production)");
      continue;
    }

    if (parsed.protocol !== "https:") {
      const msg = `[CORS] FATAL: configured origin must use https: — got "${raw}"`;
      if (isProd) throw new Error(msg);
      console.warn(msg + " — skipping (non-production)");
      continue;
    }

    // Reject wildcards, paths, credentials — canonical origin is scheme+host+port only
    if (
      parsed.pathname !== "/" && parsed.pathname !== "" ||
      parsed.search   !== "" ||
      parsed.hash     !== "" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hostname.includes("*")
    ) {
      const msg = `[CORS] FATAL: configured origin must be canonical (no path/query/credentials/wildcards): "${raw}"`;
      if (isProd) throw new Error(msg);
      console.warn(msg + " — skipping (non-production)");
      continue;
    }

    // Canonical form: scheme + host + (non-default port)
    const canonical = parsed.origin; // e.g. "https://app.example.com"
    if (!valid.includes(canonical)) valid.push(canonical);
  }
  return valid;
}

/**
 * Builds an origin-allow predicate for the CORS middleware.
 *
 * @param {string[]} allowedOrigins   Pre-validated origins (output of validateAndNormalizeOrigins).
 * @param {boolean}  isProd           true → production rules apply.
 * @returns {function(string|undefined): boolean}
 */
function makeOriginChecker(allowedOrigins, isProd) {
  const allowedSet = new Set(allowedOrigins);
  return function isAllowedOrigin(origin) {
    // No Origin header → same-origin / curl / server-to-server → always allowed
    if (!origin) return true;

    // Incoming origin must be HTTPS to be eligible for list matching.
    // An http: origin is never trusted, even if misconfiguration somehow
    // put it in the allowedOrigins list.
    let parsedOrigin;
    try { parsedOrigin = new URL(origin); } catch { return false; }
    if (parsedOrigin.protocol !== "https:") {
      // In dev/test, localhost http: is auto-allowed below
      if (!isProd) {
        const h = parsedOrigin.hostname;
        if (h === "localhost" || h === "127.0.0.1") return true;
      }
      return false;
    }

    // Explicit list match (https: already guaranteed above)
    if (allowedSet.has(origin)) return true;

    // Dev/test auto-allowances: *.up.railway.app (https: already checked)
    if (!isProd) {
      const h = parsedOrigin.hostname;
      if (h.endsWith(".up.railway.app")) return true;
    }

    return false;
  };
}

module.exports = { validateAndNormalizeOrigins, makeOriginChecker };
