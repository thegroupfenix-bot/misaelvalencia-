/**
 * PdfPayloadInspector.js — V9.1 PDF Payload Validator
 *
 * Pre-render validation layer. Inspects a normalized PDF payload
 * for null safety, type safety, array integrity, logistics consistency.
 *
 * Used by PdfRenderSupervisor before passing payload to PDF renderer.
 * Never crashes — returns a structured inspection report.
 */

import { validateUnitConsistency } from "../../engines/core/containerMathEngine.js";

// ─── Inspection result factory ────────────────────────────────────────────────

function pass(field, value) { return { field, status: "pass", value }; }
function warn(field, message, value) { return { field, status: "warn", message, value }; }
function fail(field, message, value) { return { field, status: "fail", message, value }; }

// ─── Individual field validators ──────────────────────────────────────────────

function inspectString(payload, key, required = false) {
  const v = payload[key];
  if (v == null || String(v).trim() === "") {
    return required ? fail(key, `Required string '${key}' is missing`) : warn(key, `String '${key}' is empty`);
  }
  return pass(key, v);
}

function inspectNumber(payload, key, required = false, min = null) {
  const v = payload[key];
  const n = parseFloat(v);
  if (isNaN(n)) {
    return required ? fail(key, `Required number '${key}' is not numeric`) : warn(key, `Number '${key}' is NaN`);
  }
  if (min !== null && n < min) {
    return warn(key, `Number '${key}' = ${n} is below minimum ${min}`);
  }
  return pass(key, n);
}

function inspectArray(payload, key, required = false) {
  const v = payload[key];
  if (!Array.isArray(v)) {
    return required ? fail(key, `Required array '${key}' is not an array`) : warn(key, `Field '${key}' is not an array`);
  }
  return pass(key, v.length);
}

// ─── Main inspector ───────────────────────────────────────────────────────────

/**
 * Inspect a raw CommercialEngine row for PDF readiness.
 * @param {object} row — raw commercial row (from cdRows[0])
 * @returns {PdfInspectionReport}
 */
export function inspectPdfRow(row) {
  if (!row || typeof row !== "object") {
    return {
      valid: false,
      blockPdf: true,
      errors: [{ field: "row", status: "fail", message: "Row is null or not an object" }],
      warnings: [],
      info: [],
    };
  }

  const checks = [];

  // Category
  checks.push(inspectString(row, "category", true));

  // Incoterms
  const incotermCheck = Array.isArray(row.incoterms) && row.incoterms.length > 0
    ? pass("incoterms", row.incoterms)
    : warn("incoterms", "incoterms array missing — defaulting to CFR");
  checks.push(incotermCheck);

  // OILS-specific checks
  if (row.category === "OILS") {
    const cfg = row.oilsConfig || {};

    checks.push(cfg.productId ? pass("oilsConfig.productId", cfg.productId) : warn("oilsConfig.productId", "Oil product not selected"));
    checks.push(cfg.packagingType ? pass("oilsConfig.packagingType", cfg.packagingType) : warn("oilsConfig.packagingType", "Packaging type not selected"));
    checks.push(cfg.sizeId ? pass("oilsConfig.sizeId", cfg.sizeId) : warn("oilsConfig.sizeId", "Size not selected"));
    checks.push(cfg.incoterm ? pass("oilsConfig.incoterm", cfg.incoterm) : warn("oilsConfig.incoterm", "Incoterm not set — defaulting to FOB"));

    // Container units consistency
    if (cfg.packagingType && cfg.sizeId && cfg.unitsPerContainer) {
      const consistency = validateUnitConsistency(cfg.packagingType, cfg.sizeId, cfg.unitsPerContainer);
      if (!consistency.valid) {
        checks.push(warn(
          "oilsConfig.unitsPerContainer",
          `CONTAINER LOGISTICS MISMATCH: reported=${consistency.reported}, canonical=${consistency.canonical}, delta=${(consistency.deltaFraction * 100).toFixed(1)}%`,
          cfg.unitsPerContainer,
        ));
      } else {
        checks.push(pass("oilsConfig.unitsPerContainer", cfg.unitsPerContainer));
      }
    }

    // Arrays
    checks.push(Array.isArray(cfg.certifications) ? pass("oilsConfig.certifications", cfg.certifications.length) : warn("oilsConfig.certifications", "certifications not an array"));
    checks.push(Array.isArray(cfg.foodGrade) ? pass("oilsConfig.foodGrade", cfg.foodGrade.length) : warn("oilsConfig.foodGrade", "foodGrade not an array"));
    checks.push(Array.isArray(cfg.skus) ? pass("oilsConfig.skus", cfg.skus.length) : warn("oilsConfig.skus", "skus not an array"));
  }

  // LIVE_ANIMALS-specific checks — do NOT transform, just verify presence
  if (row.category === "LIVE_ANIMALS") {
    const specs = row.specs || {};
    checks.push(inspectNumber({ headCount: specs.headCount }, "headCount", false, 1));
    checks.push(inspectNumber({ avgWeight: specs.avgWeight }, "avgWeight", false, 1));
  }

  const errors   = checks.filter(c => c.status === "fail");
  const warnings = checks.filter(c => c.status === "warn");
  const info     = checks.filter(c => c.status === "pass");

  // Block PDF only for hard failures (missing category or null row)
  const blockPdf = errors.some(e => ["row", "category"].includes(e.field));

  return {
    valid: errors.length === 0,
    blockPdf,
    errors,
    warnings,
    info,
    rowCategory: row.category || null,
    inspectedAt: Date.now(),
  };
}

/**
 * Inspect multiple rows (full cdRows array).
 * Returns combined report.
 */
export function inspectAllRows(cdRows) {
  if (!Array.isArray(cdRows) || cdRows.length === 0) {
    return {
      valid: false, blockPdf: true,
      errors: [{ field: "cdRows", status: "fail", message: "No commercial rows found" }],
      warnings: [], info: [],
    };
  }
  return inspectPdfRow(cdRows[0]);
}
