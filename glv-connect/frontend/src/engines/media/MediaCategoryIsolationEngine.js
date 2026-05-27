/**
 * MediaCategoryIsolationEngine.js — V1.0
 *
 * Strict per-category media isolation rules for SCO/FCO export documents.
 *
 * RULE: Each document category must display ONLY contextually valid images.
 * Cross-contamination (e.g., livestock vessels in an oils document) is prohibited.
 * Maximum 2 commercial images per document (main + 1 support). Branding is separate.
 *
 * This engine enforces the media policy at the PDF rendering layer.
 * It works in coordination with mediaContextResolver.js (which handles
 * the backend asset query/scoring) — this engine is the PDF-layer enforcer.
 */

import { DOCUMENT_MODES } from "../documentModeResolver.js";

// ─── Per-category media rules ──────────────────────────────────────────────────

export const MEDIA_CATEGORY_RULES = Object.freeze({

  LIVE_ANIMALS: {
    maxCommercialImages: 2,
    allowedKeywords: [
      "livestock", "cattle", "sheep", "goats", "bovine", "ovine",
      "livestock vessel", "livestock carrier", "veterinary", "quarantine",
      "zoosanitary", "animal loading", "livestock export", "animals",
    ],
    forbiddenKeywords: [
      "grain", "silo", "flexitank", "edible oil", "frozen",
      "fish", "seafood", "fruit", "bottle", "pet bottle", "pouch",
      "packaging line", "refinery", "oil tank",
    ],
    coverLabel: { es: "Animales Vivos — Exportación", en: "Live Animals — Export" },
  },

  OILS: {
    maxCommercialImages: 2,
    allowedKeywords: [
      "edible oil", "cooking oil", "olive oil", "sunflower oil", "soybean oil",
      "pet bottle", "flexitank", "refinery", "food grade oil", "oil packaging",
      "bottle filling", "oil export", "vegetable oil", "palm oil", "canola",
    ],
    forbiddenKeywords: [
      "livestock", "cattle", "sheep", "animal", "grain silo",
      "cereal", "frozen meat", "seafood", "live animal", "chicken farm",
    ],
    coverLabel: { es: "Aceites Comestibles — Exportación", en: "Edible Oils — Export" },
  },

  GRAINS: {
    maxCommercialImages: 2,
    allowedKeywords: [
      "grain", "cereal", "wheat", "soy", "corn", "maize", "soybean",
      "silo", "bulk vessel", "loading grain", "agricultural", "harvest",
      "grain storage", "grain export", "oilseed", "commodity",
    ],
    forbiddenKeywords: [
      "livestock", "animal", "frozen", "seafood", "oil bottle",
      "flexitank", "packaging line", "pouch", "pet bottle",
    ],
    coverLabel: { es: "Granos y Cereales — Exportación", en: "Grains & Cereals — Export" },
  },

  FROZEN: {
    maxCommercialImages: 2,
    allowedKeywords: [
      "frozen", "cold chain", "reefer", "frozen meat", "cold storage",
      "refrigerated", "export meat", "frozen container", "reefer vessel",
    ],
    forbiddenKeywords: [
      "livestock vessel", "live animal", "grain silo", "oil bottle",
      "fresh fruit", "fresh produce",
    ],
    coverLabel: { es: "Productos Congelados — Exportación", en: "Frozen Products — Export" },
  },

  FOOD: {
    maxCommercialImages: 2,
    allowedKeywords: [
      "fruit", "food", "export", "agriculture", "harvest", "fresh produce",
      "food processing", "food export", "quality inspection",
    ],
    forbiddenKeywords: [
      "livestock vessel", "live animal transport", "grain bulk vessel",
    ],
    coverLabel: { es: "Productos Alimenticios — Exportación", en: "Food Products — Export" },
  },

});

// ─── Mode → rule set mapping ───────────────────────────────────────────────────

const MODE_TO_RULE = {
  [DOCUMENT_MODES.LIVE_ANIMALS]:         "LIVE_ANIMALS",
  [DOCUMENT_MODES.RETAIL_OILS]:          "OILS",
  [DOCUMENT_MODES.FLEXITANK]:            "OILS",
  [DOCUMENT_MODES.INDUSTRIAL_OILS]:      "OILS",
  [DOCUMENT_MODES.BULK_GRAINS]:          "GRAINS",
  [DOCUMENT_MODES.FROZEN_PRODUCTS]:      "FROZEN",
  [DOCUMENT_MODES.GENERAL_FOOD]:         "FOOD",
  [DOCUMENT_MODES.CUSTOM_PRIVATE_LABEL]: "FOOD",
};

/**
 * Get media rules for a given document mode.
 * @param {string} mode — one of DOCUMENT_MODES values
 * @returns {object}     — media rule set
 */
export function getMediaRulesForMode(mode) {
  const key = MODE_TO_RULE[mode] || "FOOD";
  return MEDIA_CATEGORY_RULES[key] || MEDIA_CATEGORY_RULES.FOOD;
}

/**
 * Validate a bound media set against the document mode.
 * Returns an audit result — never throws, never blocks PDF.
 *
 * @param {object} boundMedia — { main, secondary, branding }
 * @param {string} mode       — document mode
 * @returns {object}           — { pass, issues, maxCommercialImages }
 */
export function auditBoundMediaForMode(boundMedia, mode) {
  if (!boundMedia) {
    return { pass: true, issues: [], maxCommercialImages: 2 };
  }

  const rules = getMediaRulesForMode(mode);
  const issues = [];

  const commercialImageCount = (boundMedia.main ? 1 : 0) + (boundMedia.secondary?.length || 0);
  if (commercialImageCount > rules.maxCommercialImages) {
    issues.push(`Mode ${mode}: ${commercialImageCount} commercial images present — max is ${rules.maxCommercialImages}. Secondary images beyond index 0 will be suppressed.`);
  }

  return {
    pass: issues.length === 0,
    issues,
    maxCommercialImages: rules.maxCommercialImages,
    mode,
    ruleSet: MODE_TO_RULE[mode] || "FOOD",
  };
}

/**
 * Get the maximum number of secondary images allowed for a given mode.
 * PDF rendering uses this to cap secondary[] display.
 * Rule: 1 main commercial + 1 support = 2 total. Branding is always additional.
 */
export function getMaxSecondaryImages(mode) {
  return 1; // always 1 secondary commercial image — 2 total max
}
