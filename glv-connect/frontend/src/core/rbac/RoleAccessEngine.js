/**
 * RoleAccessEngine.js — GLV GOS Enterprise RBAC Foundation V1.0
 *
 * Role-Based Access Control engine for the GLV Global Operating System.
 * Defines roles, permissions per module, per country, and per action.
 *
 * STATUS: FOUNDATION — role registry and permission schema defined.
 * Dynamic permission evaluation to be integrated with API auth layer.
 */

// ─── Role definitions ──────────────────────────────────────────────────────────

export const ROLES = Object.freeze({

  GLOBAL_ADMIN: {
    id:          "GLOBAL_ADMIN",
    label:       "Global Administrator",
    level:       10,
    description: "Full access to all domains, countries, and modules",
    domains:     ["*"],
    countries:   ["*"],
  },

  COUNTRY_DIRECTOR: {
    id:          "COUNTRY_DIRECTOR",
    label:       "Country Director",
    level:       9,
    description: "Full access within assigned country. Manages regional operations.",
    domains:     ["COMMERCIAL", "OPERATIONS", "FINANCIAL", "HR", "COMPLIANCE", "MEDIA"],
    countries:   [], // populated per user assignment
  },

  OPERATIONS_MANAGER: {
    id:          "OPERATIONS_MANAGER",
    label:       "Operations Manager",
    level:       7,
    description: "Manages shipments, inspections, port operations for assigned country",
    domains:     ["OPERATIONS", "COMMERCIAL"],
    countries:   [],
  },

  COMPLIANCE_OFFICER: {
    id:          "COMPLIANCE_OFFICER",
    label:       "Compliance Officer",
    level:       7,
    description: "Full access to Compliance domain, read-only on all others",
    domains:     ["COMPLIANCE"],
    readOnlyDomains: ["COMMERCIAL", "OPERATIONS", "FINANCIAL"],
    countries:   ["*"],
  },

  AUDITOR: {
    id:          "AUDITOR",
    label:       "Auditor",
    level:       7,
    description: "Read-only access to all audit trails, documents, and financial records",
    domains:     [],
    readOnlyDomains: ["*"],
    countries:   ["*"],
  },

  COMMERCIAL_MANAGER: {
    id:          "COMMERCIAL_MANAGER",
    label:       "Commercial Manager",
    level:       6,
    description: "Creates and manages SCO/FCO/SPA, pricing, and commercial operations",
    domains:     ["COMMERCIAL", "MEDIA"],
    countries:   [],
  },

  VETERINARY_INSPECTOR: {
    id:          "VETERINARY_INSPECTOR",
    label:       "Veterinary Inspector",
    level:       5,
    description: "Manages veterinary and sanitary compliance for livestock operations",
    domains:     ["OPERATIONS"],
    modules:     ["VETERINARY", "INSPECTIONS", "SHIPMENTS"],
    countries:   [],
  },

  TREASURY: {
    id:          "TREASURY",
    label:       "Treasury",
    level:       6,
    description: "Manages banking, treasury, and bank export operations",
    domains:     ["FINANCIAL"],
    modules:     ["BANKING", "TREASURY", "RECONCILIATION"],
    countries:   [],
  },

  ACCOUNTING: {
    id:          "ACCOUNTING",
    label:       "Accounting",
    level:       5,
    description: "Manages invoicing, accounting integrations, and reconciliation",
    domains:     ["FINANCIAL"],
    modules:     ["INVOICES", "RECONCILIATION", "ACCOUNTING"],
    countries:   [],
  },

  LOGISTICS: {
    id:          "LOGISTICS",
    label:       "Logistics",
    level:       4,
    description: "Manages shipments, loading, and port operations",
    domains:     ["OPERATIONS"],
    modules:     ["SHIPMENTS", "LOADING", "PORTS"],
    countries:   [],
  },

  HR_MANAGER: {
    id:          "HR_MANAGER",
    label:       "HR Manager",
    level:       5,
    description: "Manages employees, payroll, attendance, and approvals",
    domains:     ["HR"],
    countries:   [],
  },

  AGENTE: {
    id:          "AGENTE",
    label:       "Commercial Agent",
    level:       3,
    description: "Creates SCO documents and manages own commercial portfolio",
    domains:     ["COMMERCIAL"],
    modules:     ["SCO", "PRICING"],
    countries:   [],
  },

});

// ─── Permission actions ────────────────────────────────────────────────────────

export const PERMISSIONS = Object.freeze({
  CREATE:   "CREATE",
  READ:     "READ",
  UPDATE:   "UPDATE",
  DELETE:   "DELETE",
  APPROVE:  "APPROVE",
  EXPORT:   "EXPORT",
  SIGN:     "SIGN",
  AUDIT:    "AUDIT",
  ADMIN:    "ADMIN",
});

// ─── Permission matrix (role → module → allowed actions) ─────────────────────
// Foundation: define the policy structure. Enforcement implemented per module.

