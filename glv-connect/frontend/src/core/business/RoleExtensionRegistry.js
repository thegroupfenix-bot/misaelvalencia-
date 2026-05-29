/**
 * RoleExtensionRegistry.js
 * Extends existing ROLES with new operational roles.
 * GLV_BUSINESS_OPERATING_MODEL_FOUNDATION_V1
 *
 * Does NOT modify TaskResponsibilityRegistry.js.
 * Imports ROLES and TASK_CATEGORIES from the tasks directory and extends them here.
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

import { ROLES } from '../tasks/TaskResponsibilityRegistry.js';
import { TASK_CATEGORIES } from '../tasks/TaskEngine.js';

// ---------------------------------------------------------------------------
// NEW_ROLES (frozen object — ONLY the new roles, not duplicating existing ones)
// ---------------------------------------------------------------------------
export const NEW_ROLES = Object.freeze({
  INVENTORY_OFFICER: 'INVENTORY_OFFICER',
  PORT_COORDINATOR: 'PORT_COORDINATOR',
  QUARANTINE_COORDINATOR: 'QUARANTINE_COORDINATOR',
  FLEET_MANAGER: 'FLEET_MANAGER',
  LEGAL_OFFICER: 'LEGAL_OFFICER',
  COMPLIANCE_OFFICER: 'COMPLIANCE_OFFICER',
  QUALITY_OFFICER: 'QUALITY_OFFICER',
});

// ---------------------------------------------------------------------------
// EXTENDED_ROLES (frozen object) — merged set of all roles
// ---------------------------------------------------------------------------
export const EXTENDED_ROLES = Object.freeze({ ...ROLES, ...NEW_ROLES });

// ---------------------------------------------------------------------------
// EXTENDED_ROLE_PERMISSIONS (frozen object — ONLY permissions for NEW roles)
// Each entry: { canCreate, canView, canAssign, canAudit }
// ---------------------------------------------------------------------------
export const EXTENDED_ROLE_PERMISSIONS = Object.freeze({
  [NEW_ROLES.INVENTORY_OFFICER]: Object.freeze({
    canCreate: Object.freeze([TASK_CATEGORIES.INVENTORY]),
    canView: Object.freeze([
      TASK_CATEGORIES.INVENTORY,
      TASK_CATEGORIES.LOGISTICS,
      TASK_CATEGORIES.TRANSPORT,
    ]),
    canAssign: Object.freeze([]),
    canAudit: false,
  }),

  [NEW_ROLES.PORT_COORDINATOR]: Object.freeze({
    canCreate: Object.freeze([TASK_CATEGORIES.TRANSPORT, TASK_CATEGORIES.LOGISTICS]),
    canView: Object.freeze([TASK_CATEGORIES.LOGISTICS, TASK_CATEGORIES.TRANSPORT]),
    canAssign: Object.freeze([]),
    canAudit: false,
  }),

  [NEW_ROLES.QUARANTINE_COORDINATOR]: Object.freeze({
    canCreate: Object.freeze([TASK_CATEGORIES.QUALITY, TASK_CATEGORIES.COMPLIANCE]),
    canView: Object.freeze([
      TASK_CATEGORIES.QUALITY,
      TASK_CATEGORIES.COMPLIANCE,
      TASK_CATEGORIES.LIVESTOCK,
    ]),
    canAssign: Object.freeze([]),
    canAudit: false,
  }),

  [NEW_ROLES.FLEET_MANAGER]: Object.freeze({
    canCreate: Object.freeze([TASK_CATEGORIES.TRANSPORT]),
    canView: Object.freeze([TASK_CATEGORIES.TRANSPORT, TASK_CATEGORIES.LOGISTICS]),
    canAssign: Object.freeze([NEW_ROLES.PORT_COORDINATOR]),
    canAudit: false,
  }),

  [NEW_ROLES.LEGAL_OFFICER]: Object.freeze({
    canCreate: Object.freeze([TASK_CATEGORIES.COMPLIANCE, TASK_CATEGORIES.DOCUMENTATION]),
    canView: Object.freeze(Object.values(TASK_CATEGORIES)),
    canAssign: Object.freeze([]),
    canAudit: true,
  }),

  [NEW_ROLES.COMPLIANCE_OFFICER]: Object.freeze({
    canCreate: Object.freeze([TASK_CATEGORIES.COMPLIANCE, TASK_CATEGORIES.AUDIT]),
    canView: Object.freeze(Object.values(TASK_CATEGORIES)),
    canAssign: Object.freeze([]),
    canAudit: true,
  }),

  [NEW_ROLES.QUALITY_OFFICER]: Object.freeze({
    canCreate: Object.freeze([
      TASK_CATEGORIES.QUALITY,
      TASK_CATEGORIES.COMPLIANCE,
      TASK_CATEGORIES.PRODUCTION,
    ]),
    canView: Object.freeze([
      TASK_CATEGORIES.QUALITY,
      TASK_CATEGORIES.COMPLIANCE,
      TASK_CATEGORIES.PRODUCTION,
      TASK_CATEGORIES.LIVESTOCK,
    ]),
    canAssign: Object.freeze([]),
    canAudit: false,
  }),
});

// ---------------------------------------------------------------------------
// getAllRoles()
// Returns array of all role values (existing + new).
// ---------------------------------------------------------------------------
export function getAllRoles() {
  return Object.values(EXTENDED_ROLES);
}

// ---------------------------------------------------------------------------
// isValidRole(role)
// Returns true if role is a known value in EXTENDED_ROLES.
// ---------------------------------------------------------------------------
export function isValidRole(role) {
  return Object.values(EXTENDED_ROLES).includes(role);
}
