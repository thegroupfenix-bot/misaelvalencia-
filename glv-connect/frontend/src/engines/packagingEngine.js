/**
 * packagingEngine.js — Multi-Layer Unit System for GLV Commercial Engine V4.
 *
 * Five distinct unit layers:
 *   1. Presentation Unit  — retail/commercial format (100g, 500ml, etc.)
 *   2. Packaging Unit     — export grouping (box, sack, drum, etc.)
 *   3. Commercial Unit    — pricing mode (perKg, perBox, perJerrycan, etc.)
 *   4. Export Unit        — logistics unit (KG, MT, CBM, Containers, etc.)
 *   5. Internal Unit      — calculation normalization (always KG where possible)
 *
 * IMPORTANT: Internal conversions NEVER modify displayed commercial units or PDF prices.
 */

// ─── Layer 1: Presentation Units ─────────────────────────────────────────────

export const WEIGHT_PRESENTATIONS = [
  { id: "100g",  label: "100 g",  gramValue: 100   },
  { id: "125g",  label: "125 g",  gramValue: 125   },
  { id: "200g",  label: "200 g",  gramValue: 200   },
  { id: "250g",  label: "250 g",  gramValue: 250   },
  { id: "454g",  label: "454 g",  gramValue: 454   },
  { id: "500g",  label: "500 g",  gramValue: 500   },
  { id: "900g",  label: "900 g",  gramValue: 900   },
  { id: "1kg",   label: "1 kg",   gramValue: 1000  },
  { id: "2kg",   label: "2 kg",   gramValue: 2000  },
  { id: "3kg",   label: "3 kg",   gramValue: 3000  },
  { id: "5kg",   label: "5 kg",   gramValue: 5000  },
  { id: "10kg",  label: "10 kg",  gramValue: 10000 },
];

export const LIQUID_PRESENTATIONS = [
  { id: "100ml",  label: "100 ml",  mlValue: 100    },
  { id: "125ml",  label: "125 ml",  mlValue: 125    },
  { id: "200ml",  label: "200 ml",  mlValue: 200    },
  { id: "250ml",  label: "250 ml",  mlValue: 250    },
  { id: "330ml",  label: "330 ml",  mlValue: 330    },
  { id: "350ml",  label: "350 ml",  mlValue: 350    },
  { id: "400ml",  label: "400 ml",  mlValue: 400    },
  { id: "454ml",  label: "454 ml",  mlValue: 454    },
  { id: "500ml",  label: "500 ml",  mlValue: 500    },
  { id: "750ml",  label: "750 ml",  mlValue: 750    },
  { id: "900ml",  label: "900 ml",  mlValue: 900    },
  { id: "1000ml", label: "1 L",     mlValue: 1000   },
  { id: "1500ml", label: "1.5 L",   mlValue: 1500   },
  { id: "2000ml", label: "2 L",     mlValue: 2000   },
  { id: "2500ml", label: "2.5 L",   mlValue: 2500   },
  { id: "3000ml", label: "3 L",     mlValue: 3000   },
  { id: "5000ml", label: "5 L",     mlValue: 5000   },
  { id: "10L",    label: "10 L",    mlValue: 10000  },
  { id: "20L",    label: "20 L",    mlValue: 20000  },
  { id: "25L",    label: "25 L",    mlValue: 25000  },
  { id: "50L",    label: "50 L",    mlValue: 50000  },
  { id: "100L",   label: "100 L",   mlValue: 100000 },
  { id: "200L",   label: "200 L",   mlValue: 200000 },
];

// ─── Layer 2: Packaging Units ─────────────────────────────────────────────────

export const PACKAGING_UNITS = [
  { id: "box",         label: { es: "Caja",           en: "Box" } },
  { id: "carton",      label: { es: "Cartón",         en: "Carton" } },
  { id: "sack",        label: { es: "Saco / Bolsa",   en: "Sack / Bag" } },
  { id: "drum",        label: { es: "Bidón",          en: "Drum" } },
  { id: "jerrycan",    label: { es: "Bidón Plástico", en: "Jerrycan" } },
  { id: "pallet",      label: { es: "Paleta",         en: "Pallet" } },
  { id: "bucket",      label: { es: "Balde",          en: "Bucket" } },
  { id: "bottle",      label: { es: "Botella",        en: "Bottle" } },
  { id: "tetrapack",   label: { es: "Tetra Pak",      en: "Tetra Pack" } },
  { id: "retail_pack", label: { es: "Pack Retail",    en: "Retail Pack" } },
  { id: "pouch",       label: { es: "Pouch / Doypack",en: "Pouch" } },
  { id: "mesh_bag",    label: { es: "Malla / Red",    en: "Mesh Bag" } },
  { id: "crate",       label: { es: "Caja de Madera", en: "Crate" } },
  { id: "can",         label: { es: "Lata",           en: "Can / Tin" } },
  { id: "bulk",        label: { es: "Granel",         en: "Bulk" } },
  { id: "flexitank",   label: { es: "Flexitank",      en: "Flexitank" } },
  { id: "iso_tank",    label: { es: "Isotanque",      en: "ISO Tank" } },
  { id: "big_bag",     label: { es: "Big Bag 1MT",    en: "Big Bag 1MT" } },
];

