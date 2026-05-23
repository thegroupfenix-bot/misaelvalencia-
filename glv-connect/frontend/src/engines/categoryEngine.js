/**
 * DynamicCommercialEngine — category routing and configuration.
 *
 * Single source of truth for ALL category-specific behavioral mappings.
 * Replaces scattered hardcoded if/switch chains across CommercialEngine,
 * GlvPDF, mediaBinding, and validators.
 *
 * Import pattern:
 *   import { getCategoryEngine, isLiveAnimalCategory, getDefaultContainer } from "../engines/categoryEngine.js";
 */

import { PRODUCT_CATEGORIES } from "../config/productCategories.js";

// ─── Category group sets ───────────────────────────────────────────────────────
// Mutually exclusive sets. Add new categories here — NEVER in component files.

export const LIVE_ANIMAL_CATEGORIES  = new Set(["LIVE_ANIMALS"]);
export const FROZEN_CATEGORIES       = new Set(["FROZEN_MEAT", "FROZEN_POULTRY"]);
export const FRUIT_CATEGORIES        = new Set(["FRUIT_PRODUCTS", "COLOMBIAN_EXOTIC_FRUITS"]);
export const GRAIN_CATEGORIES        = new Set(["COMMODITIES", "BEANS", "LENTILS", "CHICKPEAS", "ANIMAL_FEED"]);
export const CANNED_CATEGORIES       = new Set(["CANNED_MEAT", "EGGS"]);
export const REFRIGERATED_CATEGORIES = new Set(["FROZEN_MEAT", "FROZEN_POULTRY", "FRUIT_PRODUCTS", "COLOMBIAN_EXOTIC_FRUITS", "CANNED_MEAT", "EGGS"]);
export const LIQUID_CATEGORIES       = new Set(["OILS"]);
export const BULK_CATEGORIES         = new Set(["COMMODITIES", "BEANS", "LENTILS", "CHICKPEAS", "ANIMAL_FEED", "OILS"]);

// ─── Category predicate functions ─────────────────────────────────────────────
// Use these instead of string-matching product names or hardcoded category arrays.

export const isLiveAnimalCategory  = (cat) => LIVE_ANIMAL_CATEGORIES.has(cat);
export const isFrozenCategory      = (cat) => FROZEN_CATEGORIES.has(cat);
export const isFruitCategory       = (cat) => FRUIT_CATEGORIES.has(cat);
export const isGrainCategory       = (cat) => GRAIN_CATEGORIES.has(cat);
export const isCannedCategory      = (cat) => CANNED_CATEGORIES.has(cat);
export const isRefrigeratedCategory = (cat) => REFRIGERATED_CATEGORIES.has(cat);
export const isLiquidCategory      = (cat) => LIQUID_CATEGORIES.has(cat);
export const isBulkCategory        = (cat) => BULK_CATEGORIES.has(cat);

// ─── Default container per category ───────────────────────────────────────────
// Single source of truth — replaces defaultContainerForCategory() in CommercialEngine.jsx

export const CATEGORY_DEFAULT_CONTAINER = {
  LIVE_ANIMALS:            "LIVESTOCK_VESSEL",
  FROZEN_MEAT:             "REEFER_40",
  FROZEN_POULTRY:          "REEFER_40",
  FRUIT_PRODUCTS:          "REEFER_40",
  COLOMBIAN_EXOTIC_FRUITS: "REEFER_40",
  CANNED_MEAT:             "REEFER_40",
  EGGS:                    "REEFER_40",
  COMMODITIES:             "BULK_VESSEL",
  BEANS:                   "BULK_VESSEL",
  LENTILS:                 "BULK_VESSEL",
  CHICKPEAS:               "BULK_VESSEL",
  ANIMAL_FEED:             "BULK_VESSEL",
  OILS:                    "FLEXITANK",
  CUSTOM:                  "40FT",
};

export function getDefaultContainer(category) {
  return CATEGORY_DEFAULT_CONTAINER[category] || "40FT";
}

