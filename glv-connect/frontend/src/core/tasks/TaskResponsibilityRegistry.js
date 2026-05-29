/**
 * TaskResponsibilityRegistry.js
 * Central registry for roles, category responsibility matrices, and permission checks.
 * TASK_RESPONSIBILITY_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// ROLES (frozen enum)
// ---------------------------------------------------------------------------
export const ROLES = Object.freeze({
  AGENT: 'AGENT',
  COUNTRY_MANAGER: 'COUNTRY_MANAGER',
  OPERATIONS_MANAGER: 'OPERATIONS_MANAGER',
  QUALITY_MANAGER: 'QUALITY_MANAGER',
  AUDITOR: 'AUDITOR',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
  PROCUREMENT_MANAGER: 'PROCUREMENT_MANAGER',
  LOGISTICS_MANAGER: 'LOGISTICS_MANAGER',
  GLOBAL_ADMIN: 'GLOBAL_ADMIN',
});

// ---------------------------------------------------------------------------
// CATEGORY_RESPONSIBILITY_MATRIX
// Maps each task category to: primaryRole, secondaryRoles[], canApprove[], canView[]
// ---------------------------------------------------------------------------
export const CATEGORY_RESPONSIBILITY_MATRIX = Object.freeze({
  COMMERCIAL: Object.freeze({
    primaryRole: ROLES.OPERATIONS_MANAGER,
    secondaryRoles: Object.freeze([ROLES.COUNTRY_MANAGER, ROLES.AGENT]),
    canApprove: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER, ROLES.COUNTRY_MANAGER]),
    canView: Object.freeze([
      ROLES.GLOBAL_ADMIN,
      ROLES.OPERATIONS_MANAGER,
      ROLES.COUNTRY_MANAGER,
      ROLES.AGENT,
      ROLES.AUDITOR,
    ]),
  }),

  FINANCIAL: Object.freeze({
    primaryRole: ROLES.FINANCE_MANAGER,
    secondaryRoles: Object.freeze([ROLES.OPERATIONS_MANAGER, ROLES.COUNTRY_MANAGER]),
    canApprove: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.FINANCE_MANAGER, ROLES.OPERATIONS_MANAGER]),
    canView: Object.freeze([
      ROLES.GLOBAL_ADMIN,
      ROLES.FINANCE_MANAGER,
      ROLES.OPERATIONS_MANAGER,
      ROLES.COUNTRY_MANAGER,
      ROLES.AUDITOR,
    ]),
  }),

  LOGISTICS: Object.freeze({
    primaryRole: ROLES.LOGISTICS_MANAGER,
    secondaryRoles: Object.freeze([ROLES.OPERATIONS_MANAGER, ROLES.AGENT]),
    canApprove: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.LOGISTICS_MANAGER, ROLES.OPERATIONS_MANAGER]),
    canView: Object.freeze([
      ROLES.GLOBAL_ADMIN,
      ROLES.LOGISTICS_MANAGER,
      ROLES.OPERATIONS_MANAGER,
      ROLES.COUNTRY_MANAGER,
      ROLES.AGENT,
      ROLES.AUDITOR,
    ]),
  }),

  PROCUREMENT: Object.freeze({
    primaryRole: ROLES.PROCUREMENT_MANAGER,
    secondaryRoles: Object.freeze([ROLES.OPERATIONS_MANAGER, ROLES.FINANCE_MANAGER]),
    canApprove: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.PROCUREMENT_MANAGER, ROLES.OPERATIONS_MANAGER]),
    canView: Object.freeze([
      ROLES.GLOBAL_ADMIN,
      ROLES.PROCUREMENT_MANAGER,
      ROLES.OPERATIONS_MANAGER,
      ROLES.FINANCE_MANAGER,
      ROLES.COUNTRY_MANAGER,
      ROLES.AUDITOR,
    ]),
  }),

  QUALITY: Object.freeze({
    primaryRole: ROLES.QUALITY_MANAGER,
    secondaryRoles: Object.freeze([ROLES.OPERATIONS_MANAGER, ROLES.AGENT]),
    canApprove: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.QUALITY_MANAGER, ROLES.OPERATIONS_MANAGER]),
    canView: Object.freeze([
      ROLES.GLOBAL_ADMIN,
      ROLES.QUALITY_MANAGER,
      ROLES.OPERATIONS_MANAGER,
      ROLES.COUNTRY_MANAGER,
      ROLES.AGENT,
      ROLES.AUDITOR,
    ]),
  }),

  COMPLIANCE: Object.freeze({
    primaryRole: ROLES.AUDITOR,
    secondaryRoles: Object.freeze([ROLES.OPERATIONS_MANAGER, ROLES.QUALITY_MANAGER]),
    canApprove: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.AUDITOR, ROLES.OPERATIONS_MANAGER]),
    canView: Object.freeze([
      ROLES.GLOBAL_ADMIN,
      ROLES.AUDITOR,
      ROLES.OPERATIONS_MANAGER,
      ROLES.QUALITY_MANAGER,
      ROLES.COUNTRY_MANAGER,
    ]),
  }),

  AUDIT: Object.freeze({
    primaryRole: ROLES.AUDITOR,
    secondaryRoles: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER]),
    canApprove: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.AUDITOR]),
    canView: Object.freeze([
      ROLES.GLOBAL_ADMIN,
      ROLES.AUDITOR,
      ROLES.OPERATIONS_MANAGER,
      ROLES.COUNTRY_MANAGER,
    ]),
  }),

  PRODUCTION: Object.freeze({
    primaryRole: ROLES.OPERATIONS_MANAGER,
    secondaryRoles: Object.freeze([ROLES.COUNTRY_MANAGER, ROLES.QUALITY_MANAGER, ROLES.AGENT]),
    canApprove: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER, ROLES.QUALITY_MANAGER]),
    canView: Object.freeze([
      ROLES.GLOBAL_ADMIN,
      ROLES.OPERATIONS_MANAGER,
      ROLES.QUALITY_MANAGER,
      ROLES.COUNTRY_MANAGER,
      ROLES.AGENT,
      ROLES.AUDITOR,
    ]),
  }),

  INVENTORY: Object.freeze({
    primaryRole: ROLES.LOGISTICS_MANAGER,
    secondaryRoles: Object.freeze([ROLES.OPERATIONS_MANAGER, ROLES.PROCUREMENT_MANAGER]),
    canApprove: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.LOGISTICS_MANAGER, ROLES.OPERATIONS_MANAGER]),
    canView: Object.freeze([
      ROLES.GLOBAL_ADMIN,
      ROLES.LOGISTICS_MANAGER,
      ROLES.OPERATIONS_MANAGER,
      ROLES.PROCUREMENT_MANAGER,
      ROLES.COUNTRY_MANAGER,
      ROLES.AGENT,
      ROLES.AUDITOR,
    ]),
  }),

  LIVESTOCK: Object.freeze({
    primaryRole: ROLES.OPERATIONS_MANAGER,
    secondaryRoles: Object.freeze([ROLES.QUALITY_MANAGER, ROLES.COUNTRY_MANAGER, ROLES.AGENT]),
    canApprove: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER, ROLES.QUALITY_MANAGER]),
    canView: Object.freeze([
      ROLES.GLOBAL_ADMIN,
      ROLES.OPERATIONS_MANAGER,
      ROLES.QUALITY_MANAGER,
      ROLES.COUNTRY_MANAGER,
      ROLES.AGENT,
      ROLES.AUDITOR,
    ]),
  }),

  TRANSPORT: Object.freeze({
    primaryRole: ROLES.LOGISTICS_MANAGER,
    secondaryRoles: Object.freeze([ROLES.OPERATIONS_MANAGER, ROLES.AGENT]),
    canApprove: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.LOGISTICS_MANAGER, ROLES.OPERATIONS_MANAGER]),
    canView: Object.freeze([
      ROLES.GLOBAL_ADMIN,
      ROLES.LOGISTICS_MANAGER,
      ROLES.OPERATIONS_MANAGER,
      ROLES.COUNTRY_MANAGER,
      ROLES.AGENT,
      ROLES.AUDITOR,
    ]),
  }),

  DOCUMENTATION: Object.freeze({
    primaryRole: ROLES.OPERATIONS_MANAGER,
    secondaryRoles: Object.freeze([ROLES.COUNTRY_MANAGER, ROLES.AGENT, ROLES.AUDITOR]),
    canApprove: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER, ROLES.COUNTRY_MANAGER]),
    canView: Object.freeze([
      ROLES.GLOBAL_ADMIN,
      ROLES.OPERATIONS_MANAGER,
      ROLES.COUNTRY_MANAGER,
      ROLES.AGENT,
      ROLES.AUDITOR,
      ROLES.QUALITY_MANAGER,
    ]),
  }),
});

// ---------------------------------------------------------------------------
// ROLE_PERMISSIONS
// Maps each role to: canCreate[], canAssign[], canApprove[], canAudit (boolean)
// ---------------------------------------------------------------------------
export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.GLOBAL_ADMIN]: Object.freeze({
    canCreate: Object.freeze(Object.values({
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
    })),
    canAssign: Object.freeze(Object.values(ROLES)),
    canApprove: Object.freeze(Object.values({
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
    })),
    canAudit: true,
  }),

  [ROLES.OPERATIONS_MANAGER]: Object.freeze({
    canCreate: Object.freeze([
      'COMMERCIAL', 'LOGISTICS', 'PRODUCTION', 'TRANSPORT',
      'DOCUMENTATION', 'QUALITY', 'PROCUREMENT', 'INVENTORY', 'LIVESTOCK',
    ]),
    canAssign: Object.freeze([
      ROLES.AGENT, ROLES.COUNTRY_MANAGER, ROLES.QUALITY_MANAGER,
      ROLES.LOGISTICS_MANAGER, ROLES.PROCUREMENT_MANAGER,
    ]),
    canApprove: Object.freeze([
      'COMMERCIAL', 'LOGISTICS', 'PRODUCTION', 'TRANSPORT',
      'DOCUMENTATION', 'QUALITY', 'PROCUREMENT', 'INVENTORY', 'LIVESTOCK',
    ]),
    canAudit: false,
  }),

  [ROLES.COUNTRY_MANAGER]: Object.freeze({
    canCreate: Object.freeze(['COMMERCIAL', 'LOGISTICS', 'DOCUMENTATION', 'TRANSPORT']),
    canAssign: Object.freeze([ROLES.AGENT]),
    canApprove: Object.freeze(['COMMERCIAL', 'DOCUMENTATION']),
    canAudit: false,
  }),

  [ROLES.QUALITY_MANAGER]: Object.freeze({
    canCreate: Object.freeze(['QUALITY', 'COMPLIANCE', 'PRODUCTION', 'LIVESTOCK']),
    canAssign: Object.freeze([ROLES.AGENT]),
    canApprove: Object.freeze(['QUALITY', 'COMPLIANCE', 'PRODUCTION', 'LIVESTOCK']),
    canAudit: false,
  }),

  [ROLES.AUDITOR]: Object.freeze({
    canCreate: Object.freeze(['AUDIT', 'COMPLIANCE']),
    canAssign: Object.freeze([]),
    canApprove: Object.freeze(['AUDIT', 'COMPLIANCE']),
    canAudit: true,
  }),

  [ROLES.FINANCE_MANAGER]: Object.freeze({
    canCreate: Object.freeze(['FINANCIAL', 'PROCUREMENT']),
    canAssign: Object.freeze([ROLES.AGENT]),
    canApprove: Object.freeze(['FINANCIAL', 'PROCUREMENT']),
    canAudit: false,
  }),

  [ROLES.PROCUREMENT_MANAGER]: Object.freeze({
    canCreate: Object.freeze(['PROCUREMENT', 'LOGISTICS', 'INVENTORY']),
    canAssign: Object.freeze([ROLES.AGENT]),
    canApprove: Object.freeze(['PROCUREMENT', 'INVENTORY']),
    canAudit: false,
  }),

  [ROLES.LOGISTICS_MANAGER]: Object.freeze({
    canCreate: Object.freeze(['LOGISTICS', 'TRANSPORT', 'INVENTORY']),
    canAssign: Object.freeze([ROLES.AGENT]),
    canApprove: Object.freeze(['LOGISTICS', 'TRANSPORT', 'INVENTORY']),
    canAudit: false,
  }),

  [ROLES.AGENT]: Object.freeze({
    canCreate: Object.freeze([]),
    canAssign: Object.freeze([]),
    canApprove: Object.freeze([]),
    canAudit: false,
  }),
});

// ---------------------------------------------------------------------------
// validateRoleForCategory(role, category, permission)
// Returns true if the role has the specified permission for the given category.
// permission: 'primaryRole' | 'secondaryRoles' | 'canApprove' | 'canView'
// ---------------------------------------------------------------------------
export function validateRoleForCategory(role, category, permission) {
  const entry = CATEGORY_RESPONSIBILITY_MATRIX[category];
  if (!entry) return false;

  if (permission === 'primaryRole') {
    return entry.primaryRole === role;
  }

  const list = entry[permission];
  if (!Array.isArray(list)) return false;
  return list.includes(role);
}

// ---------------------------------------------------------------------------
// getResponsibleRoles(category)
// Returns { primary, secondary, approvers } for a given category.
// ---------------------------------------------------------------------------
export function getResponsibleRoles(category) {
  const entry = CATEGORY_RESPONSIBILITY_MATRIX[category];
  if (!entry) {
    throw new Error(`getResponsibleRoles: unknown category "${category}"`);
  }

  return Object.freeze({
    primary: entry.primaryRole,
    secondary: entry.secondaryRoles,
    approvers: entry.canApprove,
  });
}

// ---------------------------------------------------------------------------
// canActOnTask(task, actorRole, action)
// Central permission check.
// action: 'assign' | 'approve' | 'reject' | 'complete' | 'audit'
// ---------------------------------------------------------------------------
export function canActOnTask(task, actorRole, action) {
  if (!task || !actorRole || !action) return false;

  const rolePerms = ROLE_PERMISSIONS[actorRole];
  if (!rolePerms) return false;

  const categoryEntry = CATEGORY_RESPONSIBILITY_MATRIX[task.category];
  if (!categoryEntry) return false;

  switch (action) {
    case 'assign':
      // Must be able to assign at least one role AND be authorized for the category
      return (
        rolePerms.canAssign.length > 0 &&
        categoryEntry.canView.includes(actorRole)
      );

    case 'approve':
      return (
        categoryEntry.canApprove.includes(actorRole) &&
        rolePerms.canApprove.includes(task.category)
      );

    case 'reject':
      // Same authority as approve
      return (
        categoryEntry.canApprove.includes(actorRole) &&
        rolePerms.canApprove.includes(task.category)
      );

    case 'complete':
      // Completion requires approval authority or being the assigned role
      return (
        categoryEntry.canApprove.includes(actorRole) ||
        task.assignedRole === actorRole
      );

    case 'audit':
      return rolePerms.canAudit === true;

    default:
      return false;
  }
}