// ─── Layer 3: Commercial Units (pricing modes) ────────────────────────────────

export const COMMERCIAL_UNITS = [
  { id: "perKg",        label: { es: "por Kilogramo",    en: "per Kilogram" },      abbr: "/kg" },
  { id: "perMT",        label: { es: "por Tonelada MT",  en: "per Metric Ton" },    abbr: "/MT" },
  { id: "perUnit",      label: { es: "por Unidad",       en: "per Unit" },          abbr: "/unit" },
  { id: "perBox",       label: { es: "por Caja",         en: "per Box" },           abbr: "/box" },
  { id: "perPallet",    label: { es: "por Paleta",       en: "per Pallet" },        abbr: "/pallet" },
  { id: "perDrum",      label: { es: "por Bidón",        en: "per Drum" },          abbr: "/drum" },
  { id: "perJerrycan",  label: { es: "por Bidón Plást.", en: "per Jerrycan" },      abbr: "/jerrycan" },
  { id: "perLiter",     label: { es: "por Litro",        en: "per Liter" },         abbr: "/L" },
  { id: "perContainer", label: { es: "por Contenedor",   en: "per Container" },     abbr: "/container" },
  { id: "perHead",      label: { es: "por Cabeza",       en: "per Head" },          abbr: "/head" },
  { id: "perBag",       label: { es: "por Saco",         en: "per Bag" },           abbr: "/bag" },
];

// ─── Layer 4: Export Units ────────────────────────────────────────────────────

export const EXPORT_UNITS = [
  { id: "KG",         label: { es: "Kilogramos",      en: "Kilograms" },       toKgFactor: 1    },
  { id: "MT",         label: { es: "Tonelada Métrica",en: "Metric Ton" },      toKgFactor: 1000 },
  { id: "CBM",        label: { es: "Metro Cúbico",    en: "Cubic Meter" },     toKgFactor: null },
  { id: "Units",      label: { es: "Unidades",        en: "Units" },           toKgFactor: null },
  { id: "Containers", label: { es: "Contenedores",    en: "Containers" },      toKgFactor: null },
  { id: "Heads",      label: { es: "Cabezas",         en: "Heads" },           toKgFactor: null },
  { id: "Liters",     label: { es: "Litros",          en: "Liters" },          toKgFactor: null },
];

// ─── Layer 5: Internal normalization ─────────────────────────────────────────

/**
 * Normalize quantity to KG for internal calculation only.
 * NEVER use this value in PDF price display or commercial unit display.
 * Returns null for units that require additional parameters (e.g. Heads → needs avgWeight).
 *
 * @param {number|string} qty
 * @param {string} unitType  — raw unit string from form (e.g. "Tonelada Métrica / MT")
 * @param {object} [opts]
 * @param {number} [opts.containerCapacityMT=27]
 * @param {number} [opts.avgWeightKg=0]
 * @returns {number|null}
 */
export function normalizeToKg(qty, unitType, { containerCapacityMT = 27, avgWeightKg = 0 } = {}) {
  const q = parseFloat(qty) || 0;
  if (!q) return 0;
  const u = (unitType || "").toLowerCase();
  if (u.includes("container") || u.includes("contenedor")) return q * containerCapacityMT * 1000;
  if (u.includes("mt") || u.includes("tonelada"))          return q * 1000;
  if (u.includes("head") || u.includes("cabeza"))          return avgWeightKg > 0 ? q * avgWeightKg : null;
  if (u.includes("liter") || u.includes("litro"))          return null; // density required
  return q; // already kg or unit-based
}

// ─── Helpers for category-aware unit filtering ────────────────────────────────

