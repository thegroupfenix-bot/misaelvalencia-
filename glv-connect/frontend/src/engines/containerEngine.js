/**
 * containerEngine.js — Centralized container definitions for GLV Commercial Engine V4.
 * Single source of truth for container types, specs, and classification.
 * Replaces the CONTAINER_TYPES array hardcoded in CommercialEngine.jsx.
 */

export const CONTAINER_SPECS = {
  "20FT":             { label: "20FT Dry",          desc: "~26 MT",                maxPayloadMT: 26,   volumeCBM: 33.2, tempControlled: false, liquid: false, livestock: false, bulk: false },
  "40FT":             { label: "40FT Dry",           desc: "~28 MT",                maxPayloadMT: 28,   volumeCBM: 67.7, tempControlled: false, liquid: false, livestock: false, bulk: false },
  "40HC":             { label: "40HC Dry",           desc: "~28.5 MT (high cube)",  maxPayloadMT: 28.5, volumeCBM: 76.3, tempControlled: false, liquid: false, livestock: false, bulk: false },
  "REEFER_20":        { label: "Reefer 20FT",        desc: "Refrigerado 20FT",      maxPayloadMT: 20,   volumeCBM: 28.0, tempControlled: true,  liquid: false, livestock: false, bulk: false },
  "REEFER_40":        { label: "Reefer 40FT",        desc: "Refrigerado 40FT",      maxPayloadMT: 25,   volumeCBM: 59.8, tempControlled: true,  liquid: false, livestock: false, bulk: false },
  "FLEXITANK":        { label: "Flexitank",          desc: "Granel líquido",        maxPayloadMT: 22,   volumeCBM: 24.0, tempControlled: false, liquid: true,  livestock: false, bulk: false },
  "ISO_TANK":         { label: "ISO Tank",           desc: "Tanque líquidos/gases", maxPayloadMT: 24,   volumeCBM: 26.0, tempControlled: false, liquid: true,  livestock: false, bulk: false },
  "BULK_VESSEL":      { label: "Bulk Vessel",        desc: "Buque a granel",        maxPayloadMT: null, volumeCBM: null, tempControlled: false, liquid: false, livestock: false, bulk: true  },
  "LIVESTOCK_VESSEL": { label: "Livestock Vessel",   desc: "Buque ganadero",        maxPayloadMT: null, volumeCBM: null, tempControlled: false, liquid: false, livestock: true,  bulk: false },
  "AIR_CARGO":        { label: "Air Cargo",          desc: "Carga aérea",           maxPayloadMT: 10,   volumeCBM: null, tempControlled: false, liquid: false, livestock: false, bulk: false },
};

// Flat list for UI selectors — shape matches the legacy CONTAINER_TYPES array
export const CONTAINER_TYPES = Object.entries(CONTAINER_SPECS).map(([id, spec]) => ({
  id,
  label: spec.label,
  desc:  spec.desc,
}));

// ─── Accessors ────────────────────────────────────────────────────────────────

export function getContainerSpec(id) {
  return CONTAINER_SPECS[id] || null;
}

export function getContainerLabel(id) {
  return CONTAINER_SPECS[id]?.label || id || "";
}

// ─── Classification predicates ────────────────────────────────────────────────

export function isReeferContainer(id)    { return id?.startsWith("REEFER_") ?? false; }
export function isLiquidContainer(id)    { return ["FLEXITANK", "ISO_TANK"].includes(id); }
export function isLivestockContainer(id) { return id === "LIVESTOCK_VESSEL"; }
export function isBulkContainer(id)     { return id === "BULK_VESSEL"; }
export function isDryContainer(id)      { return ["20FT", "40FT", "40HC"].includes(id); }

// ─── Allowed containers per category ─────────────────────────────────────────

export const CATEGORY_ALLOWED_CONTAINERS = {
  LIVE_ANIMALS:            ["LIVESTOCK_VESSEL"],
  FROZEN_MEAT:             ["REEFER_20", "REEFER_40", "AIR_CARGO"],
  FROZEN_POULTRY:          ["REEFER_20", "REEFER_40"],
  CANNED_MEAT:             ["20FT", "40FT", "40HC"],
  COMMODITIES:             ["20FT", "40FT", "40HC", "BULK_VESSEL"],
  BEANS:                   ["20FT", "40FT", "40HC"],
  LENTILS:                 ["20FT", "40FT", "40HC"],
  CHICKPEAS:               ["20FT", "40FT", "40HC"],
  ANIMAL_FEED:             ["20FT", "40FT", "40HC", "BULK_VESSEL"],
  OILS:                    ["FLEXITANK", "ISO_TANK", "20FT"],
  FRUIT_PRODUCTS:          ["REEFER_20", "REEFER_40", "AIR_CARGO"],
  COLOMBIAN_EXOTIC_FRUITS: ["REEFER_20", "REEFER_40", "AIR_CARGO"],
  EGGS:                    ["REEFER_20", "REEFER_40"],
  CUSTOM:                  Object.keys(CONTAINER_SPECS),
};

export function getAllowedContainers(category) {
  const ids = CATEGORY_ALLOWED_CONTAINERS[category] || Object.keys(CONTAINER_SPECS);
  return ids.map(id => ({ id, ...CONTAINER_SPECS[id] }));
}
