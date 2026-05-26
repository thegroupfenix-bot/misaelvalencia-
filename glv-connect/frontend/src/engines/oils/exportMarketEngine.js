/**
 * exportMarketEngine.js — V8.0 Export Market Segmentation Engine
 * Defines market segments, packaging compatibility, and commercial strategy per segment.
 * Isolated. No LIVE_ANIMALS / frozen cargo coupling.
 */

// ─── Market segment definitions ───────────────────────────────────────────────

export const MARKET_SEGMENTS = {
  Retail: {
    label: "Retail",
    description: "Supermarkets, modern trade, premium retail",
    preferredPackaging: ["PET_BOTTLE", "SPOUT_POUCH", "TETRA_PACK"],
    preferredSizes: ["900ml", "1000ml", "2000ml", "3000ml"],
    privateLabel: true,
    horecaCompatible: false,
    moqUnits: 22000,
    color: "#059669",
  },
  PrivateLabel: {
    label: "Private Label",
    description: "OEM production for retail brands",
    preferredPackaging: ["PET_BOTTLE", "RETAIL_POUCH"],
    preferredSizes: ["900ml", "1000ml", "2000ml", "5000ml"],
    privateLabel: true,
    horecaCompatible: false,
    moqUnits: 44000,
    color: "#7c3aed",
  },
  Africa: {
    label: "Africa",
    description: "Mass distribution, price-sensitive markets",
    preferredPackaging: ["RETAIL_POUCH", "DOYPACK"],
    preferredSizes: ["500ml", "1000ml", "2000ml"],
    privateLabel: false,
    horecaCompatible: false,
    moqUnits: 30000,
    color: "#b45309",
  },
  Caribbean: {
    label: "Caribbean",
    description: "Caribbean economy — volume retail and institutional",
    preferredPackaging: ["PET_BOTTLE", "RETAIL_POUCH", "SPOUT_POUCH"],
    preferredSizes: ["900ml", "1000ml", "2000ml", "5000ml"],
    privateLabel: true,
    horecaCompatible: true,
    moqUnits: 22000,
    color: "#0369a1",
  },
  Venezuela: {
    label: "Venezuela",
    description: "Mass distribution — price-sensitive volume",
    preferredPackaging: ["PET_BOTTLE", "RETAIL_POUCH"],
    preferredSizes: ["900ml", "1000ml", "2000ml", "2500ml"],
    privateLabel: false,
    horecaCompatible: false,
    moqUnits: 22000,
    color: "#0369a1",
  },
  MiddleEast: {
    label: "Middle East",
    description: "Premium import, Halal-certified",
    preferredPackaging: ["PET_BOTTLE", "TETRA_PACK"],
    preferredSizes: ["1000ml", "2000ml", "3000ml", "5000ml"],
    privateLabel: true,
    horecaCompatible: false,
    moqUnits: 22000,
    color: "#d97706",
  },
  Horeca: {
    label: "Horeca",
    description: "Hotels, restaurants, catering — foodservice supply",
    preferredPackaging: ["JERRYCAN_20L", "IBC_1000L"],
    preferredSizes: ["20L"],
    privateLabel: false,
    horecaCompatible: true,
    moqUnits: 1050,
    color: "#dc2626",
  },
  Wholesale: {
    label: "Wholesale",
    description: "Bulk wholesale — industrial and distribution",
    preferredPackaging: ["JERRYCAN_20L", "DRUM_200L", "FLEXITANK"],
    preferredSizes: ["20L"],
    privateLabel: false,
    horecaCompatible: true,
    moqUnits: 1050,
    color: "#475569",
  },
};

export const MARKET_IDS = Object.keys(MARKET_SEGMENTS);

// ─── Compatibility helpers ────────────────────────────────────────────────────

/**
 * Get preferred packaging types for a market.
 */
export function getPreferredPackaging(marketId) {
  return MARKET_SEGMENTS[marketId]?.preferredPackaging || [];
}

/**
 * Get preferred sizes for a market.
 */
export function getPreferredSizes(marketId) {
  return MARKET_SEGMENTS[marketId]?.preferredSizes || [];
}

/**
 * Get MOQ for a market.
 */
export function getMarketMOQ(marketId) {
  return MARKET_SEGMENTS[marketId]?.moqUnits || 0;
}

/**
 * Check if a packaging type is preferred for a given market.
 */
export function isPackagingPreferredForMarket(packagingType, marketId) {
  return getPreferredPackaging(marketId).includes(packagingType);
}

/**
 * Get commercial segmentation label for PDF.
 */
export function getMarketSegmentLabel(marketId) {
  return MARKET_SEGMENTS[marketId]?.label || marketId || "";
}

/**
 * Get markets that support private label.
 */
export function getPrivateLabelMarkets() {
  return MARKET_IDS.filter(id => MARKET_SEGMENTS[id].privateLabel);
}

/**
 * Get markets that are horeca-compatible.
 */
export function getHorecaMarkets() {
  return MARKET_IDS.filter(id => MARKET_SEGMENTS[id].horecaCompatible);
}
