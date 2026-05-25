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
