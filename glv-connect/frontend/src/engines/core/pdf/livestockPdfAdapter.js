/**
 * livestockPdfAdapter.js — V9 Livestock → Normalized PDF Payload Adapter
 *
 * CRITICAL: LIVE_ANIMALS data is NEVER transformed aggressively.
 * This adapter is a careful passthrough that maps existing livestock fields
 * to the canonical shape WITHOUT overriding any livestock-specific logic.
 *
 * DO NOT modify livestock headcount, weight, breed, or formula fields.
 * DO NOT apply oils pricing logic to livestock rows.
 * DO NOT reuse this adapter for any other category.
 */

import { createEmptyNormalizedPayload } from "../commercialCore.js";

function safe(v, fallback = null) {
  if (v === undefined || v === null || (typeof v === "number" && isNaN(v))) return fallback;
  return v;
}

/**
 * @param {object} row — raw CommercialEngine row (category must be "LIVE_ANIMALS")
 * @returns {object}   — normalized payload (livestock fields preserved)
 */
export function normalizeLivestockRow(row) {
  const base = createEmptyNormalizedPayload();

  // Preserve all livestock-specific data verbatim — no transformation
  return {
    ...base,

    // Meta
    category:        "LIVE_ANIMALS",
    productLabel:    safe(row.product),
    exportFormat:    null,
    _sourceCategory: "LIVE_ANIMALS",
    _adapterVersion: "livestock-v9",

    // Pricing — use row-level fields only (never oils engine)
    incoterm:    safe(row.incoterms && row.incoterms[0]),
    pricePerUnit: null,
    currency:    safe(row.currency, "USD"),
    triplet:     null,

    // Livestock-specific fields (stored in extra for PDF renderer)
    _livestock: {
      headCount:    safe(row.headCount),
      avgWeightKg:  safe(row.avgWeight),
      species:      safe(row.specs?.species),
      breeds:       Array.isArray(row.specs?.breeds) ? row.specs.breeds : [],
      origin:       safe(row.origin),
      cargoType:    safe(row.cargoType),
      incoterms:    Array.isArray(row.incoterms) ? row.incoterms : [],
      incotermPrices: (row.incotermPrices && typeof row.incotermPrices === "object") ? row.incotermPrices : {},
    },

    // Logistics
    origin:       safe(row.origin),
    destination:  safe(row.destination),
    containerType: safe(row.containerType),
  };
}
