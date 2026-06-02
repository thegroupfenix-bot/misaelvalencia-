/**
 * PdfOrchestrationBridge.js — GLV GOS Core PDF — Orchestration Bridge V1.0
 *
 * Connects PDF generation to enterprise operation context.
 * Attaches operationId, workflowState, entityChain, auditReference,
 * generatedBy, language, and timestamp to every generated PDF.
 *
 * STATUS: ACTIVE — metadata architecture.
 * DO NOT redesign PDF rendering — this layer attaches metadata only.
 *
 * DESIGN CONTRACT:
 *   - This module emits PDF context metadata objects only.
 *   - GlvPDF.jsx consumes these to stamp orchestration data onto documents.
 *   - No @react-pdf imports. No JSX. No calculation changes.
 */

import { getOperation }         from "../operations/OperationRegistry.js";
import { getOperationChainSummary } from "../operations/OperationChainEngine.js";
import { generateAuditEvent }   from "../orchestration/EnterpriseOrchestrator.js";
import { normalizeLanguage }    from "../i18n/LanguageCore.js";

// ─── PDF context schema ─────────────────────────────────────────────────────────

/**
 * Build the orchestration metadata block for a PDF document.
 * This block is attached to the PDF payload before rendering.
 *
 * @param {object} params
 * @param {string} params.operationId
 * @param {string} params.documentRef      — e.g. "SCO-GLV-2026-047"
 * @param {string} params.documentType     — DOCUMENT_TYPES value
 * @param {string} [params.generatedBy]    — user ID or system name
 * @param {string} [params.generatedByRole]
 * @param {string} [params.language]
 * @returns {object}                        — frozen PDF context metadata
 */
export function buildPdfOrchestrationContext({
  operationId,
  documentRef,
  documentType,
  generatedBy      = "GLV GOS",
  generatedByRole  = null,
  language         = "es",
}) {
  const lang = normalizeLanguage(language);

  // Resolve operation data if available
  const op           = operationId ? getOperation(operationId) : null;
  const workflowState= op?.workflowState || null;
  const entityChain  = op?.operationChain ? getOperationChainSummary(op.operationChain) : null;
  const category     = op?.category || null;
  const currency     = op?.currency || null;
  const clientName   = op?.clientName || null;

  const auditRef = `AUD-${documentRef || operationId}-${Date.now()}`;

  return Object.freeze({
    operationId:    operationId || null,
    documentRef,
    documentType,
    workflowState,
    entityChain,
    category,
    currency,
    clientName,
    generatedBy,
    generatedByRole,
    language:       lang,
    auditReference: auditRef,
    generatedAt:    new Date().toISOString(),
    platform:       "GLV GOS",
    platformVersion:"1.0",
    _schema:        "GLV_PDF_ORCHESTRATION_V1",
  });
}

/**
 * Record a PDF generation event against the operation's audit trail.
 * Call this immediately after a successful PDF render.
 *
 * @param {string} operationId
 * @param {string} documentRef
 * @param {string} documentType
 * @param {string} actorId
 * @param {string} actorRole
 * @param {string} [lang]
 * @returns {object}  — audit event
 */
export function recordPdfGenerated(operationId, documentRef, documentType, actorId, actorRole, lang = "es") {
  return generateAuditEvent(operationId, "PDF_GENERATED", {
    actorId,
    actorRole,
    notes: `${documentType}: ${documentRef} [${lang.toUpperCase()}]`,
  });
}

/**
 * Record a PDF download event.
 *
 * @param {string} operationId
 * @param {string} documentRef
 * @param {string} actorId
 * @param {string} actorRole
 * @returns {object}  — audit event
 */
export function recordPdfDownloaded(operationId, documentRef, actorId, actorRole) {
  return generateAuditEvent(operationId, "PDF_DOWNLOADED", {
    actorId,
    actorRole,
    notes: `Downloaded: ${documentRef}`,
  });
}

/**
 * Validate that a PDF payload has the minimum required orchestration fields.
 * Never throws — returns structured validation result.
 *
 * @param {object} pdfContext  — result of buildPdfOrchestrationContext()
 * @returns {{ valid: boolean, issues: string[] }}
 */
export function validatePdfOrchestrationContext(pdfContext = {}) {
  const issues = [];

  if (!pdfContext.documentRef) issues.push("documentRef is required");
  if (!pdfContext.documentType) issues.push("documentType is required");
  if (!pdfContext.generatedAt)  issues.push("generatedAt is missing");
  if (!pdfContext.language)     issues.push("language is missing");
  if (!pdfContext.auditReference) issues.push("auditReference is missing");

  return Object.freeze({ valid: issues.length === 0, issues });
}
