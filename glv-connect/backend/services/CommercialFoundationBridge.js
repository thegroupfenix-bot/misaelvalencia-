"use strict";
/**
 * CommercialFoundationBridge — FASE 0 compatibility adapter.
 *
 * All methods check the new V2 tables first and fall back to existing sources
 * when the new tables are empty or the product is not yet migrated.
 * Existing code (CommercialEngine, ProductIntelligenceRegistry, PaymentTermsRegistry,
 * mediaBinding) is NEVER modified by this file.
 */

const db = require("../db/database");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJSON(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch (_) { return fallback; }
}

function gprProductExists(productCode) {
  const row = db.prepare("SELECT id, migration_status FROM gpr_products WHERE product_code = ? AND active = 1").get(productCode);
  return row || null;
}

// ─── Global Product Registry ──────────────────────────────────────────────────

/**
 * Resolve a product by code. Returns GPR row (new) or a legacy-compatible
 * shape built from product_master (old). Never returns null for known codes.
 */
function resolveProduct(productCode) {
  const row = db.prepare("SELECT * FROM gpr_products WHERE product_code = ? AND active = 1").get(productCode);
  if (row) {
    return {
      source: "GPR_V2",
      product_code: row.product_code,
      category_code: row.category_code,
      name_es: row.name_es,
      name_en: row.name_en,
      name_fr: row.name_fr,
      name_zh: row.name_zh,
      name_ar: row.name_ar,
      hs_code: row.hs_code,
      calc_mode: row.calc_mode,
      default_unit: row.default_unit,
      container_capacity: row.container_capacity,
      moq_value: row.moq_value,
      moq_unit: row.moq_unit,
      origin_countries: parseJSON(row.origin_countries, []),
      certifications: parseJSON(row.certifications, []),
      market_segments: parseJSON(row.market_segments, []),
      reefer_required: row.reefer_required === 1,
      frozen_required: row.frozen_required === 1,
      cargo_type: row.cargo_type,
      shelf_life: row.shelf_life,
      migration_status: row.migration_status,
    };
  }

  // Fallback: legacy product_master
  const legacy = db.prepare("SELECT * FROM product_master WHERE product_code = ? AND active = 1").get(productCode);
  if (legacy) {
    return {
      source: "PRODUCT_MASTER_LEGACY",
      product_code: legacy.product_code,
      category_code: legacy.category,
      name_es: legacy.name_es,
      name_en: legacy.name_en,
      name_fr: null,
      name_zh: null,
      name_ar: null,
      migration_status: "PENDING",
    };
  }

  return null;
}

/**
 * List all GPR products, optionally filtered by category.
 */
function listProducts(categoryCode) {
  const sql = categoryCode
    ? "SELECT * FROM gpr_products WHERE category_code = ? AND active = 1 ORDER BY name_es"
    : "SELECT * FROM gpr_products WHERE active = 1 ORDER BY category_code, name_es";
  const rows = categoryCode
    ? db.prepare(sql).all(categoryCode)
    : db.prepare(sql).all();
  return rows.map(row => ({
    ...row,
    origin_countries: parseJSON(row.origin_countries, []),
    certifications: parseJSON(row.certifications, []),
    market_segments: parseJSON(row.market_segments, []),
  }));
}

/**
 * Resolve product specifications. Returns key-value map.
 */
function resolveSpecs(productCode) {
  const product = db.prepare("SELECT id FROM gpr_products WHERE product_code = ? AND active = 1").get(productCode);
  if (!product) return {};
  const rows = db.prepare("SELECT spec_key, spec_value, spec_type, unit FROM gpr_specifications WHERE product_id = ?").all(product.id);
  return Object.fromEntries(rows.map(r => [r.spec_key, { value: r.spec_value, type: r.spec_type, unit: r.unit }]));
}

// ─── Product Intelligence ─────────────────────────────────────────────────────

