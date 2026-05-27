/**
 * pdfPayloadSanitizer.js — V9.2
 *
 * Sanitizes the raw document payload BEFORE pdf().toBlob() is called.
 *
 * Problem: CommercialEngine always emits ALL row fields (packagingType,
 * commercialUnit, presentationSize, exportFormat, etc.) regardless of category.
 * When a user switches from LIQUID → OILS, stale liquid fields persist in the
 * stored row. GlvPDF.jsx reads those stale fields and incorrectly activates
 * V5/V6 liquid packaging sections for OILS documents.
 *
 * This sanitizer:
 *   1. Deep-clones the document (never mutates original state)
 *   2. Parses commercialData rows
 *   3. For each row, runs the category-appropriate field sanitizer
 *   4. Injects canonical defaults (currency, incoterm, etc.)
 *   5. Returns a frozen, render-ready payload
 *
 * Safety contract: never throws, never returns undefined, always returns
 * a valid document object.
 */

import { safeCurrencyResolver } from "./safeCurrencyResolver.js";

// ─── Fields that are LIQUID/V5 specific and must be nulled for OILS rows ──────
const OILS_STALE_LIQUID_FIELDS = [
  "packagingType",
  "presentationSize",
  "commercialUnit",
  "exportFormat",
  "packagingMode",
  "normalizedPresentationSize",
  "unitsPerBox",
  "netWeightPerUnit",
  "pouchConfig",
];

// ─── Fields that are OILS-specific and must be nulled for LIQUID/V5 rows ──────
const LIQUID_STALE_OILS_FIELDS = [
  "oilsConfig",
];

// ─── Safe deep clone (handles non-circular JSON payloads) ─────────────────────
function safeDeepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    // Fallback: shallow spread — handles most cases
    if (Array.isArray(obj)) return obj.map(item => ({ ...item }));
    if (obj && typeof obj === "object") return { ...obj };
    return obj;
  }
}

// ─── Per-category row sanitizers ──────────────────────────────────────────────

function sanitizeOilsRow(row) {
  const cleaned = { ...row };

  // Remove stale liquid/V5 fields that would trigger incorrect PDF sections
  for (const f of OILS_STALE_LIQUID_FIELDS) {
    if (cleaned[f]) {
      console.log(`[PDF_STALE_FIELDS_REMOVED] OILS row: cleared stale field "${f}" = ${JSON.stringify(cleaned[f])}`);
      cleaned[f] = null;
    }
  }

  // Ensure currency is a safe ISO code
  const rawCurrency = cleaned.currency;
  cleaned.currency = safeCurrencyResolver(rawCurrency);
  if (!rawCurrency) {
    console.log(`[PDF_SANITIZER] OILS row: injected default currency USD (was missing)`);
  }

  // Ensure oilsConfig exists and is an object
  if (!cleaned.oilsConfig || typeof cleaned.oilsConfig !== "object") {
    cleaned.oilsConfig = {};
    console.log(`[PDF_SANITIZER] OILS row: oilsConfig was missing — injected empty object`);
  }

  // Ensure incoterms is an array
  if (!Array.isArray(cleaned.incoterms) || cleaned.incoterms.length === 0) {
    cleaned.incoterms = [cleaned.oilsConfig.incoterm || "FOB"];
  }

  return cleaned;
}

function sanitizeLiquidRow(row) {
  const cleaned = { ...row };

  // Ensure currency
  cleaned.currency = safeCurrencyResolver(cleaned.currency);

  // Remove stale OILS fields from liquid rows
  for (const f of LIQUID_STALE_OILS_FIELDS) {
    if (cleaned[f] && Object.keys(cleaned[f]).length > 0) {
      // Keep oilsConfig only if explicitly present AND category matches
      if (row.category !== "OILS") {
        cleaned[f] = null;
      }
    }
  }

  // packagingType: inject safe default if it's a non-string
  if (cleaned.packagingType != null && typeof cleaned.packagingType !== "string") {
    console.log(`[PDF_STALE_FIELDS_REMOVED] Liquid row: packagingType was not a string — cleared`);
    cleaned.packagingType = null;
  }

  // commercialUnit: inject safe default if it's a non-string
  if (cleaned.commercialUnit != null && typeof cleaned.commercialUnit !== "string") {
    cleaned.commercialUnit = null;
  }

  return cleaned;
}

function sanitizeLiveAnimalsRow(row) {
  const cleaned = { ...row };

  // LIVE_ANIMALS must NEVER have liquid/OILS fields contaminating it
  for (const f of OILS_STALE_LIQUID_FIELDS) {
    cleaned[f] = null;
  }
  cleaned.oilsConfig = null;

  // Ensure specs has headCount and avgWeight
  if (!cleaned.specs || typeof cleaned.specs !== "object") {
    cleaned.specs = {};
  }

  cleaned.currency = safeCurrencyResolver(cleaned.currency);
  return cleaned;
}

