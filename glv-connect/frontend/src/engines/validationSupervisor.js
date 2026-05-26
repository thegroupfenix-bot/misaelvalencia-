/**
 * validationSupervisor.js — GLV Commercial Document Validation Supervisor V7.1.
 *
 * 24 mandatory validation checks before any PDF generation or document submission:
 *
 *   VAL-001  Pricing consistency           — unit price must be > 0
 *   VAL-002  Unit consistency              — unit type compatible with category
 *   VAL-003  Packaging consistency         — packaging field filled for packaged categories
 *   VAL-004  PDF overflow risk             — description length within safe limits
 *   VAL-005  Media contamination           — enforced server-side, surfaced as info
 *   VAL-006  Country contamination         — destination country must be set
 *   VAL-007  Port contamination            — destination port should be set
 *   VAL-008  Container mismatch            — selected container compatible with category
 *   VAL-009  Stale cache detection         — multiple categories in one document
 *   VAL-010  Formula mismatch              — required fields present for category engine
 *   VAL-011  Commercial unit required      — liquid/packaged categories must declare sale unit
 *   VAL-012  Packaging mode required       — packaged categories must declare packaging mode
 *   VAL-013  Retail size required          — retail bottle/can packaging must declare presentation size
 *   VAL-014  Box engine units required     — retail carton packaging with size must declare units/box
 *   VAL-015  SKU packaging required        — each retail SKU must declare packaging type
 *   VAL-016  SKU size required             — each retail SKU must declare presentation size
 *   VAL-017  SKU sale basis required       — each retail SKU must declare commercial sale unit
 *   VAL-018  SKU price required            — each retail SKU must have a price > 0
 *   VAL-019  Pouch sizing consistency      — pouch config size must be in POUCH_SIZES
 *   VAL-020  Pouch carton consistency      — unitsPerCarton must be positive for pouch formats
 *   VAL-021  Pouch pallet consistency      — pallet config exists for declared size
 *   VAL-022  Container optimization sanity — pouch format should not use livestock/bulk vessel
 *   VAL-023  Export format consistency     — pouch format only for liquid-compatible categories
 *   VAL-024  Price basis consistency       — pouch formats must declare a commercial sale unit
 */

import { getCategoryEngine } from "./categoryEngine.js";
import { getCategoryProfile } from "./categoryProfiles.js";
import { isLivestockContainer, isLiquidContainer } from "./containerEngine.js";
import { POUCH_SIZES, PALLET_CONFIG, POUCH_EXPORT_FORMAT_IDS } from "./PouchPackagingEngine.js";
import { resolveNormalizedPresentationSize } from "./packagingEngine.js";
import { getOilPrice, OIL_INCOTERMS } from "./oils/oilsPricingEngine.js";
import { DESTINATION_MATRIX } from "./oils/exportFreightEngine.js";
import { PROFIT_TARGET_MIN_USD, runProfitSimulation } from "./oils/profitSimulationEngine.js";
import { validateContainerLoad } from "./oils/logisticsCapacityEngine.js";
import { validateJerrycanMOQ } from "./oils/jerrycanEngine.js";

/**
 * Run all 10 validation checks against a document + its CD rows.
 *
 * @param {object}   doc
 * @param {object[]} cdRows
 * @returns {{ valid: boolean, errors: Check[], warnings: Check[], checks: Check[] }}
 */