/**
 * Resolve intelligence profile for a product code.
 * Returns PI row (new) or null if not yet seeded.
 */
function resolveIntelligence(productCode) {
  const row = db.prepare("SELECT * FROM pi_profiles WHERE product_code = ? AND active = 1").get(productCode);
  if (!row) return null;
  return {
    source: "PI_PROFILES_V2",
    product_code: row.product_code,
    executive_description: row.executive_description,
    certification_profile: parseJSON(row.certification_profile, []),
    compliance_badges: parseJSON(row.compliance_badges, []),
    timeline: {
      min_days: row.timeline_min_days,
      max_days: row.timeline_max_days,
      notes: row.timeline_notes,
    },
    logistics: {
      mode: row.logistics_mode,
      notes: row.logistics_notes,
    },
    market_applications: parseJSON(row.market_applications, []),
    intelligence_version: row.intelligence_version,
  };
}

// ─── Media Intelligence ───────────────────────────────────────────────────────

/**
 * Resolve media assets for a product from the new MI layer.
 * Returns array of MI asset records sorted by priority.
 */
function resolveMediaAssets(productCode, options) {
  const { role = null, languageCode = null, status = "ACTIVE" } = options || {};
  let sql = "SELECT mi.*, ma.public_url, ma.thumbnail_url, ma.filename FROM mi_assets mi LEFT JOIN media_assets ma ON mi.media_asset_id = ma.id WHERE mi.product_code = ? AND mi.status = ?";
  const params = [productCode, status];
  if (role) { sql += " AND mi.asset_role = ?"; params.push(role); }
  if (languageCode) { sql += " AND (mi.language_code = ? OR mi.language_code = 'ALL')"; params.push(languageCode); }
  sql += " ORDER BY mi.priority ASC, mi.version DESC";
  return db.prepare(sql).all(...params);
}

/**
 * Register a media asset into the MI layer. Non-destructive — creates a new
 * version record rather than updating existing ones.
 */
function registerMediaAsset(productCode, mediaAssetId, role, options) {
  const { languageCode = "ALL", notes = null, approvedBy = null } = options || {};
  const current = db.prepare(
    "SELECT MAX(version) AS v FROM mi_assets WHERE product_code = ? AND asset_role = ? AND language_code = ?"
  ).get(productCode, role, languageCode);
  const nextVersion = (current?.v || 0) + 1;
  db.prepare(`
    INSERT INTO mi_assets (product_code, asset_role, media_asset_id, language_code, version, approved_by, approved_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `).run(productCode, role, mediaAssetId, languageCode, nextVersion, approvedBy, notes);
  return nextVersion;
}

// ─── Commercial Rules ─────────────────────────────────────────────────────────

/**
 * Resolve payment rules for a given volume (MT) and category.
 * Returns ordered array of matching rule configs.
 */
function resolvePaymentRules(volumeMT, categoryCode) {
  const rows = db.prepare(`
    SELECT * FROM cr_rules
    WHERE rule_type = 'PAYMENT'
      AND active = 1
      AND (category_scope = 'ALL' OR category_scope = ? OR category_scope LIKE ?)
      AND (min_volume IS NULL OR min_volume <= ?)
      AND (max_volume IS NULL OR max_volume >= ?)
    ORDER BY priority ASC
  `).all(categoryCode, `%${categoryCode}%`, volumeMT, volumeMT);
  return rows.map(r => ({ ...r, rule_config: parseJSON(r.rule_config, {}) }));
}

/**
 * Resolve pricing governance rules for a role.
 */
function resolvePricingRules(categoryCode) {
  const rows = db.prepare(`
    SELECT * FROM cr_rules
    WHERE rule_type IN ('PRICING','INCOTERM')
      AND active = 1
      AND (category_scope = 'ALL' OR category_scope = ? OR category_scope LIKE ?)
    ORDER BY rule_type, priority ASC
  `).all(categoryCode, `%${categoryCode}%`);
  return rows.map(r => ({ ...r, rule_config: parseJSON(r.rule_config, {}) }));
}

