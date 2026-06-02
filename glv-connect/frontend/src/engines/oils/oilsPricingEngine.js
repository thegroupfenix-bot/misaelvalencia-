/**
 * oilsPricingEngine.js — V8.0 Export Oils Price Matrix Engine
 * Isolated from all other category engines. No cross-contamination with LIVE_ANIMALS / frozen cargo.
 *
 * Products: PALM_OIL_RBD, PALM_OLEIN, SOYBEAN_OIL_RBD, SUNFLOWER_OIL_RBD,
 *           BLENDED_VEGETABLE_OIL, COOKING_OIL_BLEND
 * Incoterms supported: FOB | CFR | CIF only.
 */

// ─── Product registry ─────────────────────────────────────────────────────────

export const OIL_PRODUCTS = [
  { id: "PALM_OIL_RBD",           label: "Palm Oil RBD",              defaultMarket: "Caribbean" },
  { id: "PALM_OLEIN",             label: "Palm Olein",                defaultMarket: "Caribbean" },
  { id: "SOYBEAN_OIL_RBD",        label: "Soybean Oil RBD",           defaultMarket: "Caribbean" },
  { id: "SUNFLOWER_OIL_RBD",      label: "Sunflower Oil RBD",         defaultMarket: "Retail"    },
  { id: "BLENDED_VEGETABLE_OIL",  label: "Blended Vegetable Oil",     defaultMarket: "Wholesale" },
  { id: "COOKING_OIL_BLEND",      label: "Cooking Oil Blend",         defaultMarket: "Horeca"    },
];

export const OIL_INCOTERMS = ["FOB", "CFR", "CIF"];

// ─── Price matrices ───────────────────────────────────────────────────────────
// Structure: PRICE_MATRIX[productId][packagingGroup][sizeId] = { FOB, CFR, CIF }
// packagingGroup: "PET" | "POUCH" | "JERRY"

