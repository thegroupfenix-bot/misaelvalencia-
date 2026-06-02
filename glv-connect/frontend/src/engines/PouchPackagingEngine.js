/**
 * PouchPackagingEngine.js — GLV Multi-Packaging Export Engine V7.
 *
 * Isolated engine for flexible pouch / bag-in-box packaging.
 * Integrates with: packagingEngine, CommercialEngine, MultiSKU, GlvPDF,
 * mediaContextResolver, validationSupervisor, containerEngine, calculations.
 *
 * ISOLATION GUARANTEE:
 *   - LIVE_ANIMALS: not touched. Zero imports from this file affect livestock.
 *   - Frozen cargo / grains / eggs: no changes.
 *   - V5 / V6 existing export format logic: additive only.
 */

// ─── Pouch Export Format IDs ──────────────────────────────────────────────────
// These extend EXPORT_FORMAT_OPTIONS in packagingEngine.js (added there too).

export const POUCH_EXPORT_FORMAT_IDS = new Set([
  "RETAIL_POUCH",
  "PILLOW_POUCH",
  "STAND_UP_POUCH",
  "SPOUT_POUCH",
  "GUSSET_POUCH",
  "SIDE_SEAL_POUCH",
  "BAG_IN_BOX",
]);

export function isPouchExportFormat(formatId) {
  return POUCH_EXPORT_FORMAT_IDS.has(formatId);
}

// ─── Pouch Type Options ───────────────────────────────────────────────────────

export const POUCH_TYPES = [
  { id: "PILLOW_POUCH",    label: "Pillow Pouch",     desc: "Flat back seal, high volume",          group: "FLEXIBLE" },
  { id: "STAND_UP_POUCH",  label: "Stand Up Pouch",   desc: "Doypack with stable base",             group: "FLEXIBLE" },
  { id: "SPOUT_POUCH",     label: "Spout Pouch",       desc: "Re-closable spout, liquid optimized",  group: "FLEXIBLE" },
  { id: "GUSSET_POUCH",    label: "Gusset Pouch",     desc: "Side/bottom gusset for volume",        group: "FLEXIBLE" },
  { id: "SIDE_SEAL_POUCH", label: "Side Seal Pouch",  desc: "3-side seal, sachets/flat packs",      group: "FLEXIBLE" },
  { id: "BAG_IN_BOX",      label: "Bag In Box",        desc: "Flexible bag inside outer carton",     group: "BAG_IN_BOX" },
];

export function getPouchTypeLabel(id) {
  return POUCH_TYPES.find(p => p.id === id)?.label || id || "";
}

// ─── Film Structure Options ───────────────────────────────────────────────────

export const FILM_STRUCTURES = [
  {
    id:    "PET_PE",
    label: "PET + PE",
    desc:  "Standard food-grade laminate — cost effective, suitable for dry/semi-liquid",
    tier:  "STANDARD",
  },
  {
    id:    "PET_NYLON_PE",
    label: "PET + NYLON + PE",
    desc:  "Premium laminate — enhanced oxygen/moisture barrier, oils and premium liquids",
    tier:  "PREMIUM",
  },
  {
    id:    "BOPP_METPET_PE",
    label: "BOPP + MET PET + PE",
    desc:  "Export Heavy Duty — metallized barrier, maximum shelf life, long-haul export",
    tier:  "EXPORT_HEAVY_DUTY",
  },
];

export function getFilmStructureLabel(id) {
  return FILM_STRUCTURES.find(f => f.id === id)?.label || id || "";
}

// ─── Seal Types ───────────────────────────────────────────────────────────────

export const SEAL_TYPES = [
  { id: "HEAT_SEAL",       label: "Heat Seal" },
  { id: "ULTRASONIC_SEAL", label: "Ultrasonic Seal" },
  { id: "LASER_SEAL",      label: "Laser Seal" },
  { id: "ZIP_LOCK",        label: "Zip Lock" },
];

// ─── Print Types ──────────────────────────────────────────────────────────────

export const PRINT_TYPES = [
  { id: "ROTOGRAVURE",   label: "Rotogravure (8-color)" },
  { id: "FLEXO",         label: "Flexographic (6-color)" },
  { id: "DIGITAL",       label: "Digital Print" },
  { id: "NO_PRINT",      label: "Plain / No Print (OEM)" },
];

