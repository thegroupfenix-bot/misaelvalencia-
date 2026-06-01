/**
 * WorkflowIntegrityAgent.js — GLV GOS Agents — Workflow Integrity Validation V1.0
 *
 * Validates workflow state transitions and operation history for integrity.
 * Detects illegal state sequences, skipped states, and orphaned transitions.
 * Never throws. Returns structured reports.
 *
 * STATUS: ACTIVE
 */

import { WORKFLOW_STATES, WORKFLOW_TRANSITIONS, canTransition, getWorkflowTimeline } from "../core/workflows/WorkflowStateEngine.js";

const AGENT_ID = "WORKFLOW_INTEGRITY_AGENT";

/**
 * Run a workflow integrity check on an operation.
 *
 * @param {object} operation  — must have { operationId, workflowState, workflowHistory }
 * @returns {object}           — structured validation report
 */
export function runWorkflowIntegrityCheck(operation = {}) {
  const issues   = [];
  const warnings = [];

  try {
    if (!operation.operationId) {
      issues.push("operationId is missing");
    }

    const currentState = operation.workflowState;
    if (!currentState) {
      issues.push("workflowState is missing");
    } else if (!WORKFLOW_STATES[currentState]) {
      issues.push(`Unknown workflowState: "${currentState}"`);
    }

    const history = operation.workflowHistory || [];

    // Validate each history transition is legal
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const check = canTransition(entry.from, entry.to);
      if (!check.allowed) {
        issues.push(`Illegal transition at step ${i + 1}: ${entry.from} → ${entry.to}`);
      }
      if (!entry.actorId) {
        warnings.push(`Transition step ${i + 1} (${entry.from} → ${entry.to}) has no actorId recorded`);
      }
    }

    // Verify current state is reachable from history
    if (history.length > 0 && currentState) {
      const lastHistoryState = history[history.length - 1].to;
      if (lastHistoryState !== currentState) {
        issues.push(`workflowState "${currentState}" does not match last history transition target "${lastHistoryState}"`);
      }
    }

    const timeline = currentState && WORKFLOW_STATES[currentState]
      ? getWorkflowTimeline(operation)
      : null;

    return Object.freeze({
      agentId:     AGENT_ID,
      operationId: operation.operationId || "unknown",
      pass:        issues.length === 0,
      blockOp:     issues.length > 0,
      issues,
      warnings,
      currentState: currentState || null,
      historySteps: history.length,
      timeline,
      _ran:         new Date().toISOString(),
    });

  } catch (err) {
    return Object.freeze({
      agentId:     AGENT_ID,
      operationId: operation?.operationId || "unknown",
      pass:        false,
      blockOp:     true,
      issues:      [`Agent error: ${err.message}`],
      warnings:    [],
      currentState: null,
      historySteps: 0,
      timeline:     null,
      _ran:         new Date().toISOString(),
    });
  }
}