export function validateDocument(doc, cdRows = []) {
  const firstRow  = cdRows.find(r => r.category) || {};
  const category  = firstRow.category || null;
  const engine    = category ? getCategoryEngine(category)  : null;
  const profile   = category ? getCategoryProfile(category) : null;

  const checks = [
    checkPricingConsistency(firstRow),
    checkUnitConsistency(firstRow, profile),
    checkPackagingConsistency(firstRow, profile),
    checkPDFOverflow(doc),
    checkMediaContamination(category),
    checkCountryContamination(doc),
    checkPortContamination(doc),
    checkContainerMismatch(firstRow, engine),
    checkStaleCache(cdRows),
    checkFormulaMismatch(firstRow, engine),
    checkCommercialUnitRequired(firstRow, profile),
    checkPackagingModeRequired(firstRow, profile),
    checkRetailSizeRequired(firstRow),
    checkBoxEngineUnitsRequired(firstRow),
    ...checkSkuPackagingRequired(firstRow),
    ...checkSkuSizeRequired(firstRow),
    ...checkSkuSaleBasisRequired(firstRow),
    ...checkSkuPriceRequired(firstRow),
    // V7: Pouch packaging guards
    checkPouchSizingConsistency(firstRow),
    checkPouchCartonConsistency(firstRow),
    checkPouchPalletConsistency(firstRow),
    checkContainerOptimizationSanity(firstRow),
    checkExportFormatCategoryConsistency(firstRow, profile),
    checkPouchPriceBasisConsistency(firstRow),
    // V7.1: Single source of truth — blocks PDF if pouchConfig and SKUs disagree on size
    checkPresentationSizeMismatch(firstRow),
    // V8: Oils Export Engine guards — only activate when category === "OILS"
    ...checkOilsValidation(firstRow),
  ];

  const errors   = checks.filter(c => !c.pass && c.severity === "error");
  const warnings = checks.filter(c => !c.pass && c.severity === "warning");

  return {
    valid:    errors.length === 0,
    errors,
    warnings,
    checks,
  };
}

// ─── Individual checks ────────────────────────────────────────────────────────

function checkPricingConsistency(row) {
  const price = parseFloat(row.unitPrice || 0);
  return {
    id:       "VAL-001",
    name:     "Pricing Consistency",
    pass:     price > 0,
    message:  price > 0 ? `Unit price: ${price}` : "Unit price is zero or missing — PDF will show USD 0",
    severity: "error",
  };
}

function checkUnitConsistency(row, profile) {
  const unit = row.unitType || "";
  if (!profile || !unit) {
    return { id: "VAL-002", name: "Unit Consistency", pass: true, message: "Unit not yet selected", severity: "warning" };
  }
  const allowed = profile.allowedUnits || [];
  const compatible = allowed.length === 0 || allowed.some(u => unit.toLowerCase().includes(u.toLowerCase()));
  return {
    id:       "VAL-002",
    name:     "Unit Consistency",
    pass:     compatible,
    message:  compatible
      ? `Unit "${unit}" compatible with ${profile.category}`
      : `Unit "${unit}" may not be compatible with ${profile.category} — expected one of: ${allowed.join(", ")}`,
    severity: "warning",
  };
}

function checkPackagingConsistency(row, profile) {
  if (!profile?.supportsPackaging) {
    return { id: "VAL-003", name: "Packaging Consistency", pass: true, message: "Category does not require packaging spec", severity: "warning" };
  }
  const packaging = row.specs?.packaging || row.specs?.packagingUnit || "";
  return {
    id:       "VAL-003",
    name:     "Packaging Consistency",
    pass:     !!packaging,
    message:  packaging ? `Packaging: ${packaging}` : "Packaging not specified — add packaging type to complete the document",
    severity: "warning",
  };
}

function checkPDFOverflow(doc) {
  const descLen = (doc.custom_product_desc || doc.customProductDesc || "").length;
  return {
    id:       "VAL-004",
    name:     "PDF Overflow Risk",
    pass:     descLen < 500,
    message:  descLen < 500
      ? "Product description length OK"
      : `Description too long (${descLen} chars) — may overflow PDF text box (max ~500)`,
    severity: "warning",
  };
}

function checkMediaContamination(category) {
  return {
    id:       "VAL-005",
    name:     "Media Contamination",
    pass:     true,
    message:  category
      ? `Media category isolation active for ${category} (enforced server-side)`
      : "No category — media isolation inactive",
    severity: "warning",
  };
}

function checkCountryContamination(doc) {
  const dest = doc.destination || doc.destinationCountry || "";
  return {
    id:       "VAL-006",
    name:     "Country Contamination",
    pass:     !!dest,
    message:  dest
      ? `Destination: ${dest}`
      : "Destination country not set — PDF Section 2 will be incomplete",
    severity: "error",
  };
}

