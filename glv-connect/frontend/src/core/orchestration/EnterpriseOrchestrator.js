/**
 * EnterpriseOrchestrator.js — GLV GOS Core Orchestration Layer V1.0
 *
 * Central coordination layer for GLV GOS enterprise operations.
 * Connects: OperationChainEngine, WorkflowStateEngine, MasterEntityRegistry,
 * DocumentRelationEngine, AuditTrailEngine, LanguageCore, RoleAccessEngine.
 *
 * STATUS: ACTIVE — orchestration core.
 * Persistence adapters to be injected per deployment environment.
 */

import { createOperationChain, validateOperationChain, getOperationChainSummary, CHAIN_STATUS } from "../operations/OperationChainEngine.js";
import { WORKFLOW_STATES, transitionOperation, canTransition, getWorkflowTimeline } from "../workflows/WorkflowStateEngine.js";
import { resolveEntity, resolveInvoiceEntity }                                       from "../entities/MasterEntityRegistry.js";
import { attachDocument, getOperationDocuments, validateDocumentChain }              from "../documents/DocumentRelationEngine.js";
import { createAuditEvent, logAuditEvent }                                           from "../audit/AuditTrailEngine.js";
import { normalizeLanguage }                                                          from "../i18n/LanguageCore.js";
import { hasPermission }                                                              from "../rbac/RoleAccessEngine.js";
import { registerOperation, getOperation, updateOperation }                          from "../operations/OperationRegistry.js";

// ─── Orchestrator constants ─────────────────────────────────────────────────────

export const ORCHESTRATOR_VERSION = "1.0";

// ─── Core orchestration methods ─────────────────────────────────────────────────

/**
 * Initialize a new enterprise operation.
 * Creates the operation chain, registers it, and logs the creation audit event.
 *
 * @param {object} params
 * @param {string} params.operationId
 * @param {string} params.category
 * @param {string} params.currency
 * @param {string} params.clientName
 * @param {string} params.originCountry
 * @param {string} params.destinationCountry
 * @param {object[]} [params.entities]          — pre-built chain entity objects
 * @param {string} [params.language]
 * @param {string} params.actorId               — user initializing the operation
 * @param {string} params.actorRole
 * @returns {{ success: boolean, operationId: string, snapshot: object|null, reason: string }}
 */
export function initializeOperation({
  operationId,
  category,
  currency,
  clientName,
  originCountry,
  destinationCountry,
  entities    = [],
  language    = "es",
  actorId,
  actorRole,
}) {
  try {
    if (!hasPermission(actorRole, "SCO", "create")) {
      return {
        success:     false,
        operationId: operationId || null,
        snapshot:    null,
        reason:      `Role "${actorRole}" does not have permission to create operations`,
      };
    }

    const lang   = normalizeLanguage(language);
    const entity = resolveInvoiceEntity(destinationCountry || originCountry);

    const chain = createOperationChain({
      operationId,
      category,
      currency,
      entities,
      status: CHAIN_STATUS.DRAFT,
    });

    const opRecord = {
      operationId,
      clientName,
      category,
      currency,
      originCountry,
      destinationCountry,
      language:       lang,
      workflowState:  WORKFLOW_STATES.DRAFT,
      workflowHistory:[],
      operationChain: chain,
      activeEntity:   entity?.id || null,
      assignedUsers:  [actorId],
      attachedDocuments: [],
      auditTimeline:  [],
      createdAt:      new Date().toISOString(),
      createdBy:      actorId,
    };

    registerOperation(opRecord);

    const auditEvent = createAuditEvent({
      action:       "OPERATION_CREATED",
      userId:       actorId,
      userRole:     actorRole,
      country:      originCountry,
      module:       "ORCHESTRATOR",
      entityId:     operationId,
      entityType:   "OPERATION",
      workflowState:WORKFLOW_STATES.DRAFT,
    });
    logAuditEvent(auditEvent);

    return {
      success:     true,
      operationId,
      snapshot:    getOperationSnapshot(operationId),
      reason:      `Operation "${operationId}" initialized successfully`,
    };

  } catch (err) {
    return {
      success:     false,
      operationId: operationId || null,
      snapshot:    null,
      reason:      `Orchestrator error: ${err.message}`,
    };
  }
}

/**
 * Validate an operation's full integrity.
 * Runs chain validation, document chain check, and workflow integrity.
 *
 * @param {string} operationId
 * @returns {object} — consolidated validation result
 */
export function validateOperation(operationId) {
  try {
    const op = getOperation(operationId);
    if (!op) {
      return { valid: false, operationId, issues: ["Operation not found in registry"], warnings: [] };
    }

    const chainResult = validateOperationChain(op.operationChain || {});
    const docResult   = validateDocumentChain(operationId);

    const issues   = [...chainResult.missing];
    const warnings = [...chainResult.warnings];

    if (!docResult.valid) {
      warnings.push(...docResult.missing.map(t => `Missing document: ${t}`));
    }

    return Object.freeze({
      valid:        issues.length === 0,
      operationId,
      issues,
      warnings,
      chainValid:   chainResult.valid,
      docsPresent:  docResult.present,
      docsMissing:  docResult.missing,
      workflowState:op.workflowState,
    });

  } catch (err) {
    return { valid: false, operationId, issues: [`Validation error: ${err.message}`], warnings: [] };
  }
}

