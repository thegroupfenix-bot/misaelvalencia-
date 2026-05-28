/**
 * EnterpriseRoleFlowEngine.js — GLV GOS Core RBAC — Enterprise Role Flow V1.0
 *
 * Defines operational permissions by workflow stage.
 * Maps roles to allowed actions per workflow state.
 *
 * STATUS: ACTIVE — role-workflow matrix.
 * Extends RoleAccessEngine with per-stage operational action control.
 */

import { WORKFLOW_STATES } from "../workflows/WorkflowStateEngine.js";

// ─── Action constants ────────────────────────────────────────────────────────────

export const ROLE_ACTIONS = Object.freeze({
  // Commercial
  CREATE_SCO:           "CREATE_SCO",
  EDIT_DRAFT:           "EDIT_DRAFT",
  SUBMIT_FOR_APPROVAL:  "SUBMIT_FOR_APPROVAL",
  SEND_QUOTE:           "SEND_QUOTE",
  GENERATE_PDF:         "GENERATE_PDF",

  // Financial
  APPROVE_PAYMENT:      "APPROVE_PAYMENT",
  ASSIGN_INVOICE_ENTITY:"ASSIGN_INVOICE_ENTITY",
  ISSUE_INVOICE:        "ISSUE_INVOICE",
  CONFIRM_BANK_TRANSFER:"CONFIRM_BANK_TRANSFER",
  VIEW_FINANCIALS:      "VIEW_FINANCIALS",

  // Operations
  APPROVE_PRODUCTION:   "APPROVE_PRODUCTION",
  ASSIGN_SHIPMENT:      "ASSIGN_SHIPMENT",
  CONFIRM_LOADING:      "CONFIRM_LOADING",
  UPLOAD_INSPECTION:    "UPLOAD_INSPECTION",
  MANAGE_LOGISTICS:     "MANAGE_LOGISTICS",

  // Audit & Compliance
  APPROVE_COMPLIANCE:   "APPROVE_COMPLIANCE",
  FREEZE_OPERATION:     "FREEZE_OPERATION",
  VIEW_AUDIT_TRAIL:     "VIEW_AUDIT_TRAIL",
  ISSUE_CERTIFICATE:    "ISSUE_CERTIFICATE",

  // Client-facing
  VIEW_DOCUMENTS:       "VIEW_DOCUMENTS",
  VIEW_SHIPMENT:        "VIEW_SHIPMENT",
  DOWNLOAD_PDF:         "DOWNLOAD_PDF",

  // Admin
  MANAGE_USERS:         "MANAGE_USERS",
  CLOSE_OPERATION:      "CLOSE_OPERATION",
  ASSIGN_ENTITY:        "ASSIGN_ENTITY",
});

// ─── Role → actions map ─────────────────────────────────────────────────────────
// Each role lists the actions it is ALWAYS permitted to perform (state-independent).

