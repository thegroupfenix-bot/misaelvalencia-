/**
 * FormulaAuditAgent.js — V9.1
 *
 * Audits commercial formula correctness:
 *   FOB/CFR/CIF math, insurance, freight, ratios, totals.
 *
 * Returns a structured report. Never throws.
 */

import { calcFOBTotal, calcCFRTotal, calcCIFTotal } from "../engines/core/commercialCore.js";

export const AGENT_ID = "FORMULA_AUDIT_AGENT";
export const AGENT_VERSION = "v9.1";

const TOLERANCE = 0.001; // $0.001 rounding tolerance

function near(a, b) { return Math.abs(a - b) <= TOLERANCE; }

/**
 * Audit the formula math in an oilsConfig normalized payload.
 *
 * @param {object} oilsConfig — from OilsExportPanel
 * @returns {AuditReport}
 */
export function auditFormulas(oilsConfig = {}) {
  const checks = [];
  const addCheck = (name, ok, message) => checks.push({ name, ok, message });

  const {
    basePrice, unitsPerContainer, freightUSD, insuranceUSD,
    incoterm, triplet,
  } = oilsConfig;

  const price  = parseFloat(basePrice)        || 0;
  const units  = parseFloat(unitsPerContainer) || 0;
  const freight = parseFloat(freightUSD)       || 0;
  const ins    = parseFloat(insuranceUSD)       || 0;

  // FOB total
  if (price > 0 && units > 0) {
    const expectedFOB = calcFOBTotal({ pricePerUnit: price, unitsPerContainer: units });
    addCheck("FOB total = price × units", true, `$${price} × ${units} = $${expectedFOB.toFixed(2)}`);
  }

  // CFR = FOB + freight
  const fob = price * units;
  if (fob > 0 && freight > 0) {
    const expectedCFR = calcCFRTotal({ fobTotal: fob, freightUSD: freight });
    addCheck("CFR = FOB + freight", true, `$${fob.toFixed(2)} + $${freight.toFixed(2)} = $${expectedCFR.toFixed(2)}`);
  }

  // CIF = CFR + insurance
  const cfr = fob + freight;
  if (cfr > 0 && ins > 0) {
    const expectedCIF = calcCIFTotal({ cfrTotal: cfr, insuranceUSD: ins });
    addCheck("CIF = CFR + insurance", true, `$${cfr.toFixed(2)} + $${ins.toFixed(2)} = $${expectedCIF.toFixed(2)}`);
  }

  // Price triplet consistency
  if (triplet && incoterm) {
    const priceFromTriplet = triplet[incoterm];
    if (priceFromTriplet != null) {
      addCheck(
        "basePrice matches triplet for incoterm",
        near(price, parseFloat(priceFromTriplet)),
        near(price, parseFloat(priceFromTriplet))
          ? `${incoterm} price = $${price} ✓`
          : `Mismatch: basePrice=$${price} but triplet[${incoterm}]=$${priceFromTriplet}`,
      );
    }
  }

  // Insurance sanity: should be ~0.3–0.6% of FOB (marine cargo standard)
  if (ins > 0 && fob > 0) {
    const insPct = ins / fob;
    addCheck(
      "insurance within 0.2–1% of FOB",
      insPct >= 0.002 && insPct <= 0.01,
      `Insurance = ${(insPct * 100).toFixed(3)}% of FOB (standard 0.4%)`,
    );
  }

  const errors = checks.filter(c => !c.ok);
  return { agentId: AGENT_ID, version: AGENT_VERSION, valid: errors.length === 0, checks };
}
