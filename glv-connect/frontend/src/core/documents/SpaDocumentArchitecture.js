/**
 * SpaDocumentArchitecture.js — GLV GOS — SPA Document Placeholder Architecture V1.0
 *
 * Defines the data model and validation schema for SPA (Sales Purchase Agreement)
 * document management. This is architecture-only — no contract generation, no AI
 * drafting, no signature integration.
 *
 * Future capability: Lawyer uploads SPA.pdf, system stores version, upload date,
 * lawyer identity, and approval status. DocuSign/signature integration to be added
 * in a subsequent phase.
 *
 * STATUS: ARCHITECTURE ONLY — data model and validation defined; persistence and
 * upload endpoints to be implemented when the SPA module goes live.
 */

// ─── SPA Document Status ────────────────────────────────────────────────────────

export const SPA_DOCUMENT_STATUS = Object.freeze({
  PENDING_UPLOAD:     "PENDING_UPLOAD",
  UPLOADED:           "UPLOADED",
  UNDER_LEGAL_REVIEW: "UNDER_LEGAL_REVIEW",
  APPROVED:           "APPROVED",
  SENT_FOR_SIGNATURE: "SENT_FOR_SIGNATURE",
  PARTIALLY_SIGNED:   "PARTIALLY_SIGNED",
  FULLY_SIGNED:       "FULLY_SIGNED",
  ACTIVE:             "ACTIVE",
  SUPERSEDED:         "SUPERSEDED",
  CANCELLED:          "CANCELLED",
});

export const SPA_DOCUMENT_STATUS_LABELS = Object.freeze({
  PENDING_UPLOAD:     { es: "Pendiente de Carga",       en: "Pending Upload" },
  UPLOADED:           { es: "Cargado",                   en: "Uploaded" },
  UNDER_LEGAL_REVIEW: { es: "En Revisión Legal",        en: "Under Legal Review" },
  APPROVED:           { es: "Aprobado",                  en: "Approved" },
  SENT_FOR_SIGNATURE: { es: "Enviado a Firma",          en: "Sent for Signature" },
  PARTIALLY_SIGNED:   { es: "Parcialmente Firmado",     en: "Partially Signed" },
  FULLY_SIGNED:       { es: "Completamente Firmado",    en: "Fully Signed" },
  ACTIVE:             { es: "Activo",                    en: "Active" },
  SUPERSEDED:         { es: "Reemplazado",               en: "Superseded" },
  CANCELLED:          { es: "Cancelado",                 en: "Cancelled" },
});

// ─── SPA Document Schema ────────────────────────────────────────────────────────

export const SPA_DOCUMENT_SCHEMA = Object.freeze({
  spaId:            { type: "string",   required: true,  description: "Unique SPA identifier (auto-generated)" },
  operationId:      { type: "string",   required: true,  description: "Parent operation ID" },
  fcoId:            { type: "string",   required: true,  description: "Source FCO document ID" },
  version:          { type: "number",   required: true,  description: "SPA version number (1, 2, 3...)" },
  status:           { type: "string",   required: true,  description: "Current SPA document status" },
  fileKey:          { type: "string",   required: false, description: "R2/S3 storage key for the uploaded PDF" },
  fileUrl:          { type: "string",   required: false, description: "Public URL for the uploaded PDF" },
  fileHash:         { type: "string",   required: false, description: "SHA-256 hash of the uploaded file" },
  fileSizeBytes:    { type: "number",   required: false, description: "File size in bytes" },
  uploadedBy:       { type: "string",   required: false, description: "User ID of the uploader (lawyer)" },
  uploadedAt:       { type: "string",   required: false, description: "ISO 8601 timestamp of upload" },
  lawyerName:       { type: "string",   required: false, description: "Name of the reviewing/drafting lawyer" },
  lawyerFirm:       { type: "string",   required: false, description: "Law firm name" },
  reviewedBy:       { type: "string",   required: false, description: "User ID who approved the review" },
  reviewedAt:       { type: "string",   required: false, description: "ISO 8601 timestamp of approval" },
  reviewNotes:      { type: "string",   required: false, description: "Legal review notes" },
  sellerSignedAt:   { type: "string",   required: false, description: "ISO 8601 timestamp — seller signature" },
  buyerSignedAt:    { type: "string",   required: false, description: "ISO 8601 timestamp — buyer signature" },
  activatedAt:      { type: "string",   required: false, description: "ISO 8601 timestamp — contract activated" },
  supersededBy:     { type: "string",   required: false, description: "SPA ID of the newer version (if superseded)" },
  createdAt:        { type: "string",   required: true,  description: "ISO 8601 timestamp of record creation" },
  updatedAt:        { type: "string",   required: true,  description: "ISO 8601 timestamp of last update" },
});