const BASE_ROLE_ACTIONS = Object.freeze({

  GLOBAL_ADMIN: Object.values(ROLE_ACTIONS),

  COUNTRY_DIRECTOR: [
    ROLE_ACTIONS.CREATE_SCO,
    ROLE_ACTIONS.EDIT_DRAFT,
    ROLE_ACTIONS.SUBMIT_FOR_APPROVAL,
    ROLE_ACTIONS.SEND_QUOTE,
    ROLE_ACTIONS.GENERATE_PDF,
    ROLE_ACTIONS.APPROVE_PAYMENT,
    ROLE_ACTIONS.ASSIGN_INVOICE_ENTITY,
    ROLE_ACTIONS.ISSUE_INVOICE,
    ROLE_ACTIONS.APPROVE_PRODUCTION,
    ROLE_ACTIONS.ASSIGN_SHIPMENT,
    ROLE_ACTIONS.APPROVE_COMPLIANCE,
    ROLE_ACTIONS.VIEW_AUDIT_TRAIL,
    ROLE_ACTIONS.VIEW_DOCUMENTS,
    ROLE_ACTIONS.VIEW_SHIPMENT,
    ROLE_ACTIONS.DOWNLOAD_PDF,
    ROLE_ACTIONS.CLOSE_OPERATION,
    ROLE_ACTIONS.ASSIGN_ENTITY,
  ],

  OPERATIONS_MANAGER: [
    ROLE_ACTIONS.APPROVE_PRODUCTION,
    ROLE_ACTIONS.ASSIGN_SHIPMENT,
    ROLE_ACTIONS.CONFIRM_LOADING,
    ROLE_ACTIONS.UPLOAD_INSPECTION,
    ROLE_ACTIONS.MANAGE_LOGISTICS,
    ROLE_ACTIONS.VIEW_DOCUMENTS,
    ROLE_ACTIONS.VIEW_SHIPMENT,
    ROLE_ACTIONS.GENERATE_PDF,
    ROLE_ACTIONS.DOWNLOAD_PDF,
    ROLE_ACTIONS.VIEW_AUDIT_TRAIL,
  ],

  COMPLIANCE_OFFICER: [
    ROLE_ACTIONS.APPROVE_COMPLIANCE,
    ROLE_ACTIONS.FREEZE_OPERATION,
    ROLE_ACTIONS.VIEW_AUDIT_TRAIL,
    ROLE_ACTIONS.ISSUE_CERTIFICATE,
    ROLE_ACTIONS.VIEW_DOCUMENTS,
    ROLE_ACTIONS.DOWNLOAD_PDF,
    ROLE_ACTIONS.UPLOAD_INSPECTION,
  ],

  AUDITOR: [
    ROLE_ACTIONS.VIEW_AUDIT_TRAIL,
    ROLE_ACTIONS.VIEW_DOCUMENTS,
    ROLE_ACTIONS.FREEZE_OPERATION,
    ROLE_ACTIONS.APPROVE_COMPLIANCE,
    ROLE_ACTIONS.DOWNLOAD_PDF,
  ],

  COMMERCIAL_MANAGER: [
    ROLE_ACTIONS.CREATE_SCO,
    ROLE_ACTIONS.EDIT_DRAFT,
    ROLE_ACTIONS.SUBMIT_FOR_APPROVAL,
    ROLE_ACTIONS.SEND_QUOTE,
    ROLE_ACTIONS.GENERATE_PDF,
    ROLE_ACTIONS.VIEW_DOCUMENTS,
    ROLE_ACTIONS.VIEW_SHIPMENT,
    ROLE_ACTIONS.DOWNLOAD_PDF,
    ROLE_ACTIONS.ASSIGN_ENTITY,
  ],

  VETERINARY_INSPECTOR: [
    ROLE_ACTIONS.UPLOAD_INSPECTION,
    ROLE_ACTIONS.ISSUE_CERTIFICATE,
    ROLE_ACTIONS.VIEW_DOCUMENTS,
    ROLE_ACTIONS.VIEW_SHIPMENT,
    ROLE_ACTIONS.DOWNLOAD_PDF,
  ],

  TREASURY: [
    ROLE_ACTIONS.APPROVE_PAYMENT,
    ROLE_ACTIONS.ASSIGN_INVOICE_ENTITY,
    ROLE_ACTIONS.CONFIRM_BANK_TRANSFER,
    ROLE_ACTIONS.VIEW_FINANCIALS,
    ROLE_ACTIONS.VIEW_DOCUMENTS,
    ROLE_ACTIONS.DOWNLOAD_PDF,
    ROLE_ACTIONS.VIEW_AUDIT_TRAIL,
  ],

  ACCOUNTING: [
    ROLE_ACTIONS.ISSUE_INVOICE,
    ROLE_ACTIONS.VIEW_FINANCIALS,
    ROLE_ACTIONS.VIEW_DOCUMENTS,
    ROLE_ACTIONS.DOWNLOAD_PDF,
    ROLE_ACTIONS.VIEW_AUDIT_TRAIL,
  ],

  LOGISTICS: [
    ROLE_ACTIONS.ASSIGN_SHIPMENT,
    ROLE_ACTIONS.CONFIRM_LOADING,
    ROLE_ACTIONS.MANAGE_LOGISTICS,
    ROLE_ACTIONS.VIEW_DOCUMENTS,
    ROLE_ACTIONS.VIEW_SHIPMENT,
    ROLE_ACTIONS.DOWNLOAD_PDF,
  ],

  HR_MANAGER: [
    ROLE_ACTIONS.MANAGE_USERS,
    ROLE_ACTIONS.VIEW_AUDIT_TRAIL,
  ],

  AGENTE: [
    ROLE_ACTIONS.CREATE_SCO,
    ROLE_ACTIONS.EDIT_DRAFT,
    ROLE_ACTIONS.SUBMIT_FOR_APPROVAL,
    ROLE_ACTIONS.GENERATE_PDF,
    ROLE_ACTIONS.VIEW_DOCUMENTS,
    ROLE_ACTIONS.DOWNLOAD_PDF,
    ROLE_ACTIONS.VIEW_SHIPMENT,
  ],

  CLIENT: [
    ROLE_ACTIONS.VIEW_DOCUMENTS,
    ROLE_ACTIONS.VIEW_SHIPMENT,
    ROLE_ACTIONS.DOWNLOAD_PDF,
  ],

});