// ─── Finish Types ─────────────────────────────────────────────────────────────

export const FINISH_TYPES = [
  { id: "MATTE",      label: "Matte Finish" },
  { id: "GLOSSY",     label: "Glossy Finish" },
  { id: "SOFT_TOUCH", label: "Soft Touch" },
  { id: "METALLIC",   label: "Metallic Finish" },
];

// ─── Valve / Spout Options ────────────────────────────────────────────────────

export const VALVE_OPTIONS = [
  { id: "NONE",        label: "None" },
  { id: "SPOUT_SCREW", label: "Screw Spout (re-closable)" },
  { id: "SPOUT_PUSH",  label: "Push Spout" },
  { id: "DEGASSING",   label: "Degassing Valve (coffee/oils)" },
  { id: "FITMENT",     label: "Fitment Spout (Bag-In-Box)" },
];

// ─── Food Grade Certifications ────────────────────────────────────────────────

export const FOOD_GRADE_CERTS = [
  { id: "FDA",        label: "FDA (USA)" },
  { id: "EU_10_2011", label: "EU Reg. 10/2011" },
  { id: "KOSHER",     label: "Kosher Certified" },
  { id: "HALAL",      label: "Halal Certified" },
  { id: "BPA_FREE",   label: "BPA Free" },
  { id: "ISO_9001",   label: "ISO 9001:2015" },
];

// ─── Pouch Presentation Sizes ─────────────────────────────────────────────────
// Additional pouch-specific sizes supplementing LIQUID_SIZE_RETAIL from packagingEngine.

export const POUCH_SIZES = [
  { id: "250ml",  label: "250 ml",  litValue: 0.25,  mlValue: 250  },
  { id: "500ml",  label: "500 ml",  litValue: 0.50,  mlValue: 500  },
  { id: "900ml",  label: "900 ml",  litValue: 0.90,  mlValue: 900  },
  { id: "1000ml", label: "1 L",     litValue: 1.00,  mlValue: 1000 },
  { id: "1500ml", label: "1.5 L",   litValue: 1.50,  mlValue: 1500 },
  { id: "2000ml", label: "2 L",     litValue: 2.00,  mlValue: 2000 },
  { id: "2500ml", label: "2.5 L",   litValue: 2.50,  mlValue: 2500 },
  { id: "3000ml", label: "3 L",     litValue: 3.00,  mlValue: 3000 },
  { id: "5000ml", label: "5 L",     litValue: 5.00,  mlValue: 5000 },
  { id: "10L",    label: "10 L",    litValue: 10.0,  mlValue: 10000 },
  { id: "20L",    label: "20 L",    litValue: 20.0,  mlValue: 20000 },
];

export function getPouchSizeLabel(id) {
  return POUCH_SIZES.find(s => s.id === id)?.label || id || "";
}

// ─── Master Carton Configuration ──────────────────────────────────────────────
// Default units-per-carton by pouch size — overridable per SKU.

export const MASTER_CARTON_CONFIG = {
  "250ml":  [{ units: 24, label: "24 / carton" }, { units: 30, label: "30 / carton" }, { units: 48, label: "48 / carton" }],
  "500ml":  [{ units: 12, label: "12 / carton" }, { units: 15, label: "15 / carton" }, { units: 18, label: "18 / carton" }, { units: 20, label: "20 / carton" }],
  "900ml":  [{ units: 12, label: "12 / carton" }, { units: 15, label: "15 / carton" }],
  "1000ml": [{ units: 12, label: "12 / carton" }, { units: 15, label: "15 / carton" }, { units: 18, label: "18 / carton" }],
  "1500ml": [{ units: 8,  label: "8 / carton"  }, { units: 12, label: "12 / carton" }],
  "2000ml": [{ units: 6,  label: "6 / carton"  }, { units: 8,  label: "8 / carton"  }],
  "2500ml": [{ units: 6,  label: "6 / carton"  }],
  "3000ml": [{ units: 4,  label: "4 / carton"  }, { units: 6,  label: "6 / carton"  }],
  "5000ml": [{ units: 4,  label: "4 / carton"  }],
  "10L":    [{ units: 2,  label: "2 / carton"  }],
  "20L":    [{ units: 1,  label: "1 / carton (20L bag-in-box)" }],
};

