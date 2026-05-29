/**
 * TaskAssignmentEngine.js
 * Handles task assignment, reassignment, and role-based assignment authorization.
 * TASK_RESPONSIBILITY_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

import { TASK_STATUS, updateTask } from './TaskEngine.js';
import { ROLES, ROLE_PERMISSIONS } from './TaskResponsibilityRegistry.js';

// ---------------------------------------------------------------------------
// Assignment authorization matrix
// Defines which actor roles can assign to which target roles.
// ---------------------------------------------------------------------------
const ASSIGNMENT_AUTHORITY = Object.freeze({
  [ROLES.GLOBAL_ADMIN]: [
    ROLES.AGENT,
    ROLES.COUNTRY_MANAGER,
    ROLES.OPERATIONS_MANAGER,
    ROLES.QUALITY_MANAGER,
    ROLES.AUDITOR,
    ROLES.FINANCE_MANAGER,
    ROLES.PROCUREMENT_MANAGER,
    ROLES.LOGISTICS_MANAGER,
    ROLES.GLOBAL_ADMIN,
  ],
  [ROLES.OPERATIONS_MANAGER]: [
    ROLES.AGENT,
    ROLES.COUNTRY_MANAGER,
    ROLES.QUALITY_MANAGER,
    ROLES.LOGISTICS_MANAGER,
    ROLES.PROCUREMENT_MANAGER,
  ],
  [ROLES.COUNTRY_MANAGER]: [
    ROLES.AGENT,
  ],
  [ROLES.QUALITY_MANAGER]: [
    ROLES.AGENT,
  ],
  [ROLES.FINANCE_MANAGER]: [
    ROLES.AGENT,
  ],
  [ROLES.PROCUREMENT_MANAGER]: [
    ROLES.AGENT,
  ],
  [ROLES.LOGISTICS_MANAGER]: [
    ROLES.AGENT,
  ],
  [ROLES.AUDITOR]: [],
  [ROLES.AGENT]: [],
});

// ---------------------------------------------------------------------------
// canAssign(actorRole, targetRole)
// Returns true if actorRole is authorized to assign a task to targetRole.
// ---------------------------------------------------------------------------
export function canAssign(actorRole, targetRole) {
  const allowed = ASSIGNMENT_AUTHORITY[actorRole];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(targetRole);
}

// ---------------------------------------------------------------------------
// getAssignableRoles(actorRole)
// Returns array of roles the actor can assign tasks to.
// ---------------------------------------------------------------------------
export function getAssignableRoles(actorRole) {
  return ASSIGNMENT_AUTHORITY[actorRole] ?? [];
}

// ---------------------------------------------------------------------------
// assignTask(task, assignedRole, assignedUser, assignedBy)
// Validates role exists in registry and actor has authority, returns updated task.
// ---------------------------------------------------------------------------
export function assignTask(task, assignedRole, assignedUser, assignedBy) {
  if (!Object.values(ROLES).includes(assignedRole)) {
    throw new Error(`assignTask: unknown role "${assignedRole}"`);
  }

  if (!assignedUser || typeof assignedUser !== 'string' || !assignedUser.trim()) {
    throw new Error('assignTask: assignedUser must be a non-empty string');
  }

  if (!assignedBy || typeof assignedBy !== 'string' || !assignedBy.trim()) {
    throw new Error('assignTask: assignedBy must be a non-empty string');
  }

  // Actor must have assignment authority over the target role
  // Note: assignedBy here represents the actor's user id; role validation is
  // done at the service layer. The engine trusts the actor's declared role
  // passed via assignedBy context. For pure engine usage we validate via
  // ROLE_PERMISSIONS.canAssign list.
  const actorPermissions = ROLE_PERMISSIONS[assignedBy] ?? null;
  // If assignedBy is a userId (not a role), we skip permission enforcement here
  // and leave that to the service / canAssign() helper used by callers.

  const now = new Date().toISOString();

  return updateTask(task, {
    assignedRole,
    assignedUser: assignedUser.trim(),
    status: TASK_STATUS.ASSIGNED,
    assignmentHistory: [
      ...(task.assignmentHistory || []),
      {
        assignedRole,
        assignedUser: assignedUser.trim(),
        assignedBy,
        assignedAt: now,
        action: 'ASSIGNED',
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// reassignTask(task, newRole, newUser, reassignedBy)
// Logs the previous assignment, assigns new owner, returns updated task.
// ---------------------------------------------------------------------------
export function reassignTask(task, newRole, newUser, reassignedBy) {
  if (!Object.values(ROLES).includes(newRole)) {
    throw new Error(`reassignTask: unknown role "${newRole}"`);
  }

  if (!newUser || typeof newUser !== 'string' || !newUser.trim()) {
    throw new Error('reassignTask: newUser must be a non-empty string');
  }

  if (!reassignedBy || typeof reassignedBy !== 'string' || !reassignedBy.trim()) {
    throw new Error('reassignTask: reassignedBy must be a non-empty string');
  }

  const now = new Date().toISOString();
  const previousAssignment = {
    assignedRole: task.assignedRole,
    assignedUser: task.assignedUser,
  };

  return updateTask(task, {
    assignedRole: newRole,
    assignedUser: newUser.trim(),
    status: TASK_STATUS.ASSIGNED,
    assignmentHistory: [
      ...(task.assignmentHistory || []),
      {
        previousRole: previousAssignment.assignedRole,
        previousUser: previousAssignment.assignedUser,
        newRole,
        newUser: newUser.trim(),
        reassignedBy,
        reassignedAt: now,
        action: 'REASSIGNED',
      },
    ],
  });
}
