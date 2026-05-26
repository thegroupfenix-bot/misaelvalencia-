/**
 * fruitsPdfAdapter.js — V9 Fruits → Normalized PDF Payload Adapter
 *
 * Maps fruit/produce export rows to the canonical PDF payload shape.
 * Handles box-weight pricing (boxes × kg/box × price/kg) and
 * packaging-based commercial calculations.
 *
 * DO NOT import oils engine or livestock logic.
 * DO NOT modify existing fruit formula calculations.
 */

import { createEmptyNormalizedPayload } from "../commercialCore.js";

function safe(v, fallback = null) {
  if (v === undefined || v === null || (typeof v === "number" && isNaN(v))) return fallback;
  return v;
}

function safeNum(v, fallback = 0) {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

/**
 * @param {object} row — raw CommercialEngine row (category must be "FRUITS")
 * @returns {object}   — normalized payload
 */
export function normalizeFruitsRow(row) {
  const base = createEmptyNormalizedPayload();
  const specs = (row && typeof row.specs === "object" && row.specs) ? row.specs : {};

  const quantity       = safeNum(row.quantity);
  const unitsPerBox    = safeNum(row.unitsPerBox || specs.unitsPerPackage);
  const netWeightKg    = safeNum(row.netWeightPerUnit || specs.netWeightPerUnit);
  const unitPrice      = safeNum(row.unitPrice);

  // Box-weight model: totalKg = quantity × netWeightKg, value = totalKg × price
  const totalNetKg     = quantity * netWeightKg;
  const shipmentTotal  = row.shipmentValue ? safeNum(row.shipmentValue) : totalNetKg * unitPrice;

  return {
    ...base,

    // Meta
    category:        "FRUITS",
    productLabel:    safe(row.product),
    exportFormat:    safe(row.exportFormat),
    _sourceCategory: "FRUITS",
    _adapterVersion: "fruits-v9",

    // Pricing
    incoterm:    safe(row.incoterms && row.incoterms[0]),
    pricePerUnit: unitPrice || null,
    currency:    safe(row.currency, "USD"),
    triplet:     null,

    // Volume
    unitsPerContainer: quantity || null,
    containerType:     safe(row.containerType),
    packagingType:     safe(row.packagingType),
    unitsPerCarton:    unitsPerBox || null,

    // Logistics
    destination:  safe(row.destination),
    origin:       safe(row.origin),
    containerType: safe(row.containerType),

    // Totals (box-weight model)
    fobTotal:      shipmentTotal,
    shipmentTotal,

    // Fruits-specific extra
    _fruits: {
      quantity,
      unitsPerBox,
      netWeightKgPerBox: netWeightKg,
      totalNetKg,
      specs,
    },
  };
}
