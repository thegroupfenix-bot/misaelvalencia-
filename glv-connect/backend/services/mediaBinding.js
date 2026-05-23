'use strict';

/**
 * mediaBinding.js — Media Auto-Binding Engine for SCO/FCO commercial documents.
 *
 * Exports:
 *   bindMedia(db, { category, origin, tags, limit }) → BindingResult
 */

const CATEGORY_RULES = {
  LIVE_ANIMALS: {
    cats: ["livestock","sheep","lamb","cattle","goat","animales","live","ovino","bovino","caprino","animal","vivo","ovejas","cordero","ganado"],
    tags: ["sheep","lamb","cattle","goat","livestock","cordero","vivo","ovino","bovino","merino","dorper","santa","ines","boer","nelore","angus","brahman","hereford","corriedale","texel","suffolk","brangus"],
  },
  FROZEN_MEAT:    { cats: ["products/meat","products/frozen","Carnes","meat","carne","frozen"], tags: ["meat","carne","frozen","beef","lamb","cordero","congelado","corte","reefer"] },
  FROZEN_POULTRY: { cats: ["products/poultry","poultry","pollo","ave"], tags: ["chicken","pollo","poultry","ave","turkey","pato","reefer"] },
  COMMODITIES:    { cats: ["products/grains","Granos","grains","grano","soya","maiz"], tags: ["grain","soy","corn","maize","soja","grano","wheat","trigo","rice","arroz","bulk"] },
  BEANS:          { cats: ["products/grains","Granos","legumes","frijol","lenteja","garbanzo"], tags: ["bean","frijol","lentil","garbanzo","legume","pulse","bag"] },
  LENTILS:        { cats: ["products/grains","Granos","legumes","lenteja","lentil"], tags: ["lentil","lenteja","legume","pulse","red lentil","green lentil"] },
  CHICKPEAS:      { cats: ["products/grains","Granos","legumes","garbanzo","chickpea"], tags: ["chickpea","garbanzo","chana","legume","pulse","kabuli","desi"] },
  ANIMAL_FEED:    { cats: ["products/feed","Alimento","feed","alimento","pienso"], tags: ["feed","alimento","soybean meal","harina","bran","salvado","alfalfa","pellet"] },
  OILS:           { cats: ["products/oils","Aceites","oil","aceite","liquid"], tags: ["oil","aceite","palm","soy","sunflower","girasol","corn","canola","tank"] },
  FRUIT_PRODUCTS: { cats: ["products/fruits","Frutas","fruits","fruta"], tags: ["fruit","fruta","mango","banana","citrus","citrico","avocado","aguacate","pineapple","piña"] },
  COLOMBIAN_EXOTIC_FRUITS: { cats: ["products/fruits/colombia","Frutas","Colombia","exotic","exotico"], tags: ["exotic","exotico","colombia","uchuva","gulupa","pitahaya","lulo","maracuya","tropical"] },
  CANNED_MEAT:    { cats: ["products/meat","Carnes","canned","enlatado","conserva"], tags: ["canned","enlatado","conserva","meat","carne","corned","lata"] },
  EGGS:           { cats: ["products/poultry","Huevos","eggs","huevo","poultry"], tags: ["egg","huevo","fertile","fértil","incubation","poultry"] },
};

