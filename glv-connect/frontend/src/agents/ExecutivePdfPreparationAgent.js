/**
 * ExecutivePdfPreparationAgent.js — GLV GOS Agents — Executive PDF Preparation V1.0
 *
 * Validates that a document payload is architecturally ready for executive PDF rendering.
 * Checks: orchestration context, presentation zone coverage, layout data completeness,
 * operation context linkage, and entity chain availability.
 * Never throws. Returns structured reports.
 *
 * STATUS: ACTIVE
 */

import { buildPdfOrchestrationContext, validatePdfOrchestrationContext } from "../core/pdf/PdfOrchestrationBridge.js";
import { getActivePdfZones, getContentSourcesForPage }                   from "../core/pdf/ExecutivePdfPresentationMap.js";
import { resolveDocumentMode }                                            from "../engines/documentModeResolver.js";
import { assembleExecutiveLayout }                                        from "../core/pdf/PdfExecutiveLayoutEngine.js";

const AGENT_ID = "EXECUTIVE_PDF_PREPARATION_AGENT";

/**
 * Run a preparation audit for an executive PDF document.
 *
 * @param {object} doc         — document payload (from CommercialEngine or GlvPDF)
 * @param {object} [options]
 * @param {string} [options.operationId]
 * @param {string} [options.actorId]
 * @param {string} [options.actorRole]
 * @returns {object}            — structured preparation report
 */
export function runExecutivePdfPreparation(doc = {}, options = {}) {
  const issues   = [];
  const warnings = [];

  try {
    const cdRows     = doc.cdRows || [];
    const firstCdRow = cdRows[0] || {};
    const lang       = doc.lang || doc.language || "es";
    const docRef     = doc.docRef || doc.documentRef || null;
    const docType    = doc.documentType || "SCO";

    // ── Orchestration context ────────────────────────────────────────────────
    let orchestrationCtx = null;
    try {
      orchestrationCtx = buildPdfOrchestrationContext({
        operationId:    options.operationId || null,
        documentRef:    docRef,
        documentType:   docType,
        generatedBy:    options.actorId || "GLV GOS",
        generatedByRole:options.actorRole || null,
        language:       lang,
      });

      const ctxValidation = validatePdfOrchestrationContext(orchestrationCtx);
      if (!ctxValidation.valid) {
        for (const issue of ctxValidation.issues) {
          warnings.push(`[ORCHESTRATION] ${issue}`);
        }
      }
    } catch (_) {
      warnings.push("Could not build PDF orchestration context");
    }

    // ── Document mode resolution ─────────────────────────────────────────────
    let docMode = null;
    try {
      docMode = resolveDocumentMode(firstCdRow, doc);
    } catch (_) {
      warnings.push("Could not resolve document mode");
    }

    // ── Active zone coverage ─────────────────────────────────────────────────
    const activeZones = getActivePdfZones();
    for (const zone of activeZones) {
      const sources = zone.contentSources || [];
      const missing = sources.filter(src => {
        if (src === "pageNumber" || src === "platform" || src === "generatedAt") return false;
        return !doc[src] && !firstCdRow[src];
      });
      if (missing.length > 0) {
        warnings.push(`Zone "${zone.id}" missing content sources: [${missing.join(", ")}]`);
      }
    }

    // ── Layout assembly check ────────────────────────────────────────────────
    let layoutReady = false;
    try {
      const layout = assembleExecutiveLayout({
        documentRef:  docRef || "PREVIEW",
        documentType: docType,
        coverLabel:   "Export Offer",
        entityName:   doc.entityName || "GLV Global Food Services LLC",
        buyerName:    doc.buyerName || firstCdRow.buyerName || "—",
        sellerCountry:doc.originCountry || "USA",
        buyerCountry: doc.destinationCountry || "—",
        date:         doc.date || new Date().toISOString().slice(0, 10),
        lang,
      });
      layoutReady = !!layout.cover && !!layout.footer;
    } catch (_) {
      warnings.push("Executive layout assembly check failed");
    }

    // ── Minimum required fields ──────────────────────────────────────────────
    if (!docRef)              issues.push("documentRef is missing from payload");
    if (!firstCdRow.category) warnings.push("No category in first CD row — mode may be imprecise");
    if (cdRows.length === 0)  issues.push("cdRows is empty — no commercial data to render");

    return Object.freeze({
      agentId:          AGENT_ID,
      documentRef:      docRef || "unknown",
      pass:             issues.length === 0,
      blockRender:      issues.length > 0,
      issues,
      warnings,
      docMode,
      layoutReady,
      orchestrationCtx: orchestrationCtx || null,
      activeZoneCount:  activeZones.length,
      lang,
      _ran:             new Date().toISOString(),
    });

  } catch (err) {
    return Object.freeze({
      agentId:          AGENT_ID,
      documentRef:      doc?.docRef || "unknown",
      pass:             false,
      blockRender:      true,
      issues:           [`Agent error: ${err.message}`],
      warnings:         [],
      docMode:          null,
      layoutReady:      false,
      orchestrationCtx: null,
      activeZoneCount:  0,
      lang:             "es",
      _ran:             new Date().toISOString(),
    });
  }
}
