/**
 * TaskEngine.js
 * Core task creation, validation, and lifecycle management engine.
 * TASK_RESPONSIBILITY_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// Task Status Enum (frozen)
// ---------------------------------------------------------------------------
export const TASK_STATUS = Object.freeze({
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

// ---------------------------------------------------------------------------
// Task Categories Enum (frozen)
// ---------------------------------------------------------------------------
export const TASK_CATEGORIES = Object.freeze({
  COMMERCIAL: 'COMMERCIAL',
  FINANCIAL: 'FINANCIAL',
  LOGISTICS: 'LOGISTICS',
  PROCUREMENT: 'PROCUREMENT',
  QUALITY: 'QUALITY',
  COMPLIANCE: 'COMPLIANCE',
  AUDIT: 'AUDIT',
  PRODUCTION: 'PRODUCTION',
  INVENTORY: 'INVENTORY',
  LIVESTOCK: 'LIVESTOCK',
  TRANSPORT: 'TRANSPORT',
  DOCUMENTATION: 'DOCUMENTATION',
});

// ---------------------------------------------------------------------------
// Required fields for the full task model
// ---------------------------------------------------------------------------
const REQUIRED_FIELDS = [
  'taskId',
  'operationId',
  'country',
  'entity',
  'category',
  'assignedRole',
  'createdBy',
  'priority',
  'dueDate',
];

// ---------------------------------------------------------------------------
// Internal helper — generate a unique ID without external dependencies
// ---------------------------------------------------------------------------
function generateId(prefix = 'task') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// createTask(fields)
// Validates required fields, applies defaults, returns frozen task object.
// ---------------------------------------------------------------------------
export function createTask(fields = {}) {
  const now = new Date().toISOString();

  // Merge caller fields with required defaults
  const task = {
    // Defaults that can be overridden
    taskId: generateId('task'),
    completionPercent: 0,
    status: TASK_STATUS.CREATED,
    assignedUser: null,
    createdAt: now,
    updatedAt: now,
    auditTrail: [],
    evidence: [],
    escalations: [],
    // Caller-supplied fields (may override defaults like taskId)
    ...fields,
    // Immutable stamps — always set by engine, never from caller
    createdAt: fields.createdAt || now,
    updatedAt: now,
  };

  const validationError = validateTaskModel(task);
  if (validationError) {
    throw new Error(`createTask validation failed: ${validationError}`);
  }

  return Object.freeze(task);
}

// ---------------------------------------------------------------------------
// validateTaskModel(task)
// Returns an error string if invalid, null if valid.
// ---------------------------------------------------------------------------
export function validateTaskModel(task) {
  if (!task || typeof task !== 'object') {
    return 'Task must be a non-null object';
  }

  for (const field of REQUIRED_FIELDS) {
    if (task[field] === undefined || task[field] === null || task[field] === '') {
      return `Missing or empty required field: ${field}`;
    }
  }

  // Validate status is a known value
  if (!Object.values(TASK_STATUS).includes(task.status)) {
    return `Invalid status value: ${task.status}`;
  }

  // Validate category is a known value
  if (!Object.values(TASK_CATEGORIES).includes(task.category)) {
    return `Invalid category value: ${task.category}`;
  }

  // Validate completionPercent is in range [0, 100]
  if (
    typeof task.completionPercent !== 'number' ||
    task.completionPercent < 0 ||
    task.completionPercent > 100
  ) {
    return `completionPercent must be a number between 0 and 100`;
  }

  // Validate dueDate is a parseable date string
  if (isNaN(Date.parse(task.dueDate))) {
    return `dueDate is not a valid date string: ${task.dueDate}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// updateTask(task, patch)
// Returns a new frozen task with the given patch applied and updatedAt refreshed.
// Patch must not change immutable fields (taskId, operationId, createdAt, createdBy).
// ---------------------------------------------------------------------------
export function updateTask(task, patch = {}) {
  const IMMUTABLE_FIELDS = ['taskId', 'operationId', 'createdAt', 'createdBy'];

  for (const key of IMMUTABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      throw new Error(`updateTask: field "${key}" is immutable and cannot be patched`);
    }
  }

  const updated = {
    ...task,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  const validationError = validateTaskModel(updated);
  if (validationError) {
    throw new Error(`updateTask validation failed: ${validationError}`);
  }

  return Object.freeze(updated);
}

// ---------------------------------------------------------------------------
// getTaskSummary(task)
// Returns a lightweight display object (no audit trail / evidence arrays).
// ---------------------------------------------------------------------------
export function getTaskSummary(task) {
  return Object.freeze({
    taskId: task.taskId,
    operationId: task.operationId,
    country: task.country,
    entity: task.entity,
    category: task.category,
    assignedRole: task.assignedRole,
    assignedUser: task.assignedUser ?? null,
    priority: task.priority,
    dueDate: task.dueDate,
    status: task.status,
    completionPercent: task.completionPercent,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    evidenceCount: Array.isArray(task.evidence) ? task.evidence.length : 0,
    auditCount: Array.isArray(task.auditTrail) ? task.auditTrail.length : 0,
    escalationCount: Array.isArray(task.escalations) ? task.escalations.length : 0,
  });
}
