/**
 * MarginGovernanceRegistry.js
 * Policy registry for margin field visibility governance.
 * FINANCIAL_INSTRUMENT_FOUNDATION_V1
 *
 * CRITICAL RULES enforced in code:
 *   - Internal margin NEVER exposed to clients
 *   - Margin NEVER included in PDF output
 *   - Margin separated from cost structure
 *
 * No actual margin values. No percentages. No pricing data.
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// MARGIN_VISIBILITY (frozen enum)
// ---------------------------------------------------------------------------
export const MARGIN_VISIBILITY = Object.freeze({
  INTERNAL_ONLY: 'INTERNAL_ONLY',
  MANAGEMENT_ONLY: 'MANAGEMENT_ONLY',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

// ---------------------------------------------------------------------------
// MARGIN_FIELD_POLICY (frozen object)
// Defines visibility policy for each financial field.
// ---------------------------------------------------------------------------
export const MARGIN_FIELD_POLICY = Object.freeze({
  grossMargin: Object.freeze({
    visibility: MARGIN_VISIBILITY.INTERNAL_ONLY,
    exposedInPDF: false,
    exposedToClient: false,
    exposedInExport: false,
  }),
  netMargin: Object.freeze({
    visibility: MARGIN_VISIBILITY.INTERNAL_ONLY,
    exposedInPDF: false,
    exposedToClient: false,
    exposedInExport: false,
  }),
  targetMargin: Object.freeze({
    visibility: MARGIN_VISIBILITY.MANAGEMENT_ONLY,
    exposedInPDF: false,
    exposedToClient: false,
    exposedInExport: false,
  }),
  costStructure: Object.freeze({
    visibility: MARGIN_VISIBILITY.INTERNAL_ONLY,
    exposedInPDF: false,
    exposedToClient: false,
    exposedInExport: false,
  }),
  commercialPrice: Object.freeze({
    visibility: MARGIN_VISIBILITY.NOT_APPLICABLE,
    exposedInPDF: true,
    exposedToClient: true,
    exposedInExport: true,
  }),
  shipmentValue: Object.freeze({
    visibility: MARGIN_VISIBILITY.NOT_APPLICABLE,
    exposedInPDF: true,
    exposedToClient: true,
    exposedInExport: true,
  }),
  contractValue: Object.freeze({
    visibility: MARGIN_VISIBILITY.NOT_APPLICABLE,
    exposedInPDF: true,
    exposedToClient: true,
    exposedInExport: true,
  }),
});

// ---------------------------------------------------------------------------
// assertMarginHidden(fieldName)
// Enforces that INTERNAL_ONLY and MANAGEMENT_ONLY fields are never exposed.
// If the field's visibility is INTERNAL_ONLY or MANAGEMENT_ONLY AND
// (exposedInPDF OR exposedToClient), throws an error.
// Otherwise returns true.
// ---------------------------------------------------------------------------
export function assertMarginHidden(fieldName) {
  const policy = MARGIN_FIELD_POLICY[fieldName];
  if (!policy) {
    // Unknown field — conservatively allow (not a margin field)
    return true;
  }

  const isRestricted =
    policy.visibility === MARGIN_VISIBILITY.INTERNAL_ONLY ||
    policy.visibility === MARGIN_VISIBILITY.MANAGEMENT_ONLY;

  if (isRestricted && (policy.exposedInPDF || policy.exposedToClient)) {
    throw new Error(
      `assertMarginHidden: field "${fieldName}" has visibility "${policy.visibility}" ` +
        `but is marked as exposed (exposedInPDF=${policy.exposedInPDF}, ` +
        `exposedToClient=${policy.exposedToClient}). ` +
        `Margin fields must never be exposed to clients or included in PDF output.`
    );
  }

  return true;
}

// ---------------------------------------------------------------------------
// isClientVisible(fieldName)
// Returns exposedToClient for the field, false if field not found.
// ---------------------------------------------------------------------------
export function isClientVisible(fieldName) {
  const policy = MARGIN_FIELD_POLICY[fieldName];
  if (!policy) return false;
  return policy.exposedToClient;
}

// ---------------------------------------------------------------------------
// isPDFSafe(fieldName)
// Returns exposedInPDF for the field, false if field not found.
// ---------------------------------------------------------------------------
export function isPDFSafe(fieldName) {
  const policy = MARGIN_FIELD_POLICY[fieldName];
  if (!policy) return false;
  return policy.exposedInPDF;
}