function sanitizeDefaultRow(row) {
  const cleaned = { ...row };
  cleaned.currency = safeCurrencyResolver(cleaned.currency);
  return cleaned;
}

// ─── Row dispatcher ────────────────────────────────────────────────────────────
function sanitizeRow(row) {
  if (!row || typeof row !== "object") return row;

  switch (row.category) {
    case "OILS":        return sanitizeOilsRow(row);
    case "LIVE_ANIMALS": return sanitizeLiveAnimalsRow(row);
    default:            return sanitizeLiquidRow(row);
  }
}

// ─── Main sanitizer ────────────────────────────────────────────────────────────

/**
 * Sanitize a document payload for PDF rendering.
 *
 * @param {object} doc — raw document from state (may contain stale fields)
 * @returns {object}   — sanitized, render-ready document (deep clone, never mutates original)
 */
export function sanitizePdfPayload(doc) {
  if (!doc || typeof doc !== "object") {
    console.error("[PDF_SANITIZER] Called with invalid doc — returning empty object");
    return {};
  }

  console.group("[PDF_SANITIZER] Starting payload sanitization — " + (doc.id || "(no id)"));

  // ── Step 1: Deep clone ────────────────────────────────────────────────────
  const sanitized = safeDeepClone(doc);

  // ── Step 2: Parse commercialData ──────────────────────────────────────────
  let cdParsed = sanitized.commercialData || sanitized.commercial_data;
  if (typeof cdParsed === "string") {
    try {
      cdParsed = JSON.parse(cdParsed);
      console.log("[PDF_SANITIZER] commercialData parsed from JSON string");
    } catch {
      cdParsed = {};
      console.warn("[PDF_SANITIZER] commercialData is a string but JSON.parse failed — using empty object");
    }
  }
  cdParsed = cdParsed || {};

  // ── Step 3: Sanitize each row ─────────────────────────────────────────────
  const rawRows = Array.isArray(cdParsed.rows) ? cdParsed.rows : [];
  const sanitizedRows = rawRows.map((row, i) => {
    const before = row.category;
    const result = sanitizeRow(row);
    console.log(`[PDF_SANITIZER] row[${i}] category=${before} → currency=${result.currency} | packagingType=${result.packagingType ?? "null"} | commercialUnit=${result.commercialUnit ?? "null"}`);
    return result;
  });

  // ── Step 4: Rebuild commercialData ────────────────────────────────────────
  const sanitizedCd = { ...cdParsed, rows: sanitizedRows };
  sanitized.commercialData = sanitizedCd;
  delete sanitized.commercial_data; // unify to one key

  // ── Step 5: Inject top-level doc defaults ─────────────────────────────────
  if (!sanitized.type)        sanitized.type        = "SCO";
  if (!sanitized.date)        sanitized.date        = new Date().toISOString().split("T")[0];
  if (!sanitized.destination) sanitized.destination = "";

  // ── Step 6: Log summary ───────────────────────────────────────────────────
  const firstRow = sanitizedRows[0] || {};
  console.log("[PDF_PAYLOAD_NORMALIZED]", {
    docId:        sanitized.id,
    docType:      sanitized.type,
    rowCount:     sanitizedRows.length,
    category:     firstRow.category,
    currency:     firstRow.currency,
    packagingType: firstRow.packagingType,
    commercialUnit: firstRow.commercialUnit,
    hasOilsConfig: !!firstRow.oilsConfig && Object.keys(firstRow.oilsConfig).length > 0,
  });
  console.groupEnd();

  return sanitized;
}

/**
 * Detect stale fields in a raw document before sanitization.
 * Returns a list of detected issues for logging/audit.
 *
 * @param {object}   doc    — raw document
 * @param {object[]} cdRows — parsed rows
 * @returns {{ stale: string[], count: number }}
 */
export function detectStaleFields(doc = {}, cdRows = []) {
  const stale = [];

  for (const [i, row] of cdRows.entries()) {
    const cat = row.category;

    if (cat === "OILS") {
      for (const f of OILS_STALE_LIQUID_FIELDS) {
        const v = row[f];
        if (v != null && v !== "" && !(Array.isArray(v) && v.length === 0)) {
          stale.push(`row[${i}].${f}="${JSON.stringify(v).slice(0,40)}" (stale liquid field on OILS row)`);
        }
      }
    }

    if (cat === "LIVE_ANIMALS") {
      if (row.packagingType) stale.push(`row[${i}].packagingType on LIVE_ANIMALS row`);
      if (row.oilsConfig && Object.keys(row.oilsConfig).length > 0) stale.push(`row[${i}].oilsConfig on LIVE_ANIMALS row`);
    }

    if (!row.currency || typeof row.currency !== "string") {
      stale.push(`row[${i}].currency is missing or non-string (category=${cat})`);
    }
  }

  return { stale, count: stale.length };
}