export const PRICE_MATRIX = {
  PALM_OIL_RBD: {
    PET: {
      "900ml":  { FOB: 1.63, CFR: 1.69, CIF: 1.73 },
      "1000ml": { FOB: 1.74, CFR: 1.81, CIF: 1.85 },
      "2000ml": { FOB: 3.28, CFR: 3.38, CIF: 3.46 },
      "2500ml": { FOB: 3.95, CFR: 4.08, CIF: 4.15 },
      "3000ml": { FOB: 4.68, CFR: 4.82, CIF: 4.92 },
      "5000ml": { FOB: 7.62, CFR: 7.88, CIF: 8.02 },
      "10000ml":{ FOB: 14.95,CFR: 15.42,CIF: 15.68},
      "20L":    { FOB: 38.90,CFR: 40.45,CIF: 41.20},
    },
    POUCH: {
      "500ml":  { FOB: 0.82, CFR: 0.86, CIF: 0.89 },
      "1000ml": { FOB: 1.34, CFR: 1.40, CIF: 1.44 },
      "2000ml": { FOB: 2.58, CFR: 2.68, CIF: 2.75 },
      "3000ml": { FOB: 3.72, CFR: 3.85, CIF: 3.95 },
      "5000ml": { FOB: 5.95, CFR: 6.18, CIF: 6.32 },
    },
    JERRY: {
      "20L":    { FOB: 38.90,CFR: 40.45,CIF: 41.20},
    },
  },

  PALM_OLEIN: {
    // Derives from PALM_OIL_RBD — slight premium for clarity
    PET: {
      "900ml":  { FOB: 1.63, CFR: 1.69, CIF: 1.73 },
      "1000ml": { FOB: 1.74, CFR: 1.81, CIF: 1.85 },
      "2000ml": { FOB: 3.28, CFR: 3.38, CIF: 3.46 },
      "2500ml": { FOB: 3.95, CFR: 4.08, CIF: 4.15 },
      "3000ml": { FOB: 4.68, CFR: 4.82, CIF: 4.92 },
      "5000ml": { FOB: 7.62, CFR: 7.88, CIF: 8.02 },
      "10000ml":{ FOB: 14.95,CFR: 15.42,CIF: 15.68},
      "20L":    { FOB: 38.90,CFR: 40.45,CIF: 41.20},
    },
    POUCH: {
      "500ml":  { FOB: 0.82, CFR: 0.86, CIF: 0.89 },
      "1000ml": { FOB: 1.34, CFR: 1.40, CIF: 1.44 },
      "2000ml": { FOB: 2.58, CFR: 2.68, CIF: 2.75 },
      "3000ml": { FOB: 3.72, CFR: 3.85, CIF: 3.95 },
      "5000ml": { FOB: 5.95, CFR: 6.18, CIF: 6.32 },
    },
    JERRY: {
      "20L":    { FOB: 38.90,CFR: 40.45,CIF: 41.20},
    },
  },

  SOYBEAN_OIL_RBD: {
    PET: {
      "900ml":  { FOB: 1.52, CFR: 1.58, CIF: 1.62 },
      "1000ml": { FOB: 1.62, CFR: 1.69, CIF: 1.73 },
      "2000ml": { FOB: 2.98, CFR: 3.08, CIF: 3.15 },
      "2500ml": { FOB: 3.62, CFR: 3.75, CIF: 3.82 },
      "3000ml": { FOB: 4.28, CFR: 4.42, CIF: 4.52 },
      "5000ml": { FOB: 6.88, CFR: 7.12, CIF: 7.25 },
      "10000ml":{ FOB: 13.30,CFR: 13.75,CIF: 14.02},
      "20L":    { FOB: 25.95,CFR: 27.10,CIF: 27.85},
    },
    POUCH: {
      "500ml":  { FOB: 0.76, CFR: 0.80, CIF: 0.83 },
      "1000ml": { FOB: 1.24, CFR: 1.30, CIF: 1.34 },
      "2000ml": { FOB: 2.36, CFR: 2.45, CIF: 2.52 },
      "3000ml": { FOB: 3.42, CFR: 3.55, CIF: 3.65 },
      "5000ml": { FOB: 5.62, CFR: 5.85, CIF: 5.98 },
    },
    JERRY: {
      "20L":    { FOB: 25.95,CFR: 27.10,CIF: 27.85},
    },
  },

  SUNFLOWER_OIL_RBD: {
    PET: {
      "900ml":  { FOB: 1.85, CFR: 1.92, CIF: 1.97 },
      "1000ml": { FOB: 1.98, CFR: 2.05, CIF: 2.10 },
      "2000ml": { FOB: 3.58, CFR: 3.70, CIF: 3.78 },
      "2500ml": { FOB: 4.35, CFR: 4.50, CIF: 4.58 },
      "3000ml": { FOB: 5.05, CFR: 5.22, CIF: 5.32 },
      "5000ml": { FOB: 8.18, CFR: 8.45, CIF: 8.62 },
      "10000ml":{ FOB: 15.85,CFR: 16.35,CIF: 16.68},
      "20L":    { FOB: 30.50,CFR: 31.85,CIF: 32.65},
    },
    POUCH: {
      "500ml":  { FOB: 0.95, CFR: 1.00, CIF: 1.04 },
      "1000ml": { FOB: 1.48, CFR: 1.55, CIF: 1.60 },
      "2000ml": { FOB: 2.88, CFR: 3.00, CIF: 3.08 },
      "3000ml": { FOB: 4.05, CFR: 4.20, CIF: 4.32 },
      "5000ml": { FOB: 6.62, CFR: 6.88, CIF: 7.02 },
    },
    JERRY: {
      "20L":    { FOB: 30.50,CFR: 31.85,CIF: 32.65},
    },
  },

  BLENDED_VEGETABLE_OIL: {
    PET: {
      "900ml":  { FOB: 1.52, CFR: 1.58, CIF: 1.62 },
      "1000ml": { FOB: 1.62, CFR: 1.69, CIF: 1.73 },
      "2000ml": { FOB: 2.98, CFR: 3.08, CIF: 3.15 },
      "2500ml": { FOB: 3.62, CFR: 3.75, CIF: 3.82 },
      "3000ml": { FOB: 4.28, CFR: 4.42, CIF: 4.52 },
      "5000ml": { FOB: 6.88, CFR: 7.12, CIF: 7.25 },
      "10000ml":{ FOB: 13.30,CFR: 13.75,CIF: 14.02},
      "20L":    { FOB: 25.95,CFR: 27.10,CIF: 27.85},
    },
    POUCH: {
      "500ml":  { FOB: 0.76, CFR: 0.80, CIF: 0.83 },
      "1000ml": { FOB: 1.24, CFR: 1.30, CIF: 1.34 },
      "2000ml": { FOB: 2.36, CFR: 2.45, CIF: 2.52 },
      "3000ml": { FOB: 3.42, CFR: 3.55, CIF: 3.65 },
      "5000ml": { FOB: 5.62, CFR: 5.85, CIF: 5.98 },
    },
    JERRY: {
      "20L":    { FOB: 25.95,CFR: 27.10,CIF: 27.85},
    },
  },

  COOKING_OIL_BLEND: {
    PET: {
      "900ml":  { FOB: 1.52, CFR: 1.58, CIF: 1.62 },
      "1000ml": { FOB: 1.62, CFR: 1.69, CIF: 1.73 },
      "2000ml": { FOB: 2.98, CFR: 3.08, CIF: 3.15 },
      "2500ml": { FOB: 3.62, CFR: 3.75, CIF: 3.82 },
      "3000ml": { FOB: 4.28, CFR: 4.42, CIF: 4.52 },
      "5000ml": { FOB: 6.88, CFR: 7.12, CIF: 7.25 },
      "10000ml":{ FOB: 13.30,CFR: 13.75,CIF: 14.02},
      "20L":    { FOB: 25.95,CFR: 27.10,CIF: 27.85},
    },
    POUCH: {
      "500ml":  { FOB: 0.76, CFR: 0.80, CIF: 0.83 },
      "1000ml": { FOB: 1.24, CFR: 1.30, CIF: 1.34 },
      "2000ml": { FOB: 2.36, CFR: 2.45, CIF: 2.52 },
      "3000ml": { FOB: 3.42, CFR: 3.55, CIF: 3.65 },
      "5000ml": { FOB: 5.62, CFR: 5.85, CIF: 5.98 },
    },
    JERRY: {
      "20L":    { FOB: 25.95,CFR: 27.10,CIF: 27.85},
    },
  },
};

