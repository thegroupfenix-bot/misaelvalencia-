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
  FROZEN_MEAT:    { cats: ["products/meat","products/frozen","Carnes","meat","carne","frozen"], tags: ["meat","carne","frozen","beef","lamb","cordero","congelado","corte"] },
  FROZEN_POULTRY: { cats: ["products/poultry","poultry","pollo","ave"], tags: ["chicken","pollo","poultry","ave"] },
  COMMODITIES:    { cats: ["products/grains","products/oils","Granos","Aceites","grains","oils","grano","aceite","soya","maiz"], tags: ["grain","oil","soy","corn","maize","soja","aceite","grano"] },
  BEANS:          { cats: ["products/grains","Granos","legumes","frijol","lenteja","garbanzo"], tags: ["bean","frijol","lentil","garbanzo","legume"] },
  FRUIT_PRODUCTS: { cats: ["products/fruits","Frutas","fruits","fruta"], tags: ["fruit","fruta","mango","banana","citrus","citrico"] },
  COLOMBIAN_EXOTIC_FRUITS: { cats: ["products/fruits/colombia","Frutas","Colombia","exotic","exotico"], tags: ["exotic","exotico","colombia","uchuva","gulupa","pitahaya"] },
  CANNED_MEAT:    { cats: ["products/meat","Carnes","canned","enlatado","conserva"], tags: ["canned","enlatado","conserva","meat","carne"] },
  LENTILS:        { cats: ["products/grains","Granos","legumes","lenteja","lentil"], tags: ["lentil","lenteja","legume","pulse","bag"] },
  CHICKPEAS:      { cats: ["products/grains","Granos","legumes","garbanzo","chickpea"], tags: ["chickpea","garbanzo","chana","legume","pulse","bag"] },
  ANIMAL_FEED:    { cats: ["products/feed","Alimento","feed","alimento","harina"], tags: ["feed","alimento","soybean","meal","harina","bran","salvado","alfalfa","pellet"] },
  OILS:           { cats: ["products/oils","Aceites","oil","aceite","liquid"], tags: ["oil","aceite","palm","soy","sunflower","girasol","corn","canola","liquid","tank"] },
  EGGS:           { cats: ["products/poultry","poultry","eggs","huevos","huevo"], tags: ["egg","huevo","poultry","incubation","fertile","huevos","pollito"] },
};

// ─── Product-level Media Resolver (Phase 3B) ─────────────────────────────────
// Sub-product keywords, scoped to a single product_code, used ONLY to validate
// that an explicitly-assigned MediaProfile asset actually depicts that product
// (e.g. reject a "sheep" image assigned to CATTLE). This is intentionally
// narrower than CATEGORY_RULES above, which legitimately groups sibling
// products together for the category-level fallback scoring path.
const PRODUCT_KEYWORDS = {
  CATTLE:        ["cattle","bovino","bovine","beef","angus","nelore","brahman","hereford","ganado"],
  SHEEP:         ["sheep","lamb","ovino","ovine","cordero","merino","dorper","corriedale","texel","suffolk"],
  GOAT:          ["goat","caprino","caprine","cabra"],
  PALM_OIL:      ["palm","palma"],
  SOYBEAN_OIL:   ["soybean oil","soy oil","aceite de soja","aceite de soya"],
  SUNFLOWER_OIL: ["sunflower","girasol"],
  CORN_OIL:      ["corn oil","aceite de maiz","aceite de maíz"],
  SOYBEANS:      ["soybean","soya","soja"],
  CORN:          ["corn","maiz","maíz"],
  WHEAT:         ["wheat","trigo"],
  OATS:          ["oats","avena"],
  RICE:          ["rice","arroz"],
  SUGAR:         ["sugar","azucar","azúcar"],
};

