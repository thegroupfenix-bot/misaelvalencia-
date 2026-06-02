/**
 * MediaRegistryEngine.js — GLV GOS Core Domain — Media Registry Foundation V1.0
 *
 * Approved media asset registry with category isolation enforcement.
 * Max 2 commercial images per document. Category isolation is mandatory.
 * CDN-ready structure for future asset delivery.
 *
 * STATUS: FOUNDATION — registry schema, category resolver, and cover media logic defined.
 * CDN URL injection and signed URL generation to be layered server-side.
 *
 * DESIGN RULE: Only approved assets from this registry may appear in executive PDFs.
 * Never render arbitrary URLs from document payloads without passing validateMediaCategory().
 */

// ─── Media types ────────────────────────────────────────────────────────────────

export const MEDIA_TYPES = Object.freeze({
  COVER_IMAGE:      "COVER_IMAGE",
  PRODUCT_IMAGE:    "PRODUCT_IMAGE",
  LOGO:             "LOGO",
  BACKGROUND:       "BACKGROUND",
  SIGNATURE:        "SIGNATURE",
  CERTIFICATION_SEAL: "CERTIFICATION_SEAL",
  STAMP:            "STAMP",
});

export const MEDIA_STATUS = Object.freeze({
  APPROVED:   "APPROVED",
  PENDING:    "PENDING",
  RETIRED:    "RETIRED",
});

// ─── Media registry ─────────────────────────────────────────────────────────────
// CDN base path placeholder — resolved server-side in production.

const CDN_BASE = "/assets/media";

export const MEDIA_REGISTRY = Object.freeze({

  // ── Logos ───────────────────────────────────────────────────────────────────
  LOGO_GLV_DARK: {
    id:       "LOGO_GLV_DARK",
    type:     MEDIA_TYPES.LOGO,
    category: null,
    path:     `${CDN_BASE}/logos/glv-logo-dark.png`,
    status:   MEDIA_STATUS.APPROVED,
    maxWidth: 200,
  },
  LOGO_GLV_WHITE: {
    id:       "LOGO_GLV_WHITE",
    type:     MEDIA_TYPES.LOGO,
    category: null,
    path:     `${CDN_BASE}/logos/glv-logo-white.png`,
    status:   MEDIA_STATUS.APPROVED,
    maxWidth: 200,
  },

  // ── Oils category ────────────────────────────────────────────────────────────
  COVER_OILS_SUNFLOWER: {
    id:       "COVER_OILS_SUNFLOWER",
    type:     MEDIA_TYPES.COVER_IMAGE,
    category: "OILS",
    path:     `${CDN_BASE}/covers/oils-sunflower-cover.jpg`,
    status:   MEDIA_STATUS.APPROVED,
    keywords: ["sunflower", "oil", "bottle"],
  },
  COVER_OILS_SOYBEAN: {
    id:       "COVER_OILS_SOYBEAN",
    type:     MEDIA_TYPES.COVER_IMAGE,
    category: "OILS",
    path:     `${CDN_BASE}/covers/oils-soybean-cover.jpg`,
    status:   MEDIA_STATUS.APPROVED,
    keywords: ["soybean", "oil", "bulk"],
  },

  // ── Grains category ──────────────────────────────────────────────────────────
  COVER_GRAINS_SOYBEAN: {
    id:       "COVER_GRAINS_SOYBEAN",
    type:     MEDIA_TYPES.COVER_IMAGE,
    category: "GRAINS",
    path:     `${CDN_BASE}/covers/grains-soybean-cover.jpg`,
    status:   MEDIA_STATUS.APPROVED,
    keywords: ["soybean", "grain", "bulk"],
  },
  COVER_GRAINS_CORN: {
    id:       "COVER_GRAINS_CORN",
    type:     MEDIA_TYPES.COVER_IMAGE,
    category: "GRAINS",
    path:     `${CDN_BASE}/covers/grains-corn-cover.jpg`,
    status:   MEDIA_STATUS.APPROVED,
    keywords: ["corn", "grain", "bulk"],
  },

  // ── Live animals ─────────────────────────────────────────────────────────────
  COVER_ANIMALS_BOVINE: {
    id:       "COVER_ANIMALS_BOVINE",
    type:     MEDIA_TYPES.COVER_IMAGE,
    category: "LIVE_ANIMALS",
    path:     `${CDN_BASE}/covers/animals-bovine-cover.jpg`,
    status:   MEDIA_STATUS.APPROVED,
    keywords: ["bovine", "cattle", "livestock"],
  },

  // ── Frozen ───────────────────────────────────────────────────────────────────
  COVER_FROZEN_GENERIC: {
    id:       "COVER_FROZEN_GENERIC",
    type:     MEDIA_TYPES.COVER_IMAGE,
    category: "FROZEN",
    path:     `${CDN_BASE}/covers/frozen-generic-cover.jpg`,
    status:   MEDIA_STATUS.APPROVED,
    keywords: ["frozen", "cold", "processing"],
  },

  // ── General food ─────────────────────────────────────────────────────────────
  COVER_FOOD_GENERIC: {
    id:       "COVER_FOOD_GENERIC",
    type:     MEDIA_TYPES.COVER_IMAGE,
    category: "FOOD",
    path:     `${CDN_BASE}/covers/food-generic-cover.jpg`,
    status:   MEDIA_STATUS.APPROVED,
    keywords: ["food", "processing", "export"],
  },

  // ── Backgrounds ──────────────────────────────────────────────────────────────
  BG_EXECUTIVE_DARK: {
    id:       "BG_EXECUTIVE_DARK",
    type:     MEDIA_TYPES.BACKGROUND,
    category: null,
    path:     `${CDN_BASE}/backgrounds/executive-dark.png`,
    status:   MEDIA_STATUS.APPROVED,
  },
  BG_EXECUTIVE_LIGHT: {
    id:       "BG_EXECUTIVE_LIGHT",
    type:     MEDIA_TYPES.BACKGROUND,
    category: null,
    path:     `${CDN_BASE}/backgrounds/executive-light.png`,
    status:   MEDIA_STATUS.APPROVED,
  },

});

