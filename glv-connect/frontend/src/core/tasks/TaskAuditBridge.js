/**
 * TaskAuditBridge.js
 * Audit trail management, event hooks (pub/sub), and escalation helpers.
 * TASK_RESPONSIBILITY_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

import { updateTask } from './TaskEngine.js';

// ---------------------------------------------------------------------------
// AUDIT_ACTIONS (frozen enum)
// ---------------------------------------------------------------------------
export const AUDIT_ACTIONS = Object.freeze({
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  REASSIGNED: 'REASSIGNED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  EVIDENCE_ATTACHED: 'EVIDENCE_ATTACHED',
  EVIDENCE_REMOVED: 'EVIDENCE_REMOVED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  ESCALATED: 'ESCALATED',
});

// ---------------------------------------------------------------------------
// Internal — generate an audit entry ID
// ---------------------------------------------------------------------------
function generateAuditId() {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// createAuditEntry(task, action, actorRole, actorUser, details)
// Returns a frozen audit entry object.
// ---------------------------------------------------------------------------
export function createAuditEntry(task, action, actorRole, actorUser, details = {}) {
  if (!task || typeof task !== 'object') {
    throw new Error('createAuditEntry: task must be a non-null object');
  }

  if (!Object.values(AUDIT_ACTIONS).includes(action)) {
    throw new Error(`createAuditEntry: unknown action "${action}". Valid actions: ${Object.values(AUDIT_ACTIONS).join(', ')}`);
  }

  if (!actorRole || typeof actorRole !== 'string' || !actorRole.trim()) {
    throw new Error('createAuditEntry: actorRole must be a non-empty string');
  }

  if (!actorUser || typeof actorUser !== 'string' || !actorUser.trim()) {
    throw new Error('createAuditEntry: actorUser must be a non-empty string');
  }

  return Object.freeze({
    auditId: generateAuditId(),
    taskId: task.taskId,
    action,
    actorRole: actorRole.trim(),
    actorUser: actorUser.trim(),
    details: Object.freeze({ ...details }),
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// attachAuditEntry(task, auditEntry)
// Returns updated task with the audit entry appended to auditTrail.
// ---------------------------------------------------------------------------
export function attachAuditEntry(task, auditEntry) {
  if (!auditEntry || typeof auditEntry !== 'object') {
    throw new Error('attachAuditEntry: auditEntry must be a non-null object');
  }

  if (!auditEntry.auditId || !auditEntry.action || !auditEntry.timestamp) {
    throw new Error('attachAuditEntry: auditEntry is missing required fields (auditId, action, timestamp)');
  }

  return updateTask(task, {
    auditTrail: [...(task.auditTrail || []), auditEntry],
  });
}

// ---------------------------------------------------------------------------
// getAuditTrail(task)
// Returns array of audit entries sorted by timestamp ascending.
// ---------------------------------------------------------------------------
export function getAuditTrail(task) {
  const trail = task.auditTrail || [];
  return [...trail].sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tA - tB;
  });
}

// ---------------------------------------------------------------------------
// Escalation Helpers
// ---------------------------------------------------------------------------

// How long (in milliseconds) a task may remain in the same status before
// it is considered "stuck" and eligible for escalation.
const STUCK_THRESHOLD_MS = Object.freeze({
  CREATED: 24 * 60 * 60 * 1000,         // 1 day
  ASSIGNED: 48 * 60 * 60 * 1000,        // 2 days
  IN_PROGRESS: 72 * 60 * 60 * 1000,     // 3 days
  PENDING_REVIEW: 24 * 60 * 60 * 1000,  // 1 day
  APPROVED: 24 * 60 * 60 * 1000,        // 1 day
  REJECTED: 48 * 60 * 60 * 1000,        // 2 days
  COMPLETED: null,   // Terminal — never stuck
  CANCELLED: null,   // Terminal — never stuck
});

/**
 * shouldEscalate(task)
 * Returns true if:
 *   - The task is overdue (dueDate has passed), OR
 *   - The task has been in its current status longer than STUCK_THRESHOLD_MS.
 */
export function shouldEscalate(task) {
  // Terminal statuses never require escalation
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    return false;
  }

  const now = Date.now();

  // Overdue check
  if (task.dueDate && !isNaN(Date.parse(task.dueDate))) {
    if (now > new Date(task.dueDate).getTime()) {
      return true;
    }
  }

  // Stuck-in-status check
  const threshold = STUCK_THRESHOLD_MS[task.status];
  if (threshold !== null && typeof threshold === 'number') {
    const lastUpdated = new Date(task.updatedAt).getTime();
    if (now - lastUpdated > threshold) {
      return true;
    }
  }

  return false;
}