function checkPortContamination(doc) {
  const port = doc.destinationPort || doc.destination_port || "";
  return {
    id:       "VAL-007",
    name:     "Port Contamination",
    pass:     !!port,
    message:  port ? `Port: ${port}` : "Destination port not set",
    severity: "warning",
  };
}

function checkContainerMismatch(row, engine) {
  const selected = row.containerType || "";
  if (!selected || !engine) {
    return { id: "VAL-008", name: "Container Mismatch", pass: true, message: "Container not yet selected", severity: "warning" };
  }

  if (engine.isLiveAnimal && !isLivestockContainer(selected)) {
    return {
      id: "VAL-008", name: "Container Mismatch", pass: false,
      message: `LIVE_ANIMALS requires Livestock Vessel — selected: ${selected}`,
      severity: "warning",
    };
  }
  if (engine.isLiquid && !isLiquidContainer(selected)) {
    return {
      id: "VAL-008", name: "Container Mismatch", pass: false,
      message: `Liquid category (${engine.category}) should use Flexitank or ISO Tank — selected: ${selected}`,
      severity: "warning",
    };
  }
  return { id: "VAL-008", name: "Container Mismatch", pass: true, message: `Container ${selected} compatible`, severity: "warning" };
}

function checkStaleCache(cdRows) {
  const categories = [...new Set(cdRows.map(r => r.category).filter(Boolean))];
  const contaminated = categories.length > 1;
  return {
    id:       "VAL-009",
    name:     "Stale Cache Detection",
    pass:     !contaminated,
    message:  contaminated
      ? `Multiple categories in document (${categories.join(", ")}) — possible stale form state`
      : "Single category — no stale state",
    severity: "warning",
  };
}

function checkFormulaMismatch(row, engine) {
  if (!engine) {
    return { id: "VAL-010", name: "Formula Mismatch", pass: true, message: "No engine — category not selected", severity: "warning" };
  }
  if (engine.isLiveAnimal) {
    const heads = parseFloat(row.specs?.headCount || 0);
    const avgWt = parseFloat(row.specs?.avgWeight  || 0);
    if (heads <= 0 || avgWt <= 0) {
      return {
        id: "VAL-010", name: "Formula Mismatch", pass: false,
        message: "LIVE_ANIMALS: headCount and avgWeight are both required to calculate shipment value",
        severity: "error",
      };
    }
  }
  return { id: "VAL-010", name: "Formula Mismatch", pass: true, message: "Formula inputs consistent with category engine", severity: "warning" };
}

const LIQUID_PACKAGED_CATEGORIES = new Set(["OILS", "FRUIT_PRODUCTS", "COLOMBIAN_EXOTIC_FRUITS"]);

function checkCommercialUnitRequired(row, profile) {
  const category = row.category || "";
  if (!LIQUID_PACKAGED_CATEGORIES.has(category)) {
    return { id: "VAL-011", name: "Commercial Unit Required", pass: true, message: "Category does not require explicit commercial sale unit", severity: "warning" };
  }
  const unit = row.commercialUnit || "";
  return {
    id:       "VAL-011",
    name:     "Commercial Unit Required",
    pass:     !!unit,
    message:  unit
      ? `Commercial sale unit declared: ${unit}`
      : `${category} requires a commercial sale unit (perKg, perLiter, perBox, etc.) — PDF pricing basis will be incomplete`,
    severity: "warning",
  };
}

function checkPackagingModeRequired(row, profile) {
  if (!profile?.supportsLiquidPackaging && !profile?.supportsPackaging) {
    return { id: "VAL-012", name: "Packaging Mode Required", pass: true, message: "Category does not require packaging mode", severity: "warning" };
  }
  const mode = row.packagingMode || "";
  return {
    id:       "VAL-012",
    name:     "Packaging Mode Required",
    pass:     !!mode,
    message:  mode
      ? `Packaging mode: ${mode}`
      : "Packaging mode not declared — select BULK/INDUSTRIAL or RETAIL/CONSUMER to generate correct PDF output",
    severity: "warning",
  };
}

const RETAIL_SIZE_REQUIRED_TYPES = new Set([
  "PET_BOTTLE","GLASS_BOTTLE","TETRA_PAK","DOYPACK","SACHET","PREMIUM_BOTTLE","CAN_TIN","PLASTIC_GALLON",
]);

