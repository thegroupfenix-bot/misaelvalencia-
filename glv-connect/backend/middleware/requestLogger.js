"use strict";
const crypto = require("crypto");

// Headers that must never appear in logs
const SENSITIVE_HEADERS = new Set([
  "authorization", "cookie", "x-api-key", "x-auth-token",
  "proxy-authorization", "set-cookie",
]);

/**
 * Structured request logger.
 *
 * Emits one JSON line per request to stdout. Fields: timestamp, request_id,
 * method, route, status, duration_ms, user_id.
 *
 * Never logs: passwords, JWT, Authorization header, PII (KYC, documents body),
 * or any request/response body content.
 */
function requestLogger(req, res, next) {
  const requestId = crypto.randomBytes(8).toString("hex");
  const startMs   = Date.now();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const duration = Date.now() - startMs;
    const entry = {
      ts:          new Date().toISOString(),
      request_id:  requestId,
      method:      req.method,
      route:       req.path,
      status:      res.statusCode,
      duration_ms: duration,
      user_id:     req.user?.id ?? null,
    };
    // Use process.stdout.write for structured log — avoids console formatting overhead
    process.stdout.write(JSON.stringify(entry) + "\n");
  });

  next();
}

module.exports = { requestLogger };