export function getCommercialUnitsForCategory(categoryProfile) {
  if (!categoryProfile?.pricingModes) return COMMERCIAL_UNITS;
  return COMMERCIAL_UNITS.filter(cu => categoryProfile.pricingModes.includes(cu.id));
}

export function getPackagingUnitsForCategory(categoryProfile) {
  if (categoryProfile?.supportsLivestock) return [];
  if (categoryProfile?.supportsLiquidPackaging) {
    return PACKAGING_UNITS.filter(p =>
      ["drum", "jerrycan", "bottle", "bulk", "flexitank", "iso_tank", "pouch", "retail_pack"].includes(p.id)
    );
  }
  if (categoryProfile?.supportsBulk) {
    return PACKAGING_UNITS.filter(p => ["sack", "big_bag", "bulk"].includes(p.id));
  }
  return PACKAGING_UNITS.filter(p =>
    ["box", "carton", "pallet", "retail_pack", "pouch", "mesh_bag", "crate", "can", "sack", "big_bag"].includes(p.id)
  );
}

export function getWeightPresentationsForCategory(categoryProfile) {
  if (!categoryProfile?.supportsPresentationFormats) return [];
  if (categoryProfile?.supportsLiquidPackaging) return LIQUID_PRESENTATIONS;
  return WEIGHT_PRESENTATIONS;
}

// ─── Bulk / Industrial packaging options ─────────────────────────────────────

export const BULK_INDUSTRIAL_OPTIONS = [
  { id: "FLEXITANK",    label: "Flexi Tank",      desc: "24,000 L / contenedor 40FT" },
  { id: "ISO_TANK",     label: "ISO Tank",         desc: "26,000 L / cisterna" },
  { id: "IBC_1000L",    label: "IBC 1000L",        desc: "Contenedor intermedio a granel" },
  { id: "DRUM_200L",    label: "Drum 200L",        desc: "Bidón industrial 200 litros" },
  { id: "JERRYCAN_20L", label: "Jerrycan 20L",     desc: "Bidón plástico 20 litros" },
  { id: "JERRYCAN_10L", label: "Jerrycan 10L",     desc: "Bidón plástico 10 litros" },
  { id: "JERRYCAN_5L",  label: "Jerrycan 5L",      desc: "Bidón plástico 5 litros" },
  { id: "BIG_BAG_1MT",  label: "Big Bag 1MT",      desc: "Bolsón a granel 1 tonelada" },
  { id: "SACK_50KG",    label: "Saco 50kg",        desc: "Saco estándar exportación" },
  { id: "BULK_VESSEL",  label: "Granel Cisterna",  desc: "Tanque/barco cisterna a granel" },
];

// ─── Retail / Consumer packaging options ──────────────────────────────────────

export const RETAIL_CONSUMER_OPTIONS = [
  { id: "PET_BOTTLE",      label: "PET Bottle",          desc: "Botella plástica PET", isBottle: true },
  { id: "GLASS_BOTTLE",    label: "Glass Bottle",        desc: "Botella de vidrio", isBottle: true },
  { id: "TETRA_PAK",       label: "Tetra Pak",           desc: "Envase aséptico multicapa", isBottle: true },
  { id: "DOYPACK",         label: "Doypack / Pouch",     desc: "Bolsa flexible con base", isBottle: true },
  { id: "SACHET",          label: "Sachet",              desc: "Sobre monodosis", isBottle: true },
  { id: "PLASTIC_GALLON",  label: "Plastic Gallon",      desc: "Galón plástico (3.78L)", isBottle: false },
  { id: "PREMIUM_BOTTLE",  label: "Premium Export Bottle",desc: "Botella premium exportación", isBottle: true },
  { id: "CAN_TIN",         label: "Can / Tin",           desc: "Lata metálica", isBottle: false },
  { id: "RETAIL_BOX",      label: "Retail Box / Carton", desc: "Caja cartón retail", isBottle: false },
];

// Identifies packaging types that trigger the "units per box" box engine
export const RETAIL_BOX_ENGINE_TYPES = new Set([
  "PET_BOTTLE", "GLASS_BOTTLE", "TETRA_PAK", "DOYPACK", "SACHET", "PREMIUM_BOTTLE", "CAN_TIN",
]);

// ─── Liquid presentation sizes ────────────────────────────────────────────────

