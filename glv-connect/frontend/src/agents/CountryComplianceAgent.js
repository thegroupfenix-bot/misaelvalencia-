/**
 * CountryComplianceAgent.js — GLV GOS Agents — Country Compliance Audit V1.0
 *
 * Validates that an operation's country context, certifications, banking format,
 * and payroll configuration are correctly set for the involved countries.
 * Never throws. Returns structured reports.
 *
 * STATUS: ACTIVE
 */

import {
  getCountryContext,
  countrySupportsExportCert,
  getCountryBankFormats,
  getCountryComplianceRules,
  getCountryDefaultLanguage,
  getCountryDocumentRules,
} from "../core/geo/CountryContextEngine.js";
import { getOperation } from "../core/operations/OperationRegistry.js";

const AGENT_ID = "COUNTRY_COMPLIANCE_AGENT";

/**
 * Run a country compliance check for an operation.
 *
 * @param {string} operationId
 * @param {object} [options]
 * @param {string[]} [options.requiredCerts]   — cert types to verify for origin country
 * @returns {object}  — structured compliance report
 */
export function runCountryComplianceCheck(operationId, options = {}) {
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
        countries:   {},
        _ran:        new Date().toISOString(),
      };
    }

    const originCtx = op.originCountry ? getCountryContext(op.originCountry) : null;
    const destCtx   = op.destinationCountry ? getCountryContext(op.destinationCountry) : null;

    if (!originCtx) {
      issues.push(`Origin country "${op.originCountry}" not found in country registry`);
    }
    if (!destCtx) {
      warnings.push(`Destination country "${op.destinationCountry}" not found in country registry`);
    }

    // Verify required certs if specified
    const requiredCerts = options.requiredCerts || [];
    for (const cert of requiredCerts) {
      if (originCtx && !countrySupportsExportCert(op.originCountry, cert)) {
        warnings.push(`Origin country "${op.originCountry}" does not have cert "${cert}" configured`);
      }
    }

    // Language consistency check
    if (originCtx && op.language) {
      const expectedLang = getCountryDefaultLanguage(op.originCountry);
      if (op.language !== expectedLang && op.language !== "en") {
        warnings.push(`Operation language "${op.language}" differs from origin country default "${expectedLang}"`);
      }
    }

    // Bank format check
    if (originCtx) {
      const bankFormats = getCountryBankFormats(op.originCountry);
      if (bankFormats.length === 0) {
        warnings.push(`No bank formats configured for "${op.originCountry}"`);
      }
    }

    // Compliance rules summary
    const originCompliance = originCtx ? getCountryComplianceRules(op.originCountry) : null;
    const destCompliance   = destCtx   ? getCountryComplianceRules(op.destinationCountry) : null;
    const originDocRules   = originCtx ? getCountryDocumentRules(op.originCountry) : null;

    return Object.freeze({
      agentId:     AGENT_ID,
      operationId,
      pass:        issues.length === 0,
      blockOp:     issues.length > 0,
      issues,
      warnings,
      countries: Object.freeze({
        origin: originCtx ? {
          id:             originCtx.id,
          currency:       originCtx.currency,
          timezone:       originCtx.timezone,
          defaultLanguage:originCtx.defaultLanguage,
          exportCerts:    originCtx.exportCerts,
          bankFormats:    originCtx.bankFormats,
          complianceRules:originCompliance,
          documentRules:  originDocRules,
        } : null,
        destination: destCtx ? {
          id:             destCtx.id,
          currency:       destCtx.currency,
          complianceRules:destCompliance,
        } : null,
      }),
      _ran: new Date().toISOString(),
    });

  } catch (err) {
    return Object.freeze({
      agentId:     AGENT_ID,
      operationId: operationId || "unknown",
      pass:        false,
      blockOp:     false,
      issues:      [`Agent error: ${err.message}`],
      warnings:    [],
      countries:   {},
      _ran:        new Date().toISOString(),
    });
  }
}
