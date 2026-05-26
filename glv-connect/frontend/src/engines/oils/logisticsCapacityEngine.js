/**
 * logisticsCapacityEngine.js — V8.0 Container Capacity & Logistics Engine
 * Isolated. Handles PET / Pouch / Jerrycan capacity for 40HQ containers.
 */

// ─── Container capacity presets ───────────────────────────────────────────────
// unitsMin/Max per 40HQ, cartonsPerPallet, palletCount per 40HQ

export const CONTAINER_CAPACITY = {
  PET: {
    "900ml":  { unitsMin: 22000, unitsMax: 24000, unitsPerCarton: 12, cartonsPerPallet: 60, pallets: 20 },
    "1000ml": { unitsMin: 22000, unitsMax: 23000, unitsPerCarton: 12, cartonsPerPallet: 56, pallets: 20 },
    "2000ml": { unitsMin: 10000, unitsMax: 11200, unitsPerCarton: 6,  cartonsPerPallet: 48, pallets: 20 },
    "2500ml": { unitsMin:  8400, unitsMax:  9600, unitsPerCarton: 6,  cartonsPerPallet: 40, pallets: 20 },
    "3000ml": { unitsMin:  7200, unitsMax:  8000, unitsPerCarton: 4,  cartonsPerPallet: 36, pallets: 20 },
    "5000ml": { unitsMin:  4200, unitsMax:  4800, unitsPerCarton: 4,  cartonsPerPallet: 28, pallets: 20 },
    "10000ml":{ unitsMin:  2000, unitsMax:  2400, unitsPerCarton: 2,  cartonsPerPallet: 20, pallets: 20 },
    "20L":    { unitsMin:  1050, unitsMax:  1100, unitsPerCarton: 1,  cartonsPerPallet: 52, pallets: 20 },
  },
  POUCH: {
    "500ml":  { unitsMin: 56000, unitsMax: 64000, unitsPerCarton: 48, cartonsPerPallet: 80, pallets: 20 },
    "1000ml": { unitsMin: 30000, unitsMax: 34000, unitsPerCarton: 24, cartonsPerPallet: 64, pallets: 20 },
    "2000ml": { unitsMin: 14000, unitsMax: 16000, unitsPerCarton: 12, cartonsPerPallet: 56, pallets: 20 },
    "3000ml": { unitsMin:  9600, unitsMax: 11000, unitsPerCarton: 8,  cartonsPerPallet: 48, pallets: 20 },
    "5000ml": { unitsMin:  5600, unitsMax:  6400, unitsPerCarton: 6,  cartonsPerPallet: 40, pallets: 20 },
  },
  JERRY: {
    "20L":    { unitsMin:  1050, unitsMax:  1200, unitsPerCarton: 1,  cartonsPerPallet: 56, pallets: 20 },
  },
};

// ─── Packaging group resolver ─────────────────────────────────────────────────

const JERRY_IDS  = new Set(["JERRYCAN_20L"]);
const POUCH_IDS  = new Set(["RETAIL_POUCH","PILLOW_POUCH","LAMINATED_POUCH","MULTILAYER_POUCH","FLEXIBLE_OIL_POUCH","DOYPACK","SPOUT_POUCH"]);

export function resolveCapacityGroup(packagingType) {
  if (JERRY_IDS.has(packagingType))  return "JERRY";
  if (POUCH_IDS.has(packagingType))  return "POUCH";
  return "PET";
}

// ─── Capacity functions ───────────────────────────────────────────────────────

/**
 * Get capacity preset for a packaging type + size.
 * @returns {object|null}
 */
export function getCapacityPreset(packagingType, sizeId) {
  const group = resolveCapacityGroup(packagingType);
  return CONTAINER_CAPACITY[group]?.[sizeId] || null;
}

/**
 * Calculate container logistics for a shipment.
 * @param {object} p
 * @param {string} p.packagingType
 * @param {string} p.sizeId
 * @param {number} p.totalUnits
 * @returns {object} { containers, pallets, cartonsTotal, deadSpaceRatio, freightEfficiencyVsPET }
 */
export function calcContainerLogistics({ packagingType, sizeId, totalUnits }) {
  const preset = getCapacityPreset(packagingType, sizeId);
  if (!preset || !totalUnits) return null;

  const nominalUnitsPerContainer = Math.round((preset.unitsMin + preset.unitsMax) / 2);
  const containers  = Math.ceil(totalUnits / nominalUnitsPerContainer);
  const cartonsTotal = Math.ceil(totalUnits / preset.unitsPerCarton);
  const palletsTotal = Math.ceil(cartonsTotal / preset.cartonsPerPallet);
  const palletsPerContainer = preset.pallets;

  // Dead space: how much of the last container is unused
  const lastContainerUnits = totalUnits % nominalUnitsPerContainer || nominalUnitsPerContainer;
  const deadSpaceRatio = parseFloat(((nominalUnitsPerContainer - lastContainerUnits) / nominalUnitsPerContainer * 100).toFixed(1));

  // Freight efficiency vs baseline 1L PET (22,000 units/40HQ)
  const PET_1L_BASELINE = 22000;
  const freightEfficiencyVsPET = parseFloat((nominalUnitsPerContainer / PET_1L_BASELINE).toFixed(2));

  return {
    containers,
    palletsTotal,
    palletsPerContainer,
    cartonsTotal,
    nominalUnitsPerContainer,
    deadSpaceRatio,
    freightEfficiencyVsPET,
    unitsPerCarton: preset.unitsPerCarton,
    cartonsPerPallet: preset.cartonsPerPallet,
  };
}

/**
 * Calculate pallets per container.
 */
export function calcPalletsPerContainer(packagingType, sizeId) {
  return getCapacityPreset(packagingType, sizeId)?.pallets ?? 20;
}

/**
 * Validate that a unit count doesn't overload container pallet capacity.
 * @returns {{ valid: boolean, overloadPct: number }}
 */
export function validateContainerLoad(packagingType, sizeId, totalUnits) {
  const preset = getCapacityPreset(packagingType, sizeId);
  if (!preset) return { valid: true, overloadPct: 0 };
  const max = preset.unitsMax;
  const actual = totalUnits;
  const overloadPct = actual > max ? parseFloat(((actual - max) / max * 100).toFixed(1)) : 0;
  return { valid: actual <= max, overloadPct };
}
