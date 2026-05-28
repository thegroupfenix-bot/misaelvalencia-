/**
 * OperationIntegrityAgent.js — GLV GOS Agents — Operation Integrity Audit V1.0
 *
 * Comprehensive integrity check for a full operation:
 * validates chain, documents, workflow, entity assignments, and audit trail presence.
 * Never throws. Returns structured reports.
 *
 * STATUS: ACTIVE
 */

import { getOperation, listOperations }         from "../core/operations/OperationRegistry.js";
import { validateOperationChain }               from "../core/operations/OperationChainEngine.js";
import { validateDocumentChain }                from "../core/documents/DocumentRelationEngine.js";
import { getWorkflowTimeline, WORKFLOW_STATES } from "../core/workflows/WorkflowStateEngine.js";
import { buildAuditTimeline }                   from "../core/audit/AuditTimelineEngine.js";

const AGENT_ID = "OPERATION_INTEGRITY_AGENT";

/**
 * Run a full integrity check on a single operation.
 *
 * @param {string} operationId
 * @returns {object}  — structured integrity report
 */
export function runOperationIntegrityCheck(operationId) {
  const issues   = [];
  const warnings = [];

  try {
    const op = getOperation(operationId);
    if (!op) {
      return {
        agentId:     AGENT_ID,
        operationId: operationId || "unknown",
        pass:        false,
        issues:      [`Operation "${operationId}" not found`],
        warnings:    [],
        details:     null,
        _ran:        new Date().toISOString(),
      };
    }

    // Schema integrity
    if (!op.category)           warnings.push("category is not set");
    if (!op.currency)           issues.push("currency is required");
    if (!op.originCountry)      warnings.push("originCountry is not set");
    if (!op.destinationCountry) warnings.push("destinationCountry is not set");
    if (!op.clientName)         warnings.push("clientName is not set");
    if (!op.language)           warnings.push("language is not set — defaulting to es");

    // Workflow integrity
    if (!WORKFLOW_STATES[op.workflowState]) {
      issues.push(`Invalid workflowState: "${op.workflowState}"`);
    }

    // Chain integrity
    let chainResult = { valid: true, missing: [], warnings: [] };
    if (op.operationChain) {
      chainResult = validateOperationChain(op.operationChain);
      issues.push(...chainResult.missing);
      warnings.push(...chainResult.warnings);
    } else {
      warnings.push("operationChain is not set");
    }

    // Document chain
    const docResult = validateDocumentChain(operationId);
    if (!docResult.valid) {
      warnings.push(...docResult.missing.map(t => `Missing expected document: ${t}`));
    }

    // Audit trail presence
    const auditEntries = buildAuditTimeline(operationId);
    if (auditEntries.length === 0) {
      warnings.push("No audit trail entries found for this operation");
    }

    const timeline = getWorkflowTimeline(op, op.language || "es");

    return Object.freeze({
      agentId:          AGENT_ID,
      operationId,
      pass:             issues.length === 0,
      blockOp:          issues.filter(i => i.includes("required") || i.includes("Invalid")).length > 0,
      issues,
      warnings,
      details: Object.freeze({
        workflowState:    op.workflowState,
        category:         op.category || null,
        currency:         op.currency || null,
        chainValid:       chainResult.valid,
        documentsPresent: docResult.present,
        auditEntries:     auditEntries.length,
        workflowSteps:    (op.workflowHistory || []).length,
      }),
      timeline,
      _ran: new Date().toISOString(),
    });

  } catch (err) {
    return Object.freeze({
      agentId:     AGENT_ID,
      operationId: operationId || "unknown",
      pass:        false,
      blockOp:     true,
      issues:      [`Agent error: ${err.message}`],
      warnings:    [],
      details:     null,
      timeline:    null,
      _ran:        new Date().toISOString(),
    });
  }
}

/**
 * Run integrity checks on all registered operations.
 *
 * @returns {object}  — summary with per-operation results
 */
export function runBulkIntegrityCheck() {
  const operations = listOperations();
  const results    = [];
  let passed = 0, failed = 0;

  for (const op of operations) {
    const result = runOperationIntegrityCheck(op.operationId);
    results.push({ operationId: op.operationId, pass: result.pass, issueCount: result.issues.length });
    if (result.pass) passed++; else failed++;
  }

  return Object.freeze({
    agentId:   AGENT_ID,
    total:     operations.length,
    passed,
    failed,
    results,
    _ran:      new Date().toISOString(),
  });
}
