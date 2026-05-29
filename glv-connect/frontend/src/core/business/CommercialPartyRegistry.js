/**
 * CommercialPartyRegistry.js
 * Commercial party lifecycle model.
 * GLV_BUSINESS_OPERATING_MODEL_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

import { ROLES } from '../tasks/TaskResponsibilityRegistry.js';

// ---------------------------------------------------------------------------
// PARTY_STATUS (frozen enum)
// ---------------------------------------------------------------------------
export const PARTY_STATUS = Object.freeze({
  PROSPECT: 'PROSPECT',
  QUALIFIED: 'QUALIFIED',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  ARCHIVED: 'ARCHIVED',
});

// ---------------------------------------------------------------------------
// PARTY_TYPES (frozen enum)
// ---------------------------------------------------------------------------
export const PARTY_TYPES = Object.freeze({
  BUYER: 'BUYER',
  SUPPLIER: 'SUPPLIER',
  BROKER: 'BROKER',
  FREIGHT_FORWARDER: 'FREIGHT_FORWARDER',
  INSPECTION_AGENT: 'INSPECTION_AGENT',
  BANK: 'BANK',
});

// ---------------------------------------------------------------------------
// PARTY_STATUS_TRANSITIONS (frozen)
// Format: { [fromStatus]: [{ to, allowedRoles }] }
// ---------------------------------------------------------------------------
export const PARTY_STATUS_TRANSITIONS = Object.freeze({
  [PARTY_STATUS.PROSPECT]: Object.freeze([
    Object.freeze({
      to: PARTY_STATUS.QUALIFIED,
      allowedRoles: Object.freeze([
        ROLES.OPERATIONS_MANAGER,
        ROLES.COUNTRY_MANAGER,
        ROLES.GLOBAL_ADMIN,
      ]),
    }),
  ]),

  [PARTY_STATUS.QUALIFIED]: Object.freeze([
    Object.freeze({
      to: PARTY_STATUS.APPROVED,
      allowedRoles: Object.freeze([ROLES.OPERATIONS_MANAGER, ROLES.GLOBAL_ADMIN]),
    }),
    Object.freeze({
      to: PARTY_STATUS.ARCHIVED,
      allowedRoles: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER]),
    }),
  ]),

  [PARTY_STATUS.APPROVED]: Object.freeze([
    Object.freeze({
      to: PARTY_STATUS.ACTIVE,
      allowedRoles: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER]),
    }),
  ]),

  [PARTY_STATUS.ACTIVE]: Object.freeze([
    Object.freeze({
      to: PARTY_STATUS.SUSPENDED,
      allowedRoles: Object.freeze([ROLES.GLOBAL_ADMIN, ROLES.OPERATIONS_MANAGER]),
    }),
    Object.freeze({
      to: PARTY_STATUS.ARCHIVED,
      allowedRoles: Object.freeze([ROLES.GLOBAL_ADMIN]),
    }),
  ]),

  [PARTY_STATUS.SUSPENDED]: Object.freeze([
    Object.freeze({
      to: PARTY_STATUS.ACTIVE,
      allowedRoles: Object.freeze([ROLES.GLOBAL_ADMIN]),
    }),
  ]),

  [PARTY_STATUS.ARCHIVED]: Object.freeze([]), // Terminal state
});

// ---------------------------------------------------------------------------
// canTransitionParty(currentStatus, newStatus, actorRole)
// Returns true if the transition is legal for the given role.
// ---------------------------------------------------------------------------
export function canTransitionParty(currentStatus, newStatus, actorRole) {
  const transitions = PARTY_STATUS_TRANSITIONS[currentStatus];
  if (!Array.isArray(transitions)) return false;

  const match = transitions.find((t) => t.to === newStatus);
  if (!match) return false;

  return match.allowedRoles.includes(actorRole);
}

// ---------------------------------------------------------------------------
// createPartyRecord(fields)
// Validates required fields, applies defaults, returns frozen party object.
// ---------------------------------------------------------------------------
export function createPartyRecord(fields = {}) {
  const now = new Date().toISOString();

  const REQUIRED_FIELDS = [
    'partyId',
    'name',
    'type',
    'country',
    'legalEntityRef',
    'createdBy',
  ];

  for (const field of REQUIRED_FIELDS) {
    if (!fields[field] && fields[field] !== 0) {
      throw new Error(`createPartyRecord: missing required field "${field}"`);
    }
  }

  const party = {
    status: PARTY_STATUS.PROSPECT,
    createdAt: now,
    updatedAt: now,
    ...fields,
    // Stamps always set by engine
    updatedAt: now,
  };

  const validationError = validatePartyRecord(party);
  if (validationError) {
    throw new Error(`createPartyRecord validation failed: ${validationError}`);
  }

  return Object.freeze(party);
}

// ---------------------------------------------------------------------------
// validatePartyRecord(party)
// Returns error string or null.
// ---------------------------------------------------------------------------
export function validatePartyRecord(party) {
  if (!party || typeof party !== 'object') {
    return 'Party must be a non-null object';
  }

  const REQUIRED_FIELDS = [
    'partyId',
    'name',
    'type',
    'country',
    'legalEntityRef',
    'createdBy',
  ];

  for (const field of REQUIRED_FIELDS) {
    if (party[field] === undefined || party[field] === null || party[field] === '') {
      return `Missing or empty required field: ${field}`;
    }
  }

  if (!Object.values(PARTY_TYPES).includes(party.type)) {
    return `Invalid type value: "${party.type}". Must be one of: ${Object.values(PARTY_TYPES).join(', ')}`;
  }

  if (!Object.values(PARTY_STATUS).includes(party.status)) {
    return `Invalid status value: "${party.status}". Must be one of: ${Object.values(PARTY_STATUS).join(', ')}`;
  }

  if (typeof party.legalEntityRef !== 'string' || !party.legalEntityRef.trim()) {
    return 'legalEntityRef must be a non-empty string';
  }

  return null;
}