/**
 * escalateTask(task, escalatedTo, reason)
 * Returns updated task with an escalation record appended to task.escalations
 * and a corresponding audit entry in the auditTrail.
 */
export function escalateTask(task, escalatedTo, reason) {
  if (!escalatedTo || typeof escalatedTo !== 'string' || !escalatedTo.trim()) {
    throw new Error('escalateTask: escalatedTo must be a non-empty string');
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('escalateTask: reason must be a non-empty string');
  }

  const now = new Date().toISOString();

  const escalationRecord = Object.freeze({
    escalationId: `esc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    escalatedTo: escalatedTo.trim(),
    reason: reason.trim(),
    fromStatus: task.status,
    escalatedAt: now,
  });

  const auditEntry = createAuditEntry(
    task,
    AUDIT_ACTIONS.ESCALATED,
    'SYSTEM',
    'system',
    { escalatedTo: escalatedTo.trim(), reason: reason.trim(), fromStatus: task.status }
  );

  const withEscalation = updateTask(task, {
    escalations: [...(task.escalations || []), escalationRecord],
    auditTrail: [...(task.auditTrail || []), auditEntry],
  });

  return withEscalation;
}

// ---------------------------------------------------------------------------
// Simple pub/sub hook system — no external dependencies
// Each hook factory accepts a callback and returns an unsubscribe function.
// ---------------------------------------------------------------------------

function createHook() {
  const subscribers = new Set();

  function subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Hook subscriber must be a function');
    }
    subscribers.add(callback);
    return function unsubscribe() {
      subscribers.delete(callback);
    };
  }

  function emit(payload) {
    subscribers.forEach((cb) => {
      try {
        cb(payload);
      } catch (_err) {
        // Swallow subscriber errors to prevent one bad subscriber
        // from breaking the audit pipeline.
      }
    });
  }

  return { subscribe, emit };
}

// Internal hook instances (module-level singletons, but not observable at load time)
const _hooks = {
  taskCreated: createHook(),
  taskAssigned: createHook(),
  taskStatusChanged: createHook(),
  taskEscalated: createHook(),
  taskCompleted: createHook(),
};

/**
 * onTaskCreated(callback) — fires when a task is created.
 * Returns unsubscribe fn.
 */
export function onTaskCreated(callback) {
  return _hooks.taskCreated.subscribe(callback);
}

/**
 * onTaskAssigned(callback) — fires when a task is assigned or reassigned.
 * Returns unsubscribe fn.
 */
export function onTaskAssigned(callback) {
  return _hooks.taskAssigned.subscribe(callback);
}

/**
 * onTaskStatusChanged(callback) — fires when a task status changes.
 * Returns unsubscribe fn.
 */
export function onTaskStatusChanged(callback) {
  return _hooks.taskStatusChanged.subscribe(callback);
}

/**
 * onTaskEscalated(callback) — fires when a task is escalated.
 * Returns unsubscribe fn.
 */
export function onTaskEscalated(callback) {
  return _hooks.taskEscalated.subscribe(callback);
}

/**
 * onTaskCompleted(callback) — fires when a task reaches COMPLETED status.
 * Returns unsubscribe fn.
 */
export function onTaskCompleted(callback) {
  return _hooks.taskCompleted.subscribe(callback);
}

// ---------------------------------------------------------------------------
// Internal emit helpers — called by the application layer after each operation
// to notify subscribers. Exported so orchestration layers can trigger them.
// ---------------------------------------------------------------------------
export function emitTaskCreated(task) {
  _hooks.taskCreated.emit({ task, timestamp: new Date().toISOString() });
}

export function emitTaskAssigned(task, previousAssignment) {
  _hooks.taskAssigned.emit({ task, previousAssignment, timestamp: new Date().toISOString() });
}

export function emitTaskStatusChanged(task, previousStatus) {
  _hooks.taskStatusChanged.emit({ task, previousStatus, timestamp: new Date().toISOString() });
  if (task.status === 'COMPLETED') {
    _hooks.taskCompleted.emit({ task, timestamp: new Date().toISOString() });
  }
}

export function emitTaskEscalated(task, escalationRecord) {
  _hooks.taskEscalated.emit({ task, escalationRecord, timestamp: new Date().toISOString() });
}
