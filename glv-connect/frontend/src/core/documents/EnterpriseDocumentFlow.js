/**
 * EnterpriseDocumentFlow.js — GLV GOS Core Documents — Enterprise Document Flow V1.0
 *
 * Defines the full document lifecycle for export operations.
 * Lifecycle: SCO → FCO → SPA → Invoice → Packing List → BL → Delivery Confirmation.
 * Each flow step is linked to an operationId, workflow state, role, and entity.
 *
 * STATUS: ACTIVE — document flow engine.
 */

import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from "./DocumentRelationEngine.js";
import { WORKFLOW_STATES }                       from "../workflows/WorkflowStateEngine.js";

// ─── Flow stage schema ──────────────────────────────────────────────────────────

export const FLOW_STAGE_STATUS = Object.freeze({
  PENDING:    "PENDING",
  ACTIVE:     "ACTIVE",
  COMPLETE:   "COMPLETE",
  BLOCKED:    "BLOCKED",
  SKIPPED:    "SKIPPED",
});

// ─── Document flow definition ───────────────────────────────────────────────────
// Ordered list of document stages in a standard export operation lifecycle.

export const DOCUMENT_FLOW_STAGES = Object.freeze([

  {
    order:         1,
    documentType:  DOCUMENT_TYPES.SCO,
    requiredState: WORKFLOW_STATES.QUOTED,
    minState:      WORKFLOW_STATES.DRAFT,
    required:      true,
    rolesAllowed:  ["GLOBAL_ADMIN", "COUNTRY_DIRECTOR", "COMMERCIAL_MANAGER", "AGENTE"],
    description:   { es: "Oferta comercial inicial enviada al comprador", en: "Initial commercial offer sent to buyer" },
    nextStage:     DOCUMENT_TYPES.FCO,
  },

  {
    order:         2,
    documentType:  DOCUMENT_TYPES.FCO,
    requiredState: WORKFLOW_STATES.APPROVED,
    minState:      WORKFLOW_STATES.QUOTED,
    required:      true,
    rolesAllowed:  ["GLOBAL_ADMIN", "COUNTRY_DIRECTOR", "COMMERCIAL_MANAGER"],
    description:   { es: "Confirmación formal de la oferta aceptada", en: "Formal confirmation of accepted offer" },
    nextStage:     DOCUMENT_TYPES.SPA,
  },

  {
    order:         3,
    documentType:  DOCUMENT_TYPES.SPA,
    requiredState: WORKFLOW_STATES.CONTRACTED,
    minState:      WORKFLOW_STATES.APPROVED,
    required:      true,
    rolesAllowed:  ["GLOBAL_ADMIN", "COUNTRY_DIRECTOR"],
    description:   { es: "Contrato firmado de compraventa", en: "Signed sales & purchase agreement" },
    nextStage:     DOCUMENT_TYPES.INVOICE,
  },

  {
    order:         4,
    documentType:  DOCUMENT_TYPES.INVOICE,
    requiredState: WORKFLOW_STATES.PAYMENT_PENDING,
    minState:      WORKFLOW_STATES.CONTRACTED,
    required:      true,
    rolesAllowed:  ["GLOBAL_ADMIN", "COUNTRY_DIRECTOR", "ACCOUNTING", "TREASURY"],
    description:   { es: "Factura comercial emitida para cobro", en: "Commercial invoice issued for payment" },
    nextStage:     DOCUMENT_TYPES.PACKING_LIST,
  },

  {
    order:         5,
    documentType:  DOCUMENT_TYPES.PACKING_LIST,
    requiredState: WORKFLOW_STATES.READY_FOR_LOADING,
    minState:      WORKFLOW_STATES.PRODUCTION,
    required:      true,
    rolesAllowed:  ["GLOBAL_ADMIN", "OPERATIONS_MANAGER", "LOGISTICS"],
    description:   { es: "Lista de empaque generada para el embarque", en: "Packing list generated for loading" },
    nextStage:     DOCUMENT_TYPES.BILL_OF_LADING,
  },

  {
    order:         6,
    documentType:  DOCUMENT_TYPES.BILL_OF_LADING,
    requiredState: WORKFLOW_STATES.SHIPPED,
    minState:      WORKFLOW_STATES.LOADED,
    required:      true,
    rolesAllowed:  ["GLOBAL_ADMIN", "OPERATIONS_MANAGER", "LOGISTICS"],
    description:   { es: "Conocimiento de embarque emitido por la naviera", en: "Bill of lading issued by shipping line" },
    nextStage:     DOCUMENT_TYPES.SGS_REPORT,
  },

  {
    order:         7,
    documentType:  DOCUMENT_TYPES.SGS_REPORT,
    requiredState: WORKFLOW_STATES.SHIPPED,
    minState:      WORKFLOW_STATES.INSPECTION,
    required:      false,
    rolesAllowed:  ["GLOBAL_ADMIN", "COMPLIANCE_OFFICER", "VETERINARY_INSPECTOR", "OPERATIONS_MANAGER"],
    description:   { es: "Reporte de inspección SGS / tercero", en: "SGS / third-party inspection report" },
    nextStage:     DOCUMENT_TYPES.PHYTO_CERT,
  },

  {
    order:         8,
    documentType:  DOCUMENT_TYPES.PHYTO_CERT,
    requiredState: WORKFLOW_STATES.SHIPPED,
    minState:      WORKFLOW_STATES.INSPECTION,
    required:      false,
    rolesAllowed:  ["GLOBAL_ADMIN", "COMPLIANCE_OFFICER", "VETERINARY_INSPECTOR"],
    description:   { es: "Certificado fitosanitario o sanitario emitido", en: "Phytosanitary or health certificate issued" },
    nextStage:     DOCUMENT_TYPES.ORIGIN_CERT,
  },

  {
    order:         9,
    documentType:  DOCUMENT_TYPES.ORIGIN_CERT,
    requiredState: WORKFLOW_STATES.SHIPPED,
    minState:      WORKFLOW_STATES.LOADED,
    required:      false,
    rolesAllowed:  ["GLOBAL_ADMIN", "COMPLIANCE_OFFICER"],
    description:   { es: "Certificado de origen para aduana destino", en: "Certificate of origin for destination customs" },
    nextStage:     null,
  },

]);