// ─── Default cargo type label per category ────────────────────────────────────
// Replaces hardcoded conditional in CargoTypeSelector component.

export const CATEGORY_CARGO_TYPE = {
  LIVE_ANIMALS:            "Live Animals",
  FROZEN_MEAT:             "Frozen Cargo",
  FROZEN_POULTRY:          "Frozen Cargo",
  CANNED_MEAT:             "Frozen Cargo",
  EGGS:                    "Refrigerated Cargo",
  FRUIT_PRODUCTS:          "Refrigerated Cargo",
  COLOMBIAN_EXOTIC_FRUITS: "Refrigerated Cargo",
  OILS:                    "Liquid Bulk",
  COMMODITIES:             "Dry Bulk",
  BEANS:                   "Dry Bulk",
  LENTILS:                 "Dry Bulk",
  CHICKPEAS:               "Dry Bulk",
  ANIMAL_FEED:             "Dry Bulk",
};

export function getDefaultCargoType(category) {
  return CATEGORY_CARGO_TYPE[category] || "Dry Cargo";
}

// ─── PDF text block routing ────────────────────────────────────────────────────
// Maps category → textKey that selects certifications / timeline / mandatory text.
// Replaces fragile isLivestock(doc.product) / isGrain(doc.product) string matching.
//
// Keys:
//   "livestock"      → live animal certs, livestock vessel timeline, OIE mandatory
//   "grain"          → grain/commodity certs, bulk timeline, GMO mandatory
//   "frozen_meat"    → meat certs, reefer timeline
//   "frozen_poultry" → poultry certs, reefer timeline
//   "fruit"          → phytosanitary certs, reefer / ambient timeline
//   "food"           → generic export food (default)

export const CATEGORY_PDF_TEXT_KEY = {
  LIVE_ANIMALS:            "livestock",
  FROZEN_MEAT:             "frozen_meat",
  FROZEN_POULTRY:          "frozen_poultry",
  FRUIT_PRODUCTS:          "fruit",
  COLOMBIAN_EXOTIC_FRUITS: "fruit",
  COMMODITIES:             "grain",
  BEANS:                   "grain",
  LENTILS:                 "grain",
  CHICKPEAS:               "grain",
  ANIMAL_FEED:             "grain",
  OILS:                    "food",
  CANNED_MEAT:             "food",
  EGGS:                    "food",
  CUSTOM:                  "food",
};

export function getPDFTextKey(category) {
  return CATEGORY_PDF_TEXT_KEY[category] || "food";
}

// ─── Media config per category ─────────────────────────────────────────────────
// Strict tag-sets and exclusion-sets for media binding.
// Frontend MediaPanel and backend mediaBinding.js both reference this contract.