// ─── Packaging group resolver ─────────────────────────────────────────────────

const JERRY_TYPES = new Set(["JERRYCAN_20L"]);
const POUCH_TYPES_SET = new Set(["RETAIL_POUCH","PILLOW_POUCH","LAMINATED_POUCH","MULTILAYER_POUCH","FLEXIBLE_OIL_POUCH","DOYPACK","SPOUT_POUCH"]);

export function getPackagingGroup(packagingType) {
  if (JERRY_TYPES.has(packagingType)) return "JERRY";
  if (POUCH_TYPES_SET.has(packagingType)) return "POUCH";
  return "PET";
}

// ─── Core price lookup ────────────────────────────────────────────────────────

/**
 * Look up export price for an oil product.
 * @param {string} productId
 * @param {string} packagingType  — e.g. "PET_BOTTLE", "RETAIL_POUCH", "JERRYCAN_20L"
 * @param {string} sizeId         — e.g. "1000ml", "20L"
 * @param {string} incoterm       — "FOB" | "CFR" | "CIF"
 * @returns {number|null}
 */
export function getOilPrice(productId, packagingType, sizeId, incoterm = "FOB") {
  const group = getPackagingGroup(packagingType);
  return PRICE_MATRIX[productId]?.[group]?.[sizeId]?.[incoterm] ?? null;
}

/**
 * Get full FOB/CFR/CIF triplet for display.
 */
export function getOilPriceTriplet(productId, packagingType, sizeId) {
  const group = getPackagingGroup(packagingType);
  return PRICE_MATRIX[productId]?.[group]?.[sizeId] ?? null;
}

/**
 * Calculate freight component: CFR - FOB.
 */
export function calcFreightComponent(productId, packagingType, sizeId) {
  const triplet = getOilPriceTriplet(productId, packagingType, sizeId);
  if (!triplet) return null;
  return parseFloat((triplet.CFR - triplet.FOB).toFixed(4));
}

/**
 * Calculate insurance component: CIF - CFR.
 */
export function calcInsuranceComponent(productId, packagingType, sizeId) {
  const triplet = getOilPriceTriplet(productId, packagingType, sizeId);
  if (!triplet) return null;
  return parseFloat((triplet.CIF - triplet.CFR).toFixed(4));
}

/**
 * Return freight ratio as pct of FOB.
 */
export function calcFreightRatioPct(productId, packagingType, sizeId) {
  const triplet = getOilPriceTriplet(productId, packagingType, sizeId);
  if (!triplet || !triplet.FOB) return null;
  return parseFloat(((triplet.CFR - triplet.FOB) / triplet.FOB * 100).toFixed(2));
}

/**
 * Return insurance ratio as pct of CFR.
 */
export function calcInsuranceRatioPct(productId, packagingType, sizeId) {
  const triplet = getOilPriceTriplet(productId, packagingType, sizeId);
  if (!triplet || !triplet.CFR) return null;
  return parseFloat(((triplet.CIF - triplet.CFR) / triplet.CFR * 100).toFixed(2));
}

/**
 * List all available sizes for a product + packaging group.
 */
export function getAvailableSizes(productId, packagingType) {
  const group = getPackagingGroup(packagingType);
  const sizes = PRICE_MATRIX[productId]?.[group];
  if (!sizes) return [];
  return Object.keys(sizes);
}

/**
 * Validate that a product + packaging + size combination has prices.
 */
export function isOilPriceAvailable(productId, packagingType, sizeId) {
  return getOilPrice(productId, packagingType, sizeId, "FOB") !== null;
}
