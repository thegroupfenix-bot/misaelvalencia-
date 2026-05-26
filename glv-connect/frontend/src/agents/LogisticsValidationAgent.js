/**
 * LogisticsValidationAgent.js — V9.1
 *
 * Validates container logistics consistency:
 *   units, pallets, weight, density, container capacity.
 *
 * Returns a structured report. Never throws.
 * DO NOT import LIVE_ANIMALS / frozen cargo / fruits / grains / meat logic.
 */

import {
  calcCanonicalUnitsPerContainer,
  calcContainerWeight,
  calcCartonsPerContainer,
  getCanonicalConfig,
  validateUnitConsistency,
  MAX_40HQ_PAYLOAD_KG,
  OIL_DENSITY_KG_PER_L,
} from "../engines/core/containerMathEngine.js";

export const AGENT_ID = "LOGISTICS_VALIDATION_AGENT";
export const AGENT_VERSION = "v9.1";

/**
 * Run full logistics validation against an oilsConfig payload.
 *
 * @param {object} oilsConfig — from OilsExportPanel / pdfPayloadNormalizer
 * @returns {ValidationReport}
 */
export function validateLogistics(oilsConfig = {}) {
  const report = {
    agentId: AGENT_ID,
    version: AGENT_VERSION,
    valid: true,
    blockPdf: false,
    checks: [],
  };

  const { packagingType, sizeId, unitsPerContainer, containerType } = oilsConfig;

  const addCheck = (name, ok, message, severity = "warn") => {
    report.checks.push({ name, ok, message, severity });
    if (!ok && severity === "error") { report.valid = false; report.blockPdf = true; }
    if (!ok && severity === "warn")  { report.valid = false; }
  };

  // Check 1: packaging type + size are set
  addCheck("packagingType present", !!packagingType, packagingType ? `packagingType: ${packagingType}` : "packagingType is missing", "error");
  addCheck("sizeId present", !!sizeId, sizeId ? `sizeId: ${sizeId}` : "sizeId is missing", "error");

  if (!packagingType || !sizeId) return report;

  // Check 2: canonical config exists
  const cfg = getCanonicalConfig(packagingType, sizeId);
  addCheck("canonical config exists", !!cfg, cfg ? `${cfg.upc}upc × ${cfg.cpp}cpp × ${cfg.p}p` : `No canonical config for ${packagingType}/${sizeId}`, "error");

  if (!cfg) return report;

  // Check 3: units consistency
  const canonical = calcCanonicalUnitsPerContainer(packagingType, sizeId);
  if (unitsPerContainer) {
    const consistency = validateUnitConsistency(packagingType, sizeId, unitsPerContainer);
    addCheck(
      "units consistency",
      consistency.valid,
      consistency.valid
        ? `Units ${unitsPerContainer} within 5% of canonical ${canonical}`
        : `MISMATCH: reported=${unitsPerContainer}, canonical=${canonical} (${(consistency.deltaFraction * 100).toFixed(1)}% delta)`,
      consistency.valid ? "pass" : "warn",
    );
  }

  // Check 4: weight within 40HQ payload
  const weight = calcContainerWeight(packagingType, sizeId);
  addCheck(
    "payload within 40HQ limit",
    weight.withinPayload,
    weight.withinPayload
      ? `Gross ${weight.grossMT}MT ≤ ${(MAX_40HQ_PAYLOAD_KG / 1000).toFixed(1)}MT limit`
      : `OVERLOAD: gross ${weight.grossMT}MT > ${(MAX_40HQ_PAYLOAD_KG / 1000).toFixed(1)}MT limit`,
    weight.withinPayload ? "pass" : "error",
  );

  // Check 5: container type
  addCheck("container type is 40HQ", !containerType || containerType === "40HQ", containerType === "40HQ" ? "Container: 40HQ ✓" : `Non-standard container: ${containerType}`, "warn");

  return {
    ...report,
    canonical,
    weight,
    cartons: calcCartonsPerContainer(packagingType, sizeId),
  };
}
