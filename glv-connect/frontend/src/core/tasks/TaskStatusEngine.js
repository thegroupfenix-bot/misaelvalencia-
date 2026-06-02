/**
 * TaskStatusEngine.js
 * Manages task status transitions with role-based authorization and guard logic.
 * TASK_RESPONSIBILITY_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

import { TASK_STATUS, updateTask } from './TaskEngine.js';
import { ROLES } from './TaskResponsibilityRegistry.js';

// ---------------------------------------------------------------------------
// VALID_TRANSITIONS map
// Defines which statuses a task can move to from a given current status,
// and which roles are authorized to make that transition.
// Format: { [fromStatus]: [{ to, allowedRoles }] }
// ---------------------------------------------------------------------------
export const VALID_TRANSITIONS = Object.freeze({
  [TASK_STATUS.CREATED]: [
    {
      to: TASK_STATUS.ASSIGNED,
      allowedRoles: [
        ROLES.GLOBAL_ADMIN,
        ROLES.OPERATIONS_MANAGER,
        ROLES.COUNTRY_MANAGER,
        ROLES.QUALITY_MANAGER,
        ROLES.FINANCE_MANAGER,
        ROLES.PROCUREMENT_MANAGER,
        ROLES.LOGISTICS_MANAGER,
      ],
    },
    {
      to: TASK_STATUS.CANCELLED,
      allowedRoles: [ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER, ROLES.COUNTRY_MANAGER],
    },
  ],

  [TASK_STATUS.ASSIGNED]: [
    {
      to: TASK_STATUS.IN_PROGRESS,
      allowedRoles: [
        ROLES.AGENT,
        ROLES.GLOBAL_ADMIN,
        ROLES.OPERATIONS_MANAGER,
        ROLES.COUNTRY_MANAGER,
        ROLES.QUALITY_MANAGER,
        ROLES.FINANCE_MANAGER,
        ROLES.PROCUREMENT_MANAGER,
        ROLES.LOGISTICS_MANAGER,
      ],
    },
    {
      to: TASK_STATUS.CANCELLED,
      allowedRoles: [ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER, ROLES.COUNTRY_MANAGER],
    },
    {
      to: TASK_STATUS.CREATED,
      allowedRoles: [ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER],
    },
  ],

  [TASK_STATUS.IN_PROGRESS]: [
    {
      to: TASK_STATUS.PENDING_REVIEW,
      allowedRoles: [
        ROLES.AGENT,
        ROLES.GLOBAL_ADMIN,
        ROLES.OPERATIONS_MANAGER,
        ROLES.COUNTRY_MANAGER,
        ROLES.QUALITY_MANAGER,
        ROLES.FINANCE_MANAGER,
        ROLES.PROCUREMENT_MANAGER,
        ROLES.LOGISTICS_MANAGER,
      ],
    },
    {
      to: TASK_STATUS.CANCELLED,
      allowedRoles: [ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER, ROLES.COUNTRY_MANAGER],
    },
  ],

  [TASK_STATUS.PENDING_REVIEW]: [
    {
      to: TASK_STATUS.APPROVED,
      allowedRoles: [
        ROLES.GLOBAL_ADMIN,
        ROLES.OPERATIONS_MANAGER,
        ROLES.COUNTRY_MANAGER,
        ROLES.QUALITY_MANAGER,
        ROLES.FINANCE_MANAGER,
        ROLES.PROCUREMENT_MANAGER,
        ROLES.LOGISTICS_MANAGER,
        ROLES.AUDITOR,
      ],
    },
    {
      to: TASK_STATUS.REJECTED,
      allowedRoles: [
        ROLES.GLOBAL_ADMIN,
        ROLES.OPERATIONS_MANAGER,
        ROLES.COUNTRY_MANAGER,
        ROLES.QUALITY_MANAGER,
        ROLES.FINANCE_MANAGER,
        ROLES.PROCUREMENT_MANAGER,
        ROLES.LOGISTICS_MANAGER,
        ROLES.AUDITOR,
      ],
    },
    {
      to: TASK_STATUS.IN_PROGRESS,
      allowedRoles: [ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER],
    },
  ],

  [TASK_STATUS.APPROVED]: [
    {
      to: TASK_STATUS.COMPLETED,
      allowedRoles: [
        ROLES.GLOBAL_ADMIN,
        ROLES.OPERATIONS_MANAGER,
        ROLES.COUNTRY_MANAGER,
        ROLES.QUALITY_MANAGER,
        ROLES.FINANCE_MANAGER,
        ROLES.PROCUREMENT_MANAGER,
        ROLES.LOGISTICS_MANAGER,
      ],
    },
    {
      to: TASK_STATUS.PENDING_REVIEW,
      allowedRoles: [ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER],
    },
  ],

  [TASK_STATUS.REJECTED]: [
    {
      to: TASK_STATUS.IN_PROGRESS,
      allowedRoles: [
        ROLES.AGENT,
        ROLES.GLOBAL_ADMIN,
        ROLES.OPERATIONS_MANAGER,
        ROLES.COUNTRY_MANAGER,
      ],
    },
    {
      to: TASK_STATUS.CANCELLED,
      allowedRoles: [ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER, ROLES.COUNTRY_MANAGER],
    },
  ],

  [TASK_STATUS.COMPLETED]: [],   // Terminal state — no outbound transitions

  [TASK_STATUS.CANCELLED]: [],   // Terminal state — no outbound transitions
});

// ---------------------------------------------------------------------------
// canTransition(currentStatus, newStatus, actorRole)
// Returns true if the transition is legal for the given role.
// ---------------------------------------------------------------------------
export function canTransition(currentStatus, newStatus, actorRole) {
  const transitions = VALID_TRANSITIONS[currentStatus];
  if (!Array.isArray(transitions)) return false;

  const match = transitions.find((t) => t.to === newStatus);
  if (!match) return false;

  return match.allowedRoles.includes(actorRole);
}

// ---------------------------------------------------------------------------
// getAvailableTransitions(task, actorRole)
// Returns array of valid next status values the actor can move the task to.
// ---------------------------------------------------------------------------
export function getAvailableTransitions(task, actorRole) {
  const transitions = VALID_TRANSITIONS[task.status];
  if (!Array.isArray(transitions)) return [];

  return transitions
    .filter((t) => t.allowedRoles.includes(actorRole))
    .map((t) => t.to);
}

// ---------------------------------------------------------------------------
// transitionStatus(task, newStatus, actorRole)
// Validates the transition is legal, returns an updated frozen task.
// ---------------------------------------------------------------------------
export function transitionStatus(task, newStatus, actorRole) {
  if (!Object.values(TASK_STATUS).includes(newStatus)) {
    throw new Error(`transitionStatus: unknown target status "${newStatus}"`);
  }

  if (!canTransition(task.status, newStatus, actorRole)) {
    throw new Error(
      `transitionStatus: transition from "${task.status}" to "${newStatus}" is not allowed for role "${actorRole}"`
    );
  }

  const completionPercent =
    newStatus === TASK_STATUS.COMPLETED
      ? 100
      : newStatus === TASK_STATUS.CANCELLED
      ? task.completionPercent
      : task.completionPercent;

  return updateTask(task, {
    status: newStatus,
    completionPercent,
    statusChangedAt: new Date().toISOString(),
  });
}
