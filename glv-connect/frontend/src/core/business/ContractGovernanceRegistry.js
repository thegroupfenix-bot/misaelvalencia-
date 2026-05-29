/**
 * ContractGovernanceRegistry.js
 * Document type registry and contract lifecycle governance.
 * GLV_BUSINESS_OPERATING_MODEL_FOUNDATION_V1
 *
 * CRITICAL RULE: Agents can NEVER generate contracts.
 * This is enforced as a hard guard in assertContractOriginRules and canAgentGenerate.
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 * NOTE: Role strings used here (LEGAL_OFFICER, COMPLIANCE_OFFICER) do not yet
 * exist in TaskResponsibilityRegistry.js — they are defined as string literals
 * to avoid a circular/forward dependency and will be unified when
 * RoleExtensionRegistry.js is consumed by the contract layer.
 */

// ---------------------------------------------------------------------------
// CONTRACT_DOCUMENT_TYPES (frozen enum)
// ---------------------------------------------------------------------------
export const CONTRACT_DOCUMENT_TYPES = Object.freeze({
  SCO: 'SCO',
  ICPO: 'ICPO',
  LOI: 'LOI',
  FCO: 'FCO',
  SPA: 'SPA',
  LAWYER_REVIEW: 'LAWYER_REVIEW',
  EXECUTED_CONTRACT: 'EXECUTED_CONTRACT',
});

// ---------------------------------------------------------------------------
// DOCUMENT_ORIGIN_RULES (frozen)
// Maps each document type to its generation and approval requirements.
// ---------------------------------------------------------------------------
export const DOCUMENT_ORIGIN_RULES = Object.freeze({
  [CONTRACT_DOCUMENT_TYPES.SCO]: Object.freeze({
    requiresCommercialApproval: false,
    requiresLegalReview: false,
    agentCanGenerate: true,
  }),
  [CONTRACT_DOCUMENT_TYPES.ICPO]: Object.freeze({
    requiresCommercialApproval: false,
    requiresLegalReview: false,
    agentCanGenerate: true,
  }),
  [CONTRACT_DOCUMENT_TYPES.LOI]: Object.freeze({
    requiresCommercialApproval: true,
    requiresLegalReview: false,
    agentCanGenerate: false,
  }),
  [CONTRACT_DOCUMENT_TYPES.FCO]: Object.freeze({
    requiresCommercialApproval: true,
    requiresLegalReview: false,
    agentCanGenerate: false,
  }),
  [CONTRACT_DOCUMENT_TYPES.SPA]: Object.freeze({
    requiresCommercialApproval: true,
    requiresLegalReview: true,
    agentCanGenerate: false,
  }),
  [CONTRACT_DOCUMENT_TYPES.LAWYER_REVIEW]: Object.freeze({
    requiresCommercialApproval: true,
    requiresLegalReview: true,
    agentCanGenerate: false,
  }),
  [CONTRACT_DOCUMENT_TYPES.EXECUTED_CONTRACT]: Object.freeze({
    requiresCommercialApproval: true,
    requiresLegalReview: true,
    agentCanGenerate: false,
  }),
});

// ---------------------------------------------------------------------------
// CONTRACT_STATUS (frozen enum)
// ---------------------------------------------------------------------------
export const CONTRACT_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  EXECUTED: 'EXECUTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

// ---------------------------------------------------------------------------
// CONTRACT_LIFECYCLE_TRANSITIONS (frozen)
// Maps each from-status to an array of { to, allowedRoles }.
// Role strings are used directly here; LEGAL_OFFICER and COMPLIANCE_OFFICER
// are defined in RoleExtensionRegistry.js, not yet in TaskResponsibilityRegistry.js.
// ---------------------------------------------------------------------------
export const CONTRACT_LIFECYCLE_TRANSITIONS = Object.freeze({
  [CONTRACT_STATUS.DRAFT]: Object.freeze([
    Object.freeze({
      to: CONTRACT_STATUS.UNDER_REVIEW,
      allowedRoles: Object.freeze(['LEGAL_OFFICER', 'GLOBAL_ADMIN', 'OPERATIONS_MANAGER']),
    }),
    Object.freeze({
      to: CONTRACT_STATUS.CANCELLED,
      allowedRoles: Object.freeze(['GLOBAL_ADMIN', 'OPERATIONS_MANAGER']),
    }),
  ]),

  [CONTRACT_STATUS.UNDER_REVIEW]: Object.freeze([
    Object.freeze({
      to: CONTRACT_STATUS.APPROVED,
      allowedRoles: Object.freeze(['LEGAL_OFFICER', 'GLOBAL_ADMIN']),
    }),
    Object.freeze({
      to: CONTRACT_STATUS.DRAFT,
      allowedRoles: Object.freeze(['LEGAL_OFFICER', 'GLOBAL_ADMIN', 'OPERATIONS_MANAGER']),
    }),
    Object.freeze({
      to: CONTRACT_STATUS.CANCELLED,
      allowedRoles: Object.freeze(['GLOBAL_ADMIN']),
    }),
  ]),

  [CONTRACT_STATUS.APPROVED]: Object.freeze([
    Object.freeze({
      to: CONTRACT_STATUS.EXECUTED,
      allowedRoles: Object.freeze(['GLOBAL_ADMIN']),
    }),
    Object.freeze({
      to: CONTRACT_STATUS.UNDER_REVIEW,
      allowedRoles: Object.freeze(['LEGAL_OFFICER', 'GLOBAL_ADMIN']),
    }),
  ]),

  [CONTRACT_STATUS.EXECUTED]: Object.freeze([
    Object.freeze({
      to: CONTRACT_STATUS.EXPIRED,
      allowedRoles: Object.freeze(['GLOBAL_ADMIN', 'COMPLIANCE_OFFICER']),
    }),
  ]),

  [CONTRACT_STATUS.EXPIRED]: Object.freeze([]), // Terminal state

  [CONTRACT_STATUS.CANCELLED]: Object.freeze([]), // Terminal state
});

// ---------------------------------------------------------------------------
// canAgentGenerate(documentType)
// Returns boolean — reads from DOCUMENT_ORIGIN_RULES.
// ---------------------------------------------------------------------------
export function canAgentGenerate(documentType) {
  const rules = DOCUMENT_ORIGIN_RULES[documentType];
  if (!rules) return false;
  return rules.agentCanGenerate === true;
}

// ---------------------------------------------------------------------------
// assertContractOriginRules(documentType, hasCommercialApproval, hasLegalReview)
// Throws if rules are not met. Returns true if all rules pass.
// ---------------------------------------------------------------------------
export function assertContractOriginRules(documentType, hasCommercialApproval, hasLegalReview) {
  const rules = DOCUMENT_ORIGIN_RULES[documentType];

  if (!rules) {
    throw new Error(
      `assertContractOriginRules: unknown document type "${documentType}". ` +
        `Valid types: ${Object.values(CONTRACT_DOCUMENT_TYPES).join(', ')}`
    );
  }

  if (rules.requiresCommercialApproval && !hasCommercialApproval) {
    throw new Error(
      `assertContractOriginRules: document type "${documentType}" requires commercial approval ` +
        `but hasCommercialApproval is false`
    );
  }

  if (rules.requiresLegalReview && !hasLegalReview) {
    throw new Error(
      `assertContractOriginRules: document type "${documentType}" requires legal review ` +
        `but hasLegalReview is false`
    );
  }

  return true;
}
