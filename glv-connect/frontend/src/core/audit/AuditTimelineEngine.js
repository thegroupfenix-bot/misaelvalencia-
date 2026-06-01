/**
 * AuditTimelineEngine.js — GLV GOS Core Audit — Audit Timeline Foundation V1.0
 *
 * Generates operational event timelines for operations, PDFs, workflows,
 * entity assignments, payments, inspections, and compliance events.
 *
 * Extends AuditTrailEngine with timeline assembly and display-ready output.
 *
 * STATUS: ACTIVE — timeline engine.
 * Client-portal rendering layer to be implemented per deployment.
 */

import { getAuditQueue } from "./AuditTrailEngine.js";

// ─── Timeline event types ────────────────────────────────────────────────────────

export const TIMELINE_EVENT_TYPES = Object.freeze({
  // Commercial
  SCO_GENERATED:         "SCO_GENERATED",
  FCO_GENERATED:         "FCO_GENERATED",
  SPA_SIGNED:            "SPA_SIGNED",
  QUOTE_SENT:            "QUOTE_SENT",

  // Workflow
  WORKFLOW_APPROVED:     "WORKFLOW_APPROVED",
  WORKFLOW_TRANSITIONED: "WORKFLOW_TRANSITIONED",
  OPERATION_CREATED:     "OPERATION_CREATED",
  OPERATION_CLOSED:      "OPERATION_CLOSED",

  // Financial
  PAYMENT_PENDING:       "PAYMENT_PENDING",
  PAYMENT_CONFIRMED:     "PAYMENT_CONFIRMED",
  INVOICE_ISSUED:        "INVOICE_ISSUED",
  BANK_TRANSFER_SENT:    "BANK_TRANSFER_SENT",

  // Operations
  ENTITY_ASSIGNED:       "ENTITY_ASSIGNED",
  PRODUCTION_RELEASED:   "PRODUCTION_RELEASED",
  INSPECTION_UPLOADED:   "INSPECTION_UPLOADED",
  LOADING_CONFIRMED:     "LOADING_CONFIRMED",
  SHIPMENT_DEPARTED:     "SHIPMENT_DEPARTED",
  DELIVERY_CONFIRMED:    "DELIVERY_CONFIRMED",

  // Documents
  PDF_GENERATED:         "PDF_GENERATED",
  PDF_DOWNLOADED:        "PDF_DOWNLOADED",
  DOCUMENT_ATTACHED:     "DOCUMENT_ATTACHED",

  // Compliance
  CERTIFICATE_ISSUED:    "CERTIFICATE_ISSUED",
  COMPLIANCE_APPROVED:   "COMPLIANCE_APPROVED",
  AUDIT_FROZEN:          "AUDIT_FROZEN",
});

export const TIMELINE_EVENT_LABELS = Object.freeze({
  SCO_GENERATED:         { es: "SCO generado",                    en: "SCO generated" },
  FCO_GENERATED:         { es: "FCO generado",                    en: "FCO generated" },
  SPA_SIGNED:            { es: "SPA firmado",                     en: "SPA signed" },
  QUOTE_SENT:            { es: "Cotización enviada",              en: "Quote sent" },
  WORKFLOW_APPROVED:     { es: "Flujo aprobado",                  en: "Workflow approved" },
  WORKFLOW_TRANSITIONED: { es: "Estado actualizado",              en: "Workflow transitioned" },
  OPERATION_CREATED:     { es: "Operación creada",                en: "Operation created" },
  OPERATION_CLOSED:      { es: "Operación cerrada",               en: "Operation closed" },
  PAYMENT_PENDING:       { es: "Pago pendiente",                  en: "Payment pending" },
  PAYMENT_CONFIRMED:     { es: "Pago confirmado",                 en: "Payment confirmed" },
  INVOICE_ISSUED:        { es: "Factura emitida",                 en: "Invoice issued" },
  BANK_TRANSFER_SENT:    { es: "Transferencia enviada",           en: "Bank transfer sent" },
  ENTITY_ASSIGNED:       { es: "Entidad asignada",                en: "Entity assigned" },
  PRODUCTION_RELEASED:   { es: "Producción liberada",             en: "Production released" },
  INSPECTION_UPLOADED:   { es: "Inspección cargada",              en: "Inspection uploaded" },
  LOADING_CONFIRMED:     { es: "Embarque confirmado",             en: "Loading confirmed" },
  SHIPMENT_DEPARTED:     { es: "Envío despachado",                en: "Shipment departed" },
  DELIVERY_CONFIRMED:    { es: "Entrega confirmada",              en: "Delivery confirmed" },
  PDF_GENERATED:         { es: "PDF generado",                    en: "PDF generated" },
  PDF_DOWNLOADED:        { es: "PDF descargado",                  en: "PDF downloaded" },
  DOCUMENT_ATTACHED:     { es: "Documento adjuntado",             en: "Document attached" },
  CERTIFICATE_ISSUED:    { es: "Certificado emitido",             en: "Certificate issued" },
  COMPLIANCE_APPROVED:   { es: "Cumplimiento aprobado",           en: "Compliance approved" },
  AUDIT_FROZEN:          { es: "Auditoría congelada",             en: "Audit frozen" },
});

