/**
 * PdfSafeRenderer.js — V9.1 PDF Safe Field Extraction Utilities
 *
 * Null-safe accessors for use inside @react-pdf/renderer JSX.
 * Never throws. Never returns undefined. Never returns NaN.
 *
 * These replace the inline safeStr/safeNum/safeArr helpers in GlvPDF.jsx
 * with a single importable module.
 */

// ─── Primitive safe extractors ────────────────────────────────────────────────

/**
 * Safe string coalesce.
 * Returns fallback if v is null, undefined, or empty after trim.
 */
export function safeStr(v, fallback = "") {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s.length > 0 ? s : fallback;
}

/**
 * Safe number coalesce.
 * Returns fallback if v cannot be parsed to a valid finite number.
 */
export function safeNum(v, fallback = 0) {
  const n = parseFloat(v);
  return (isFinite(n) && !isNaN(n)) ? n : fallback;
}

/**
 * Safe array coalesce.
 * Returns empty array if v is not an array.
 */
export function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Safe object coalesce.
 * Returns empty object if v is not a plain object.
 */
export function safeObj(v) {
  return (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
}

/**
 * Safe field extractor with try/catch.
 * @param {function} fn — accessor function (may throw)
 * @param {*} fallback
 */
export function safeField(fn, fallback = "") {
  try {
    const v = fn();
    if (v === null || v === undefined || (typeof v === "number" && (isNaN(v) || !isFinite(v)))) return fallback;
    return v;
  } catch {
    return fallback;
  }
}

/**
 * Format a number as USD currency string for PDF display.
 * @param {number} v
 * @param {number} decimals
 */
export function fmtUSD(v, decimals = 2) {
  const n = safeNum(v, null);
  if (n === null) return "—";
  return `$${n.toFixed(decimals)} USD`;
}

/**
 * Format a number with comma separators.
 * @param {number} v
 */
export function fmtLocale(v) {
  const n = safeNum(v, null);
  if (n === null) return "—";
  return n.toLocaleString("en-US");
}

/**
 * Format a percentage.
 */
export function fmtPct(v, decimals = 1) {
  const n = safeNum(v, null);
  if (n === null) return "—";
  return `${n.toFixed(decimals)}%`;
}

/**
 * Resolve arrays to a joined display string (or fallback if empty).
 */
export function joinArr(arr, sep = " · ", fallback = "—") {
  const a = safeArr(arr).filter(Boolean);
  return a.length > 0 ? a.join(sep) : fallback;
}

/**
 * Validate that a payload object is safe for PDF rendering.
 * Returns { safe: boolean, issues: string[] }
 */
export function validatePayloadSafety(payload) {
  if (!payload || typeof payload !== "object") {
    return { safe: false, issues: ["payload is not an object"] };
  }
  const issues = [];
  // Check for circular references (would crash JSON serializer)
  try { JSON.stringify(payload); } catch { issues.push("payload contains circular reference"); }
  return { safe: issues.length === 0, issues };
}