// Sibling products within the same family — used to detect cross-product
// keyword collisions (e.g. a CATTLE profile pointing at a SHEEP-tagged asset).
const PRODUCT_FAMILY = {
  CATTLE: ["SHEEP","GOAT"], SHEEP: ["CATTLE","GOAT"], GOAT: ["CATTLE","SHEEP"],
  PALM_OIL: ["SOYBEAN_OIL","SUNFLOWER_OIL","CORN_OIL"],
  SOYBEAN_OIL: ["PALM_OIL","SUNFLOWER_OIL","CORN_OIL"],
  SUNFLOWER_OIL: ["PALM_OIL","SOYBEAN_OIL","CORN_OIL"],
  CORN_OIL: ["PALM_OIL","SOYBEAN_OIL","SUNFLOWER_OIL"],
  SOYBEANS: ["CORN","WHEAT","OATS","RICE","SUGAR"],
  CORN: ["SOYBEANS","WHEAT","OATS","RICE","SUGAR"],
  WHEAT: ["SOYBEANS","CORN","OATS","RICE","SUGAR"],
  OATS: ["SOYBEANS","CORN","WHEAT","RICE","SUGAR"],
  RICE: ["SOYBEANS","CORN","WHEAT","OATS","SUGAR"],
  SUGAR: ["SOYBEANS","CORN","WHEAT","OATS","RICE"],
};

const BRANDING_CATS = ["branding","branding/logos","branding/templates","Branding","Corporativo","corporate"];

// Hard exclusion keywords for PRODUCT (non-branding) assets per document category.
// Prevents e.g. sheep images appearing in FRUIT_PRODUCTS SCOs.
const PRODUCT_CATEGORY_EXCLUSIONS = {
  FRUIT_PRODUCTS: [
    "sheep","lamb","cattle","goat","livestock","ovino","bovino","caprino","ganado",
    "cordero","animales","vivo","live","animal","ovejas","merino","dorper","santa",
    "ines","boer","nelore","angus","brahman","hereford","corriedale","texel","suffolk",
    "brangus","ganadero","poultry","chicken","pollo","ave","meat","carne","canned","enlatado",
  ],
  COLOMBIAN_EXOTIC_FRUITS: [
    "sheep","lamb","cattle","livestock","ovino","bovino","ganado","cordero","live","animal",
    "poultry","chicken","pollo","meat","carne","grain","grano","oil","aceite",
  ],
  LIVE_ANIMALS: [
    "avocado","avoca","aguacate","avocaviva","fruta","fruit","mango","banana","citrus",
    "citrico","uchuva","gulupa","pitahaya","exotic","exotico",
    "grain","grano","oil","aceite","soy","soja","corn","maiz","bean","frijol",
    "lentil","garbanzo","canned","enlatado","poultry","chicken","pollo",
  ],
  FROZEN_MEAT: [
    "avocado","avoca","aguacate","avocaviva","fruta","fruit","mango","banana",
    "grain","grano","oil","aceite","soy","soja","corn","maiz","sheep","lamb",
    "ovino","ganado","live","vivo",
  ],
  FROZEN_POULTRY: [
    "avocado","avoca","fruta","fruit","grain","grano","oil","aceite",
    "sheep","lamb","ovino","ganado","live","vivo","cattle","bovino",
  ],
  COMMODITIES: [
    "avocado","avoca","aguacate","fruta","fruit","mango","banana",
    "sheep","lamb","cattle","livestock","ovino","bovino","ganado",
    "poultry","chicken","pollo","canned","enlatado",
  ],
  BEANS: [
    "avocado","avoca","fruta","fruit","sheep","lamb","cattle","livestock",
    "poultry","chicken","canned","enlatado",
  ],
  CANNED_MEAT: [
    "avocado","avoca","fruta","fruit","grain","grano","oil","aceite",
    "sheep","lamb","ovino","ganado","live","vivo",
  ],
  LENTILS: [
    "avocado","avoca","fruta","fruit","sheep","lamb","cattle","livestock",
    "poultry","chicken","canned","enlatado","oil","aceite",
  ],
  CHICKPEAS: [
    "avocado","avoca","fruta","fruit","sheep","lamb","cattle","livestock",
    "poultry","chicken","canned","enlatado","oil","aceite",
  ],
  ANIMAL_FEED: [
    "avocado","avoca","fruta","fruit","poultry","chicken","canned","enlatado","reefer",
    "sheep","lamb","cattle","livestock","ovino","bovino",
  ],
  OILS: [
    "livestock","sheep","ovino","bovino","fruta","fruit","canned","frozen","meat","carne",
    "poultry","chicken","pollo","ganado",
  ],
  EGGS: [
    "avocado","avoca","fruta","fruit","livestock","sheep","bovino",
    "grain","grano","oil","aceite","meat","carne","beef",
  ],
};