/**
 * Returns the suggested unit options for a pouch size.
 * Falls back to a sensible default if size not found.
 */
export function getCartonConfig(sizeId) {
  return MASTER_CARTON_CONFIG[sizeId] || [{ units: 12, label: "12 / carton" }];
}

/**
 * Returns the default (first) units-per-carton for a given size.
 */
export function getDefaultUnitsPerCarton(sizeId) {
  const cfg = getCartonConfig(sizeId);
  return cfg[0]?.units || 12;
}

// ─── Logistics Density: Container Utilization ─────────────────────────────────
// Approximate units per 40HQ container by format and size.
// Used for freight optimization simulation and PDF display.

export const CONTAINER_UTILIZATION = {
  PET_BOTTLE: {
    default: { unitsPer40HQ: 22000, note: "~22,000–23,000 PET bottles / 40HQ" },
    "500ml":  { unitsPer40HQ: 23000 },
    "900ml":  { unitsPer40HQ: 22000 },
    "1000ml": { unitsPer40HQ: 21500 },
  },
  POUCH: {
    default: { unitsPer40HQ: 32000, note: "~30,000–34,000 pouches / 40HQ (superior cube utilization)" },
    "250ml":  { unitsPer40HQ: 60000 },
    "500ml":  { unitsPer40HQ: 34000 },
    "900ml":  { unitsPer40HQ: 30000 },
    "1000ml": { unitsPer40HQ: 30000 },
    "2000ml": { unitsPer40HQ: 18000 },
    "5000ml": { unitsPer40HQ: 8000  },
    "10L":    { unitsPer40HQ: 3600  },
    "20L":    { unitsPer40HQ: 1800  },
  },
};

/**
 * Returns estimated units per 40HQ container for a format/size combination.
 */
export function getContainerUtilization(packagingFormat, sizeId) {
  const type = isPouchExportFormat(packagingFormat) ? "POUCH" : "PET_BOTTLE";
  const table = CONTAINER_UTILIZATION[type] || CONTAINER_UTILIZATION.POUCH;
  return table[sizeId] || table.default;
}

// ─── Freight Efficiency Comparison ───────────────────────────────────────────

/**
 * Compare freight efficiency between pouch and PET for the same size.
 * Returns ratio > 1 = pouch is more efficient.
 */
export function calcFreightEfficiencyRatio(sizeId) {
  const pet   = CONTAINER_UTILIZATION.PET_BOTTLE[sizeId]  || CONTAINER_UTILIZATION.PET_BOTTLE.default;
  const pouch = CONTAINER_UTILIZATION.POUCH[sizeId]        || CONTAINER_UTILIZATION.POUCH.default;
  if (!pet?.unitsPer40HQ || !pouch?.unitsPer40HQ) return null;
  return (pouch.unitsPer40HQ / pet.unitsPer40HQ).toFixed(2);
}

// ─── Pallet Configuration ─────────────────────────────────────────────────────

export const PALLET_CONFIG = {
  "250ml":  { cartonsPerPallet: 80, stackLayers: 10 },
  "500ml":  { cartonsPerPallet: 60, stackLayers: 8  },
  "900ml":  { cartonsPerPallet: 48, stackLayers: 7  },
  "1000ml": { cartonsPerPallet: 48, stackLayers: 7  },
  "1500ml": { cartonsPerPallet: 40, stackLayers: 6  },
  "2000ml": { cartonsPerPallet: 36, stackLayers: 6  },
  "5000ml": { cartonsPerPallet: 24, stackLayers: 5  },
  "10L":    { cartonsPerPallet: 16, stackLayers: 4  },
  "20L":    { cartonsPerPallet: 8,  stackLayers: 3  },
};

export function getPalletConfig(sizeId) {
  return PALLET_CONFIG[sizeId] || { cartonsPerPallet: 40, stackLayers: 6 };
}

// ─── Private Label / OEM Capabilities ────────────────────────────────────────

export const OEM_CAPABILITIES = [
  { id: "PRIVATE_LABEL",  label: "Private Label",          desc: "Full brand on pouch for buyer" },
  { id: "OEM",            label: "OEM Production",         desc: "Buyer-supplied formula or recipe" },
  { id: "WHITE_LABEL",    label: "White Label",            desc: "Unbranded, buyer applies sticker" },
  { id: "CO_BRANDING",    label: "Co-Branding",            desc: "Seller + buyer brand side by side" },
];

