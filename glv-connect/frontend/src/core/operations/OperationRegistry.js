/**
 * OperationRegistry.js — GLV GOS Core Operations — Operation Registry Foundation V1.0
 *
 * Single source of truth for all enterprise operations in the current session.
 * Immutable IDs, audit-aware, future database-ready, future API-ready.
 *
 * STATUS: ACTIVE — in-memory foundation. Adapter interface defined for DB integration.
 *
 * DESIGN: All mutations return new frozen records. Registry is adapter-agnostic —
 * replace _adapter to swap in a REST API or database layer.
 */

// ─── Operation schema ───────────────────────────────────────────────────────────

/**
 * Create a canonical operation registry record.
 *
 * @param {object} params
 * @returns {object}
 */
export function createOperationRecord({
  operationId,
  clientName,
  category,
  currency,
  originCountry,
  destinationCountry,
  language        = "es",
  workflowState   = "DRAFT",
  workflowHistory = [],
  operationChain  = null,
  attachedDocuments = [],
  auditTimeline   = [],
  assignedUsers   = [],
  activeEntity    = null,
  createdBy       = null,
  notes           = null,
}) {
  if (!operationId) throw new Error("[OperationRegistry] operationId is required");

  return Object.freeze({
    operationId,
    clientName,
    category,
    currency,
    originCountry,
    destinationCountry,
    language,
    workflowState,
    workflowHistory:    Object.freeze(workflowHistory),
    operationChain,
    attachedDocuments:  Object.freeze(attachedDocuments),
    auditTimeline:      Object.freeze(auditTimeline),
    assignedUsers:      Object.freeze(assignedUsers),
    activeEntity,
    notes,
    createdBy,
    createdAt:          new Date().toISOString(),
    updatedAt:          new Date().toISOString(),
    _schema:            "GLV_OPERATION_REGISTRY_V1",
    _version:           1,
  });
}

// ─── In-memory adapter ──────────────────────────────────────────────────────────
// Replace _store.set/get/delete with DB calls to swap persistence layer.

const _store = new Map();

// ─── Registry interface ─────────────────────────────────────────────────────────

/**
 * Register a new operation. Throws if operationId already exists.
 *
 * @param {object} opRecord  — plain object or createOperationRecord() output
 * @returns {object}          — frozen registered record
 */
export function registerOperation(opRecord) {
  const id = opRecord?.operationId;
  if (!id) throw new Error("[OperationRegistry] operationId required");
  if (_store.has(id)) throw new Error(`[OperationRegistry] Operation "${id}" already registered`);

  const record = Object.freeze({ ...opRecord, _registeredAt: new Date().toISOString() });
  _store.set(id, record);
  return record;
}

/**
 * Get an operation by ID.
 *
 * @param {string} operationId
 * @returns {object|null}
 */
export function getOperation(operationId) {
  return _store.get(operationId) || null;
}

/**
 * Update an operation with a partial patch.
 * Returns the updated frozen record.
 *
 * @param {string} operationId
 * @param {object} patch         — fields to update
 * @returns {object|null}
 */
export function updateOperation(operationId, patch = {}) {
  const existing = _store.get(operationId);
  if (!existing) return null;

  const updated = Object.freeze({
    ...existing,
    ...patch,
    operationId,
    updatedAt: new Date().toISOString(),
    _version: (existing._version || 1) + 1,
  });
  _store.set(operationId, updated);
  return updated;
}

/**
 * Delete an operation from the registry.
 * Use with caution — prefer closing (workflowState: CLOSED) over deletion.
 *
 * @param {string} operationId
 * @returns {boolean}
 */
export function deleteOperation(operationId) {
  return _store.delete(operationId);
}

/**
 * List all operations, optionally filtered.
 *
 * @param {object} [filter]  — { category, workflowState, originCountry, destinationCountry }
 * @returns {object[]}
 */
export function listOperations(filter = {}) {
  let ops = [..._store.values()];

  if (filter.category)           ops = ops.filter(o => o.category === filter.category);
  if (filter.workflowState)      ops = ops.filter(o => o.workflowState === filter.workflowState);
  if (filter.originCountry)      ops = ops.filter(o => o.originCountry === filter.originCountry);
  if (filter.destinationCountry) ops = ops.filter(o => o.destinationCountry === filter.destinationCountry);
  if (filter.clientName)         ops = ops.filter(o => o.clientName === filter.clientName);
  if (filter.activeEntity)       ops = ops.filter(o => o.activeEntity === filter.activeEntity);

  return ops;
}

/**
 * Get a summary count of operations by workflow state.
 *
 * @returns {object}  — e.g. { DRAFT: 3, QUOTED: 1, ... }
 */
export function getOperationStateCounts() {
  const counts = {};
  for (const op of _store.values()) {
    counts[op.workflowState] = (counts[op.workflowState] || 0) + 1;
  }
  return Object.freeze(counts);
}

/**
 * Check if an operation exists.
 *
 * @param {string} operationId
 * @returns {boolean}
 */
export function operationExists(operationId) {
  return _store.has(operationId);
}

/**
 * Get total operation count.
 *
 * @returns {number}
 */
export function getOperationCount() {
  return _store.size;
}