// Keywords that, if found in a NON-BRANDING product asset, indicate the asset belongs
// to a DIFFERENT product category. Prevents e.g. sheep photos appearing in FROZEN_MEAT SCO.
const PRODUCT_CATEGORY_EXCLUSIONS = {
  LIVE_ANIMALS:            ["avocado","avoca","aguacate","fruit","fruta","mango","banana","grain","grano","oil","aceite","canned","enlatado","poultry","chicken","pollo","meat","carne","frozen","congelado"],
  FROZEN_MEAT:             ["avocado","avoca","aguacate","fruit","fruta","livestock","sheep","ovino","bovino","ganado","cordero","grain","grano","oil","aceite","poultry","chicken","egg","huevo"],
  FROZEN_POULTRY:          ["avocado","avoca","fruit","fruta","livestock","sheep","ovino","bovino","ganado","grain","grano","oil","aceite","beef","carne"],
  FRUIT_PRODUCTS:          ["livestock","sheep","cattle","ovino","bovino","ganado","cordero","animales","vivo","grain","grano","oil","aceite","frozen","congelado","poultry","chicken","egg"],
  COLOMBIAN_EXOTIC_FRUITS: ["livestock","sheep","cattle","ovino","ganado","grain","grano","oil","aceite","frozen","congelado","beef","poultry","chicken"],
  COMMODITIES:             ["avocado","avoca","aguacate","fruit","fruta","livestock","sheep","ovino","bovino","poultry","chicken","egg","canned","reefer"],
  BEANS:                   ["avocado","avoca","fruit","fruta","livestock","sheep","ovino","bovino","oil","aceite","poultry","chicken"],
  LENTILS:                 ["avocado","fruit","fruta","livestock","sheep","ovino","bovino","oil","aceite","poultry"],
  CHICKPEAS:               ["avocado","fruit","fruta","livestock","sheep","bovino","oil","aceite","poultry"],
  ANIMAL_FEED:             ["avocado","fruit","fruta","poultry","chicken","canned","enlatado","reefer"],
  OILS:                    ["livestock","sheep","ovino","bovino","fruit","fruta","canned","frozen","meat","carne","egg","poultry"],
  CANNED_MEAT:             ["avocado","avoca","fruit","fruta","livestock","sheep","grain","grano","oil","aceite","egg"],
  EGGS:                    ["avocado","fruit","fruta","livestock","sheep","bovino","grain","oil","aceite","meat","carne"],
};

const BRANDING_CATS = ["branding","branding/logos","branding/templates","Branding","Corporativo","corporate"];

