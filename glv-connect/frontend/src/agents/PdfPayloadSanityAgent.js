/**
 * PdfPayloadSanityAgent.js — V9.2
 *
 * Audits a raw document payload BEFORE sanitization to detect:
 * - Stale legacy fields from previous category state
 * - Hybrid payloads (OILS row with liquid fields)
 * - Invalid pricing basis
 * - Missing resolvedCurrency
 * - Mixed V5/V6 packaging schemas
 * - Undefined critical fields
 *
 * Never throws. Never blocks PDF. Returns structured audit results.
 */

import { detectStaleFields } from "../utils/pdfPayloadSanitizer.js";
import { safeCurrencyResolver } from "../utils/safeCurrencyResolver.js";

/**
 * @param {object}   doc    — raw document
 * @param {object[]} cdRows — parsed CommercialEngine rows (before sanitization)
 * @returns {object}         — audit result
 */
export function runPayloadSanityAudit(doc = {}, cdRows = []) {
  const findings = [];
  const info     = [];

  try {
    const { stale, count } = detectStaleFields(doc, cdRows);

    info.push(`cdRows.length: ${cdRows.length}`);
    info.push(`stale field count: ${count}`);

    if (count > 0) {
      for (const s of stale) {
        findings.push({ severity: "warning", type: "STALE_FIELD", message: s });
      }
    }

    // ── Check each row ────────────────────────────────────────────────────────
    for (const [i, row] of cdRows.entries()) {
      const cat = row.category;
      info.push(`row[${i}]: category=${cat}`);

      // Hybrid payload detection
      if (cat === "OILS" && (row.packagingType || row.commercialUnit || row.presentationSize)) {
        findings.push({
          severity: "warning",
          type: "HYBRID_PAYLOAD",
          message: `row[${i}] OILS has stale liquid fields: packagingType="${row.packagingType}" commercialUnit="${row.commercialUnit}" presentationSize="${row.presentationSize}" — sanitizer will clear these`,
        });
      }

      // Currency check
      const resolvedCurrency = safeCurrencyResolver(row.currency);
      if (!row.currency) {
        findings.push({
          severity: "warning",
          type: "MISSING_CURRENCY",
          message: `row[${i}] (${cat}): currency missing — sanitizer will inject "${resolvedCurrency}"`,
        });
      } else {
        info.push(`row[${i}].currency: "${row.currency}" → resolved: "${resolvedCurrency}"`);
      }

      // OILS-specific checks
      if (cat === "OILS") {
        if (!row.oilsConfig || typeof row.oilsConfig !== "object") {
          findings.push({
            severity: "warning",
            type: "MISSING_OILS_CONFIG",
            message: `row[${i}] OILS: oilsConfig missing — oil rendering sections will show empty data`,
          });
        } else {
          info.push(`row[${i}].oilsConfig: present (keys: ${Object.keys(row.oilsConfig).join(", ").slice(0, 80)})`);
        }

        if (row.exportFormat) {
          findings.push({
            severity: "info",
            type: "STALE_EXPORT_FORMAT",
            message: `row[${i}] OILS: exportFormat="${row.exportFormat}" is a stale liquid field — sanitizer will null it`,
          });
        }
      }

      // Pricing basis check
      const incoterm = (Array.isArray(row.incoterms) ? row.incoterms[0] : null) || "FOB";
      const price = parseFloat(row.incotermPrices?.[incoterm] || row.unitPrice || 0);
      if (price === 0 && cat !== "OILS") {
        findings.push({
          severity: "info",
          type: "ZERO_PRICE",
          message: `row[${i}] (${cat}): price is 0 for incoterm=${incoterm}`,
        });
      }
    }

    // ── Doc-level checks ──────────────────────────────────────────────────────
    if (!doc.destination || doc.destination === "") {
      findings.push({ severity: "warning", type: "MISSING_DESTINATION", message: "doc.destination is empty — PDF will show blank destination" });
    }
    if (!doc.id) {
      findings.push({ severity: "warning", type: "MISSING_DOC_ID", message: "doc.id is missing — PDF filename will be blank" });
    }

  } catch (agentErr) {
    findings.push({ severity: "error", type: "AGENT_CRASH", message: `PdfPayloadSanityAgent crashed: ${agentErr.message}` });
  }

  const warnings   = findings.filter(f => f.severity === "warning");
  const hybrids    = findings.filter(f => f.type === "HYBRID_PAYLOAD");
  const staleFound = findings.filter(f => f.type === "STALE_FIELD");

  return {
    agent:    "PdfPayloadSanityAgent",
    version:  "v9.2",
    pass:     true,                    // never blocks — sanitizer handles all issues
    blockPdf: false,
    findings,
    info,
    summary: {
      hybridPayloads:  hybrids.length,
      staleFields:     staleFound.length,
      warnings:        warnings.length,
      requiresSanitization: hybrids.length > 0 || staleFound.length > 0,
    },
  };
}
