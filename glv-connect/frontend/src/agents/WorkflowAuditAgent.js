/**
 * WorkflowAuditAgent.js — GLV GOS Agents — Workflow Audit V1.0
 *
 * Audits workflow transitions for an operation against role permissions
 * and generates audit-trail-ready reports for each state change.
 * Never throws. Returns structured reports.
 *
 * STATUS: ACTIVE
 */

import { canTransition, getWorkflowTimeline, WORKFLOW_STATES } from "../core/workflows/WorkflowStateEngine.js";
import { validateWorkflowPermission }                           from "../core/rbac/EnterpriseRoleFlowEngine.js";
import { getOperation }                                         from "../core/operations/OperationRegistry.js";

const AGENT_ID = "WORKFLOW_AUDIT_AGENT";

/**
 * Audit all workflow transitions in an operation's history for role compliance.
 *
 * @param {string} operationId
 * @returns {object}  — structured audit report
 */
export function runWorkflowAudit(operationId) {
  const issues   = [];
  const warnings = [];
  const auditedTransitions = [];

  try {
    const op = getOperation(operationId);
    if (!op) {
      return {
        agentId:     AGENT_ID,
        operationId: operationId || "unknown",
        pass:        false,
        issues:      [`Operation "${operationId}" not found`],
        warnings:    [],
        auditedTransitions: [],
        timeline:    null,
        _ran:        new Date().toISOString(),
      };
    }

    const history = op.workflowHistory || [];

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const transCheck = canTransition(entry.from, entry.to);

      const roleCheck = entry.actorRole
        ? validateWorkflowPermission(entry.actorRole, "SUBMIT_FOR_APPROVAL", entry.from)
        : { allowed: true, reason: "No actorRole recorded — skipping role check" };

      if (!transCheck.allowed) {
        issues.push(`Step ${i + 1}: Illegal transition ${entry.from} → ${entry.to}`);
      }
      if (!entry.actorId) {
        warnings.push(`Step ${i + 1} (${entry.from} → ${entry.to}): No actorId recorded`);
      }
      if (!entry.actorRole) {
        warnings.push(`Step ${i + 1} (${entry.from} → ${entry.to}): No actorRole recorded`);
      }

      auditedTransitions.push(Object.freeze({
        step:         i + 1,
        from:         entry.from,
        to:           entry.to,
        at:           entry.at,
        actorId:      entry.actorId || null,
        actorRole:    entry.actorRole || null,
        transitionValid: transCheck.allowed,
        notes:        entry.notes || null,
      }));
    }

    const timeline = getWorkflowTimeline(op, op.language || "es");

    if (!WORKFLOW_STATES[op.workflowState]) {
      issues.push(`Invalid current workflowState: "${op.workflowState}"`);
    }

    return Object.freeze({
      agentId:            AGENT_ID,
      operationId,
      pass:               issues.length === 0,
      blockOp:            issues.length > 0,
      issues,
      warnings,
      currentState:       op.workflowState,
      totalTransitions:   history.length,
      auditedTransitions,
      timeline,
      _ran:               new Date().toISOString(),
    });

  } catch (err) {
    return Object.freeze({
      agentId:            AGENT_ID,
      operationId:        operationId || "unknown",
      pass:               false,
      blockOp:            true,
      issues:             [`Agent error: ${err.message}`],
      warnings:           [],
      currentState:       null,
      totalTransitions:   0,
      auditedTransitions: [],
      timeline:           null,
      _ran:               new Date().toISOString(),
    });
  }
}