// ─── Export Description Base ──────────────────────────────────────────────────

export const POUCH_EXPORT_DESCRIPTION = {
  en: "Flexible multilayer food-grade cooking oil pouch packaging designed for high-volume export distribution, optimized for freight efficiency, cost reduction, and large-scale retail and wholesale markets.",
  es: "Empaque flexible multicapa de grado alimenticio para aceite de cocina, diseñado para distribución de exportación de alto volumen, optimizado para eficiencia de flete, reducción de costos y mercados minoristas y mayoristas a gran escala.",
};

// ─── Media Tags for Pouch ─────────────────────────────────────────────────────

export const POUCH_MEDIA_TAGS = [
  "pouch packaging",
  "retail pouch",
  "stand up pouch",
  "oil pouch",
  "export pouch",
  "OEM pouch",
  "private label pouch",
  "flexible packaging",
  "doypack",
  "pillow pouch",
  "spout pouch",
  "bag in box",
];

export const POUCH_MEDIA_EXCLUSIONS = [
  "livestock",
  "cattle",
  "bovine",
  "sheep",
  "frozen meat",
  "poultry",
  "grain",
  "soybean",
  "corn",
];

// ─── SKU Packaging Types (Pouch extension for V6 Multi-SKU engine) ────────────

export const SKU_POUCH_PACKAGING_TYPES = [
  { id: "PILLOW_POUCH",    label: "Pillow Pouch"     },
  { id: "STAND_UP_POUCH",  label: "Stand Up Pouch"   },
  { id: "SPOUT_POUCH",     label: "Spout Pouch"      },
  { id: "GUSSET_POUCH",    label: "Gusset Pouch"     },
  { id: "SIDE_SEAL_POUCH", label: "Side Seal Pouch"  },
  { id: "BAG_IN_BOX",      label: "Bag In Box"       },
];

// ─── Commercial Sale Units for Pouches ────────────────────────────────────────
// Pouch-specific units that extend COMMERCIAL_SALE_UNITS in packagingEngine.

export const POUCH_SALE_UNITS = [
  { id: "perPouch",  label: { es: "Precio por Pouch",   en: "Price per Pouch" },  abbr: "/pouch",  requiresWeight: false },
  { id: "perCarton", label: { es: "Precio por Cartón",  en: "Price per Carton" }, abbr: "/carton", requiresWeight: false },
];

// ─── Full pouch logistics summary ─────────────────────────────────────────────

/**
 * Compute full logistics summary for a single pouch SKU.
 *
 * @param {object} opts
 * @param {string} opts.sizeId           — e.g. "1000ml"
 * @param {number} opts.unitsPerCarton   — e.g. 12
 * @param {number} opts.cartons          — number of cartons in shipment
 * @param {string} [opts.exportFormat]   — e.g. "STAND_UP_POUCH"
 * @returns {object}  logisticsSummary
 */
export function calcPouchLogistics({ sizeId, unitsPerCarton, cartons, exportFormat }) {
  const upb     = parseFloat(unitsPerCarton) || getDefaultUnitsPerCarton(sizeId);
  const ctn     = parseFloat(cartons) || 0;
  const palCfg  = getPalletConfig(sizeId);
  const pouchSz = POUCH_SIZES.find(s => s.id === sizeId);
  const litV    = pouchSz?.litValue || 1;

  const totalUnits   = ctn * upb;
  const totalLiters  = totalUnits * litV;
  const totalNetKg   = totalLiters; // 1L ≈ 1kg for food oils/juices
  const pallets      = palCfg.cartonsPerPallet > 0 ? Math.ceil(ctn / palCfg.cartonsPerPallet) : null;
  const utilization  = getContainerUtilization(exportFormat || "STAND_UP_POUCH", sizeId);

  return {
    totalUnits,
    totalLiters,
    totalNetKg,
    pallets,
    cartonsPerPallet: palCfg.cartonsPerPallet,
    estimatedContainers: utilization?.unitsPer40HQ > 0 ? Math.ceil(totalUnits / utilization.unitsPer40HQ) : null,
    containerNote: utilization?.note || null,
  };
}