function checkRetailSizeRequired(row) {
  const mode = row.packagingMode || "";
  const type = row.packagingType || "";
  if (mode !== "RETAIL" || !type || !RETAIL_SIZE_REQUIRED_TYPES.has(type)) {
    return { id: "VAL-013", name: "Retail Size Required", pass: true, message: "Presentation size not required for this packaging type", severity: "warning" };
  }
  const size = row.presentationSize || "";
  return {
    id:       "VAL-013",
    name:     "Retail Size Required",
    pass:     !!size,
    message:  size
      ? `Presentation size: ${size}`
      : `${type} packaging requires a presentation size (e.g. 900ml, 1L) — PDF carton calculation will be incomplete`,
    severity: "warning",
  };
}

function checkBoxEngineUnitsRequired(row) {
  const mode = row.packagingMode || "";
  const type = row.packagingType || "";
  const size = row.presentationSize || "";
  if (mode !== "RETAIL" || !type || !size || !RETAIL_SIZE_REQUIRED_TYPES.has(type)) {
    return { id: "VAL-014", name: "Box Engine Units Required", pass: true, message: "Box engine not active for this configuration", severity: "warning" };
  }
  const upb = parseFloat(row.unitsPerBox || 0);
  return {
    id:       "VAL-014",
    name:     "Box Engine Units Required",
    pass:     upb > 0,
    message:  upb > 0
      ? `Units per box: ${upb}`
      : `Retail carton packaging (${type} ${size}) requires units per box to calculate shipment value — e.g. 12, 24, 48`,
    severity: "warning",
  };
}

// ─── V6: Multi-SKU checks (return arrays — one check per SKU or single pass) ──

function checkSkuPackagingRequired(row) {
  const skus = Array.isArray(row.skus) ? row.skus : [];
  if (skus.length === 0) {
    return [{ id: "VAL-015", name: "SKU Packaging Required", pass: true, message: "No SKU engine active", severity: "warning" }];
  }
  return skus.map((sk, i) => ({
    id:       `VAL-015.${i + 1}`,
    name:     `SKU ${i + 1} Packaging Required`,
    pass:     !!sk.packagingType,
    message:  sk.packagingType
      ? `SKU ${i + 1} packaging: ${sk.packagingType}`
      : `SKU ${i + 1} is missing packaging type (PET Bottle, Glass Bottle, etc.) — PDF SKU table will be incomplete`,
    severity: "warning",
  }));
}

function checkSkuSizeRequired(row) {
  const skus = Array.isArray(row.skus) ? row.skus : [];
  if (skus.length === 0) {
    return [{ id: "VAL-016", name: "SKU Size Required", pass: true, message: "No SKU engine active", severity: "warning" }];
  }
  return skus.map((sk, i) => ({
    id:       `VAL-016.${i + 1}`,
    name:     `SKU ${i + 1} Size Required`,
    pass:     !!sk.presentationSize,
    message:  sk.presentationSize
      ? `SKU ${i + 1} size: ${sk.presentationSize}`
      : `SKU ${i + 1} is missing presentation size (e.g. 900ml, 1L) — carton weight calculation will be zero`,
    severity: "warning",
  }));
}

function checkSkuSaleBasisRequired(row) {
  const skus = Array.isArray(row.skus) ? row.skus : [];
  if (skus.length === 0) {
    return [{ id: "VAL-017", name: "SKU Sale Basis Required", pass: true, message: "No SKU engine active", severity: "warning" }];
  }
  return skus.map((sk, i) => ({
    id:       `VAL-017.${i + 1}`,
    name:     `SKU ${i + 1} Sale Basis Required`,
    pass:     !!sk.commercialUnit,
    message:  sk.commercialUnit
      ? `SKU ${i + 1} sale basis: ${sk.commercialUnit}`
      : `SKU ${i + 1} has no commercial sale basis selected (perBox, perUnit, etc.) — shipment value will be zero`,
    severity: "error",
  }));
}

