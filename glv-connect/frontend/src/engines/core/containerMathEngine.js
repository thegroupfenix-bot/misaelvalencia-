/**
 * containerMathEngine.js — V9.1 Canonical Container Math Engine
 *
 * SINGLE SOURCE OF TRUTH for all container capacity calculations.
 * All other engines (logisticsCapacityEngine, OilsExportPanel, GlvPDF)
 * must derive container figures from this engine only.
 *
 * Canonical formula (40HQ):
 *   unitsPerContainer = cartonsPerPallet × palletsPerContainer × unitsPerCarton
 *
 * Weight formula:
 *   netWeightKg = unitsPerContainer × litersPerUnit × OIL_DENSITY_FACTOR
 *   grossWeightKg = netWeightKg × GROSS_TARE_FACTOR
 *
 * DO NOT duplicate formulas in JSX. DO NOT calculate in components.
 * DO NOT modify livestock / frozen cargo / fruits logic here.
 */

// ─── Physical constants ───────────────────────────────────────────────────────

export const OIL_DENSITY_KG_PER_L = 0.92;   // Vegetable oil density (standard)
export const GROSS_TARE_FACTOR     = 1.06;   // 6% carton/packaging tare over net
export const MAX_40HQ_PAYLOAD_KG   = 26480;  // 40HQ max payload kg (Flexi standard)
export const MAX_40HQ_VOLUME_M3    = 76.4;   // 40HQ internal volume m³
export const PALLETS_PER_40HQ      = 20;     // Standard pallet count per 40HQ

// ─── Liters per unit (bottle/pouch/can) ──────────────────────────────────────

export const LITERS_PER_UNIT = {
  "500ml":   0.500,
  "900ml":   0.900,
  "1000ml":  1.000,
  "2000ml":  2.000,
  "2500ml":  2.500,
  "3000ml":  3.000,
  "5000ml":  5.000,
  "10000ml": 10.00,
  "20L":     20.00,
};

// ─── Canonical carton configuration per group × size ─────────────────────────
// Each entry: { upc: units/carton, cpp: cartons/pallet, p: pallets/container }
// Canonical units = upc × cpp × p

export const CANONICAL_CARTON_CONFIG = {
  PET: {
    "900ml":  { upc: 20, cpp: 60, p: 20 }, // 20×60×20 = 24,000
    "1000ml": { upc: 20, cpp: 56, p: 20 }, // 20×56×20 = 22,400
    "2000ml": { upc: 12, cpp: 48, p: 20 }, // 12×48×20 = 11,520
    "2500ml": { upc: 12, cpp: 40, p: 20 }, // 12×40×20 =  9,600
    "3000ml": { upc:  8, cpp: 50, p: 20 }, //  8×50×20 =  8,000
    "5000ml": { upc:  6, cpp: 40, p: 20 }, //  6×40×20 =  4,800
    "10000ml":{ upc:  2, cpp: 40, p: 20 }, //  2×40×20 =  1,600
    "20L":    { upc:  1, cpp: 56, p: 20 }, //  1×56×20 =  1,120 (PET gallon)
  },
  POUCH: {
    "500ml":  { upc: 48, cpp: 66, p: 20 }, // 48×66×20 = 63,360 (flexible — high density)
    "1000ml": { upc: 24, cpp: 64, p: 20 }, // 24×64×20 = 30,720
    "2000ml": { upc: 12, cpp: 56, p: 20 }, // 12×56×20 = 13,440
    "3000ml": { upc:  8, cpp: 60, p: 20 }, //  8×60×20 =  9,600
    "5000ml": { upc:  6, cpp: 50, p: 20 }, //  6×50×20 =  6,000
  },
  JERRY: {
    "20L":    { upc:  1, cpp: 56, p: 20 }, //  1×56×20 =  1,120 ≈ 1,100 ✓
  },
};

// ─── Packaging group resolver (mirrors logisticsCapacityEngine) ───────────────

const JERRY_IDS = new Set(["JERRYCAN_20L","DRUM_200L","IBC_1000L","FLEXITANK","ISOTANK"]);
const POUCH_IDS = new Set([
  "RETAIL_POUCH","PILLOW_POUCH","LAMINATED_POUCH","MULTILAYER_POUCH","FLEXIBLE_OIL_POUCH",
  "DOYPACK","SPOUT_POUCH","STAND_UP_POUCH","GUSSET_POUCH","SIDE_SEAL_POUCH",
]);

export function resolvePackagingGroup(packagingType) {
  if (!packagingType) return "PET";
  if (JERRY_IDS.has(packagingType)) return "JERRY";
  if (POUCH_IDS.has(packagingType)) return "POUCH";
  return "PET";
}

// ─── Core canonical functions ─────────────────────────────────────────────────

/**
 * Get the canonical carton config for a packaging type + size.
 * Returns null if no config exists for the combination.
 */
export function getCanonicalConfig(packagingType, sizeId) {
  const group = resolvePackagingGroup(packagingType);
  return CANONICAL_CARTON_CONFIG[group]?.[sizeId] || null;
}

/**
 * Canonical units per container.
 * Formula: upc × cpp × p (single source of truth)
 *
 * @param {string} packagingType
 * @param {string} sizeId
 * @returns {number} canonical units per 40HQ container
 */
export function calcCanonicalUnitsPerContainer(packagingType, sizeId) {
  const cfg = getCanonicalConfig(packagingType, sizeId);
  if (!cfg) return 0;
  return cfg.upc * cfg.cpp * cfg.p;
}

