/**
 * WorkflowStateEngine.js — GLV GOS Core Domain — Workflow State Foundation V1.0
 *
 * Defines the canonical export operation workflow lifecycle with 13 states,
 * valid transition rules, and a timeline generator.
 *
 * STATUS: FOUNDATION — state machine, transition validation, and timeline defined.
 * Persistence layer and event hooks to be implemented per integration.
 */

// ─── State constants ────────────────────────────────────────────────────────────

export const WORKFLOW_STATES = Object.freeze({
  DRAFT:               "DRAFT",
  QUOTED:              "QUOTED",
  APPROVED:            "APPROVED",
  CONTRACTED:          "CONTRACTED",
  PAYMENT_PENDING:     "PAYMENT_PENDING",
  PAYMENT_CONFIRMED:   "PAYMENT_CONFIRMED",
  PRODUCTION:          "PRODUCTION",
  INSPECTION:          "INSPECTION",
  READY_FOR_LOADING:   "READY_FOR_LOADING",
  LOADED:              "LOADED",
  SHIPPED:             "SHIPPED",
  DELIVERED:           "DELIVERED",
  CLOSED:              "CLOSED",
});

export const WORKFLOW_STATE_LABELS = Object.freeze({
  DRAFT:               { es: "Borrador",                  en: "Draft" },
  QUOTED:              { es: "Cotizado",                  en: "Quoted" },
  APPROVED:            { es: "Aprobado",                  en: "Approved" },
  CONTRACTED:          { es: "Contratado",                en: "Contracted" },
  PAYMENT_PENDING:     { es: "Pago Pendiente",            en: "Payment Pending" },
  PAYMENT_CONFIRMED:   { es: "Pago Confirmado",           en: "Payment Confirmed" },
  PRODUCTION:          { es: "En Producción",             en: "In Production" },
  INSPECTION:          { es: "En Inspección",             en: "Under Inspection" },
  READY_FOR_LOADING:   { es: "Listo para Embarque",       en: "Ready for Loading" },
  LOADED:              { es: "Embarcado",                 en: "Loaded" },
  SHIPPED:             { es: "En Tránsito",               en: "Shipped" },
  DELIVERED:           { es: "Entregado",                 en: "Delivered" },
  CLOSED:              { es: "Cerrado",                   en: "Closed" },
});

// ─── Transition map ─────────────────────────────────────────────────────────────
// Maps each state to the set of states it is allowed to transition to.

export const WORKFLOW_TRANSITIONS = Object.freeze({
  DRAFT:               ["QUOTED"],
  QUOTED:              ["APPROVED", "DRAFT"],
  APPROVED:            ["CONTRACTED", "QUOTED"],
  CONTRACTED:          ["PAYMENT_PENDING", "APPROVED"],
  PAYMENT_PENDING:     ["PAYMENT_CONFIRMED", "CONTRACTED"],
  PAYMENT_CONFIRMED:   ["PRODUCTION"],
  PRODUCTION:          ["INSPECTION", "PAYMENT_PENDING"],
  INSPECTION:          ["READY_FOR_LOADING", "PRODUCTION"],
  READY_FOR_LOADING:   ["LOADED"],
  LOADED:              ["SHIPPED"],
  SHIPPED:             ["DELIVERED"],
  DELIVERED:           ["CLOSED"],
  CLOSED:              [],
});

// ─── Transition rules ───────────────────────────────────────────────────────────

/**
 * Check if a transition from currentState → nextState is valid.
 *
 * @param {string} currentState
 * @param {string} nextState
 * @returns {{ allowed: boolean, reason: string }}
 */
export function canTransition(currentState, nextState) {
  if (!WORKFLOW_STATES[currentState]) {
    return { allowed: false, reason: `Unknown state: "${currentState}"` };
  }
  if (!WORKFLOW_STATES[nextState]) {
    return { allowed: false, reason: `Unknown target state: "${nextState}"` };
  }

  const allowed = (WORKFLOW_TRANSITIONS[currentState] || []).includes(nextState);
  return {
    allowed,
    reason: allowed
      ? `Transition ${currentState} → ${nextState} is permitted.`
      : `Transition ${currentState} → ${nextState} is not allowed. Valid targets: [${(WORKFLOW_TRANSITIONS[currentState] || []).join(", ")}]`,
  };
}

// ─── Transition executor ────────────────────────────────────────────────────────

/**
 * Apply a state transition to an operation workflow record.
 * Never mutates input — returns updated copy.
 *
 * @param {object} operation     — must have { operationId, workflowState }
 * @param {string} nextState     — target WORKFLOW_STATES value
 * @param {string} [actorId]     — user performing the transition
 * @param {string} [actorRole]   — role of the user
 * @param {string} [notes]
 * @returns {{ success: boolean, operation: object|null, reason: string }}
 */
export function transitionOperation(operation, nextState, actorId = null, actorRole = null, notes = null) {
  if (!operation || !operation.workflowState) {
    return { success: false, operation: null, reason: "Invalid operation object — missing workflowState" };
  }

  const check = canTransition(operation.workflowState, nextState);
  if (!check.allowed) {
    return { success: false, operation: null, reason: check.reason };
  }

  const historyEntry = Object.freeze({
    from:      operation.workflowState,
    to:        nextState,
    at:        new Date().toISOString(),
    actorId,
    actorRole,
    notes,
  });

  const updatedOperation = Object.freeze({
    ...operation,
    workflowState:   nextState,
    workflowHistory: Object.freeze([...(operation.workflowHistory || []), historyEntry]),
    _updatedAt:      new Date().toISOString(),
  });

  return { success: true, operation: updatedOperation, reason: check.reason };
}

// ─── Timeline generator ─────────────────────────────────────────────────────────

/**
 * Generate a full workflow timeline for display or audit.
 * Shows all states with completion markers based on history.
 *
 * @param {object} operation  — must have { workflowState, workflowHistory }
 * @param {string} [lang]     — "es" | "en"
 * @returns {object[]}         — ordered array of timeline step objects
 */
export function getWorkflowTimeline(operation = {}, lang = "es") {
  const currentState = operation.workflowState || WORKFLOW_STATES.DRAFT;
  const history      = operation.workflowHistory || [];

  const stateOrder = Object.keys(WORKFLOW_STATES);
  const currentIdx = stateOrder.indexOf(currentState);

  const completedStates = new Set(history.map(h => h.from));
  completedStates.add(currentState);

  return stateOrder.map((state, idx) => {
    const historyEntry = history.find(h => h.to === state) || null;
    return Object.freeze({
      state,
      label:    (WORKFLOW_STATE_LABELS[state] || {})[lang] || state,
      status:   state === currentState
        ? "current"
        : idx < currentIdx
          ? "completed"
          : "pending",
      completedAt: historyEntry ? historyEntry.at : null,
      actorId:     historyEntry ? historyEntry.actorId : null,
    });
  });
}

// ─── State label helper ─────────────────────────────────────────────────────────

export function getStateLabel(state, lang = "es") {
  return (WORKFLOW_STATE_LABELS[state] || {})[lang] || state;
}
