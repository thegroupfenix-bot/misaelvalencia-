/**
 * retailSkuEngine.js — V8.0 Retail Multi-SKU Engine for Export Oils
 * Manages multi-SKU oil export rows with per-SKU price, size, packaging, and volume.
 * Isolated. No LIVE_ANIMALS / frozen cargo coupling.
 */

import { getOilPrice, getAvailableSizes, getPackagingGroup } from "./oilsPricingEngine.js";
import { getPackagingCostPerUnit }                            from "./packagingCostEngine.js";
import { getCapacityPreset }                                  from "./logisticsCapacityEngine.js";

let _id = 1;

/**
 * Create a blank oil SKU row.
 */
export function createOilSku(overrides = {}) {
  return {
    _id:           _id++,
    productId:     "",
    packagingType: "PET_BOTTLE",
    sizeId:        "",
    incoterm:      "FOB",
    pricePerUnit:  0,
    quantity:      0,
    unitsPerCarton: 12,
    marketSegment: "",
    isOEM:         false,
    isPrivateLabel: false,
    isHoreca:      false,
    notes:         "",
    ...overrides,
  };
}

/**
 * Auto-populate price from matrix for a SKU.
 */
export function autoPopulateSkuPrice(sku) {
  if (!sku.productId || !sku.packagingType || !sku.sizeId) return sku;
  const price = getOilPrice(sku.productId, sku.packagingType, sku.sizeId, sku.incoterm || "FOB");
  return { ...sku, pricePerUnit: price ?? sku.pricePerUnit };
}

/**
 * Calculate shipment value for one oil SKU.
 */
export function calcOilSkuValue(sku) {
  return parseFloat(((sku.pricePerUnit || 0) * (sku.quantity || 0)).toFixed(2));
}

/**
 * Calculate packaging cost for one SKU.
 */
export function calcOilSkuPackagingCost(sku) {
  return parseFloat((getPackagingCostPerUnit(sku.packagingType, sku.sizeId) * (sku.quantity || 0)).toFixed(2));
}

/**
 * Aggregate multi-SKU summary.
 * @param {object[]} skus
 * @returns {object}
 */
export function calcOilMultiSkuSummary(skus) {
  if (!skus || skus.length === 0) return null;

  let totalFOB         = 0;
  let totalUnits       = 0;
  let totalPackaging   = 0;
  let totalLiters      = 0;

  for (const sku of skus) {
    const qty   = parseFloat(sku.quantity)   || 0;
    const price = parseFloat(sku.pricePerUnit) || 0;
    const preset = getCapacityPreset(sku.packagingType, sku.sizeId);
    const litValue = preset ? (qty / (preset.unitsPerCarton || 1)) : 0;

    totalFOB       += qty * price;
    totalUnits     += qty;
    totalPackaging += getPackagingCostPerUnit(sku.packagingType, sku.sizeId) * qty;
    totalLiters    += litValue;
  }

  return {
    totalFOB:       parseFloat(totalFOB.toFixed(2)),
    totalUnits,
    totalPackaging: parseFloat(totalPackaging.toFixed(2)),
    totalLiters:    parseFloat(totalLiters.toFixed(2)),
    skuCount:       skus.length,
  };
}

/**
 * Validate oil SKU — checks required fields and price availability.
 * Returns array of error strings.
 */
export function validateOilSku(sku) {
  const errors = [];
  if (!sku.productId)     errors.push("Oil type required");
  if (!sku.packagingType) errors.push("Packaging type required");
  if (!sku.sizeId)        errors.push("Size required");
  if (!sku.incoterm)      errors.push("Incoterm required");
  if (!(sku.quantity > 0)) errors.push("Quantity must be > 0");
  if (!(sku.pricePerUnit > 0)) errors.push("Price per unit required");

  if (sku.productId && sku.packagingType && sku.sizeId) {
    const matrixPrice = getOilPrice(sku.productId, sku.packagingType, sku.sizeId, sku.incoterm);
    if (matrixPrice === null) errors.push(`No price matrix entry for ${sku.productId} / ${sku.packagingType} / ${sku.sizeId}`);
  }

  return errors;
}