/**
 * Transition an operation's workflow state.
 *
 * @param {string} operationId
 * @param {string} nextState      — WORKFLOW_STATES value
 * @param {string} actorId
 * @param {string} actorRole
 * @param {string} [notes]
 * @returns {{ success: boolean, workflowState: string|null, reason: string }}
 */
export function transitionWorkflow(operationId, nextState, actorId, actorRole, notes = null) {
  try {
    const op = getOperation(operationId);
    if (!op) {
      return { success: false, workflowState: null, reason: `Operation "${operationId}" not found` };
    }

    if (!hasPermission(actorRole, "SCO", "approve")) {
      return { success: false, workflowState: op.workflowState, reason: `Role "${actorRole}" cannot perform workflow transitions` };
    }

    const result = transitionOperation(op, nextState, actorId, actorRole, notes);
    if (!result.success) {
      return { success: false, workflowState: op.workflowState, reason: result.reason };
    }

    updateOperation(operationId, {
      workflowState:   result.operation.workflowState,
      workflowHistory: result.operation.workflowHistory,
    });

    const auditEvent = createAuditEvent({
      action:       "WORKFLOW_TRANSITIONED",
      userId:       actorId,
      userRole:     actorRole,
      module:       "ORCHESTRATOR",
      entityId:     operationId,
      entityType:   "OPERATION",
      workflowState:nextState,
      notes:        `${op.workflowState} → ${nextState}`,
    });
    logAuditEvent(auditEvent);

    return { success: true, workflowState: nextState, reason: result.reason };

  } catch (err) {
    return { success: false, workflowState: null, reason: `Transition error: ${err.message}` };
  }
}

/**
 * Attach a document to an operation with audit trail.
 *
 * @param {string} operationId
 * @param {object} documentRecord  — result of createDocumentRecord()
 * @param {string} actorId
 * @param {string} actorRole
 * @returns {{ success: boolean, docId: string|null, reason: string }}
 */
export function attachOperationDocument(operationId, documentRecord, actorId, actorRole) {
  try {
    const result = attachDocument(documentRecord);
    if (!result.success) {
      return { success: false, docId: null, reason: "Document attach failed" };
    }

    const auditEvent = createAuditEvent({
      action:     "DOCUMENT_ATTACHED",
      userId:     actorId,
      userRole:   actorRole,
      module:     "ORCHESTRATOR",
      entityId:   operationId,
      entityType: "DOCUMENT",
      notes:      `${documentRecord.documentType}: ${documentRecord.documentRef}`,
    });
    logAuditEvent(auditEvent);

    return { success: true, docId: result.id, reason: `Document "${documentRecord.documentRef}" attached` };

  } catch (err) {
    return { success: false, docId: null, reason: `Attach error: ${err.message}` };
  }
}

/**
 * Generate and log an audit event for an operation.
 *
 * @param {string} operationId
 * @param {string} action          — AUDIT_ACTIONS value
 * @param {object} context         — { actorId, actorRole, notes, country, changes }
 * @returns {object}                — the audit event
 */
export function generateAuditEvent(operationId, action, context = {}) {
  const event = createAuditEvent({
    action,
    userId:       context.actorId || null,
    userRole:     context.actorRole || null,
    country:      context.country || null,
    module:       "ORCHESTRATOR",
    entityId:     operationId,
    entityType:   "OPERATION",
    notes:        context.notes || null,
    changes:      context.changes || null,
  });
  logAuditEvent(event);
  return event;
}

/**
 * Resolve the entity flow for an operation.
 *
 * @param {string} operationId
 * @returns {{ salesEntity: object|null, invoiceEntity: object|null, destinationEntity: object|null }}
 */
export function resolveEntityFlow(operationId) {
  try {
    const op = getOperation(operationId);
    if (!op) return { salesEntity: null, invoiceEntity: null, destinationEntity: null };

    const chain    = op.operationChain?.entities || {};
    const salesEnt = chain.SALES_ENTITY   ? resolveEntity(chain.SALES_ENTITY.entityId)   : null;
    const invEnt   = chain.INVOICE_ENTITY ? resolveEntity(chain.INVOICE_ENTITY.entityId)  : null;
    const destEnt  = chain.DESTINATION_COUNTRY || null;

    return Object.freeze({ salesEntity: salesEnt, invoiceEntity: invEnt, destinationCountry: destEnt });

  } catch (_) {
    return { salesEntity: null, invoiceEntity: null, destinationCountry: null };
  }
}

/**
 * Get a full snapshot of an operation's current state.
 *
 * @param {string} operationId
 * @returns {object|null}
 */
export function getOperationSnapshot(operationId) {
  try {
    const op = getOperation(operationId);
    if (!op) return null;

    const chainSummary = getOperationChainSummary(op.operationChain || {});
    const documents    = getOperationDocuments(operationId);
    const timeline     = getWorkflowTimeline(op, op.language || "es");

    return Object.freeze({
      operationId,
      clientName:        op.clientName,
      category:          op.category,
      currency:          op.currency,
      workflowState:     op.workflowState,
      language:          op.language,
      originCountry:     op.originCountry,
      destinationCountry:op.destinationCountry,
      activeEntity:      op.activeEntity,
      chainSummary,
      documentCount:     documents.length,
      documentTypes:     documents.map(d => d.documentType),
      workflowTimeline:  timeline,
      assignedUsers:     op.assignedUsers || [],
      createdAt:         op.createdAt,
      createdBy:         op.createdBy,
      _snapshotAt:       new Date().toISOString(),
      _orchestratorVersion: ORCHESTRATOR_VERSION,
    });

  } catch (err) {
    return null;
  }
}