/**
 * Returns false if a PRODUCT (non-branding) asset contains keywords from a
 * DIFFERENT category than the current document. Strict isolation:
 * FRUIT_PRODUCTS can NEVER load LIVE_ANIMALS assets and vice-versa.
 */
function isProductCategoryCompatible(asset, category) {
  if (!category || !PRODUCT_CATEGORY_EXCLUSIONS[category]) return true;
  const exclusions = PRODUCT_CATEGORY_EXCLUSIONS[category];

  const searchText = [
    parseTags(asset.tags_json).join(" "),
    asset.product_relation || "",
    asset.original_name    || "",
    asset.subcategory      || "",
    asset.category         || "",
  ].join(" ").toLowerCase();

  const excluded = exclusions.some(kw => searchText.includes(kw.toLowerCase()));
  if (excluded) {
    console.log(`[media-bind] product asset #${asset.id} (${asset.original_name}) excluded — category mismatch for ${category}`);
  }
  return !excluded;
}

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
  LENTILS:                ["avocado","avoca","fruit","fruta","livestock","sheep","ovino","bovino","poultry","chicken","oil","aceite"],
  CHICKPEAS:              ["avocado","avoca","fruit","fruta","livestock","sheep","ovino","bovino","poultry","chicken","oil","aceite"],
  ANIMAL_FEED:            ["avocado","avoca","fruit","fruta","poultry","chicken","canned","enlatado","reefer"],
  OILS:                   ["livestock","sheep","ovino","bovino","fruit","fruta","canned","frozen","meat","carne","poultry","chicken"],
  EGGS:                   ["avocado","avoca","fruit","fruta","livestock","sheep","bovino","grain","grano","oil","aceite","meat","carne"],
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
 * Validates that an asset assigned to a product's MediaProfile actually
 * depicts that product, by checking it doesn't match a SIBLING product's
 * keywords without also matching its own (e.g. an asset tagged "sheep"
 * assigned to CATTLE is rejected).
 *
 * @param {object} asset       — raw DB row (media_assets)
 * @param {string} productCode — e.g. "CATTLE"
 * @returns {{ok: boolean, reason?: string}}
 */
function validateProductAssetMatch(asset, productCode) {
  const siblings = PRODUCT_FAMILY[productCode];
  if (!siblings || siblings.length === 0) return { ok: true };

  const searchText = [
    parseTags(asset.tags_json).join(" "),
    asset.product_relation || "",
    asset.original_name    || "",
    asset.subcategory      || "",
  ].join(" ").toLowerCase();

  const ownKeywords = PRODUCT_KEYWORDS[productCode] || [];
  const matchesOwn = ownKeywords.some(kw => searchText.includes(kw.toLowerCase()));

  for (const sibling of siblings) {
    const siblingKeywords = PRODUCT_KEYWORDS[sibling] || [];
    const hit = siblingKeywords.find(kw => searchText.includes(kw.toLowerCase()));
    if (hit && !matchesOwn) {
      return {
        ok: false,
        reason: `asset #${asset.id} (${asset.original_name}) matches sibling product "${sibling}" keyword "${hit}" but no "${productCode}" keyword`,
      };
    }
  }
  return { ok: true };
}

/**
 * Resolve the explicit MediaProfile for a product_code, if one exists and
 * passes validation. This is the PREFERRED resolution path — it bypasses
 * category-level scoring entirely.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} productCode
 * @returns {{main: object, secondary: object[], brandingAssetId: number|null}|{rejected:true,reason:string}|null}
 */
function resolveProductMedia(db, productCode) {
  if (!productCode) return null;

  const profile = db.prepare("SELECT * FROM media_profiles WHERE product_code = ?").get(productCode);
  if (!profile || !profile.main_asset_id) return null;

  const assetCols = "id, public_url, thumbnail_url, category, tags_json, country_origin, original_name, mime_type, product_relation, subcategory, visibility, status, archived";
  const mainAsset = db.prepare(`SELECT ${assetCols} FROM media_assets WHERE id = ? AND status = 'active' AND archived = 0`).get(profile.main_asset_id);
  if (!mainAsset) {
    console.warn(`[media-bind] product profile for ${productCode} points to a missing/inactive asset #${profile.main_asset_id}`);
    return null;
  }

  const validation = validateProductAssetMatch(mainAsset, productCode);
  if (!validation.ok) {
    console.warn(`[media-bind] REJECTED product profile binding for ${productCode}: ${validation.reason}`);
    return { rejected: true, reason: validation.reason };
  }

  let secondaryIds = [];
  try { secondaryIds = JSON.parse(profile.secondary_asset_ids || "[]"); } catch (_) { secondaryIds = []; }

  const secondary = secondaryIds
    .map(id => db.prepare(`SELECT ${assetCols} FROM media_assets WHERE id = ? AND status = 'active' AND archived = 0`).get(id))
    .filter(Boolean)
    .map(projectAsset);

  return { main: projectAsset(mainAsset), secondary, brandingAssetId: profile.branding_asset_id || null };
}