export const PERMISSION_MATRIX = Object.freeze({

  SCO: {
    GLOBAL_ADMIN:       [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.DELETE, PERMISSIONS.APPROVE, PERMISSIONS.EXPORT],
    COUNTRY_DIRECTOR:   [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.DELETE, PERMISSIONS.APPROVE, PERMISSIONS.EXPORT],
    COMMERCIAL_MANAGER: [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.EXPORT],
    AGENTE:             [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.EXPORT],
    AUDITOR:            [PERMISSIONS.READ, PERMISSIONS.AUDIT],
    ACCOUNTING:         [PERMISSIONS.READ],
  },

  FCO: {
    GLOBAL_ADMIN:       [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.DELETE, PERMISSIONS.APPROVE, PERMISSIONS.SIGN, PERMISSIONS.EXPORT],
    COUNTRY_DIRECTOR:   [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.APPROVE, PERMISSIONS.SIGN, PERMISSIONS.EXPORT],
    COMMERCIAL_MANAGER: [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.EXPORT],
    AUDITOR:            [PERMISSIONS.READ, PERMISSIONS.AUDIT],
  },

  SPA: {
    GLOBAL_ADMIN:       [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.APPROVE, PERMISSIONS.SIGN],
    COUNTRY_DIRECTOR:   [PERMISSIONS.READ, PERMISSIONS.APPROVE, PERMISSIONS.SIGN],
    AUDITOR:            [PERMISSIONS.READ, PERMISSIONS.AUDIT],
  },

  PRICING: {
    GLOBAL_ADMIN:       [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.DELETE],
    COUNTRY_DIRECTOR:   [PERMISSIONS.READ, PERMISSIONS.UPDATE],
    COMMERCIAL_MANAGER: [PERMISSIONS.READ],
    AGENTE:             [PERMISSIONS.READ],
  },

  BANKING: {
    GLOBAL_ADMIN:       [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.EXPORT, PERMISSIONS.APPROVE],
    COUNTRY_DIRECTOR:   [PERMISSIONS.READ, PERMISSIONS.APPROVE],
    TREASURY:           [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.EXPORT],
    ACCOUNTING:         [PERMISSIONS.READ],
    AUDITOR:            [PERMISSIONS.READ, PERMISSIONS.AUDIT],
  },

  AUDIT_TRAIL: {
    GLOBAL_ADMIN:       [PERMISSIONS.READ, PERMISSIONS.EXPORT, PERMISSIONS.ADMIN],
    COUNTRY_DIRECTOR:   [PERMISSIONS.READ],
    COMPLIANCE_OFFICER: [PERMISSIONS.READ, PERMISSIONS.EXPORT],
    AUDITOR:            [PERMISSIONS.READ, PERMISSIONS.EXPORT, PERMISSIONS.AUDIT],
  },

});

// ─── Permission evaluation ─────────────────────────────────────────────────────

/**
 * Check if a user role has a given permission on a module.
 * @param {string} role       — user role ID
 * @param {string} module     — module ID (e.g. "SCO", "BANKING")
 * @param {string} permission — one of PERMISSIONS values
 * @returns {boolean}
 */
export function hasPermission(role, module, permission) {
  if (!role || !module || !permission) return false;

  // GLOBAL_ADMIN always has all permissions
  if (role === "GLOBAL_ADMIN" || role === "SUPER_ADMIN") return true;

  const moduleMatrix = PERMISSION_MATRIX[module];
  if (!moduleMatrix) return false;

  const allowed = moduleMatrix[role];
  if (!allowed) return false;

  return allowed.includes(permission);
}

/**
 * Get all permissions a role has on a module.
 */
export function getRolePermissions(role, module) {
  if (role === "GLOBAL_ADMIN" || role === "SUPER_ADMIN") {
    return Object.values(PERMISSIONS);
  }
  return PERMISSION_MATRIX[module]?.[role] || [];
}

/**
 * Map legacy app roles to new RBAC role IDs.
 * Backward-compatible bridge for existing user.role values.
 */
export const LEGACY_ROLE_MAP = Object.freeze({
  SUPER_ADMIN:        "GLOBAL_ADMIN",
  CORPORATE_ADMIN:    "GLOBAL_ADMIN",
  DIRECTOR:           "COUNTRY_DIRECTOR",
  DIRECTIVO:          "COUNTRY_DIRECTOR",
  CFO:                "COUNTRY_DIRECTOR",
  COMMERCIAL_DIRECTOR:"COMMERCIAL_MANAGER",
  COMPLIANCE:         "COMPLIANCE_OFFICER",
  ACCOUNTING:         "ACCOUNTING",
  TREASURY:           "TREASURY",
  AUDIT:              "AUDITOR",
  TAX_REVIEWER:       "AUDITOR",
  COUNTRY_ACCOUNTANT: "ACCOUNTING",
  LOGISTICS:          "LOGISTICS",
  AGENTE:             "AGENTE",
  CLIENT:             "AGENTE",
  SUPPLIER:           "AGENTE",
});

export function resolveRbacRole(legacyRole) {
  return LEGACY_ROLE_MAP[legacyRole] || "AGENTE";
}