export const LIQUID_SIZE_RETAIL = [
  { id: "100ml",  label: "100 ml",  litValue: 0.1   },
  { id: "125ml",  label: "125 ml",  litValue: 0.125 },
  { id: "200ml",  label: "200 ml",  litValue: 0.2   },
  { id: "250ml",  label: "250 ml",  litValue: 0.25  },
  { id: "330ml",  label: "330 ml",  litValue: 0.33  },
  { id: "350ml",  label: "350 ml",  litValue: 0.35  },
  { id: "500ml",  label: "500 ml",  litValue: 0.5   },
  { id: "750ml",  label: "750 ml",  litValue: 0.75  },
  { id: "900ml",  label: "900 ml",  litValue: 0.9   },
  { id: "1000ml", label: "1 L",     litValue: 1.0   },
  { id: "1L",     label: "1 L",     litValue: 1.0   },
  { id: "2L",     label: "2 L",     litValue: 2.0   },
  { id: "3L",     label: "3 L",     litValue: 3.0   },
  { id: "5L",     label: "5 L",     litValue: 5.0   },
  { id: "10L",    label: "10 L",    litValue: 10.0  },
  { id: "20L",    label: "20 L",    litValue: 20.0  },
];

export const LIQUID_SIZE_INDUSTRIAL = [
  { id: "20L",       label: "20 L",        litValue: 20    },
  { id: "200L",      label: "200 L (Drum)", litValue: 200  },
  { id: "1000L",     label: "1000 L (IBC)", litValue: 1000 },
  { id: "5000L",     label: "5000 L",       litValue: 5000 },
  { id: "FLEXITANK", label: "Flexi Tank (~24,000L)", litValue: 24000 },
  { id: "ISO_TANK",  label: "ISO Tank (~26,000L)",   litValue: 26000 },
];

// ─── Commercial sale unit options ─────────────────────────────────────────────

export const COMMERCIAL_SALE_UNITS = [
  { id: "perKg",        label: { es: "Precio por KG",         en: "Price per KG" },         abbr: "/kg",        requiresWeight: true  },
  { id: "perMT",        label: { es: "Precio por MT",         en: "Price per MT" },         abbr: "/MT",        requiresWeight: true  },
  { id: "perLiter",     label: { es: "Precio por Litro",      en: "Price per Liter" },      abbr: "/L",         requiresWeight: false },
  { id: "perBox",       label: { es: "Precio por Caja",       en: "Price per Box" },        abbr: "/box",       requiresWeight: false },
  { id: "perCarton",    label: { es: "Precio por Cartón",     en: "Price per Carton" },     abbr: "/carton",    requiresWeight: false },
  { id: "perPouch",     label: { es: "Precio por Pouch",      en: "Price per Pouch" },      abbr: "/pouch",     requiresWeight: false },
  { id: "perUnit",      label: { es: "Precio por Unidad",     en: "Price per Unit" },       abbr: "/unit",      requiresWeight: false },
  { id: "perContainer", label: { es: "Precio por Contenedor", en: "Price per Container" },  abbr: "/container", requiresWeight: false },
  { id: "perDrum",      label: { es: "Precio por Bidón",      en: "Price per Drum" },       abbr: "/drum",      requiresWeight: false },
  { id: "perJerrycan",  label: { es: "Precio por Jerrycan",   en: "Price per Jerrycan" },   abbr: "/jerrycan",  requiresWeight: false },
  { id: "perBottle",    label: { es: "Precio por Botella",    en: "Price per Bottle" },     abbr: "/bottle",    requiresWeight: false },
  { id: "perPallet",    label: { es: "Precio por Paleta",     en: "Price per Pallet" },     abbr: "/pallet",    requiresWeight: false },
  { id: "perIBC",       label: { es: "Precio por IBC",        en: "Price per IBC" },        abbr: "/IBC",       requiresWeight: false },
  { id: "perFlexitank", label: { es: "Precio por Flexitank",  en: "Price per Flexitank" },  abbr: "/flexitank", requiresWeight: false },
];

/**
 * Returns the appropriate commercial sale units for a category profile.
 * Liquid categories get liquid-specific options. Others get weight-based + box options.
 */
export function getSaleUnitsForProfile(categoryProfile) {
  if (!categoryProfile) return COMMERCIAL_SALE_UNITS;
  if (categoryProfile.supportsLiquidPackaging) {
    return COMMERCIAL_SALE_UNITS.filter(u =>
      ["perKg","perMT","perLiter","perContainer","perDrum","perJerrycan","perBottle","perBox","perCarton","perPouch","perIBC","perFlexitank"].includes(u.id)
    );
  }
  if (categoryProfile.supportsLivestock) return []; // not used for livestock
  return COMMERCIAL_SALE_UNITS.filter(u =>
    ["perKg","perMT","perBox","perCarton","perUnit","perPallet","perContainer"].includes(u.id)
  );
}

