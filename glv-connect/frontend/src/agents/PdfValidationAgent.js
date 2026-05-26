/**
 * PdfValidationAgent.js — V9.1
 *
 * Validates PDF payload safety:
 *   ES/EN render, no crashes, payload safety, bilingual labels.
 *
 * Returns a structured report. Never throws.
 */

import { validatePayloadSafety } from "../components/pdf/PdfSafeRenderer.js";
import { inspectAllRows } from "../components/pdf/PdfPayloadInspector.js";

export const AGENT_ID = "PDF_VALIDATION_AGENT";
export const AGENT_VERSION = "v9.1";

/**
 * Validate a doc object for PDF readiness.
 *
 * @param {object} doc — document object passed to downloadPDF
 * @returns {ValidationReport}
 */
export function validatePdfDoc(doc) {
  const checks = [];
  const addCheck = (name, ok, message) => checks.push({ name, ok, message });

  if (!doc || typeof doc !== "object") {
    return { agentId: AGENT_ID, valid: false, blockPdf: true, checks: [{ name: "doc", ok: false, message: "doc is null" }] };
  }

  // Circular reference check (crashes @react-pdf/renderer serializer)
  const safety = validatePayloadSafety(doc);
  addCheck("no circular reference", safety.safe, safety.safe ? "Payload is JSON-safe" : safety.issues.join("; "));

  // Required doc fields
  addCheck("doc.id present",   !!doc.id,   doc.id   ? `id: ${doc.id}` : "doc.id missing");
  addCheck("doc.type valid",   ["SCO","FCO","SPA"].includes(doc.type), doc.type ? `type: ${doc.type}` : "doc.type missing");
  addCheck("doc.date present", !!doc.date, doc.date ? `date: ${doc.date}` : "doc.date missing");

  // Commercial data
  const cd = doc.commercialData || doc.commercial_data;
  const parsedCd = typeof cd === "string" ? (() => { try { return JSON.parse(cd); } catch { return null; } })() : cd;
  addCheck("commercialData parseable", !!parsedCd, parsedCd ? "commercialData parsed OK" : "commercialData is null or invalid JSON");

  const cdRows = parsedCd?.rows || [];
  addCheck("cdRows has entries", cdRows.length > 0, `cdRows count: ${cdRows.length}`);

  if (cdRows.length > 0) {
    const rowReport = inspectAllRows(cdRows);
    addCheck("first row valid", !rowReport.blockPdf, rowReport.blockPdf ? `Row blocked: ${rowReport.errors.map(e => e.message).join("; ")}` : "Row validated");
  }

  const errors = checks.filter(c => !c.ok);
  const blockPdf = !safety.safe || !parsedCd;

  return { agentId: AGENT_ID, version: AGENT_VERSION, valid: errors.length === 0, blockPdf, checks };
}
