"use strict";
/**
 * /commercial-foundation — Read-only API for the FASE 0 foundation layer.
 * All endpoints are read-only (GET). No existing routes or data are modified.
 * Requires valid JWT. Minimum role: AGENTE (any authenticated user).
 */

const express = require("express");
const router  = express.Router();
const { authenticate } = require("../middleware/auth");
const bridge = require("../services/CommercialFoundationBridge");

// ── GET /commercial-foundation/status ────────────────────────────────────────
router.get("/status", authenticate, (_req, res) => {
  try {
    res.json(bridge.getMigrationStatus());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /commercial-foundation/products ──────────────────────────────────────
router.get("/products", authenticate, (req, res) => {
  try {
    const { category } = req.query;
    const products = bridge.listProducts(category || null);
    res.json({ total: products.length, products });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /commercial-foundation/products/:code ────────────────────────────────
router.get("/products/:code", authenticate, (req, res) => {
  try {
    const product = bridge.resolveProduct(req.params.code.toUpperCase());
    if (!product) return res.status(404).json({ error: "Product not found" });
    const specs = bridge.resolveSpecs(req.params.code.toUpperCase());
    const intelligence = bridge.resolveIntelligence(req.params.code.toUpperCase());
    res.json({ product, specs, intelligence });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /commercial-foundation/intelligence/:code ────────────────────────────
router.get("/intelligence/:code", authenticate, (req, res) => {
  try {
    const profile = bridge.resolveIntelligence(req.params.code.toUpperCase());
    if (!profile) return res.status(404).json({ error: "Intelligence profile not found" });
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /commercial-foundation/media/:code ───────────────────────────────────
router.get("/media/:code", authenticate, (req, res) => {
  try {
    const { role, lang, status } = req.query;
    const assets = bridge.resolveMediaAssets(req.params.code.toUpperCase(), {
      role: role || null,
      languageCode: lang || null,
      status: status || "ACTIVE",
    });
    res.json({ total: assets.length, assets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /commercial-foundation/rules ─────────────────────────────────────────
router.get("/rules", authenticate, (req, res) => {
  try {
    const { type } = req.query;
    const rules = bridge.listRules(type || null);
    res.json({ total: rules.length, rules });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /commercial-foundation/rules/payment ─────────────────────────────────
// Resolve payment rules for a volume + category (mirrors PaymentTermsRegistry logic)
router.get("/rules/payment", authenticate, (req, res) => {
  try {
    const { volume, category } = req.query;
    if (!volume) return res.status(400).json({ error: "volume (MT) required" });
    const volumeMT = parseFloat(volume);
    if (isNaN(volumeMT) || volumeMT < 0) return res.status(400).json({ error: "volume must be a positive number" });
    const rules = bridge.resolvePaymentRules(volumeMT, category || "ALL");
    res.json({ volume_mt: volumeMT, category: category || "ALL", applicable_rules: rules });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /commercial-foundation/requirements/:category ────────────────────────
router.get("/requirements/:category", authenticate, (req, res) => {
  try {
    const { product } = req.query;
    const requirements = bridge.resolveDocumentRequirements(
      req.params.category.toUpperCase(),
      product ? product.toUpperCase() : null
    );
    const mandatory = requirements.filter(r => r.is_mandatory === 1);
    res.json({
      category: req.params.category.toUpperCase(),
      product: product || null,
      total: requirements.length,
      mandatory_count: mandatory.length,
      requirements,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
