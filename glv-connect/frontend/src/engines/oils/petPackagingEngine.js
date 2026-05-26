/**
 * petPackagingEngine.js — V8.0 PET Bottle Packaging Engine for Export Oils
 * Isolated. Covers retail PET and 20L carboy configs.
 */

export const PET_OIL_SIZES = [
  { id: "900ml",  label: "900 ml",  litValue: 0.90, netWeightKg: 0.828 },
  { id: "1000ml", label: "1 L",     litValue: 1.00, netWeightKg: 0.920 },
  { id: "2000ml", label: "2 L",     litValue: 2.00, netWeightKg: 1.840 },
  { id: "2500ml", label: "2.5 L",   litValue: 2.50, netWeightKg: 2.300 },
  { id: "3000ml", label: "3 L",     litValue: 3.00, netWeightKg: 2.760 },
  { id: "5000ml", label: "5 L",     litValue: 5.00, netWeightKg: 4.600 },
  { id: "10000ml",label: "10 L",    litValue: 10.0, netWeightKg: 9.200 },
  { id: "20L",    label: "20 L",    litValue: 20.0, netWeightKg: 18.40 },
];

// Units per carton by size
export const PET_CARTON_CONFIG = {
  "900ml":  { unitsPerCarton: [12, 15, 18], default: 12 },
  "1000ml": { unitsPerCarton: [12, 15],     default: 12 },
  "2000ml": { unitsPerCarton: [6, 9],       default: 6  },
  "2500ml": { unitsPerCarton: [6, 8],       default: 6  },
  "3000ml": { unitsPerCarton: [4, 6],       default: 4  },
  "5000ml": { unitsPerCarton: [4, 6],       default: 4  },
  "10000ml":{ unitsPerCarton: [2, 4],       default: 2  },
  "20L":    { unitsPerCarton: [1],          default: 1  },
};

// Commercial segmentation for PET
export const PET_MARKET_SEGMENTS = ["Retail", "PrivateLabel", "Caribbean", "Venezuela", "MiddleEast", "Wholesale"];

export function getPetSizeLabel(sizeId) {
  return PET_OIL_SIZES.find(s => s.id === sizeId)?.label || sizeId || "";
}

export function getPetCartonOptions(sizeId) {
  return PET_CARTON_CONFIG[sizeId]?.unitsPerCarton || [12];
}

export function getPetDefaultCarton(sizeId) {
  return PET_CARTON_CONFIG[sizeId]?.default || 12;
}

export function getPetNetWeightKg(sizeId) {
  return PET_OIL_SIZES.find(s => s.id === sizeId)?.netWeightKg || 0;
}

/**
 * Calculate gross carton weight (net + carton tare ~0.35–0.6 kg).
 */
export function getPetCartonGrossKg(sizeId, unitsPerCarton) {
  const netKg = getPetNetWeightKg(sizeId);
  const tare = 0.45;
  return parseFloat((netKg * unitsPerCarton + tare).toFixed(2));
}