/**
 * Main binding function.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} opts
 * @param {string}   [opts.category]    — document product category key (e.g. "LIVE_ANIMALS")
 * @param {string}   [opts.productCode] — document product code (e.g. "CATTLE") — preferred,
 *                                        resolves via the explicit MediaProfile FK instead of scoring
 * @param {string}   [opts.origin]      — country of origin (e.g. "Brazil")
 * @param {string[]} [opts.tags]        — additional tags from the caller
 * @param {number}   [opts.limit]       — max non-branding assets to consider (default 6)
 * @returns {{
 *   main: object|null,
 *   secondary: object[],
 *   branding: object[],
 *   totalMatched: number,
 *   category: string|null,
 *   origin: string|null,
 *   productCode: string|null,
 *   resolution: "PRODUCT_PROFILE"|"CATEGORY_FALLBACK"|"NO_IMAGE"
 * }}
 */
function bindMedia(db, { category, productCode, origin, tags = [], limit = 6 } = {}) {
  // ── Step 1: explicit product-level resolution (preferred path) ──
  // Bypasses category scoring entirely when a validated MediaProfile exists.
  const productResult = productCode ? resolveProductMedia(db, productCode) : null;
  const productMain = productResult && !productResult.rejected ? productResult : null;

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

  // Hard-filter product assets by category compatibility before scoring
  const compatibleProductAssets = category
    ? productAssets.filter(a => isProductCategoryCompatible(a, category))
    : productAssets;

  console.log(`[media-bind] product pool — compatible: ${compatibleProductAssets.length}/${productAssets.length} for category ${category}`);

  // ── Step 4: category scoring runs only as the emergency fallback path ──
  // (when no product-level MediaProfile is resolved above). It is never
  // consulted for `main` when a productCode profile already won.
  let scoredProducts = compatibleProductAssets.map(asset => ({
    asset,
    score: rule ? scoreAsset(asset, rule, category, origin) : 0,
  }));

  scoredProducts.sort((a, b) => b.score - a.score);

  // Take top `limit` scored product assets
  const topProducts = scoredProducts.slice(0, limit);

  const categoryMain      = topProducts.length > 0 ? projectAsset(topProducts[0].asset) : null;
  const categorySecondary = topProducts.slice(1, 5).map(s => projectAsset(s.asset));

  const main      = productMain ? productMain.main : categoryMain;
  const secondary = productMain
    ? [...productMain.secondary, ...categorySecondary].slice(0, 4)
    : categorySecondary;

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

  let branding = scoredBranding.slice(0, 2).map(s => projectAsset(s.asset));

  // Explicit branding asset from the MediaProfile, if any, takes priority.
  if (productMain?.brandingAssetId) {
    const brandAsset = db.prepare(
      "SELECT id, public_url, thumbnail_url, category, tags_json, country_origin, original_name, mime_type " +
      "FROM media_assets WHERE id = ? AND status = 'active' AND archived = 0"
    ).get(productMain.brandingAssetId);
    if (brandAsset) branding = [projectAsset(brandAsset), ...branding].slice(0, 2);
  }

  const resolution = productMain ? "PRODUCT_PROFILE" : (main ? "CATEGORY_FALLBACK" : "NO_IMAGE");
  if (productCode && !productMain) {
    console.warn(`[media-bind] productCode "${productCode}" had no usable MediaProfile — falling back to category scoring for "${category}"`);
  }

  return {
    main,
    secondary,
    branding,
    totalMatched: topProducts.length,
    category: category || null,
    origin:   origin   || null,
    productCode: productCode || null,
    resolution,
  };
}

module.exports = { bindMedia, resolveProductMedia, validateProductAssetMatch };
