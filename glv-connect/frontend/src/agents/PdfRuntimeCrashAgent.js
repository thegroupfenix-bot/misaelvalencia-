/**
 * PdfRuntimeCrashAgent.js — V9.2
 *
 * Detects potential PDF runtime crash conditions before pdf().toBlob():
 * - Undefined/null values being passed to react-pdf <Text>
 * - Object/array values where strings are expected
 * - Circular references in payload
 * - Missing required fields
 *
 * Never throws. Never blocks PDF.
 */

/**
 * @param {object}   doc     — raw document payload
 * @param {object[]} cdRows  — parsed CommercialEngine rows
 * @returns {object}          — crash risk assessment
 */
export function runCrashRiskAudit(doc = {}, cdRows = []) {
  const risks   = [];
  const info    = [];

  try {
    // ── 1. Circular reference check ───────────────────────────────────────────
    try {
      JSON.stringify(doc);
      info.push("doc serialization: OK (no circular reference)");
    } catch (e) {
      risks.push({ level: "fatal", location: "doc", message: `Circular reference detected: ${e.message}` });
    }

    // ── 2. String field object/array contamination ────────────────────────────
    const REQUIRED_STRING_FIELDS = ["id", "type", "date", "destination", "client", "product", "agent"];
    for (const f of REQUIRED_STRING_FIELDS) {
      const v = doc[f];
      if (v == null || v === "") {
        risks.push({ level: "warning", location: `doc.${f}`, message: `Missing or empty — PDF header will show blank` });
      } else if (typeof v === "object") {
        risks.push({ level: "fatal", location: `doc.${f}`, message: `Object/array where string expected — will crash <Text> in react-pdf` });
      } else {
        info.push(`doc.${f}: "${String(v).slice(0, 30)}" — OK`);
      }
    }

    // ── 3. cdRows structure ───────────────────────────────────────────────────
    if (!Array.isArray(cdRows)) {
      risks.push({ level: "fatal", location: "cdRows", message: "Not an array — all CommercialEngine sections will crash" });
    } else if (cdRows.length === 0) {
      risks.push({ level: "warning", location: "cdRows", message: "Empty — commercial data sections will be skipped" });
    } else {
      info.push(`cdRows.length: ${cdRows.length}`);
      const first = cdRows[0];
      info.push(`cdRows[0].category: ${first.category}`);
      info.push(`cdRows[0].currency: ${first.currency ?? "(missing)"}`);
      if (first.category === "OILS") {
        if (!first.oilsConfig || typeof first.oilsConfig !== "object") {
          risks.push({ level: "warning", location: "cdRows[0].oilsConfig", message: "Missing or invalid — OILS section will show empty data" });
        } else {
          info.push("cdRows[0].oilsConfig: present — OK");
        }
      }
    }

  } catch (agentErr) {
    risks.push({ level: "agent_error", location: "PdfRuntimeCrashAgent", message: `Agent crashed: ${agentErr.message}` });
  }

  const fatals   = risks.filter(r => r.level === "fatal");
  const warnings = risks.filter(r => r.level === "warning");

  return {
    agent:    "PdfRuntimeCrashAgent",
    version:  "v9.2",
    pass:     fatals.length === 0,
    blockPdf: false,    // auto-healing always active — never block
    risks,
    info,
    summary: {
      fatals:   fatals.length,
      warnings: warnings.length,
      safe:     fatals.length === 0,
    },
  };
}
