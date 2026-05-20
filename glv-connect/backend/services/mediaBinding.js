'use strict';

/**
 * mediaBinding.js — Media Auto-Binding Engine for SCO/FCO commercial documents.
 *
 * Exports:
 *   bindMedia(db, { category, origin, tags, limit }) → BindingResult
 */

const CATEGORY_RULES = {
  LIVE_ANIMALS:   { cats: ["livestock/sheep","livestock/cattle","livestock/goats","products/live-animals","Animales Vivos","animales"], tags: ["sheep","cattle","goat","livestock","cordero","vivo","ovino","bovino","merino","dorper"] },
  FROZEN_MEAT:    { cats: ["products/meat","products/frozen","Carnes","meat"], tags: ["meat","carne","frozen","beef","lamb","cordero","congelado","corte"] },
  FROZEN_POULTRY: { cats: ["products/poultry","poultry"], tags: ["chicken","pollo","poultry","ave"] },
  COMMODITIES:    { cats: ["products/grains","products/oils","Granos","Aceites","grains","oils"], tags: ["grain","oil","soy","corn","maize","soja","aceite","grano"] },
  BEANS:          { cats: ["products/grains","Granos"], tags: ["bean","frijol","lentil","garbanzo"] },
  FRUIT_PRODUCTS: { cats: ["products/fruits","Frutas","fruits"], tags: ["fruit","fruta","mango","banana","citrus","citrico"] },
  COLOMBIAN_EXOTIC_FRUITS: { cats: ["products/fruits/colombia","Frutas","Colombia"], tags: ["exotic","exotico","colombia","uchuva","gulupa","pitahaya"] },
  CANNED_MEAT:    { cats: ["products/meat","Carnes"], tags: ["canned","enlatado","conserva","meat","carne"] },
};

const BRANDING_CATS = ["branding","branding/logos","branding/templates","Branding","Corporativo","corporate"];

/**
 * Safely parse a JSON array stored as text. Returns [] on any failure.
 * @param {string|null} raw
 * @returns {string[]}
 */
function parseTags(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(t => String(t)) : [];
  } catch (_) {
    return [];
  }
}

/**
 * Check whether a string `haystack` contains any of the needle strings
 * using a case-insensitive substring match.
 * @param {string} haystack
 * @param {string[]} needles
 * @returns {boolean}
 */
function containsAny(haystack, needles) {
  if (!haystack) return false;
  const lower = haystack.toLowerCase();
  return needles.some(n => lower.includes(n.toLowerCase()));
}

/**
 * Score a single asset against the rule + origin for a given category.
 * Returns an integer score (0 = no match at all but still counted).
 *
 * Scoring rules:
 *  +10  asset.category contains any of the rule's cats (case-insensitive substring)
 *  +5   asset.country_origin matches origin (case-insensitive)
 *  +5   asset.product_relation contains the category key or any rule tag
 *  +3   per tag in asset.tags_json that matches any rule tag
 *  +3   per tag in asset.tags_json that matches origin
 *  +2   visibility === 'public'
 *
 * @param {object} asset   — raw DB row
 * @param {object} rule    — { cats: string[], tags: string[] }
 * @param {string} catKey  — e.g. "LIVE_ANIMALS"
 * @param {string} origin  — e.g. "Brazil"
 * @returns {number}
 */