function checkSkuPriceRequired(row) {
  const skus = Array.isArray(row.skus) ? row.skus : [];
  if (skus.length === 0) {
    return [{ id: "VAL-018", name: "SKU Price Required", pass: true, message: "No SKU engine active", severity: "warning" }];
  }
  return skus.map((sk, i) => {
    const price = parseFloat(sk.price || 0);
    return {
      id:       `VAL-018.${i + 1}`,
      name:     `SKU ${i + 1} Price Required`,
      pass:     price > 0,
      message:  price > 0
        ? `SKU ${i + 1} price: ${price}`
        : `SKU ${i + 1} has no price — shipment value will be zero`,
      severity: "error",
    };
  });
}

// ─── V7: Pouch Packaging Guards ───────────────────────────────────────────────

const POUCH_SIZE_IDS = new Set(POUCH_SIZES.map(s => s.id));
const LIQUID_COMPATIBLE = new Set(["OILS","FRUIT_PRODUCTS","COLOMBIAN_EXOTIC_FRUITS"]);

function checkPouchSizingConsistency(row) {
  const ef = row.exportFormat || "";
  if (!POUCH_EXPORT_FORMAT_IDS.has(ef)) {
    return { id: "VAL-019", name: "Pouch Sizing Consistency", pass: true, message: "No pouch format active", severity: "warning" };
  }
  const sizeId = row.pouchConfig?.presentationSize || "";
  const valid = !sizeId || POUCH_SIZE_IDS.has(sizeId);
  return {
    id: "VAL-019", name: "Pouch Sizing Consistency",
    pass: valid,
    message: valid
      ? (sizeId ? `Pouch size "${sizeId}" is valid` : "Pouch size not yet selected")
      : `Pouch size "${sizeId}" is not in the approved POUCH_SIZES list — select a valid size (250ml–20L)`,
    severity: "warning",
  };
}

function checkPouchCartonConsistency(row) {
  const ef = row.exportFormat || "";
  if (!POUCH_EXPORT_FORMAT_IDS.has(ef)) {
    return { id: "VAL-020", name: "Pouch Carton Consistency", pass: true, message: "No pouch format active", severity: "warning" };
  }
  const sizeId = row.pouchConfig?.presentationSize || "";
  const upb    = parseFloat(row.pouchConfig?.unitsPerCarton || 0);
  if (!sizeId) {
    return { id: "VAL-020", name: "Pouch Carton Consistency", pass: true, message: "Pouch size not selected yet", severity: "warning" };
  }
  return {
    id: "VAL-020", name: "Pouch Carton Consistency",
    pass: upb > 0,
    message: upb > 0
      ? `Units per carton: ${upb}`
      : `Pouch format "${ef}" with size "${sizeId}" requires units per carton — carton weight and pallet calculations will be zero`,
    severity: "warning",
  };
}

function checkPouchPalletConsistency(row) {
  const ef = row.exportFormat || "";
  if (!POUCH_EXPORT_FORMAT_IDS.has(ef)) {
    return { id: "VAL-021", name: "Pouch Pallet Consistency", pass: true, message: "No pouch format active", severity: "warning" };
  }
  const sizeId = row.pouchConfig?.presentationSize || "";
  if (!sizeId) {
    return { id: "VAL-021", name: "Pouch Pallet Consistency", pass: true, message: "Pouch size not selected", severity: "warning" };
  }
  const hasPalletConfig = !!PALLET_CONFIG[sizeId];
  return {
    id: "VAL-021", name: "Pouch Pallet Consistency",
    pass: hasPalletConfig,
    message: hasPalletConfig
      ? `Pallet configuration available for ${sizeId}`
      : `No pallet configuration found for size "${sizeId}" — container utilization estimate may be inaccurate`,
    severity: "warning",
  };
}