/**
 * List all active commercial rules, optionally filtered by type.
 */
function listRules(ruleType) {
  const sql = ruleType
    ? "SELECT * FROM cr_rules WHERE rule_type = ? AND active = 1 ORDER BY priority"
    : "SELECT * FROM cr_rules WHERE active = 1 ORDER BY rule_type, priority";
  const rows = ruleType ? db.prepare(sql).all(ruleType) : db.prepare(sql).all();
  return rows.map(r => ({ ...r, rule_config: parseJSON(r.rule_config, {}) }));
}

// ─── Document Intelligence ────────────────────────────────────────────────────

/**
 * Resolve required fields and validations for a category + optional product.
 */
function resolveDocumentRequirements(categoryCode, productCode) {
  const rows = db.prepare(`
    SELECT * FROM di_requirements
    WHERE active = 1
      AND (category_code = 'ALL' OR category_code = ?)
      AND (product_scope = 'ALL' OR product_scope = ? OR product_scope LIKE ?)
    ORDER BY display_order ASC
  `).all(categoryCode, productCode || "ALL", productCode ? `%${productCode}%` : "ALL");
  return rows.map(r => ({
    ...r,
    validation_rule: parseJSON(r.validation_rule, null),
  }));
}

/**
 * Get mandatory fields only for a category.
 */
function getMandatoryFields(categoryCode, productCode) {
  return resolveDocumentRequirements(categoryCode, productCode)
    .filter(r => r.is_mandatory === 1 && r.req_type === "FIELD");
}

// ─── Migration status ─────────────────────────────────────────────────────────

/**
 * Return migration status summary across all foundation tables.
 */
function getMigrationStatus() {
  const gprTotal    = db.prepare("SELECT COUNT(*) AS c FROM gpr_products").get().c;
  const gprPending  = db.prepare("SELECT COUNT(*) AS c FROM gpr_products WHERE migration_status = 'PENDING'").get().c;
  const gprMigrated = db.prepare("SELECT COUNT(*) AS c FROM gpr_products WHERE migration_status = 'MIGRATED'").get().c;
  const piTotal     = db.prepare("SELECT COUNT(*) AS c FROM pi_profiles").get().c;
  const miTotal     = db.prepare("SELECT COUNT(*) AS c FROM mi_assets").get().c;
  const crTotal     = db.prepare("SELECT COUNT(*) AS c FROM cr_rules").get().c;
  const diTotal     = db.prepare("SELECT COUNT(*) AS c FROM di_requirements").get().c;
  const pmTotal     = db.prepare("SELECT COUNT(*) AS c FROM product_master").get().c;
  const pcTotal     = db.prepare("SELECT COUNT(*) AS c FROM pc_products").get().c;
  return {
    fase: "FASE_0",
    foundation_version: "2.0.0",
    tables: {
      gpr_products:       { count: gprTotal, pending: gprPending, migrated: gprMigrated },
      pi_profiles:        { count: piTotal },
      mi_assets:          { count: miTotal },
      cr_rules:           { count: crTotal },
      di_requirements:    { count: diTotal },
    },
    legacy_tables: {
      product_master:     { count: pmTotal },
      pc_products:        { count: pcTotal },
    },
    compatibility: "FULL — legacy tables and registries unchanged",
  };
}

module.exports = {
  // Product Registry
  resolveProduct,
  listProducts,
  resolveSpecs,
  // Intelligence
  resolveIntelligence,
  // Media
  resolveMediaAssets,
  registerMediaAsset,
  // Commercial Rules
  resolvePaymentRules,
  resolvePricingRules,
  listRules,
  // Document Intelligence
  resolveDocumentRequirements,
  getMandatoryFields,
  // Status
  getMigrationStatus,
  // Internals (for future migration scripts)
  gprProductExists,
};
