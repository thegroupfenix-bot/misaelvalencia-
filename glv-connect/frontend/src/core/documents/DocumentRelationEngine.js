/**
 * DocumentRelationEngine.js — GLV GOS Core Domain — Document Relation Foundation V1.0
 *
 * Links export operation documents into a validated chain:
 * SCO → FCO → SPA → Invoice → Packing List → BL → SGS → Certificates.
 * Each document is attached to an operationId and typed for integrity validation.
 *
 * STATUS: FOUNDATION — relation schema, attach, retrieve, and chain validation defined.
 * Persistence and cross-entity document routing to be layered on top.
 */

// ─── Document type constants ────────────────────────────────────────────────────

export const DOCUMENT_TYPES = Object.freeze({
  SCO:            "SCO",
  FCO:            "FCO",
  SPA:            "SPA",
  INVOICE:        "INVOICE",
  PACKING_LIST:   "PACKING_LIST",
  BILL_OF_LADING: "BILL_OF_LADING",
  SGS_REPORT:     "SGS_REPORT",
  PHYTO_CERT:     "PHYTO_CERT",
  HEALTH_CERT:    "HEALTH_CERT",
  ORIGIN_CERT:    "ORIGIN_CERT",
  INSURANCE:      "INSURANCE",
  CUSTOMS_DECL:   "CUSTOMS_DECL",
});

export const DOCUMENT_TYPE_LABELS = Object.freeze({
  SCO:            { es: "Oferta Comercial",          en: "Sales Confirmation Offer" },
  FCO:            { es: "Confirmación Formal",        en: "Formal Confirmation Order" },
  SPA:            { es: "Contrato de Compraventa",    en: "Sales & Purchase Agreement" },
  INVOICE:        { es: "Factura Comercial",          en: "Commercial Invoice" },
  PACKING_LIST:   { es: "Lista de Empaque",           en: "Packing List" },
  BILL_OF_LADING: { es: "Conocimiento de Embarque",  en: "Bill of Lading" },
  SGS_REPORT:     { es: "Reporte SGS",                en: "SGS Inspection Report" },
  PHYTO_CERT:     { es: "Certificado Fitosanitario",  en: "Phytosanitary Certificate" },
  HEALTH_CERT:    { es: "Certificado Sanitario",      en: "Health Certificate" },
  ORIGIN_CERT:    { es: "Certificado de Origen",      en: "Certificate of Origin" },
  INSURANCE:      { es: "Póliza de Seguro",           en: "Insurance Policy" },
  CUSTOMS_DECL:   { es: "Declaración Aduanera",       en: "Customs Declaration" },
});

// ─── Chain order ─────────────────────────────────────────────────────────────────
// Defines the expected document sequence in a complete export operation.

export const DOCUMENT_CHAIN_ORDER = [
  DOCUMENT_TYPES.SCO,
  DOCUMENT_TYPES.FCO,
  DOCUMENT_TYPES.SPA,
  DOCUMENT_TYPES.INVOICE,
  DOCUMENT_TYPES.PACKING_LIST,
  DOCUMENT_TYPES.BILL_OF_LADING,
  DOCUMENT_TYPES.SGS_REPORT,
  DOCUMENT_TYPES.PHYTO_CERT,
  DOCUMENT_TYPES.ORIGIN_CERT,
];

// ─── Document record schema ─────────────────────────────────────────────────────

/**
 * Create a document relation record for attachment to an operation.
 *
 * @param {object} params
 * @param {string} params.operationId  — e.g. "SCO-GLV-2026-047"
 * @param {string} params.documentType — DOCUMENT_TYPES value
 * @param {string} params.documentRef  — document-specific reference number
 * @param {string} [params.storageUrl] — link to stored file (server-side only)
 * @param {string} [params.issuedBy]   — entity that issued the document
 * @param {string} [params.issuedAt]
 * @param {string} [params.expiresAt]
 * @param {string} [params.notes]
 * @returns {object}
 */
export function createDocumentRecord({
  operationId,
  documentType,
  documentRef,
  storageUrl  = null,
  issuedBy    = null,
  issuedAt    = null,
  expiresAt   = null,
  notes       = null,
}) {
  if (!DOCUMENT_TYPES[documentType]) {
    throw new Error(`[DocumentRelationEngine] Unknown document type: "${documentType}"`);
  }
  return Object.freeze({
    id:          `doc_${operationId}_${documentType}_${Date.now()}`,
    operationId,
    documentType,
    documentRef,
    storageUrl,
    issuedBy,
    issuedAt:    issuedAt || new Date().toISOString(),
    expiresAt,
    notes,
    _schema:     "GLV_DOCUMENT_RELATION_V1",
    _attachedAt: new Date().toISOString(),
  });
}

// ─── In-memory document store (foundation) ──────────────────────────────────────
// In production this is replaced by server-side persistence.

const _documentStore = new Map();

/**
 * Attach a document record to an operation.
 *
 * @param {object} documentRecord  — result of createDocumentRecord()
 * @returns {{ success: boolean, id: string }}
 */
export function attachDocument(documentRecord) {
  if (!documentRecord || !documentRecord.operationId) {
    return { success: false, id: null };
  }

  const key = documentRecord.operationId;
  if (!_documentStore.has(key)) {
    _documentStore.set(key, []);
  }

  _documentStore.get(key).push(documentRecord);
  return { success: true, id: documentRecord.id };
}

/**
 * Get all documents attached to an operation.
 *
 * @param {string} operationId
 * @returns {object[]}
 */
export function getOperationDocuments(operationId) {
  return (_documentStore.get(operationId) || []).slice();
}

/**
 * Validate the document chain for an operation.
 * Checks for presence of minimum required document types in order.
 * Never throws — returns structured validation result.
 *
 * @param {string} operationId
 * @param {string[]} [requiredTypes]  — override required types (defaults to SCO, FCO, SPA)
 * @returns {{ valid: boolean, present: string[], missing: string[], report: string }}
 */
export function validateDocumentChain(operationId, requiredTypes = [DOCUMENT_TYPES.SCO, DOCUMENT_TYPES.FCO, DOCUMENT_TYPES.SPA]) {
  const docs    = getOperationDocuments(operationId);
  const present = [...new Set(docs.map(d => d.documentType))];
  const missing = requiredTypes.filter(t => !present.includes(t));

  return Object.freeze({
    valid:   missing.length === 0,
    present,
    missing,
    total:   docs.length,
    report:  missing.length === 0
      ? `Operation "${operationId}" document chain is valid (${docs.length} documents).`
      : `Operation "${operationId}" missing required documents: [${missing.join(", ")}]`,
  });
}

/**
 * Get a document type label.
 *
 * @param {string} documentType
 * @param {string} [lang]
 * @returns {string}
 */
export function getDocumentTypeLabel(documentType, lang = "es") {
  return (DOCUMENT_TYPE_LABELS[documentType] || {})[lang] || documentType;
}
