/**
 * EnterpriseOrchestrationAgent.js — GLV GOS Agents — Enterprise Orchestration Audit V1.0
 *
 * Validates that the enterprise orchestrator, operation registry, entity flow,
 * and audit chain are all wired correctly for a given operation.
 * Never throws. Returns structured reports.
 *
 * STATUS: ACTIVE
 */

import { validateOperation, getOperationSnapshot, resolveEntityFlow } from "../core/orchestration/EnterpriseOrchestrator.js";
import { operationExists }                                             from "../core/operations/OperationRegistry.js";

const AGENT_ID = "ENTERPRISE_ORCHESTRATION_AGENT";

/**
 * Run a full orchestration audit for an operation.
 *
 * @param {string} operationId
 * @returns {object}  — structured audit report
 */
export function runOrchestrationAudit(operationId) {
  const issues   = [];
  const warnings = [];

  try {
    if (!operationId) {
      return {
        agentId:     AGENT_ID,
        operationId: null,
        pass:        false,
        issues:      ["operationId is required"],
        warnings:    [],
        snapshot:    null,
        _ran:        new Date().toISOString(),
      };
    }

    if (!operationExists(operationId)) {
      return {
        agentId:     AGENT_ID,
        operationId,
        pass:        false,
        issues:      [`Operation "${operationId}" not found in registry`],
        warnings:    [],
        snapshot:    null,
        _ran:        new Date().toISOString(),
      };
    }

    const validation = validateOperation(operationId);
    issues.push(...validation.issues);
    warnings.push(...validation.warnings);

    const snapshot = getOperationSnapshot(operationId);
    if (!snapshot) {
      issues.push("Could not generate operation snapshot");
    }

    const entityFlow = resolveEntityFlow(operationId);
    if (!entityFlow.salesEntity && !entityFlow.invoiceEntity) {
      warnings.push("No sales or invoice entity resolved — entity chain may be incomplete");
    }

    if (snapshot && !snapshot.currency) {
      issues.push("Operation has no currency set");
    }
    if (snapshot && !snapshot.category) {
      warnings.push("Operation has no category set — document mode resolution may be imprecise");
    }

    return Object.freeze({
      agentId:     AGENT_ID,
      operationId,
      pass:        issues.length === 0,
      blockOp:     issues.length > 0,
      issues,
      warnings,
      snapshot,
      entityFlow,
      workflowState: snapshot?.workflowState || null,
      documentCount: snapshot?.documentCount || 0,
      _ran:          new Date().toISOString(),
    });

  } catch (err) {
    return Object.freeze({
      agentId:     AGENT_ID,
      operationId: operationId || "unknown",
      pass:        false,
      blockOp:     true,
      issues:      [`Agent error: ${err.message}`],
      warnings:    [],
      snapshot:    null,
      entityFlow:  null,
      workflowState: null,
      documentCount: 0,
      _ran:        new Date().toISOString(),
    });
  }
}
