/**
 * OperationChainValidationAgent.js — GLV GOS Agents — Operation Chain Validation V1.0
 *
 * Validates operation chains for completeness, entity presence,
 * and cross-field consistency. Never throws. Returns structured reports.
 *
 * STATUS: ACTIVE
 */

import { CHAIN_ROLES, CHAIN_STATUS, validateOperationChain, getOperationChainSummary } from "../core/operations/OperationChainEngine.js";

const AGENT_ID = "OPERATION_CHAIN_VALIDATION_AGENT";

/**
 * Run a full validation pass on an operation chain.
 *
 * @param {object} chain  — result of createOperationChain()
 * @returns {object}       — structured validation report
 */
export function runOperationChainValidation(chain = {}) {
  const issues   = [];
  const warnings = [];

  try {
    const baseResult = validateOperationChain(chain);
    issues.push(...baseResult.missing);
    warnings.push(...baseResult.warnings);

    const entities = chain.entities || {};

    // Cross-field consistency checks
    if (entities[CHAIN_ROLES.ORIGIN_COUNTRY] && entities[CHAIN_ROLES.DESTINATION_COUNTRY]) {
      const origin = entities[CHAIN_ROLES.ORIGIN_COUNTRY];
      const dest   = entities[CHAIN_ROLES.DESTINATION_COUNTRY];
      if (origin.country && dest.country && origin.country === dest.country) {
        warnings.push("Origin and destination countries are the same — verify this is intentional");
      }
    }

    if (chain.status === CHAIN_STATUS.ACTIVE && !entities[CHAIN_ROLES.INVOICE_ENTITY]) {
      issues.push("Active operation chain must have an INVOICE_ENTITY");
    }

    if (!chain.currency) {
      issues.push("currency is required for financial calculations");
    }

    const summary = getOperationChainSummary(chain);

    return Object.freeze({
      agentId:     AGENT_ID,
      operationId: chain.operationId || "unknown",
      pass:        issues.length === 0,
      blockOp:     issues.length > 0,
      issues,
      warnings,
      summary,
      _ran:        new Date().toISOString(),
    });

  } catch (err) {
    return Object.freeze({
      agentId:     AGENT_ID,
      operationId: chain?.operationId || "unknown",
      pass:        false,
      blockOp:     true,
      issues:      [`Agent error: ${err.message}`],
      warnings:    [],
      summary:     null,
      _ran:        new Date().toISOString(),
    });
  }
}
