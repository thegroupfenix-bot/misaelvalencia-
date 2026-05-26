/**
 * exportFreightEngine.js — V8.0 Destination Freight & Insurance Matrix
 * Isolated. Only FOB / CFR / CIF incoterms supported.
 */

// ─── Export markets ───────────────────────────────────────────────────────────

export const EXPORT_MARKETS = [
  { id: "Caribbean",    label: "Caribbean"      },
  { id: "Venezuela",    label: "Venezuela"      },
  { id: "Africa",       label: "Africa"         },
  { id: "MiddleEast",   label: "Middle East"    },
  { id: "Horeca",       label: "Horeca"         },
  { id: "Retail",       label: "Retail"         },
  { id: "Wholesale",    label: "Wholesale"      },
  { id: "PrivateLabel", label: "Private Label"  },
];

// ─── Destination matrix ───────────────────────────────────────────────────────
// freightUSD: base ocean freight per 40HQ in USD
// insuranceRatio: decimal fraction of CIF value
// portSurcharge: USD flat per container
// regionalMultiplier: applied to freightUSD

export const DESTINATION_MATRIX = {
  Venezuela:          { label: "Venezuela",          market: "Venezuela",  freightUSD: 1800, insuranceRatio: 0.0025, portSurcharge: 150, regionalMultiplier: 1.0  },
  DominicanRepublic:  { label: "Dominican Republic", market: "Caribbean",  freightUSD: 1600, insuranceRatio: 0.0020, portSurcharge: 120, regionalMultiplier: 1.0  },
  Jamaica:            { label: "Jamaica",            market: "Caribbean",  freightUSD: 1750, insuranceRatio: 0.0022, portSurcharge: 130, regionalMultiplier: 1.05 },
  TrinidadTobago:     { label: "Trinidad & Tobago",  market: "Caribbean",  freightUSD: 1900, insuranceRatio: 0.0022, portSurcharge: 140, regionalMultiplier: 1.05 },
  Guyana:             { label: "Guyana",             market: "Caribbean",  freightUSD: 2000, insuranceRatio: 0.0025, portSurcharge: 150, regionalMultiplier: 1.10 },
  Barbados:           { label: "Barbados",           market: "Caribbean",  freightUSD: 1850, insuranceRatio: 0.0022, portSurcharge: 130, regionalMultiplier: 1.05 },
  Curacao:            { label: "Curacao",            market: "Caribbean",  freightUSD: 1700, insuranceRatio: 0.0020, portSurcharge: 120, regionalMultiplier: 1.0  },
  Aruba:              { label: "Aruba",              market: "Caribbean",  freightUSD: 1700, insuranceRatio: 0.0020, portSurcharge: 120, regionalMultiplier: 1.0  },
  Haiti:              { label: "Haiti",              market: "Caribbean",  freightUSD: 1650, insuranceRatio: 0.0025, portSurcharge: 130, regionalMultiplier: 1.05 },
};

export const DESTINATIONS = Object.keys(DESTINATION_MATRIX);

// ─── Freight calculation ──────────────────────────────────────────────────────

/**
 * Total ocean freight cost for a container to a destination.
 * @param {string} destinationId
 * @param {number} [containers=1]
 * @returns {number} USD
 */
export function calcContainerFreight(destinationId, containers = 1) {
  const d = DESTINATION_MATRIX[destinationId];
  if (!d) return 0;
  return parseFloat(((d.freightUSD * d.regionalMultiplier + d.portSurcharge) * containers).toFixed(2));
}

/**
 * Per-unit freight allocation.
 * @param {string} destinationId
 * @param {number} unitsPerContainer
 * @returns {number} USD/unit
 */
export function calcFreightPerUnit(destinationId, unitsPerContainer) {
  if (!unitsPerContainer) return 0;
  const totalFreight = calcContainerFreight(destinationId, 1);
  return parseFloat((totalFreight / unitsPerContainer).toFixed(4));
}

/**
 * Insurance cost on a FOB value (applied to full shipment value).
 * @param {number} fobTotalUSD
 * @param {string} destinationId
 * @returns {number} USD
 */
export function calcInsurance(fobTotalUSD, destinationId) {
  const d = DESTINATION_MATRIX[destinationId];
  if (!d) return 0;
  return parseFloat((fobTotalUSD * d.insuranceRatio).toFixed(2));
}

/**
 * Calculate CFR per unit: FOB/unit + freight/unit.
 */
export function calcCFRPerUnit(fobPerUnit, destinationId, unitsPerContainer) {
  return parseFloat((fobPerUnit + calcFreightPerUnit(destinationId, unitsPerContainer)).toFixed(4));
}

/**
 * Calculate CIF per unit: CFR/unit + insurance/unit.
 */
export function calcCIFPerUnit(fobPerUnit, destinationId, unitsPerContainer) {
  const cfr = calcCFRPerUnit(fobPerUnit, destinationId, unitsPerContainer);
  const insurancePerUnit = parseFloat((fobPerUnit * (DESTINATION_MATRIX[destinationId]?.insuranceRatio || 0)).toFixed(4));
  return parseFloat((cfr + insurancePerUnit).toFixed(4));
}

/**
 * Get destinations for a given market segment.
 */
export function getDestinationsForMarket(marketId) {
  return Object.entries(DESTINATION_MATRIX)
    .filter(([, d]) => d.market === marketId)
    .map(([id, d]) => ({ id, ...d }));
}