// ─── Workflow-state action restrictions ─────────────────────────────────────────
// Some actions are only available in specific workflow states.

const WORKFLOW_ACTION_GATES = Object.freeze({
  [ROLE_ACTIONS.EDIT_DRAFT]:           [WORKFLOW_STATES.DRAFT, WORKFLOW_STATES.QUOTED],
  [ROLE_ACTIONS.SUBMIT_FOR_APPROVAL]:  [WORKFLOW_STATES.DRAFT, WORKFLOW_STATES.QUOTED],
  [ROLE_ACTIONS.APPROVE_PAYMENT]:      [WORKFLOW_STATES.PAYMENT_PENDING],
  [ROLE_ACTIONS.CONFIRM_BANK_TRANSFER]:[WORKFLOW_STATES.PAYMENT_PENDING, WORKFLOW_STATES.PAYMENT_CONFIRMED],
  [ROLE_ACTIONS.APPROVE_PRODUCTION]:   [WORKFLOW_STATES.PAYMENT_CONFIRMED, WORKFLOW_STATES.PRODUCTION],
  [ROLE_ACTIONS.UPLOAD_INSPECTION]:    [WORKFLOW_STATES.INSPECTION, WORKFLOW_STATES.PRODUCTION],
  [ROLE_ACTIONS.CONFIRM_LOADING]:      [WORKFLOW_STATES.READY_FOR_LOADING],
  [ROLE_ACTIONS.CLOSE_OPERATION]:      [WORKFLOW_STATES.DELIVERED],
  [ROLE_ACTIONS.FREEZE_OPERATION]:     Object.values(WORKFLOW_STATES),
});

// ─── Core methods ────────────────────────────────────────────────────────────────

/**
 * Get all actions allowed for a given role.
 *
 * @param {string} role
 * @returns {string[]}
 */
export function getAllowedActions(role) {
  return [...(BASE_ROLE_ACTIONS[role] || [])];
}

/**
 * Validate if a role can perform an action in a given workflow state.
 *
 * @param {string} role
 * @param {string} action         — ROLE_ACTIONS value
 * @param {string} workflowState  — WORKFLOW_STATES value
 * @returns {{ allowed: boolean, reason: string }}
 */
export function validateWorkflowPermission(role, action, workflowState) {
  const roleActions = BASE_ROLE_ACTIONS[role] || [];

  if (!roleActions.includes(action)) {
    return {
      allowed: false,
      reason:  `Role "${role}" does not have action "${action}"`,
    };
  }

  const allowedStates = WORKFLOW_ACTION_GATES[action];
  if (allowedStates && !allowedStates.includes(workflowState)) {
    return {
      allowed: false,
      reason:  `Action "${action}" is not permitted in workflow state "${workflowState}". Allowed states: [${allowedStates.join(", ")}]`,
    };
  }

  return {
    allowed: true,
    reason:  `Role "${role}" may perform "${action}" in state "${workflowState}"`,
  };
}

/**
 * Get the full role-workflow permission matrix for display or export.
 *
 * @returns {object}  — { role: { action: allowedInStates[] | "always" } }
 */
export function getRoleWorkflowMatrix() {
  const matrix = {};

  for (const [role, actions] of Object.entries(BASE_ROLE_ACTIONS)) {
    matrix[role] = {};
    for (const action of actions) {
      const gate = WORKFLOW_ACTION_GATES[action];
      matrix[role][action] = gate ? [...gate] : "always";
    }
  }

  return Object.freeze(matrix);
}

/**
 * Get roles that can perform a specific action.
 *
 * @param {string} action
 * @returns {string[]}
 */
export function getRolesForAction(action) {
  return Object.entries(BASE_ROLE_ACTIONS)
    .filter(([, actions]) => actions.includes(action))
    .map(([role]) => role);
}
