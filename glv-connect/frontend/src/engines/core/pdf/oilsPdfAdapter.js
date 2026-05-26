/**
 * oilsPdfAdapter.js — V9 Oils → Normalized PDF Payload Adapter
 *
 * Transforms a CommercialEngine row with category === "OILS" and an
 * attached oilsConfig into the canonical PDF payload shape.
 *
 * Safety contract: every field uses a null-safe coalesce — never throws,
 * never returns undefined. Consumers must handle null fields gracefully.
 */

import { createEmptyNormalizedPayload, calcCFRTotal, calcCIFTotal, calcFOBTotal } from "../commercialCore.js";

function safe(v, fallback = null) {
  if (v === undefined || v === null || (typeof v === "number" && isNaN(v))) return fallback;
  return v;
}

function safeNum(v, fallback = 0) {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * @param {object} row — raw CommercialEngine row (category must be "OILS")
 * @returns {object}   — normalized payload
 */
export function normalizeOilsRow(row) {
  const base   = createEmptyNormalizedPayload();
  const cfg    = (row && typeof row.oilsConfig === "object" && row.oilsConfig) ? row.oilsConfig : {};
  const triplet = cfg.triplet || null;

  const pricePerUnit    = safeNum(cfg.basePrice);
  const unitsPerCont    = safeNum(cfg.unitsPerContainer);
  const freightUSD      = safeNum(cfg.freightUSD);
  const insuranceUSD    = safeNum(cfg.insuranceUSD);
  const pkgCostPerUnit  = safeNum(cfg.pkgCostPerUnit);
  const fobTotal        = calcFOBTotal({ pricePerUnit, unitsPerContainer: unitsPerCont });
  const cfrTotal        = calcCFRTotal({ fobTotal, freightUSD });
  const cifTotal        = calcCIFTotal({ cfrTotal, insuranceUSD });

  const incoterm = safe(cfg.incoterm, "FOB");
  const shipmentTotal = incoterm === "CIF" ? cifTotal : incoterm === "CFR" ? cfrTotal : fobTotal;

  return {
    ...base,

    // Meta
    category:        "OILS",
    productLabel:    safe(cfg.productId),
    exportFormat:    safe(cfg.packagingType),
    _sourceCategory: "OILS",
    _adapterVersion: "oils-v9",

    // Pricing
    incoterm,
    pricePerUnit,
    currency:        "USD",
    triplet,

    // Volume
    unitsPerContainer:  unitsPerCont,
    containerType:      safe(cfg.containerType, "40HQ"),
    packagingType:      safe(cfg.packagingType),
    sizeId:             safe(cfg.sizeId),
    unitsPerCarton:     safeNum(cfg.unitsPerCarton),

    // Logistics
    destination:  safe(cfg.destination),
    freightUSD,
    insuranceUSD,

    // Totals
    fobTotal,
    cfrTotal,
    cifTotal,
    shipmentTotal,
    packagingCostPerUnit: pkgCostPerUnit,
    packagingCostTotal:   pkgCostPerUnit * unitsPerCont,

    // Commercial terms
    moq:              safe(cfg.moq),
    frequency:        safe(cfg.frequency),
    contractDuration: safe(cfg.contractDuration),
    shelfLife:        safe(cfg.shelfLife),
    origin:           safe(cfg.origin),
    certifications:   safeArr(cfg.certifications),

    // Technical spec (oils-specific)
    grade:        safe(cfg.grade),
    gmoStatus:    safe(cfg.gmoStatus),
    oilProductId: safe(cfg.productId),
    market:       safe(cfg.market),

    // Admin financials (only present if oilsConfig includes them)
    simulation: cfg.simulation || null,

    // Multi-SKU
    skus:       safeArr(cfg.skus),
    skuSummary: cfg.skuSummary || null,
  };
}
