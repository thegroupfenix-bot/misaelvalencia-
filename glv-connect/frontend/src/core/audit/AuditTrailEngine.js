/**
 * AuditTrailEngine.js — GLV GOS Global Audit Trail Foundation V1.0
 *
 * Foundation layer for the enterprise-wide audit trail system.
 * Every platform action will register a structured audit event here.
 *
 * STATUS: FOUNDATION — event schema and queue defined.
 * Full persistence layer (backend API + database) to be implemented.
 *
 * Event structure covers:
 *   user, country, module, action, timestamp, changes, approvals, workflow state
 */

// ─── Audit event types ─────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = Object.freeze({

  // Document actions
  DOC_CREATED:       "DOC_CREATED",
  DOC_UPDATED:       "DOC_UPDATED",
  DOC_DELETED:       "DOC_DELETED",
  DOC_PDF_GENERATED: "DOC_PDF_GENERATED",
  DOC_SENT:          "DOC_SENT",
  DOC_APPROVED:      "DOC_APPROVED",
  DOC_REJECTED:      "DOC_REJECTED",
  DOC_SIGNED:        "DOC_SIGNED",

  // User actions
  USER_LOGIN:        "USER_LOGIN",
  USER_LOGOUT:       "USER_LOGOUT",
  USER_CREATED:      "USER_CREATED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  PASSWORD_CHANGED:  "PASSWORD_CHANGED",

  // Financial actions
  INVOICE_CREATED:   "INVOICE_CREATED",
  PAYMENT_RECORDED:  "PAYMENT_RECORDED",
  BANK_EXPORT:       "BANK_EXPORT",
  RECONCILIATION:    "RECONCILIATION",

  // Operations actions
  SHIPMENT_CREATED:  "SHIPMENT_CREATED",
  SHIPMENT_UPDATED:  "SHIPMENT_UPDATED",
  INSPECTION_LOGGED: "INSPECTION_LOGGED",

  // Compliance actions
  COMPLIANCE_FLAG:   "COMPLIANCE_FLAG",
  CAPA_CREATED:      "CAPA_CREATED",

  // Media actions
  MEDIA_UPLOADED:    "MEDIA_UPLOADED",
  MEDIA_DELETED:     "MEDIA_DELETED",
  MEDIA_ASSIGNED:    "MEDIA_ASSIGNED",
});

// ─── Audit event schema ────────────────────────────────────────────────────────

/**
 * Create a structured audit event.
 *
 * @param {object} params
 * @param {string} params.action     — one of AUDIT_ACTIONS
 * @param {string} params.userId     — user who performed the action
 * @param {string} params.userName   — human-readable user name
 * @param {string} params.userRole   — user role at time of action
 * @param {string} params.country    — country context (ISO code or name)
 * @param {string} params.module     — domain module (e.g. "SCO", "SHIPMENTS")
 * @param {string} params.domain     — parent domain (e.g. "COMMERCIAL", "OPERATIONS")
 * @param {string} [params.entityId] — ID of the affected entity (docId, etc.)
 * @param {string} [params.entityType] — type label ("SCO", "User", etc.)
 * @param {object} [params.changes]  — before/after snapshot of changed fields
 * @param {string} [params.workflowState] — workflow state at time of action
 * @param {string} [params.approvalBy]    — approver user ID (if applicable)
 * @param {string} [params.notes]    — optional free-text note
 * @returns {AuditEvent}
 */
export function createAuditEvent({
  action,
  userId,
  userName,
  userRole,
  country    = null,
  module,
  domain,
  entityId   = null,
  entityType = null,
  changes    = null,
  workflowState = null,
  approvalBy = null,
  notes      = null,
}) {
  return Object.freeze({
    id:             `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp:      new Date().toISOString(),
    action,
    user: Object.freeze({ id: userId, name: userName, role: userRole }),
    country,
    module,
    domain,
    entity: entityId ? Object.freeze({ id: entityId, type: entityType }) : null,
    changes:        changes ? Object.freeze(changes) : null,
    workflowState,
    approval:       approvalBy ? Object.freeze({ approvedBy: approvalBy, at: new Date().toISOString() }) : null,
    notes,
    _version:       "1.0",
  });
}

// ─── In-memory event queue (foundation — replace with API persistence) ─────────

const _eventQueue = [];

/**
 * Log an audit event.
 * Foundation: stores in-memory queue. Replace with backend API call.
 *
 * @param {AuditEvent} event
 */
export function logAuditEvent(event) {
  try {
    _eventQueue.push(event);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[GLV-GOS][AUDIT] ${event.action} | user=${event.user?.name} | module=${event.module} | entity=${event.entity?.id || "—"}`);
    }
    // TODO: Replace with: await api.postAuditEvent(event);
  } catch (err) {
    console.warn("[GLV-GOS][AUDIT] Failed to log event:", err?.message);
  }
}

/**
 * Helper: Log a document PDF generation event.
 */
export function auditPdfGenerated(doc, user) {
  if (!doc || !user) return;
  logAuditEvent(createAuditEvent({
    action:     AUDIT_ACTIONS.DOC_PDF_GENERATED,
    userId:     user.id || user.username,
    userName:   user.name,
    userRole:   user.role,
    module:     doc.type || "SCO",
    domain:     "COMMERCIAL",
    entityId:   doc.id,
    entityType: doc.type,
    notes:      `PDF generated for ${doc.id} — category: ${doc.commercialData?.rows?.[0]?.category || "unknown"}`,
  }));
}

/**
 * Helper: Log a document creation event.
 */
export function auditDocCreated(doc, user) {
  if (!doc || !user) return;
  logAuditEvent(createAuditEvent({
    action:     AUDIT_ACTIONS.DOC_CREATED,
    userId:     user.id || user.username,
    userName:   user.name,
    userRole:   user.role,
    module:     doc.type || "SCO",
    domain:     "COMMERCIAL",
    entityId:   doc.id,
    entityType: doc.type,
  }));
}

/**
 * Get the current in-memory event queue (for debugging).
 * In production this will be replaced by an API query.
 */
export function getAuditQueue() {
  return [..._eventQueue];
}