// ─── V6: Export Format Options ────────────────────────────────────────────────
// Defines HOW the product is loaded for export — NOT bottle size, NOT carton size.
// This replaces the ambiguous "Presentación" field.

export const EXPORT_FORMAT_OPTIONS = [
  // INDUSTRIAL
  { id: "FLEXITANK",       label: "Flexitank",            desc: "~24,000 L / 40FT container",            group: "INDUSTRIAL", isRetail: false, isPouch: false },
  { id: "ISO_TANK",        label: "ISO Tank",              desc: "~26,000 L / tank container",            group: "INDUSTRIAL", isRetail: false, isPouch: false },
  { id: "IBC_1000L",       label: "IBC 1000L",             desc: "Intermediate bulk container",           group: "INDUSTRIAL", isRetail: false, isPouch: false },
  { id: "DRUM_200L",       label: "Drum 200L",             desc: "Industrial 200L steel drum",            group: "INDUSTRIAL", isRetail: false, isPouch: false },
  { id: "JERRYCAN_20L",    label: "Jerrycan 20L",          desc: "Plastic jerrycan 20 liters",            group: "INDUSTRIAL", isRetail: false, isPouch: false },
  // RETAIL DISTRIBUTION
  { id: "RETAIL_MIXED",    label: "Retail Mixed SKU",      desc: "Multiple retail sizes / SKUs",          group: "RETAIL",     isRetail: true,  isPouch: false },
  { id: "RETAIL_PET",      label: "Retail PET",            desc: "PET bottles, retail cartons",           group: "RETAIL",     isRetail: true,  isPouch: false },
  { id: "RETAIL_TETRA",    label: "Retail Tetra Pak",      desc: "Tetra Pak aseptic retail",              group: "RETAIL",     isRetail: true,  isPouch: false },
  { id: "RETAIL_DOYPACK",  label: "Retail Doypack",        desc: "Flexible pouch retail",                 group: "RETAIL",     isRetail: true,  isPouch: true  },
  // V7: POUCH FORMATS — flexible multilayer packaging
  { id: "RETAIL_POUCH",    label: "Retail Pouch",          desc: "General retail pouch — multiple types", group: "POUCH",      isRetail: true,  isPouch: true  },
  { id: "PILLOW_POUCH",    label: "Pillow Pouch",          desc: "Flat seal, high-density packing",       group: "POUCH",      isRetail: true,  isPouch: true  },
  { id: "STAND_UP_POUCH",  label: "Stand Up Pouch",        desc: "Doypack stable base, shelf-ready",      group: "POUCH",      isRetail: true,  isPouch: true  },
  { id: "SPOUT_POUCH",     label: "Spout Pouch",           desc: "Re-closable spout, liquid optimized",   group: "POUCH",      isRetail: true,  isPouch: true  },
  { id: "GUSSET_POUCH",    label: "Gusset Pouch",          desc: "Side/bottom gusset for high volume",    group: "POUCH",      isRetail: true,  isPouch: true  },
  { id: "SIDE_SEAL_POUCH", label: "Side Seal Pouch",       desc: "3-side seal sachets / flat packs",      group: "POUCH",      isRetail: true,  isPouch: true  },
  { id: "BAG_IN_BOX",      label: "Bag In Box",            desc: "Flexible bag in outer carton, 3–20L",   group: "POUCH",      isRetail: true,  isPouch: true  },
  // CUSTOM
  { id: "CUSTOM",          label: "Other / Custom",        desc: "Custom export format",                  group: "CUSTOM",     isRetail: false, isPouch: false },
];

export const INDUSTRIAL_SALE_UNITS = COMMERCIAL_SALE_UNITS.filter(u =>
  ["perKg","perMT","perLiter","perContainer","perDrum","perJerrycan","perIBC","perFlexitank"].includes(u.id)
);

export const SKU_SALE_UNITS = COMMERCIAL_SALE_UNITS.filter(u =>
  ["perBox","perCarton","perPouch","perUnit","perBottle","perLiter","perKg"].includes(u.id)
);

