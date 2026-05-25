/**
 * mediaContextResolver.js — Strict Media Category Isolation for GLV Engine V4.
 *
 * Rules:
 *   LIVE_ANIMALS  → ONLY livestock media
 *   FRUITS        → ONLY fruit media
 *   OILS          → ONLY oils/liquid branding
 *   NO cross-contamination at any level.
 *
 * Works with both the frontend MediaPanel (auto-suggest) and backend mediaBinding.js.
 */

import { getCategoryMediaConfig } from "./categoryEngine.js";

/**
 * Resolve media query context for a given document category.
 * Returns tags (positive match) and exclusions (hard block) for this category.
 *
 * @param {string} category      — e.g. "LIVE_ANIMALS", "FRUIT_PRODUCTS"
 * @param {object} [opts]
 * @param {string} [opts.origin] — country of origin for origin-bonus matching
 * @param {string[]} [opts.extraTags] — additional caller-supplied tags
 * @returns {MediaContext}
 */
export function resolveMediaContext(category, { origin = "", extraTags = [] } = {}) {
  const config = getCategoryMediaConfig(category);

  if (!config) {
    return {
      category:   null,
      origin,
      tags:       extraTags,
      exclusions: [],
      isIsolated: false,
    };
  }

  return Object.freeze({
    category,
    origin,
    tags:       [...config.tags, ...extraTags],
    exclusions: config.exclusions,
    isIsolated: true,
  });
}

/**
 * Returns true if a media asset is compatible with the current document context.
 * An asset is compatible when none of its searchable text contains an exclusion keyword.
 *
 * @param {object} asset        — asset record with category, original_name, tags, etc.
 * @param {MediaContext} ctx    — from resolveMediaContext()
 * @returns {boolean}
 */
export function isAssetCompatible(asset, ctx) {
  if (!ctx?.isIsolated) return true;
  const { exclusions } = ctx;
  if (!exclusions?.length) return true;

  const searchText = [
    asset.category          || "",
    asset.subcategory       || "",
    asset.original_name     || "",
    asset.product_relation  || "",
    ...(Array.isArray(asset.tags) ? asset.tags : []),
  ].join(" ").toLowerCase();

  return !exclusions.some(kw => searchText.includes(kw.toLowerCase()));
}

/**
 * Score an asset against the media context.
 * Higher score = better semantic match for this document's category.
 *
 * @param {object} asset
 * @param {MediaContext} ctx
 * @returns {number}
 */
export function scoreAssetForContext(asset, ctx) {
  if (!ctx) return 0;
  const { tags, origin } = ctx;
  let score = 0;

  const searchText = [
    asset.category         || "",
    asset.subcategory      || "",
    asset.original_name    || "",
    asset.product_relation || "",
    ...(Array.isArray(asset.tags) ? asset.tags : []),
  ].join(" ").toLowerCase();

  for (const tag of (tags || [])) {
    if (searchText.includes(tag.toLowerCase())) score += 3;
  }

  if (origin && asset.country_origin?.toLowerCase() === origin.toLowerCase()) score += 5;
  if (asset.visibility === "public") score += 2;

  return score;
}

/**
 * Filter and rank a list of assets for the given media context.
 * Returns up to `limit` compatible assets sorted by score descending.
 *
 * @param {object[]} assets
 * @param {MediaContext} ctx
 * @param {number} [limit=6]
 * @returns {object[]}
 */
export function selectAssetsForContext(assets, ctx, limit = 6) {
  const compatible = assets.filter(a => isAssetCompatible(a, ctx));
  return compatible
    .map(a => ({ asset: a, score: scoreAssetForContext(a, ctx) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.asset);
}
