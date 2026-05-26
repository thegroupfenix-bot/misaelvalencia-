/**
 * oilsPouchEngine.js — V8.0 Oils-Specific Pouch Packaging Engine
 * Isolated from PouchPackagingEngine.js (V7 generic pouch).
 * Purpose: oils-specific film structures, seal types, and OEM capabilities.
 */

export const OIL_POUCH_TYPES = [
  { id: "PILLOW_POUCH",       label: "Pillow Pouch",        desc: "Flat pillow seal — economy format for mass distribution" },
  { id: "LAMINATED_POUCH",    label: "Laminated Pouch",     desc: "Multi-layer laminated film — retail quality, high barrier" },
  { id: "MULTILAYER_POUCH",   label: "Multilayer Pouch",    desc: "Premium multilayer — extended shelf life, export grade" },
  { id: "FLEXIBLE_OIL_POUCH", label: "Flexible Oil Pouch",  desc: "Engineered for edible oils — grease-resistant, FDA food grade" },
];

export const OIL_FILM_MATERIALS = [
  { id: "PET_PE",               label: "PET + PE",              desc: "Standard — general retail use" },
  { id: "PET_NYLON_PE",         label: "PET + Nylon + PE",      desc: "Premium — barrier against oxygen and moisture" },
  { id: "MULTILAYER_FOOD_FILM", label: "Multilayer Food Film",  desc: "Export heavy duty — extended shelf life for edible oils" },
];

export const OIL_SEAL_TYPES = [
  { id: "SIDE_SEAL",    label: "Side Seal"     },
  { id: "CENTER_SEAL",  label: "Center Seal"   },
  { id: "TOP_SPOUT",    label: "Top Spout"     },
  { id: "CORNER_SPOUT", label: "Corner Spout"  },
];

export const OIL_POUCH_SIZES = [
  { id: "500ml",  label: "500 ml",  litValue: 0.50 },
  { id: "1000ml", label: "1 L",     litValue: 1.00 },
  { id: "2000ml", label: "2 L",     litValue: 2.00 },
  { id: "3000ml", label: "3 L",     litValue: 3.00 },
  { id: "5000ml", label: "5 L",     litValue: 5.00 },
];

export const OIL_FOOD_GRADE_LEVELS = [
  { id: "FDA",      label: "FDA Food Grade"   },
  { id: "FSSC",     label: "FSSC 22000"       },
  { id: "BRC",      label: "BRC Food Safety"  },
  { id: "HALAL",    label: "Halal Certified"  },
  { id: "KOSHER",   label: "Kosher Certified" },
];

export const OIL_OEM_CAPABILITIES = [
  { id: "oem",          label: "OEM Production"    },
  { id: "privateLabel", label: "Private Label"      },
  { id: "horeca",       label: "Horeca Supply"      },
  { id: "retail",       label: "Retail Ready"       },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getOilPouchTypeLabel(id) {
  return OIL_POUCH_TYPES.find(p => p.id === id)?.label || id || "";
}

export function getOilFilmMaterialLabel(id) {
  return OIL_FILM_MATERIALS.find(f => f.id === id)?.label || id || "";
}

export function getOilSealTypeLabel(id) {
  return OIL_SEAL_TYPES.find(s => s.id === id)?.label || id || "";
}

export function getOilPouchSizeLabel(id) {
  return OIL_POUCH_SIZES.find(s => s.id === id)?.label || id || "";
}

/**
 * Default carton configs for oil pouches.
 * Returns suggested units/carton options.
 */
export const OIL_POUCH_CARTON_CONFIG = {
  "500ml":  [24, 36, 48],
  "1000ml": [12, 18, 24],
  "2000ml": [6,  9,  12],
  "3000ml": [6,  8,  10],
  "5000ml": [4,  6,  8 ],
};

export function getOilPouchCartonOptions(sizeId) {
  return OIL_POUCH_CARTON_CONFIG[sizeId] || [12];
}