function checkContainerOptimizationSanity(row) {
  const ef = row.exportFormat || "";
  if (!POUCH_EXPORT_FORMAT_IDS.has(ef)) {
    return { id: "VAL-022", name: "Container Optimization Sanity", pass: true, message: "No pouch format active", severity: "warning" };
  }
  const ct = row.containerType || "";
  const invalidForPouch = ["LIVESTOCK_VESSEL","BULK_VESSEL","ISO_TANK"].includes(ct);
  return {
    id: "VAL-022", name: "Container Optimization Sanity",
    pass: !invalidForPouch,
    message: invalidForPouch
      ? `Container type "${ct}" is not compatible with pouch packaging — use 40FT Dry or 40HC for retail pouch export`
      : ct ? `Container "${ct}" compatible with pouch packaging` : "Container not yet selected",
    severity: "warning",
  };
}

function checkExportFormatCategoryConsistency(row, profile) {
  const ef = row.exportFormat || "";
  if (!POUCH_EXPORT_FORMAT_IDS.has(ef)) {
    return { id: "VAL-023", name: "Export Format Consistency", pass: true, message: "No pouch format active", severity: "warning" };
  }
  const category = row.category || "";
  const compatible = !category || LIQUID_COMPATIBLE.has(category);
  return {
    id: "VAL-023", name: "Export Format Consistency",
    pass: compatible,
    message: compatible
      ? `Category "${category}" supports pouch export format`
      : `Pouch export format "${ef}" is designed for liquid categories (OILS, FRUIT_PRODUCTS, COLOMBIAN_EXOTIC_FRUITS) — current category "${category}" may produce unexpected PDF output`,
    severity: "warning",
  };
}

function checkPouchPriceBasisConsistency(row) {
  const ef = row.exportFormat || "";
  if (!POUCH_EXPORT_FORMAT_IDS.has(ef)) {
    return { id: "VAL-024", name: "Price Basis Consistency", pass: true, message: "No pouch format active", severity: "warning" };
  }
  const skus = Array.isArray(row.skus) ? row.skus : [];
  if (skus.length > 0) {
    const allHaveBasis = skus.every(sk => !!sk.commercialUnit);
    return {
      id: "VAL-024", name: "Price Basis Consistency",
      pass: allHaveBasis,
      message: allHaveBasis
        ? "All SKUs have a commercial sale basis"
        : "One or more SKUs are missing a commercial sale basis (perPouch, perCarton, perBox, etc.) — shipment value will be zero",
      severity: "error",
    };
  }
  const unit = row.commercialUnit || "";
  return {
    id: "VAL-024", name: "Price Basis Consistency",
    pass: !!unit,
    message: unit
      ? `Commercial sale basis declared: ${unit}`
      : `Pouch format "${ef}" requires a commercial sale basis (perPouch, perCarton, perBox, etc.) — PDF pricing will be incomplete`,
    severity: "warning",
  };
}

// VAL-025 — V7.1: Presentation size must agree between pouchConfig and all SKUs.
// Blocks PDF generation when pouchConfig.presentationSize ≠ sku.presentationSize on any SKU.
function checkPresentationSizeMismatch(row) {
  const ef = row.exportFormat || "";
  if (!POUCH_EXPORT_FORMAT_IDS.has(ef)) {
    return { id: "VAL-025", name: "Presentation Size Mismatch", pass: true, message: "No pouch format active", severity: "error" };
  }
  const resolved = resolveNormalizedPresentationSize(row.pouchConfig || {}, row.skus || []);
  if (resolved !== null) {
    return {
      id: "VAL-025", name: "Presentation Size Mismatch",
      pass: true,
      message: resolved
        ? `Presentation size consistent: ${resolved}`
        : "No size set — specify a presentation size in Pouch Config",
      severity: "error",
    };
  }
  const pouchSize = (row.pouchConfig || {}).presentationSize || "(none)";
  const skuSizes  = [...new Set((row.skus || []).map(s => s.presentationSize).filter(Boolean))];
  return {
    id: "VAL-025", name: "Presentation Size Mismatch",
    pass: false,
    message: `PRESENTATION SIZE MISMATCH — Pouch config: ${pouchSize} vs SKU sizes: [${skuSizes.join(", ")}]. PDF generation blocked until sizes are unified.`,
    severity: "error",
  };
}

// ─── V8: Oils Export Engine Validation ───────────────────────────────────────
// VAL-030 through VAL-040
// All checks are no-ops when category !== "OILS" — zero impact on other flows.

