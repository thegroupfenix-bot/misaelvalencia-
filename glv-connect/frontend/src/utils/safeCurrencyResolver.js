/**
 * safeCurrencyResolver.js — V9.2 PDF Currency Safety Net
 *
 * Single source of truth for currency resolution in PDF rendering.
 * All Intl.NumberFormat calls must use safeCurrencyResolver() — never
 * a raw variable that could be undefined.
 *
 * Invariant: always returns a non-empty string — never throws, never returns undefined.
 */

const VALID_ISO_CURRENCIES = new Set([
  "USD","EUR","GBP","AED","SAR","CNY","JPY","BRL","COP","MXN","CAD","AUD",
  "CHF","NZD","SGD","HKD","NOK","SEK","DKK","INR","KRW","THB","MYR","IDR",
  "PHP","TRY","ZAR","EGP","NGN","GHS","KES","MAD","DZD","TND","XOF","XAF",
]);

/**
 * Resolve a currency code to a valid ISO 4217 string.
 * Falls back to "USD" if value is missing, empty, or not a string.
 *
 * @param {*} value — any value (may be undefined, null, empty string, etc.)
 * @returns {string} — valid ISO 4217 currency code, always "USD" minimum
 */
export function safeCurrencyResolver(value) {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return "USD";
  }
  const upper = value.trim().toUpperCase();
  // Accept any 3-letter uppercase code — some currencies may be valid but not in our set
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return "USD";
}

/**
 * Canonical PDF currency resolver.
 * Reads from multiple sources in priority order.
 *
 * @param {object} firstCdRow  — first CommercialEngine row
 * @param {object} [oilsConfig] — oils configuration object (optional)
 * @param {object} [payload]   — raw document payload (optional)
 * @returns {string}            — safe ISO currency code
 */
export function resolvePdfCurrency(firstCdRow = {}, oilsConfig = {}, payload = {}) {
  const raw =
    firstCdRow?.currency ||
    oilsConfig?.currency ||
    payload?.currency ||
    null;
  return safeCurrencyResolver(raw);
}

/**
 * Format a number as currency — PDF-safe, never throws.
 *
 * @param {*}      value     — number to format
 * @param {string} currency  — ISO code (will be resolved via safeCurrencyResolver)
 * @returns {string}          — formatted string or "—"
 */
export function fmtPdfCurrency(value, currency) {
  try {
    const n = parseFloat(value);
    if (!isFinite(n) || isNaN(n)) return "—";
    const c = safeCurrencyResolver(currency);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: c,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return "—";
  }
}
