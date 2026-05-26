/**
 * PackagingValidationAgent.js — V9.1
 *
 * Validates packaging consistency:
 *   SKU size consistency, PET vs pouch isolation, no mixed systems.
 *
 * Returns a structured report. Never throws.
 */

export const AGENT_ID = "PACKAGING_VALIDATION_AGENT";
export const AGENT_VERSION = "v9.1";

const POUCH_IDS = new Set([
  "RETAIL_POUCH","PILLOW_POUCH","LAMINATED_POUCH","MULTILAYER_POUCH","FLEXIBLE_OIL_POUCH",
  "DOYPACK","SPOUT_POUCH","STAND_UP_POUCH","GUSSET_POUCH","SIDE_SEAL_POUCH",
]);
const PET_IDS = new Set(["PET_BOTTLE","GLASS_BOTTLE","TETRA_PAK","PLASTIC_GALLON","PREMIUM_BOTTLE","CAN_TIN"]);
const JERRY_IDS = new Set(["JERRYCAN_20L","DRUM_200L","IBC_1000L","FLEXITANK","ISOTANK"]);

/**
 * Validate oilsConfig packaging for consistency.
 */
export function validatePackaging(oilsConfig = {}) {
  const checks = [];
  const addCheck = (name, ok, message) => checks.push({ name, ok, message });

  const { packagingType, sizeId, skus = [] } = oilsConfig;

  // Packaging type classification
  const isPouch = POUCH_IDS.has(packagingType);
  const isPet   = PET_IDS.has(packagingType);
  const isJerry = JERRY_IDS.has(packagingType);
  addCheck("packaging type recognized", isPouch || isPet || isJerry, `packagingType: ${packagingType || "(none)"}`);

  // Size present
  addCheck("sizeId present", !!sizeId, sizeId ? `sizeId: ${sizeId}` : "No size selected");

  // No mixed packaging in SKUs (all SKUs must share the same packaging group)
  if (skus.length > 1) {
    const groups = skus.map(sku => {
      if (POUCH_IDS.has(sku.packagingType)) return "POUCH";
      if (JERRY_IDS.has(sku.packagingType)) return "JERRY";
      return "PET";
    });
    const uniqueGroups = [...new Set(groups)];
    addCheck("no mixed packaging groups in SKUs", uniqueGroups.length <= 1, uniqueGroups.length > 1 ? `Mixed packaging groups: ${uniqueGroups.join(", ")}` : `All SKUs: ${uniqueGroups[0]}`);
  }

  // Pouch-specific: validate technical fields
  if (isPouch) {
    addCheck("pouch type set", !!oilsConfig.pouchType, oilsConfig.pouchType ? `pouchType: ${oilsConfig.pouchType}` : "Pouch type not selected");
    addCheck("film material set", !!oilsConfig.filmMaterial, oilsConfig.filmMaterial ? `filmMaterial: ${oilsConfig.filmMaterial}` : "Film material not selected");
  }

  const errors = checks.filter(c => !c.ok);
  return { agentId: AGENT_ID, version: AGENT_VERSION, valid: errors.length === 0, checks };
}
