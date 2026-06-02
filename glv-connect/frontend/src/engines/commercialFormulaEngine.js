/**
 * commercialFormulaEngine.js — GLV Commercial Engine V4 Formula Resolution.
 *
 * Canonical calculation cases:
 *
 *   CASE 1 — FRUIT EXPORT (packaging-based weight pricing)
 *     2400 boxes × 27 kg/box = 64,800 kg × USD 5/kg = USD 324,000
 *
 *   CASE 2 — SOYBEAN OIL (unit pricing)
 *     1000 jerrycans × USD 48/jerrycan = USD 48,000
 *
 *   CASE 3 — PULP / BAG (bags × weight × price)
 *     5000 bags × 5 kg/bag = 25,000 kg × USD 2.5/kg = USD 62,500
 *
 *   CASE 4 — LIVE ANIMALS (headcount × avgWeight × price/kg)
 *     25,000 heads × 45 kg = 1,125,000 kg × USD 6/kg = USD 6,750,000
 *
 * CRITICAL: engineUnitPrice is the sole price source. No PRICE_TABLE fallback.
 * CRITICAL: isLiveAnimalRow check uses category === "LIVE_ANIMALS", NOT product string.
 */

import { getCategoryProfile } from "./categoryProfiles.js";

const FREQ_MULTIPLIERS = {
  ONE_SHIPMENT: 1,
  MONTHLY:      12,
  BIMONTHLY:    6,
  QUARTERLY:    4,
  CUSTOM:       1,
};

/**
 * Resolve shipment value and weight for a single commercial row.
 *
 * @param {object} inputs
 * @returns {{ shipmentKg: number|null, shipmentValue: number, priceMode: string, details: object }}
 */
export function resolveFormula(inputs) {
  const {
    category,
    quantity,
    unitType,
    unitPrice,
    commercialUnit,
    // Packaging-based
    unitsPerPackage,
    netWeightPerUnit,
    // Livestock
    headCount,
    avgWeight,
    // Container
    containerCapacity,
  } = inputs;

  const qty          = parseFloat(quantity)        || 0;
  const price        = parseFloat(unitPrice)       || 0;
  const unitsPerPkg  = parseFloat(unitsPerPackage) || 0;
  const netWtPerUnit = parseFloat(netWeightPerUnit)|| 0;
  const heads        = parseFloat(headCount)       || 0;
  const avgWt        = parseFloat(avgWeight)       || 0;
  const containerCap = parseFloat(containerCapacity) || 27;

  if (!price) {
    return { shipmentKg: 0, shipmentValue: 0, priceMode: commercialUnit || "perKg", details: {} };
  }

  const profile = getCategoryProfile(category);

  // ── CASE 4: LIVE ANIMALS ──────────────────────────────────────────────────
  if (profile?.supportsLivestock || category === "LIVE_ANIMALS") {
    const liveKg = heads > 0 && avgWt > 0 ? heads * avgWt : 0;
    return {
      shipmentKg:    liveKg,
      shipmentValue: liveKg * price,
      priceMode:     "perKg",
      details:       { heads, avgWeight: avgWt, liveKg },
    };
  }

  // ── CASE 1 & 3: PACKAGING-BASED WEIGHT PRICING ───────────────────────────
  // Applies when packaging breakdown is available AND pricing is per-weight
  if (
    unitsPerPkg > 0 && netWtPerUnit > 0 &&
    (!commercialUnit || commercialUnit === "perKg" || commercialUnit === "perMT")
  ) {
    const shipmentKg = unitsPerPkg * netWtPerUnit;
    const valuableKg = commercialUnit === "perMT" ? shipmentKg / 1000 : shipmentKg;
    return {
      shipmentKg,
      shipmentValue: valuableKg * price,
      priceMode:     commercialUnit || "perKg",
      details:       { packages: unitsPerPkg, netWeightPerUnit: netWtPerUnit, shipmentKg },
    };
  }

  // ── CASE 2: UNIT / PACKAGE PRICING (perBox, perJerrycan, perDrum, etc.) ──
  if (["perBox", "perJerrycan", "perDrum", "perUnit", "perPallet", "perBag", "perHead"].includes(commercialUnit)) {
    return {
      shipmentKg:    netWtPerUnit > 0 ? qty * netWtPerUnit : null,
      shipmentValue: qty * price,
      priceMode:     commercialUnit,
      details:       { packages: qty, pricePerPackage: price },
    };
  }

  // ── STANDARD WEIGHT/VOLUME PRICING ───────────────────────────────────────
  const unitStr = (unitType || "").toLowerCase();

  if (unitStr.includes("container") || unitStr.includes("contenedor")) {
    const kgTotal = qty * containerCap * 1000;
    return { shipmentKg: kgTotal, shipmentValue: kgTotal * price, priceMode: "perKg", details: { containers: qty, containerCap } };
  }

  if (unitStr.includes("mt") || unitStr.includes("tonelada")) {
    const kgTotal = qty * 1000;
    return { shipmentKg: kgTotal, shipmentValue: kgTotal * price, priceMode: "perKg", details: { quantityMT: qty, kgTotal } };
  }

  if (unitStr.includes("liter") || unitStr.includes("litro")) {
    return { shipmentKg: null, shipmentValue: qty * price, priceMode: "perLiter", details: { liters: qty } };
  }

  // Default: quantity in kg or plain units
  return {
    shipmentKg:    qty,
    shipmentValue: qty * price,
    priceMode:     commercialUnit || "perKg",
    details:       { quantity: qty },
  };
}

/**
 * Compute annual and contract totals from per-shipment value.
 *
 * @param {number} shipmentValue
 * @param {object} opts
 * @returns {{ annualValue, contractValue, shipmentsPerYear }}
 */
export function resolveAnnualValue(shipmentValue, { deliveryFrequency, numShipments, contractDuration } = {}) {
  const baseMultiplier    = FREQ_MULTIPLIERS[deliveryFrequency] || 1;
  const shipmentsPerYear  = deliveryFrequency === "CUSTOM"
    ? (parseFloat(numShipments) || 1)
    : baseMultiplier;
  const months            = parseFloat(contractDuration) || 12;
  const annualValue       = shipmentValue * shipmentsPerYear;
  const contractValue     = shipmentValue * shipmentsPerYear * (months / 12);
  return { annualValue, contractValue, shipmentsPerYear };
}

/**
 * Resolve MT display weight from quantity+unitType without contaminating pricePerKg.
 * Use ONLY for display purposes (CommercialSummary, PDF totalKg field).
 *
 * @param {number} qty
 * @param {string} unitType
 * @param {object} [opts]
 * @returns {number}
 */
export function resolveTotalKgDisplay(qty, unitType, { containerCapacityMT = 27 } = {}) {
  const q = parseFloat(qty) || 0;
  const u = (unitType || "").toLowerCase();
  if (u.includes("container") || u.includes("contenedor")) return q * containerCapacityMT * 1000;
  if (u.includes("mt") || u.includes("tonelada"))          return q * 1000;
  return q;
}