// ─── V6: SKU Packaging Types (retail carton + pouch engine) ──────────────────
export const SKU_PACKAGING_TYPES = [
  { id: "PET_BOTTLE",     label: "PET Bottle",       group: "BOTTLE"  },
  { id: "GLASS_BOTTLE",   label: "Glass Bottle",     group: "BOTTLE"  },
  { id: "TETRA_PAK",      label: "Tetra Pak",        group: "BOTTLE"  },
  { id: "DOYPACK",        label: "Doypack / Pouch",  group: "POUCH"   },
  { id: "SACHET",         label: "Sachet",           group: "POUCH"   },
  { id: "CAN_TIN",        label: "Can / Tin",        group: "CAN"     },
  { id: "PREMIUM_BOTTLE", label: "Premium Bottle",   group: "BOTTLE"  },
  // V7: Pouch types
  { id: "PILLOW_POUCH",    label: "Pillow Pouch",    group: "POUCH"   },
  { id: "STAND_UP_POUCH",  label: "Stand Up Pouch",  group: "POUCH"   },
  { id: "SPOUT_POUCH",     label: "Spout Pouch",     group: "POUCH"   },
  { id: "GUSSET_POUCH",    label: "Gusset Pouch",    group: "POUCH"   },
  { id: "SIDE_SEAL_POUCH", label: "Side Seal Pouch", group: "POUCH"   },
  { id: "BAG_IN_BOX",      label: "Bag In Box",      group: "BAG_IN_BOX" },
];

export function isRetailExportFormat(formatId) {
  return EXPORT_FORMAT_OPTIONS.find(f => f.id === formatId)?.isRetail || false;
}

export function isPouchExportFormat(formatId) {
  return EXPORT_FORMAT_OPTIONS.find(f => f.id === formatId)?.isPouch || false;
}

/**
 * V7.1 — Single source of truth for presentation size across pouch config + multi-SKU.
 *
 * Rules:
 *   - No SKUs (or all sizes empty): return pouchConfig.presentationSize
 *   - All SKUs agree on one size: return that size
 *   - Mixed SKU sizes OR pouchConfig vs SKU divergence: return null → VAL-025 fires
 *
 * @param {object} pouchConfig  — { presentationSize, ... }
 * @param {object[]} skus       — array of SKU rows, each may have .presentationSize
 * @returns {string|null}
 */
export function resolveNormalizedPresentationSize(pouchConfig, skus) {
  const pouchSize = pouchConfig?.presentationSize || null;
  const skuSizes  = (skus || []).map(s => s.presentationSize).filter(Boolean);
  const uniqueSkuSizes = [...new Set(skuSizes)];

  if (uniqueSkuSizes.length === 0) return pouchSize;
  if (uniqueSkuSizes.length > 1)   return null; // cross-SKU mismatch
  const skuSize = uniqueSkuSizes[0];
  if (pouchSize && pouchSize !== skuSize) return null; // pouch vs SKU mismatch
  return skuSize;
}

export function getExportFormatLabel(formatId) {
  return EXPORT_FORMAT_OPTIONS.find(f => f.id === formatId)?.label || formatId || "";
}

/**
 * Returns a short unit context label for summary display.
 * e.g. perBox → "BOXES", perLiter → "LITERS", perMT → "MT"
 */
export function getUnitContext(commercialUnit, lang = "es") {
  const MAP = {
    perBox:       { es: "CAJAS",      en: "BOXES"     },
    perCarton:    { es: "CARTONES",   en: "CARTONS"   },
    perPouch:     { es: "POUCHES",    en: "POUCHES"   },
    perUnit:      { es: "UNIDADES",   en: "UNITS"     },
    perBottle:    { es: "BOTELLAS",   en: "BOTTLES"   },
    perLiter:     { es: "LITROS",     en: "LITERS"    },
    perKg:        { es: "KG",         en: "KG"        },
    perMT:        { es: "MT",         en: "MT"        },
    perDrum:      { es: "BIDONES",    en: "DRUMS"     },
    perJerrycan:  { es: "JERRYCANS",  en: "JERRYCANS" },
    perIBC:       { es: "IBC",        en: "IBCs"      },
    perFlexitank: { es: "FLEXITANKS", en: "FLEXITANKS"},
    perContainer: { es: "CONTENEDORES",en:"CONTAINERS"},
    perPallet:    { es: "PALETAS",    en: "PALLETS"   },
  };
  return MAP[commercialUnit]?.[lang] || commercialUnit?.replace("per","").toUpperCase() || "UNITS";
}

