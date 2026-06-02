/**
 * packagingCostEngine.js — V8.0 Oils Packaging Cost Engine
 * Provides per-unit packaging material cost estimates by packaging type and size.
 * Isolated. No cross-category contamination.
 */

// ─── Packaging cost table (USD/unit) ─────────────────────────────────────────

export const PACKAGING_COST = {
  PET: {
    "900ml":  { costPerUnit: 0.085, label: "PET 900ml bottle + cap + label" },
    "1000ml": { costPerUnit: 0.092, label: "PET 1L bottle + cap + label"    },
    "2000ml": { costPerUnit: 0.148, label: "PET 2L bottle + cap + label"    },
    "2500ml": { costPerUnit: 0.172, label: "PET 2.5L bottle + cap + label"  },
    "3000ml": { costPerUnit: 0.198, label: "PET 3L bottle + cap + label"    },
    "5000ml": { costPerUnit: 0.285, label: "PET 5L bottle + cap + label"    },
    "10000ml":{ costPerUnit: 0.520, label: "PET 10L container + cap + label"},
    "20L":    { costPerUnit: 1.250, label: "PET 20L carboy + cap + label"   },
  },
  POUCH: {
    "500ml":  { costPerUnit: 0.058, label: "Flexible film pouch 500ml + spout" },
    "1000ml": { costPerUnit: 0.082, label: "Flexible film pouch 1L + spout"    },
    "2000ml": { costPerUnit: 0.128, label: "Flexible film pouch 2L + spout"    },
    "3000ml": { costPerUnit: 0.175, label: "Flexible film pouch 3L + spout"    },
    "5000ml": { costPerUnit: 0.248, label: "Flexible film pouch 5L + spout"    },
  },
  JERRY: {
    "20L":    { costPerUnit: 2.150, label: "HDPE jerrycan 20L + cap + seal"    },
  },
};

// ─── Packaging types with commercial segmentation ─────────────────────────────

export const OIL_PACKAGING_TYPES = [
  // RETAIL
  { id: "PET_BOTTLE",   label: "PET Bottle",    group: "RETAIL",   capacityGroup: "PET",   segments: ["Retail","PrivateLabel","Wholesale"] },
  { id: "RETAIL_POUCH", label: "Retail Pouch",  group: "RETAIL",   capacityGroup: "POUCH", segments: ["Retail","Africa","Caribbean","PrivateLabel"] },
  { id: "TETRA_PACK",   label: "Tetra Pack",    group: "RETAIL",   capacityGroup: "PET",   segments: ["Retail","PrivateLabel"] },
  { id: "DOYPACK",      label: "Doypack",       group: "RETAIL",   capacityGroup: "POUCH", segments: ["Retail","Africa","Caribbean"] },
  { id: "SPOUT_POUCH",  label: "Spout Pouch",   group: "RETAIL",   capacityGroup: "POUCH", segments: ["Retail","Horeca","Caribbean"] },
  // INDUSTRIAL
  { id: "JERRYCAN_20L", label: "Jerrycan 20L",  group: "INDUSTRIAL", capacityGroup: "JERRY", segments: ["Horeca","Wholesale","Industrial"] },
  { id: "DRUM_200L",    label: "Drum 200L",     group: "INDUSTRIAL", capacityGroup: "JERRY", segments: ["Industrial","Wholesale"] },
  { id: "IBC_1000L",    label: "IBC 1000L",     group: "INDUSTRIAL", capacityGroup: "JERRY", segments: ["Industrial"] },
  { id: "FLEXITANK",    label: "Flexitank",     group: "INDUSTRIAL", capacityGroup: "JERRY", segments: ["Industrial","Wholesale"] },
  { id: "ISOTANK",      label: "ISO Tank",      group: "INDUSTRIAL", capacityGroup: "JERRY", segments: ["Industrial"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GROUP_MAP = {};
OIL_PACKAGING_TYPES.forEach(p => { GROUP_MAP[p.id] = p.capacityGroup; });

export function resolvePackagingCostGroup(packagingType) {
  return GROUP_MAP[packagingType] || "PET";
}

/**
 * Get packaging cost per unit for a given type + size.
 * @returns {number} USD/unit
 */
export function getPackagingCostPerUnit(packagingType, sizeId) {
  const group = resolvePackagingCostGroup(packagingType);
  return PACKAGING_COST[group]?.[sizeId]?.costPerUnit ?? 0;
}

/**
 * Get packaging label for PDF display.
 */
export function getPackagingCostLabel(packagingType, sizeId) {
  const group = resolvePackagingCostGroup(packagingType);
  return PACKAGING_COST[group]?.[sizeId]?.label ?? "";
}

/**
 * Get all packaging types for a given market segment.
 */
export function getPackagingForSegment(segmentId) {
  return OIL_PACKAGING_TYPES.filter(p => p.segments.includes(segmentId));
}

/**
 * Calculate total packaging cost for a container shipment.
 */
export function calcTotalPackagingCost(packagingType, sizeId, totalUnits) {
  return parseFloat((getPackagingCostPerUnit(packagingType, sizeId) * totalUnits).toFixed(2));
}
