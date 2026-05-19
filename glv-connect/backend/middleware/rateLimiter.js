"use strict";

/**
 * Simple in-memory sliding-window rate limiter.
 * Uses Map<ip, timestamp[]> — no external packages required.
 *
 * rateLimit(windowMs, maxRequests) → Express middleware
 */

/**
 * @param {number} windowMs   - sliding window duration in milliseconds
 * @param {number} maxRequests - max requests allowed in that window
 * @returns {import('express').RequestHandler}
 */
function rateLimit(windowMs, maxRequests) {
  /** @type {Map<string, number[]>} */
  const store = new Map();

  return function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    // Periodically clean up stale entries (0.1% of requests)
    if (Math.random() < 0.001) {
      for (const [key, timestamps] of store.entries()) {
        const fresh = timestamps.filter(t => t > windowStart);
        if (fresh.length === 0) {
          store.delete(key);
        } else {
          store.set(key, fresh);
        }
      }
    }

    // Get or create timestamp list for this IP
    const timestamps = store.get(ip) || [];
    // Remove timestamps outside the current window
    const fresh = timestamps.filter(t => t > windowStart);

    if (fresh.length >= maxRequests) {
      // Find the oldest timestamp to compute retry-after
      const oldest = fresh[0];
      const retry_after_ms = oldest + windowMs - now;
      return res.status(429).json({
        error: "Demasiadas solicitudes. Intenta más tarde.",
        retry_after_ms: Math.max(0, retry_after_ms),
      });
    }

    fresh.push(now);
    store.set(ip, fresh);
    next();
  };
}

// Pre-built limiter instances for common use cases
const apiLimiter    = rateLimit(60 * 1000, 100);  // 100 req/min
const uploadLimiter = rateLimit(60 * 1000, 10);   // 10 req/min
const adminLimiter  = rateLimit(60 * 1000, 30);   // 30 req/min

module.exports = { rateLimit, apiLimiter, uploadLimiter, adminLimiter };
