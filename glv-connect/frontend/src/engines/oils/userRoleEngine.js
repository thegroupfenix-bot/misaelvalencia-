/**
 * userRoleEngine.js — V8.1 Role-Aware Financial Visibility Guard
 * Isolated. Controls which UI blocks are visible based on user role.
 *
 * ADMIN-ONLY BLOCKS — never visible to agents, brokers, distributors, or external users:
 *   Export Margin %, Commission %, Agent Reserve %, Intermediary Reserve %
 *   Profit Simulation, Gross Profit, Net Profit, Margin %, Freight Ratio,
 *   Packaging Ratio, Reserve Ratio, Total Reserves, Profit per Container,
 *   Internal Profit Targets
 */

// ─── Role definitions ─────────────────────────────────────────────────────────

export const ROLES = {
  SUPER_ADMIN:     "SUPER_ADMIN",
  ADMIN:           "ADMIN",
  FINANCE_MANAGER: "FINANCE_MANAGER",
  MANAGER:         "MANAGER",
  AGENT:           "AGENT",
  DISTRIBUTOR:     "DISTRIBUTOR",
  BROKER:          "BROKER",
  EXTERNAL:        "EXTERNAL",
};

export const ROLE_LABELS = {
  SUPER_ADMIN:     "Super Administrator",
  ADMIN:           "Administrator",
  FINANCE_MANAGER: "Finance Manager",
  MANAGER:         "Manager",
  AGENT:           "Sales Agent",
  DISTRIBUTOR:     "Distributor",
  BROKER:          "Broker",
  EXTERNAL:        "External User",
};

// Roles that may access internal financial data
const FINANCIAL_ROLES = new Set([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.FINANCE_MANAGER,
]);

// ─── Permission guards ────────────────────────────────────────────────────────

/**
 * Returns true if the given role may view internal financial blocks:
 * profit simulation, margin %, reserves, freight ratio, packaging ratio,
 * agent/commission/intermediary reserves, net profit per container.
 *
 * Returns false for: AGENT, DISTRIBUTOR, BROKER, EXTERNAL, MANAGER, and any unknown role.
 * Unknown roles default to DENIED — fail secure.
 *
 * @param {string} role
 * @returns {boolean}
 */
export function canViewInternalFinancials(role) {
  return FINANCIAL_ROLES.has(role);
}

/**
 * Returns true if role may edit price matrices and reserve percentages.
 */
export function canEditPriceMatrix(role) {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN;
}

/**
 * Returns true if role may export or generate SCO/FCO documents.
 */
export function canGenerateSCO(role) {
  return role !== ROLES.EXTERNAL;
}

/**
 * Safe role normalizer — returns EXTERNAL if role is unknown/missing.
 */
export function normalizeRole(role) {
  return Object.values(ROLES).includes(role) ? role : ROLES.EXTERNAL;
}

/**
 * Returns a short display label for a role.
 */
export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || "Unknown";
}
