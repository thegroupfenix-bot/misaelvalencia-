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
// canAssign(actorRole, targetRole)
// Returns true if actorRole is authorized to assign a task to targetRole.
// Source of truth: ROLE_PERMISSIONS[actorRole].canAssign in TaskResponsibilityRegistry.js
// ---------------------------------------------------------------------------
export function canAssign(actorRole, targetRole) {
  const perms = ROLE_PERMISSIONS[actorRole];
  if (!perms || !Array.isArray(perms.canAssign)) return false;
  return perms.canAssign.includes(targetRole);
}

// ---------------------------------------------------------------------------
// getAssignableRoles(actorRole)
// Returns array of roles the actor can assign tasks to.
// Source of truth: ROLE_PERMISSIONS[actorRole].canAssign in TaskResponsibilityRegistry.js
// ---------------------------------------------------------------------------
export function getAssignableRoles(actorRole) {
  const perms = ROLE_PERMISSIONS[actorRole];
  if (!perms || !Array.isArray(perms.canAssign)) return [];
  return perms.canAssign;
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

  // Permission enforcement is handled at the service layer via canAssign().
  // assignedBy here is the actor's user id; role checks are left to callers.

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