// Keywords that identify a branding asset as belonging to a SPECIFIC product category.
// If a branding asset matches any of these for a category that is NOT the current document
// category, it is excluded — preventing e.g. avocado brand logos from appearing in a
// LIVE_ANIMALS SCO.
const BRANDING_EXCLUSION_KEYWORDS = {
  LIVE_ANIMALS:           ["avocado","avoca","aguacate","avocaviva","fruta","fruit","mango","banana","citrus","citrico",
                           "grain","grano","oil","aceite","soy","soja","corn","maiz","canned","enlatado"],
  FRUIT_PRODUCTS:         ["livestock","sheep","ganado","ovino","bovino","cattle","goat","cordero","animales","vivo",
                           "grain","grano","oil","aceite","soy","soja"],
  COLOMBIAN_EXOTIC_FRUITS:["livestock","sheep","ganado","ovino","cattle","grain","grano","oil","aceite"],
  COMMODITIES:            ["avocado","avoca","aguacate","avocaviva","fruit","fruta","livestock","sheep","ganado","ovino","bovino"],
  FROZEN_MEAT:            ["avocado","avoca","aguacate","avocaviva","fruit","fruta","grain","grano","oil","aceite"],
  BEANS:                  ["avocado","avoca","fruit","fruta","livestock","sheep","ganado","grain","oil"],
  CANNED_MEAT:            ["avocado","avoca","fruit","fruta","grain","grano","oil","aceite"],
  FROZEN_POULTRY:         ["avocado","avoca","fruit","fruta","grain","grano","livestock","sheep","ovino"],
};

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

  // +10 category match (substring in asset.category or subcategory)
  if (asset.category && containsAny(asset.category, rule.cats)) score += 10;
  if (asset.subcategory && containsAny(asset.subcategory, rule.cats)) score += 8;

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

  // +4 if original_name contains any rule tag (catches uploaded files named "sheep.jpg" etc.)
  if (asset.original_name) {
    const nameL = asset.original_name.toLowerCase();
    if (rule.tags.some(t => nameL.includes(t.toLowerCase()))) score += 4;
    // also check category cats against the filename
    if (rule.cats.some(c => nameL.includes(c.toLowerCase()))) score += 3;
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
 * Returns false if a NON-BRANDING product asset contains keywords that indicate it belongs
 * to a different product category than the current document.
 * Prevents e.g. sheep photos appearing in a FROZEN_MEAT SCO.
 */
function isProductCategoryCompatible(asset, category) {
  if (!category || !PRODUCT_CATEGORY_EXCLUSIONS[category]) return true;
  const exclusions = PRODUCT_CATEGORY_EXCLUSIONS[category];

  const searchText = [
    parseTags(asset.tags_json).join(" "),
    asset.product_relation || "",
    asset.original_name    || "",
    asset.category         || "",
    asset.subcategory      || "",
  ].join(" ").toLowerCase();

  const excluded = exclusions.some(kw => searchText.includes(kw.toLowerCase()));
  if (excluded) {
    console.log(`[media-bind] product asset #${asset.id} (${asset.original_name}) excluded — category mismatch for ${category}`);
  }
  return !excluded;
}

/**
 * Returns false if a branding asset contains product-specific keywords that belong to a
 * DIFFERENT category than the current document. This prevents e.g. an avocado brand logo
 * from appearing inside a LIVE_ANIMALS SCO.
 *
 * "Generic" branding (GLV corporate identity, no product keywords) always passes.
 */
function isBrandingCompatible(asset, category) {
  if (!category || !BRANDING_EXCLUSION_KEYWORDS[category]) return true;
  const exclusions = BRANDING_EXCLUSION_KEYWORDS[category];

  // Build searchable text from asset metadata (NOT the asset.category field — that is
  // already "branding/*" and is what put it in the branding pool in the first place).
  const searchText = [
    parseTags(asset.tags_json).join(" "),
    asset.product_relation || "",
    asset.original_name    || "",
    asset.subcategory      || "",
  ].join(" ").toLowerCase();

  const excluded = exclusions.some(kw => searchText.includes(kw.toLowerCase()));
  if (excluded) {
    console.log(`[media-bind] branding asset #${asset.id} (${asset.original_name}) excluded — category mismatch for ${category}`);
  }
  return !excluded;
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

  // Apply product category exclusions — remove assets that belong to a different category
  const compatibleProductAssets = category
    ? productAssets.filter(a => isProductCategoryCompatible(a, category))
    : productAssets;

  // Score and sort product assets
  let scoredProducts = compatibleProductAssets.map(asset => ({
    asset,
    score: rule ? scoreAsset(asset, rule, category, origin) : 0,
  }));

  scoredProducts.sort((a, b) => b.score - a.score);

  // Take top `limit` scored product assets
  const topProducts = scoredProducts.slice(0, limit);

  const main      = topProducts.length > 0 ? projectAsset(topProducts[0].asset) : null;
  const secondary = topProducts.slice(1, 5).map(s => projectAsset(s.asset));

  // Filter branding to only assets compatible with the current document category,
  // then score them with origin bonus and category-affinity bonus.
  const compatibleBrandingAssets = category
    ? brandingAssets.filter(a => isBrandingCompatible(a, category))
    : brandingAssets;

  let scoredBranding = compatibleBrandingAssets.map(asset => {
    let score = 0;
    const assetText = [
      parseTags(asset.tags_json).join(" "),
      asset.product_relation || "",
      asset.original_name    || "",
      asset.subcategory      || "",
    ].join(" ").toLowerCase();

    // +5 origin match
    if (origin && asset.country_origin &&
        asset.country_origin.toLowerCase() === origin.toLowerCase()) score += 5;

    // +3 per tag matching origin
    if (origin) {
      const ol = origin.toLowerCase();
      for (const t of parseTags(asset.tags_json)) {
        if (t.toLowerCase().includes(ol) || ol.includes(t.toLowerCase())) score += 3;
      }
    }

    // +10 / +8 category-affinity: branding that explicitly matches current category
    if (rule) {
      if (rule.tags.some(t => assetText.includes(t.toLowerCase()))) score += 10;
      if (rule.cats.some(c => assetText.includes(c.toLowerCase()))) score += 8;
    }

    // +3 generic GLV corporate identity bonus
    if (["glv","corporate","corporativo","oficial","general"].some(k => assetText.includes(k))) score += 3;

    // +2 public visibility
    if (asset.visibility === 'public') score += 2;

    return { asset, score };
  });

  scoredBranding.sort((a, b) => b.score - a.score);

  console.log(`[media-bind] branding pool — compatible: ${compatibleBrandingAssets.length}/${brandingAssets.length} | selected: ${JSON.stringify(scoredBranding.slice(0,2).map(s => ({ id: s.asset.id, name: s.asset.original_name, score: s.score })))}`);

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