// ─── Flow resolver ──────────────────────────────────────────────────────────────

/**
 * Get the document flow stages applicable to a given workflow state.
 *
 * @param {string} workflowState
 * @returns {object[]}
 */
export function getActiveFlowStages(workflowState) {
  return DOCUMENT_FLOW_STAGES.filter(stage => {
    const stateOrder = Object.keys(WORKFLOW_STATES);
    const current    = stateOrder.indexOf(workflowState);
    const min        = stateOrder.indexOf(stage.minState);
    return current >= min;
  });
}

/**
 * Get the next required document type for an operation given current state and attached docs.
 *
 * @param {string} workflowState
 * @param {string[]} attachedDocTypes  — document types already attached
 * @returns {object|null}               — next flow stage or null if complete
 */
export function getNextRequiredDocument(workflowState, attachedDocTypes = []) {
  for (const stage of DOCUMENT_FLOW_STAGES) {
    if (stage.required && !attachedDocTypes.includes(stage.documentType)) {
      return stage;
    }
  }
  return null;
}

/**
 * Build a display-ready flow progress map for an operation.
 *
 * @param {string}   workflowState
 * @param {string[]} attachedDocTypes
 * @param {string}   [lang]
 * @returns {object[]}
 */
export function buildFlowProgressMap(workflowState, attachedDocTypes = [], lang = "es") {
  const stateOrder = Object.keys(WORKFLOW_STATES);
  const currentIdx = stateOrder.indexOf(workflowState);

  return DOCUMENT_FLOW_STAGES.map(stage => {
    const isAttached    = attachedDocTypes.includes(stage.documentType);
    const minIdx        = stateOrder.indexOf(stage.minState);
    const isReachable   = currentIdx >= minIdx;

    let status = FLOW_STAGE_STATUS.PENDING;
    if (isAttached)         status = FLOW_STAGE_STATUS.COMPLETE;
    else if (isReachable)   status = FLOW_STAGE_STATUS.ACTIVE;

    return Object.freeze({
      order:        stage.order,
      documentType: stage.documentType,
      label:        (DOCUMENT_TYPE_LABELS[stage.documentType] || {})[lang] || stage.documentType,
      description:  (stage.description || {})[lang] || "",
      required:     stage.required,
      status,
      isAttached,
      isReachable,
      rolesAllowed: stage.rolesAllowed,
    });
  });
}
