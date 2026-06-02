/**
 * jerrycanEngine.js — V8.0 Jerrycan & Industrial Bulk Engine for Export Oils
 * Covers JERRYCAN_20L, DRUM_200L, IBC_1000L, FLEXITANK, ISOTANK.
 * Isolated. No LIVE_ANIMALS / frozen cargo coupling.
 */

export const INDUSTRIAL_FORMATS = [
  {
    id: "JERRYCAN_20L",
    label: "Jerrycan 20L",
    capacityL: 20,
    unitsPerPallet: 56,
    palletsPerContainer: 20,
    nominalUnitsPerContainer: 1050,
    netWeightKg: 18.4,
    grossWeightKg: 20.2,
    segments: ["Horeca", "Wholesale", "Industrial"],
  },
  {
    id: "DRUM_200L",
    label: "Drum 200L",
    capacityL: 200,
    unitsPerPallet: 4,
    palletsPerContainer: 20,
    nominalUnitsPerContainer: 80,
    netWeightKg: 184,
    grossWeightKg: 200,
    segments: ["Industrial", "Wholesale"],
  },
  {
    id: "IBC_1000L",
    label: "IBC 1000L",
    capacityL: 1000,
    unitsPerPallet: 1,
    palletsPerContainer: 18,
    nominalUnitsPerContainer: 18,
    netWeightKg: 920,
    grossWeightKg: 1050,
    segments: ["Industrial"],
  },
  {
    id: "FLEXITANK",
    label: "Flexitank",
    capacityL: 24000,
    unitsPerPallet: null,
    palletsPerContainer: null,
    nominalUnitsPerContainer: 1,
    netWeightKg: 22080,
    grossWeightKg: 22500,
    segments: ["Industrial", "Wholesale"],
  },
  {
    id: "ISOTANK",
    label: "ISO Tank",
    capacityL: 26000,
    unitsPerPallet: null,
    palletsPerContainer: null,
    nominalUnitsPerContainer: 1,
    netWeightKg: 23920,
    grossWeightKg: 24500,
    segments: ["Industrial"],
  },
];

export function getIndustrialFormat(formatId) {
  return INDUSTRIAL_FORMATS.find(f => f.id === formatId) || null;
}

export function getIndustrialFormatLabel(formatId) {
  return getIndustrialFormat(formatId)?.label || formatId || "";
}

/**
 * Calculate total volume and weight for a jerrycan / industrial shipment.
 */
export function calcIndustrialShipment({ formatId, quantity }) {
  const fmt = getIndustrialFormat(formatId);
  if (!fmt || !quantity) return null;
  return {
    formatId,
    quantity,
    totalLiters:  parseFloat((quantity * fmt.capacityL).toFixed(0)),
    totalNetKg:   parseFloat((quantity * fmt.netWeightKg).toFixed(1)),
    totalGrossKg: parseFloat((quantity * fmt.grossWeightKg).toFixed(1)),
    containers:   Math.ceil(quantity / fmt.nominalUnitsPerContainer),
    pallets:      fmt.unitsPerPallet ? Math.ceil(quantity / fmt.unitsPerPallet) : null,
  };
}

/**
 * Validate jerrycan MOQ against container capacity.
 */
export function validateJerrycanMOQ(formatId, quantity) {
  const fmt = getIndustrialFormat(formatId);
  if (!fmt) return { valid: true };
  const min = Math.round(fmt.nominalUnitsPerContainer * 0.5);
  return {
    valid: quantity >= min,
    minRecommended: min,
    message: quantity < min
      ? `MOQ for ${fmt.label} is ${min} units (½ container minimum)`
      : `${fmt.label} quantity ${quantity} meets container MOQ`,
  };
}