export const CATEGORY_MEDIA_CONFIG = {
  LIVE_ANIMALS: {
    tags:       ["livestock","sheep","cattle","goat","ranch","vessel","halal","quarantine","ovino","bovino","ganado"],
    exclusions: ["avocado","avoca","aguacate","fruit","fruta","mango","banana","grain","grano","oil","aceite","canned","enlatado","poultry","chicken","pollo"],
  },
  FROZEN_MEAT: {
    tags:       ["meat","carne","frozen","beef","lamb","cordero","congelado","corte","reefer"],
    exclusions: ["avocado","avoca","fruit","fruta","livestock","sheep","ovino","bovino","grain","grano","oil","aceite"],
  },
  FROZEN_POULTRY: {
    tags:       ["chicken","pollo","poultry","ave","turkey","duck","reefer","frozen"],
    exclusions: ["avocado","avoca","fruit","fruta","livestock","sheep","ovino","bovino","grain","grano","oil","aceite","beef"],
  },
  FRUIT_PRODUCTS: {
    tags:       ["fruit","fruta","mango","banana","avocado","aguacate","citrus","pineapple","piña","reefer","pallet"],
    exclusions: ["livestock","sheep","cattle","ovino","bovino","ganado","cordero","animales","grain","grano","oil","aceite"],
  },
  COLOMBIAN_EXOTIC_FRUITS: {
    tags:       ["exotic","exotico","colombia","uchuva","gulupa","pitahaya","lulo","maracuya","granadilla","tropical","reefer"],
    exclusions: ["livestock","sheep","cattle","ovino","grain","grano","oil","aceite","frozen","beef","carne"],
  },
  COMMODITIES: {
    tags:       ["grain","grano","soy","soja","corn","maiz","wheat","trigo","rice","arroz","bulk","soybean"],
    exclusions: ["avocado","avoca","fruit","fruta","livestock","sheep","ovino","bovino","poultry","chicken","pollo"],
  },
  BEANS: {
    tags:       ["bean","frijol","legume","lentil","garbanzo","pulse","leguminosa","bag"],
    exclusions: ["avocado","avoca","fruit","fruta","livestock","sheep","ovino","bovino","poultry","chicken"],
  },
  LENTILS: {
    tags:       ["lentil","lenteja","legume","pulse","bag"],
    exclusions: ["avocado","fruit","fruta","livestock","sheep","ovino","bovino","poultry","chicken"],
  },
  CHICKPEAS: {
    tags:       ["chickpea","garbanzo","chana","legume","pulse","bag"],
    exclusions: ["avocado","fruit","fruta","livestock","sheep","bovino","poultry","chicken"],
  },
  ANIMAL_FEED: {
    tags:       ["feed","alimento","soybean","meal","harina","bran","salvado","alfalfa","pellet"],
    exclusions: ["avocado","fruit","fruta","poultry","chicken","canned","enlatado","reefer"],
  },
  OILS: {
    tags:       ["oil","aceite","palm","soy","sunflower","girasol","corn","canola","liquid","tank"],
    exclusions: ["livestock","sheep","ovino","bovino","fruit","fruta","canned","frozen","meat","carne"],
  },
  CANNED_MEAT: {
    tags:       ["canned","enlatado","conserva","corned","beef","lata","can","tin"],
    exclusions: ["avocado","avoca","fruit","fruta","livestock","sheep","grain","grano","oil","aceite"],
  },
  EGGS: {
    tags:       ["egg","huevo","poultry","incubation","fertile","huevos","pollito"],
    exclusions: ["avocado","fruit","fruta","livestock","sheep","bovino","grain","oil","aceite","meat","carne"],
  },
};

export function getCategoryMediaConfig(category) {
  return CATEGORY_MEDIA_CONFIG[category] || null;
}

// ─── Main engine accessor ──────────────────────────────────────────────────────
// Returns a fully-resolved engine object for a given category.
// Components should call getCategoryEngine(category) once and destructure.

export function getCategoryEngine(category) {
  const def = PRODUCT_CATEGORIES[category] || null;
  return {
    category,
    def,
    // Category predicates
    isLiveAnimal:      isLiveAnimalCategory(category),
    isFrozen:          isFrozenCategory(category),
    isFruit:           isFruitCategory(category),
    isGrain:           isGrainCategory(category),
    isCanned:          isCannedCategory(category),
    isRefrigerated:    isRefrigeratedCategory(category),
    isLiquid:          isLiquidCategory(category),
    isBulk:            isBulkCategory(category),
    // Transport
    defaultContainer:  getDefaultContainer(category),
    defaultCargoType:  getDefaultCargoType(category),
    // PDF
    pdfTextKey:        getPDFTextKey(category),
    // Media
    mediaConfig:       getCategoryMediaConfig(category),
    // From productCategories.js
    calculationMode:   def?.calculationMode || "WEIGHT",
    units:             def?.units || ["KG", "Tonelada Métrica / MT"],
    containerCapacity: def?.containerCapacity || 25,
    label:             def?.label || { es: category, en: category },
    color:             def?.color || "#6b7280",
  };
}