// ─── Resolver functions ─────────────────────────────────────────────────────────

/**
 * Get all approved media for a given category.
 * Includes category-neutral assets (category === null).
 *
 * @param {string|null} category — e.g. "OILS" | null for universal assets
 * @returns {object[]}
 */
export function getApprovedMedia(category = null) {
  return Object.values(MEDIA_REGISTRY).filter(
    asset =>
      asset.status === MEDIA_STATUS.APPROVED &&
      (asset.category === category || asset.category === null)
  );
}

/**
 * Validate that a bound media URL belongs to an approved registry asset.
 * Never throws — returns structured validation result.
 *
 * @param {string} url       — asset path or URL to validate
 * @param {string} category  — required product category context
 * @returns {{ valid: boolean, assetId: string|null, reason: string }}
 */
export function validateMediaCategory(url, category) {
  if (!url) return { valid: false, assetId: null, reason: "No URL provided" };

  const match = Object.values(MEDIA_REGISTRY).find(
    asset =>
      asset.status === MEDIA_STATUS.APPROVED &&
      asset.path === url &&
      (asset.category === null || asset.category === category)
  );

  if (match) {
    return { valid: true, assetId: match.id, reason: "Asset is approved for this category" };
  }

  const wrongCategory = Object.values(MEDIA_REGISTRY).find(
    asset => asset.path === url && asset.category !== null && asset.category !== category
  );

  if (wrongCategory) {
    return {
      valid:   false,
      assetId: wrongCategory.id,
      reason:  `Asset "${wrongCategory.id}" is registered for category "${wrongCategory.category}", not "${category}"`,
    };
  }

  return { valid: false, assetId: null, reason: `Asset path "${url}" is not in the approved registry` };
}

/**
 * Resolve the best cover image for a given category and optional subtype.
 * Returns the first approved cover image for the category, or COVER_FOOD_GENERIC as fallback.
 *
 * @param {string} category    — e.g. "OILS"
 * @param {string} [subtype]   — optional keyword hint, e.g. "sunflower"
 * @returns {object}            — media asset record
 */
export function resolveCoverMedia(category, subtype = null) {
  const candidates = Object.values(MEDIA_REGISTRY).filter(
    asset =>
      asset.status === MEDIA_STATUS.APPROVED &&
      asset.type === MEDIA_TYPES.COVER_IMAGE &&
      asset.category === category
  );

  if (subtype) {
    const byKeyword = candidates.find(
      asset => asset.keywords && asset.keywords.some(k => k.includes(subtype.toLowerCase()))
    );
    if (byKeyword) return byKeyword;
  }

  return candidates[0] || MEDIA_REGISTRY.COVER_FOOD_GENERIC;
}

/**
 * Get a logo asset by ID — safe for PDF use.
 *
 * @param {"LOGO_GLV_DARK"|"LOGO_GLV_WHITE"} logoId
 * @returns {object|null}
 */
export function getLogo(logoId = "LOGO_GLV_DARK") {
  const asset = MEDIA_REGISTRY[logoId];
  return asset && asset.status === MEDIA_STATUS.APPROVED ? asset : null;
}