function scoreAsset(asset, rule, catKey, origin) {
  let score = 0;

  // +10 category match
  if (asset.category && containsAny(asset.category, rule.cats)) score += 10;

  // +5 country origin match
  if (origin && asset.country_origin &&
      asset.country_origin.toLowerCase() === origin.toLowerCase()) score += 5;

  // +5 product_relation contains category key or any rule tag
  if (asset.product_relation) {
    const pr = asset.product_relation.toLowerCase();
    if (pr.includes(catKey.toLowerCase()) || rule.tags.some(t => pr.includes(t.toLowerCase()))) {
      score += 5;
    }
  }

  // +3 per matching tag between asset tags and rule tags
  const assetTags = parseTags(asset.tags_json);
  for (const at of assetTags) {
    const atLower = at.toLowerCase();
    if (rule.tags.some(rt => atLower.includes(rt.toLowerCase()) || rt.toLowerCase().includes(atLower))) {
      score += 3;
    }
  }

  // +3 per tag in asset that matches origin
  if (origin) {
    const originLower = origin.toLowerCase();
    for (const at of assetTags) {
      if (at.toLowerCase().includes(originLower) || originLower.includes(at.toLowerCase())) {
        score += 3;
      }
    }
  }

  // +2 visibility public
  if (asset.visibility === 'public') score += 2;

  return score;
}

/**
 * Pick only the fields we want to expose in the binding result.
 * @param {object} asset — raw DB row
 * @returns {object}
 */
function projectAsset(asset) {
  return {
    id:            asset.id,
    public_url:    asset.public_url,
    thumbnail_url: asset.thumbnail_url,
    category:      asset.category,
    tags_json:     asset.tags_json,
    country_origin: asset.country_origin,
    original_name: asset.original_name,
    mime_type:     asset.mime_type,
  };
}

/**
 * Main binding function.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} opts
 * @param {string}   [opts.category] — document product category key (e.g. "LIVE_ANIMALS")
 * @param {string}   [opts.origin]   — country of origin (e.g. "Brazil")
 * @param {string[]} [opts.tags]     — additional tags from the caller
 * @param {number}   [opts.limit]    — max non-branding assets to consider (default 6)
 * @returns {{
 *   main: object|null,
 *   secondary: object[],
 *   branding: object[],
 *   totalMatched: number,
 *   category: string|null,
 *   origin: string|null
 * }}
 */
function bindMedia(db, { category, origin, tags = [], limit = 6 } = {}) {
  // Fetch all active, non-archived assets in one query
  const allAssets = db.prepare(
    "SELECT id, public_url, thumbnail_url, category, tags_json, country_origin, " +
    "original_name, mime_type, product_relation, visibility, status, archived " +
    "FROM media_assets WHERE status = 'active' AND archived = 0"
  ).all();

  const rule = (category && CATEGORY_RULES[category]) || null;

  // Separate into branding vs product assets
  const brandingAssets = [];
  const productAssets  = [];

  for (const asset of allAssets) {
    if (asset.category && containsAny(asset.category, BRANDING_CATS)) {
      brandingAssets.push(asset);
    } else {
      productAssets.push(asset);
    }
  }

  // Score and sort product assets
  let scoredProducts = productAssets.map(asset => ({
    asset,
    score: rule ? scoreAsset(asset, rule, category, origin) : 0,
  }));

  scoredProducts.sort((a, b) => b.score - a.score);

  // Take top `limit` scored product assets
  const topProducts = scoredProducts.slice(0, limit);

  const main      = topProducts.length > 0 ? projectAsset(topProducts[0].asset) : null;
  const secondary = topProducts.slice(1, 5).map(s => projectAsset(s.asset));

  // Score and sort branding assets (same origin bonus applies)
  let scoredBranding = brandingAssets.map(asset => {
    let score = 0;
    if (origin && asset.country_origin &&
        asset.country_origin.toLowerCase() === origin.toLowerCase()) score += 5;
    const at = parseTags(asset.tags_json);
    if (origin) {
      const ol = origin.toLowerCase();
      for (const t of at) {
        if (t.toLowerCase().includes(ol) || ol.includes(t.toLowerCase())) score += 3;
      }
    }
    if (asset.visibility === 'public') score += 2;
    return { asset, score };
  });

  scoredBranding.sort((a, b) => b.score - a.score);
  const branding = scoredBranding.slice(0, 2).map(s => projectAsset(s.asset));

  return {
    main,
    secondary,
    branding,
    totalMatched: topProducts.length,
    category: category || null,
    origin:   origin   || null,
  };
}

module.exports = { bindMedia };