// ─── SPA Version History Entry ──────────────────────────────────────────────────

export const SPA_VERSION_ENTRY_SCHEMA = Object.freeze({
  version:     { type: "number",   required: true },
  uploadedBy:  { type: "string",   required: true },
  uploadedAt:  { type: "string",   required: true },
  fileKey:     { type: "string",   required: true },
  fileHash:    { type: "string",   required: true },
  notes:       { type: "string",   required: false },
});

// ─── Validation ─────────────────────────────────────────────────────────────────

export function validateSpaDocument(doc) {
  const errors = [];
  for (const [field, spec] of Object.entries(SPA_DOCUMENT_SCHEMA)) {
    if (spec.required && (doc[field] === undefined || doc[field] === null || doc[field] === "")) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  if (doc.status && !SPA_DOCUMENT_STATUS[doc.status]) {
    errors.push(`Invalid status: ${doc.status}`);
  }
  if (doc.version !== undefined && (typeof doc.version !== "number" || doc.version < 1)) {
    errors.push(`Invalid version: ${doc.version} (must be >= 1)`);
  }
  return { valid: errors.length === 0, errors };
}

// ─── Factory ────────────────────────────────────────────────────────────────────

export function createSpaDocumentRecord(operationId, fcoId) {
  const now = new Date().toISOString();
  return Object.freeze({
    spaId:       `SPA-${operationId}-V1`,
    operationId,
    fcoId,
    version:     1,
    status:      SPA_DOCUMENT_STATUS.PENDING_UPLOAD,
    fileKey:     null,
    fileUrl:     null,
    fileHash:    null,
    fileSizeBytes: null,
    uploadedBy:  null,
    uploadedAt:  null,
    lawyerName:  null,
    lawyerFirm:  null,
    reviewedBy:  null,
    reviewedAt:  null,
    reviewNotes: null,
    sellerSignedAt: null,
    buyerSignedAt:  null,
    activatedAt:    null,
    supersededBy:   null,
    createdAt:   now,
    updatedAt:   now,
  });
}

// ─── Status Transition Map ──────────────────────────────────────────────────────

export const SPA_STATUS_TRANSITIONS = Object.freeze({
  PENDING_UPLOAD:     ["UPLOADED", "CANCELLED"],
  UPLOADED:           ["UNDER_LEGAL_REVIEW", "CANCELLED"],
  UNDER_LEGAL_REVIEW: ["APPROVED", "PENDING_UPLOAD"],
  APPROVED:           ["SENT_FOR_SIGNATURE"],
  SENT_FOR_SIGNATURE: ["PARTIALLY_SIGNED", "FULLY_SIGNED", "APPROVED"],
  PARTIALLY_SIGNED:   ["FULLY_SIGNED"],
  FULLY_SIGNED:       ["ACTIVE"],
  ACTIVE:             ["SUPERSEDED"],
  SUPERSEDED:         [],
  CANCELLED:          [],
});

export function canTransitionSpaStatus(current, next) {
  return (SPA_STATUS_TRANSITIONS[current] || []).includes(next);
}