// ─── Timeline event schema ──────────────────────────────────────────────────────

/**
 * Create a canonical timeline event record.
 *
 * @param {object} params
 * @param {string} params.operationId
 * @param {string} params.eventType    — TIMELINE_EVENT_TYPES value
 * @param {string} [params.actorId]
 * @param {string} [params.actorRole]
 * @param {string} [params.country]
 * @param {string} [params.documentRef]
 * @param {string} [params.workflowState]
 * @param {string} [params.notes]
 * @param {object} [params.metadata]
 * @returns {object}
 */
export function createTimelineEvent({
  operationId,
  eventType,
  actorId       = null,
  actorRole     = null,
  country       = null,
  documentRef   = null,
  workflowState = null,
  notes         = null,
  metadata      = null,
}) {
  return Object.freeze({
    id:           `te_${operationId}_${eventType}_${Date.now()}`,
    operationId,
    eventType,
    label:        TIMELINE_EVENT_LABELS[eventType] || { es: eventType, en: eventType },
    actorId,
    actorRole,
    country,
    documentRef,
    workflowState,
    notes,
    metadata:     metadata ? Object.freeze(metadata) : null,
    timestamp:    new Date().toISOString(),
    _schema:      "GLV_TIMELINE_EVENT_V1",
  });
}

// ─── Timeline store ─────────────────────────────────────────────────────────────

const _timelineStore = new Map();

/**
 * Append a timeline event to an operation's timeline.
 *
 * @param {object} event — result of createTimelineEvent()
 * @returns {boolean}
 */
export function appendTimelineEvent(event) {
  if (!event?.operationId) return false;
  const key = event.operationId;
  if (!_timelineStore.has(key)) _timelineStore.set(key, []);
  _timelineStore.get(key).push(event);
  return true;
}

/**
 * Get the full timeline for an operation, sorted chronologically.
 *
 * @param {string} operationId
 * @param {string} [lang]       — "es" | "en"
 * @returns {object[]}
 */
export function getOperationTimeline(operationId, lang = "es") {
  const events = (_timelineStore.get(operationId) || []).slice();
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return events.map(e => Object.freeze({
    ...e,
    displayLabel: (e.label || {})[lang] || e.eventType,
  }));
}

/**
 * Get timeline events filtered by event type.
 *
 * @param {string} operationId
 * @param {string} eventType
 * @returns {object[]}
 */
export function getTimelineByType(operationId, eventType) {
  return (_timelineStore.get(operationId) || []).filter(e => e.eventType === eventType);
}

// ─── Audit queue bridge ─────────────────────────────────────────────────────────

/**
 * Build a display timeline from the audit queue for an operation.
 * Maps audit events to timeline format.
 *
 * @param {string} operationId
 * @param {string} [lang]
 * @returns {object[]}
 */
export function buildAuditTimeline(operationId, lang = "es") {
  const auditQueue = getAuditQueue();
  const relevant   = auditQueue.filter(e => e.entityId === operationId);

  return relevant.map(e => ({
    id:           e.id,
    operationId,
    eventType:    e.action,
    displayLabel: (TIMELINE_EVENT_LABELS[e.action] || {})[lang] || e.action,
    actorId:      e.userId,
    actorRole:    e.userRole,
    country:      e.country,
    workflowState:e.workflowState,
    notes:        e.notes,
    timestamp:    e.timestamp,
    source:       "AUDIT_QUEUE",
  }));
}

/**
 * Generate a full operation event summary for display or export.
 *
 * @param {string} operationId
 * @param {string} [lang]
 * @returns {object}
 */
export function generateTimelineSummary(operationId, lang = "es") {
  const timeline = getOperationTimeline(operationId, lang);
  const audit    = buildAuditTimeline(operationId, lang);

  const allEvents = [...timeline, ...audit].sort((a, b) =>
    (a.timestamp || "").localeCompare(b.timestamp || "")
  );

  return Object.freeze({
    operationId,
    totalEvents:   allEvents.length,
    firstEventAt:  allEvents[0]?.timestamp || null,
    lastEventAt:   allEvents[allEvents.length - 1]?.timestamp || null,
    events:        allEvents,
    _generated:    new Date().toISOString(),
  });
}