function makeOilPass(id, name) {
  return { id, name, pass: true, message: "No oils engine active", severity: "warning" };
}

function checkOilsValidation(row) {
  if (row.category !== "OILS") {
    return [
      makeOilPass("VAL-030","Oils Packaging Compatibility"),
      makeOilPass("VAL-031","Oils Container Sanity"),
      makeOilPass("VAL-032","Oils SKU Consistency"),
      makeOilPass("VAL-033","Oils Freight Sanity"),
      makeOilPass("VAL-034","Oils Incoterm Logic"),
      makeOilPass("VAL-035","Oils Destination Compatibility"),
      makeOilPass("VAL-036","Oils MOQ Logic"),
      makeOilPass("VAL-037","Oils Profit Threshold"),
      makeOilPass("VAL-038","Oils Pallet Overload"),
      makeOilPass("VAL-039","Oils Invalid Pouch Structure"),
      makeOilPass("VAL-040","Oils Price Matrix Coverage"),
    ];
  }

  const cfg = row.oilsConfig || {};
  const { productId, packagingType, sizeId, incoterm, destination, moq, skus = [],
          unitsPerContainer, simulation, pouchType, filmMaterial } = cfg;

  // VAL-030: Packaging compatibility
  const val030 = (() => {
    if (!packagingType) return { id:"VAL-030", name:"Oils Packaging Compatibility", pass: false, message: "Oils document missing packaging type", severity:"error" };
    return { id:"VAL-030", name:"Oils Packaging Compatibility", pass: true, message:`Packaging type declared: ${packagingType}`, severity:"warning" };
  })();

  // VAL-031: Container sanity
  const val031 = (() => {
    if (!sizeId || !packagingType || !unitsPerContainer) return { id:"VAL-031", name:"Oils Container Sanity", pass: true, message:"Container not yet configured", severity:"warning" };
    const load = validateContainerLoad(packagingType, sizeId, unitsPerContainer);
    return {
      id:"VAL-031", name:"Oils Container Sanity",
      pass: load.valid,
      message: load.valid ? `Container load within capacity for ${packagingType} ${sizeId}` : `Container overloaded by ${load.overloadPct}% for ${packagingType} ${sizeId}`,
      severity: "error",
    };
  })();

  // VAL-032: SKU consistency (if multi-SKU active)
  const val032 = (() => {
    if (!Array.isArray(skus) || skus.length === 0) return { id:"VAL-032", name:"Oils SKU Consistency", pass: true, message:"No multi-SKU active", severity:"warning" };
    const invalid = skus.filter(s => !s.productId || !s.sizeId || !(s.pricePerUnit > 0));
    return {
      id:"VAL-032", name:"Oils SKU Consistency",
      pass: invalid.length === 0,
      message: invalid.length === 0 ? `All ${skus.length} SKUs valid` : `${invalid.length} SKU(s) missing required fields (product, size, or price)`,
      severity: "error",
    };
  })();

  // VAL-033: Freight sanity
  const val033 = (() => {
    if (incoterm === "FOB") return { id:"VAL-033", name:"Oils Freight Sanity", pass: true, message:"FOB — freight is buyer's responsibility", severity:"warning" };
    if (!destination) return {
      id:"VAL-033", name:"Oils Freight Sanity",
      pass: false,
      message:`Incoterm is ${incoterm} but no destination selected — freight cannot be calculated`,
      severity: "error",
    };
    return { id:"VAL-033", name:"Oils Freight Sanity", pass: true, message:`Freight destination: ${destination}`, severity:"warning" };
  })();

  // VAL-034: Incoterm logic
  const val034 = (() => {
    const valid = OIL_INCOTERMS.includes(incoterm);
    return {
      id:"VAL-034", name:"Oils Incoterm Logic",
      pass: !incoterm || valid,
      message: valid ? `Incoterm ${incoterm} is valid for oils export` : `Incoterm "${incoterm}" is not supported — use FOB, CFR, or CIF`,
      severity: "error",
    };
  })();

  // VAL-035: Destination compatibility
  const val035 = (() => {
    if (!destination) return { id:"VAL-035", name:"Oils Destination Compatibility", pass: true, message:"No destination set", severity:"warning" };
    const known = !!DESTINATION_MATRIX[destination];
    return {
      id:"VAL-035", name:"Oils Destination Compatibility",
      pass: known,
      message: known ? `Destination "${destination}" in freight matrix` : `Destination "${destination}" not in freight matrix — freight/insurance cannot be calculated`,
      severity: "error",
    };
  })();

  // VAL-036: MOQ logic
  const val036 = (() => {
    const moqNum = parseFloat(moq);
    if (!moqNum) return { id:"VAL-036", name:"Oils MOQ Logic", pass: true, message:"No MOQ specified", severity:"warning" };
    const reasonable = moqNum >= 100 && moqNum <= 500000;
    return {
      id:"VAL-036", name:"Oils MOQ Logic",
      pass: reasonable,
      message: reasonable ? `MOQ ${moqNum.toLocaleString()} units` : `MOQ ${moqNum} is outside reasonable range (100–500,000 units)`,
      severity: "warning",
    };
  })();

  // VAL-037: Profit threshold
  const val037 = (() => {
    if (!simulation) return { id:"VAL-037", name:"Oils Profit Threshold", pass: true, message:"Profit simulation not yet run", severity:"warning" };
    return {
      id:"VAL-037", name:"Oils Profit Threshold",
      pass: simulation.meetsTarget,
      message: simulation.meetsTarget
        ? `Net profit $${simulation.netProfit.toFixed(0)}/container meets target ($${PROFIT_TARGET_MIN_USD}–$6000)`
        : `Net profit $${simulation.netProfit.toFixed(0)}/container below target minimum $${PROFIT_TARGET_MIN_USD}`,
      severity: "warning",
    };
  })();

  // VAL-038: Pallet overload
  const val038 = (() => {
    if (!sizeId || !packagingType) return { id:"VAL-038", name:"Oils Pallet Overload", pass: true, message:"No size/packaging configured", severity:"warning" };
    const load = validateContainerLoad(packagingType, sizeId, unitsPerContainer || 0);
    return {
      id:"VAL-038", name:"Oils Pallet Overload",
      pass: load.valid,
      message: load.valid ? "Pallet configuration within container limits" : `Pallet overload: ${load.overloadPct}% over max capacity for ${sizeId}`,
      severity: "warning",
    };
  })();

  // VAL-039: Invalid pouch structure
  const POUCH_PKG_IDS = new Set(["RETAIL_POUCH","DOYPACK","SPOUT_POUCH","PILLOW_POUCH","LAMINATED_POUCH","MULTILAYER_POUCH","FLEXIBLE_OIL_POUCH"]);
  const val039 = (() => {
    if (!packagingType || !POUCH_PKG_IDS.has(packagingType)) return { id:"VAL-039", name:"Oils Invalid Pouch Structure", pass: true, message:"Non-pouch format — no structure check needed", severity:"warning" };
    const missingStructure = !pouchType || !filmMaterial;
    return {
      id:"VAL-039", name:"Oils Invalid Pouch Structure",
      pass: !missingStructure,
      message: missingStructure
        ? "Pouch packaging requires pouch type and film material to be specified"
        : `Pouch structure complete: ${pouchType} / ${filmMaterial}`,
      severity: "warning",
    };
  })();

  // VAL-040: Price matrix coverage
  const val040 = (() => {
    if (!productId || !packagingType || !sizeId || !incoterm) return { id:"VAL-040", name:"Oils Price Matrix Coverage", pass: true, message:"Incomplete configuration — price check skipped", severity:"warning" };
    const price = getOilPrice(productId, packagingType, sizeId, incoterm);
    return {
      id:"VAL-040", name:"Oils Price Matrix Coverage",
      pass: price !== null,
      message: price !== null
        ? `Price matrix entry found: ${productId} / ${packagingType} / ${sizeId} ${incoterm} = $${price}`
        : `No price matrix entry for ${productId} / ${packagingType} / ${sizeId} — document may have incorrect pricing`,
      severity: "error",
    };
  })();

  return [val030, val031, val032, val033, val034, val035, val036, val037, val038, val039, val040];
}