/**
 * Canonical total cartons per container.
 * Formula: cpp × p
 */
export function calcCartonsPerContainer(packagingType, sizeId) {
  const cfg = getCanonicalConfig(packagingType, sizeId);
  if (!cfg) return 0;
  return cfg.cpp * cfg.p;
}

/**
 * Net weight per full 40HQ container (kg).
 * Formula: unitsPerContainer × litersPerUnit × OIL_DENSITY_KG_PER_L
 *
 * @param {string} packagingType
 * @param {string} sizeId
 * @returns {{ netKg: number, grossKg: number, withinPayload: boolean }}
 */
export function calcContainerWeight(packagingType, sizeId) {
  const units    = calcCanonicalUnitsPerContainer(packagingType, sizeId);
  const lpu      = LITERS_PER_UNIT[sizeId] || 0;
  const netKg    = units * lpu * OIL_DENSITY_KG_PER_L;
  const grossKg  = netKg * GROSS_TARE_FACTOR;
  return {
    netKg:         Math.round(netKg),
    grossKg:       Math.round(grossKg),
    netMT:         parseFloat((netKg / 1000).toFixed(2)),
    grossMT:       parseFloat((grossKg / 1000).toFixed(2)),
    withinPayload: grossKg <= MAX_40HQ_PAYLOAD_KG,
  };
}

/**
 * Full container logistics object for a given packaging + size.
 * This is the single object that all components must consume.
 *
 * @returns {object|null} canonical logistics, or null if no config
 */
export function calcCanonicalContainerLogistics(packagingType, sizeId) {
  const cfg = getCanonicalConfig(packagingType, sizeId);
  if (!cfg) return null;

  const unitsPerContainer = cfg.upc * cfg.cpp * cfg.p;
  const cartonsPerContainer = cfg.cpp * cfg.p;
  const weight = calcContainerWeight(packagingType, sizeId);

  return {
    // Formula source
    unitsPerCarton:       cfg.upc,
    cartonsPerPallet:     cfg.cpp,
    palletsPerContainer:  cfg.p,

    // Derived (do not recalculate elsewhere)
    unitsPerContainer,
    cartonsPerContainer,
    netWeightKg:          weight.netKg,
    grossWeightKg:        weight.grossKg,
    netWeightMT:          weight.netMT,
    grossWeightMT:        weight.grossMT,
    withinPayload:        weight.withinPayload,

    // Container type (fixed for oils standard export)
    containerType: "40HQ",
    maxPayloadKg:  MAX_40HQ_PAYLOAD_KG,

    // Utilization
    payloadUtilizationPct: weight.grossKg > 0
      ? Math.round((weight.grossKg / MAX_40HQ_PAYLOAD_KG) * 100)
      : 0,
  };
}

/**
 * Validate that a given unit count is consistent with container math.
 * Used by the auto-validation block.
 *
 * @param {string} packagingType
 * @param {string} sizeId
 * @param {number} reportedUnits — units shown in summary
 * @returns {{ valid: boolean, canonical: number, delta: number, deltaFraction: number }}
 */
export function validateUnitConsistency(packagingType, sizeId, reportedUnits) {
  const canonical = calcCanonicalUnitsPerContainer(packagingType, sizeId);
  if (!canonical || !reportedUnits) return { valid: true, canonical, delta: 0, deltaFraction: 0 };

  const delta = Math.abs(reportedUnits - canonical);
  const deltaFraction = canonical > 0 ? delta / canonical : 0;
  // Tolerate up to 5% variance (rounding, partial loads)
  const valid = deltaFraction <= 0.05;

  return { valid, canonical, reported: reportedUnits, delta, deltaFraction: parseFloat(deltaFraction.toFixed(4)) };
}

/**
 * Canonical test cases — used by CI and validation agents.
 * DO NOT modify without updating CI guards.
 */
export const CANONICAL_TEST_CASES = [
  { name: "900ml PET",    packagingType: "PET_BOTTLE",  sizeId: "900ml",  expectedUnits: 24000, expectedNetMT: [19, 21] },
  { name: "1L PET",       packagingType: "PET_BOTTLE",  sizeId: "1000ml", expectedUnits: 22400, expectedNetMT: [19, 22] },
  { name: "5L PET",       packagingType: "PET_BOTTLE",  sizeId: "5000ml", expectedUnits:  4800, expectedNetMT: [20, 24] },
  { name: "1L POUCH",     packagingType: "PILLOW_POUCH",sizeId: "1000ml", expectedUnits: 30720, expectedNetMT: [26, 32] },
  { name: "20L JERRYCAN", packagingType: "JERRYCAN_20L",sizeId: "20L",    expectedUnits:  1120, expectedNetMT: [19, 22] },
];

/**
 * Run all canonical test cases. Returns failures array (empty = all pass).
 */
export function runCanonicalTests() {
  return CANONICAL_TEST_CASES.map(tc => {
    const actual = calcCanonicalUnitsPerContainer(tc.packagingType, tc.sizeId);
    const weight = calcContainerWeight(tc.packagingType, tc.sizeId);
    const unitsMatch = actual === tc.expectedUnits;
    const weightOk = weight.netMT >= tc.expectedNetMT[0] && weight.netMT <= tc.expectedNetMT[1];
    return {
      name: tc.name,
      pass: unitsMatch && weightOk,
      actualUnits: actual, expectedUnits: tc.expectedUnits,
      actualNetMT: weight.netMT, expectedNetMTRange: tc.expectedNetMT,
    };
  });
}
