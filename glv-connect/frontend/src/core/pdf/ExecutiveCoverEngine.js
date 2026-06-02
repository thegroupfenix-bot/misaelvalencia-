/**
 * ExecutiveCoverEngine.js — GLV GOS Executive PDF V2 — Cover Engine V1.0
 *
 * Executive cover layout system for SCO/FCO/SPA documents.
 * Emits structured DATA objects — no JSX, no @react-pdf imports.
 * GlvPDF.jsx consumes these objects to render the executive cover page.
 *
 * Visual zones produced:
 *   1. Corporate Hero Header
 *   2. Executive Commercial Title
 *   3. Product Hero Zone
 *   4. Executive Operation Summary
 *   5. Enterprise Trust Indicators
 *
 * STATUS: ACTIVE — Executive PDF V2
 * Supports: SCO · FCO · SPA (future)
 */

import { t }                       from "../i18n/LanguageCore.js";
import { EXECUTIVE_COLORS,
         EXECUTIVE_TYPOGRAPHY }    from "./ExecutiveVisualIdentityEngine.js";

// ─── Document title map ─────────────────────────────────────────────────────────

export const EXECUTIVE_TITLES = Object.freeze({
  SCO: {
    es: "Oferta Corporativa Blanda",
    en: "Soft Corporate Offer",
    "pt-br": "Oferta Corporativa Suave",
  },
  FCO: {
    es: "Oferta Corporativa Completa",
    en: "Full Corporate Offer",
    "pt-br": "Oferta Corporativa Completa",
  },
  SPA: {
    es: "Contrato Internacional de Suministro",
    en: "International Supply Agreement",
    "pt-br": "Contrato Internacional de Fornecimento",
  },
  DEFAULT: {
    es: "Propuesta Internacional de Suministro",
    en: "International Commodity Supply Proposal",
    "pt-br": "Proposta Internacional de Fornecimento",
  },
});

// ─── Category visual modes ──────────────────────────────────────────────────────

export const CATEGORY_VISUAL_MODES = Object.freeze({

  OILS: {
    id:           "OILS",
    accentColor:  "#C9A84C",
    heroLabel:    { es: "Aceites Vegetales de Exportación", en: "Export Vegetable Oils", "pt-br": "Óleos Vegetais de Exportação" },
    mediaKeywords:["refinery", "bottles", "industrial", "tank", "oil", "packaging"],
    backgroundTint:"#1B2A4A",
    badgeText:    { es: "Grado Alimentario / Exportación", en: "Food Grade / Export", "pt-br": "Grau Alimentar / Exportação" },
  },

  GRAINS: {
    id:           "GRAINS",
    accentColor:  "#B8860B",
    heroLabel:    { es: "Granos y Cereales de Exportación", en: "Export Grains & Cereals", "pt-br": "Grãos e Cereais de Exportação" },
    mediaKeywords:["silo", "vessel", "grain", "bulk", "harvest", "logistics"],
    backgroundTint:"#1A2B1A",
    badgeText:    { es: "Granel / Calidad Internacional", en: "Bulk / International Grade", "pt-br": "Granel / Qualidade Internacional" },
  },

  LIVE_ANIMALS: {
    id:           "LIVE_ANIMALS",
    accentColor:  "#6B8E6B",
    heroLabel:    { es: "Exportación de Animales Vivos", en: "Live Animal Export", "pt-br": "Exportação de Animais Vivos" },
    mediaKeywords:["livestock", "vessel", "veterinary", "inspection", "operations"],
    backgroundTint:"#1A2A1A",
    badgeText:    { es: "Veterinario / Certificado Internacional", en: "Veterinary / Internationally Certified", "pt-br": "Veterinário / Certificado Internacional" },
  },

  FROZEN: {
    id:           "FROZEN",
    accentColor:  "#4A90C4",
    heroLabel:    { es: "Productos Congelados de Exportación", en: "Export Frozen Products", "pt-br": "Produtos Congelados de Exportação" },
    mediaKeywords:["cold chain", "reefer", "processing", "frozen", "container"],
    backgroundTint:"#1A2434",
    badgeText:    { es: "Cadena de Frío Certificada", en: "Certified Cold Chain", "pt-br": "Cadeia de Frio Certificada" },
  },

  FOOD: {
    id:           "FOOD",
    accentColor:  "#C9A84C",
    heroLabel:    { es: "Alimentos Procesados de Exportación", en: "Export Processed Foods", "pt-br": "Alimentos Processados de Exportação" },
    mediaKeywords:["food", "processing", "export", "packaging"],
    backgroundTint:"#1B2A4A",
    badgeText:    { es: "Grado Exportación / Calidad Internacional", en: "Export Grade / International Quality", "pt-br": "Grau Exportação / Qualidade Internacional" },
  },

});

// ─── Zone builders ──────────────────────────────────────────────────────────────

/**
 * Build Zone 1 — Corporate Hero Header.
 * Contains: platform identity, global positioning, corporate identity bar.
 *
 * @param {object} params
 * @param {string} params.entityName       — issuing GLV entity
 * @param {string} params.documentRef      — e.g. "SCO-GLV-2026-047"
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildHeroHeader({ entityName, documentRef, lang = "es" }) {
  return Object.freeze({
    zone:            "HERO_HEADER",
    platform:        "GLV GLOBAL OPERATING SYSTEM",
    platformShort:   "GLV GOS",
    groupName:       "GLV Holding Group",
    entityName,
    documentRef,
    tagline:         lang === "en"
      ? "Enterprise Export & Operations Infrastructure"
      : "Infraestructura Empresarial de Exportación y Operaciones",
    background:      EXECUTIVE_COLORS.PRIMARY_DARK,
    accentColor:     EXECUTIVE_COLORS.ACCENT_GOLD,
    textColor:       EXECUTIVE_COLORS.TEXT_LIGHT,
    typography:      EXECUTIVE_TYPOGRAPHY.HEADER,
    _zone:           1,
  });
}

/**
 * Build Zone 2 — Executive Commercial Title.
 * Contains: document type title, ref, date, validity.
 *
 * @param {object} params
 * @param {string} params.documentType     — "SCO" | "FCO" | "SPA"
 * @param {string} params.documentRef
 * @param {string} params.date
 * @param {string} [params.validityDate]
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildExecutiveTitle({ documentType, documentRef, date, validityDate = null, lang = "es" }) {
  const titleMap = EXECUTIVE_TITLES[documentType] || EXECUTIVE_TITLES.DEFAULT;

  return Object.freeze({
    zone:          "EXECUTIVE_TITLE",
    title:         titleMap[lang] || titleMap.en,
    documentType,
    documentRef,
    date,
    validityDate,
    refLabel:      lang === "en" ? "Reference" : "Referencia",
    dateLabel:     lang === "en" ? "Issue Date" : "Fecha de Emisión",
    validityLabel: lang === "en" ? "Valid Until" : "Válido Hasta",
    background:    EXECUTIVE_COLORS.SURFACE,
    accentColor:   EXECUTIVE_COLORS.ACCENT_GOLD,
    typography:    EXECUTIVE_TYPOGRAPHY.TITLE,
    _zone:         2,
  });
}

/**
 * Build Zone 3 — Product Hero Zone.
 * Contains: category visual mode, hero image reference, category label, 1 hero image max.
 *
 * @param {object} params
 * @param {string} params.category         — OILS | GRAINS | LIVE_ANIMALS | FROZEN | FOOD
 * @param {string} [params.heroImagePath]  — path from MediaRegistryEngine
 * @param {string} [params.productName]
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildProductHeroZone({ category, heroImagePath = null, productName = null, lang = "es" }) {
  const visualMode = CATEGORY_VISUAL_MODES[category] || CATEGORY_VISUAL_MODES.FOOD;

  return Object.freeze({
    zone:         "PRODUCT_HERO",
    category,
    visualMode:   visualMode.id,
    heroLabel:    (visualMode.heroLabel || {})[lang] || (visualMode.heroLabel || {}).en,
    badgeText:    (visualMode.badgeText || {})[lang] || (visualMode.badgeText || {}).en,
    heroImagePath,
    productName:  productName || null,
    accentColor:  visualMode.accentColor,
    tintColor:    visualMode.backgroundTint,
    maxImages:    1,
    mediaKeywords:visualMode.mediaKeywords,
    _zone:        3,
    _mediaRule:   "MAX_1_HERO_IMAGE — category isolation enforced",
  });
}

/**
 * Build Zone 4 — Executive Operation Summary.
 * Contains: product, origin, destination, incoterm, volume, validity, payment, shipment.
 *
 * @param {object} params
 * @returns {object}
 */
export function buildOperationSummaryBlock({
  product,
  origin,
  destination,
  incoterm,
  volume,
  volumeUnit,
  currency,
  totalValue,
  validityDate,
  paymentTerms,
  shipmentWindow,
  lang = "es",
}) {
  const labels = {
    es: {
      product:       "Producto",
      origin:        "País de Origen",
      destination:   "País de Destino",
      incoterm:      "Incoterm",
      volume:        "Volumen",
      totalValue:    "Valor Total",
      validity:      "Validez",
      payment:       "Condiciones de Pago",
      shipment:      "Ventana de Embarque",
    },
    en: {
      product:       "Product",
      origin:        "Country of Origin",
      destination:   "Country of Destination",
      incoterm:      "Incoterm",
      volume:        "Volume",
      totalValue:    "Total Value",
      validity:      "Validity",
      payment:       "Payment Terms",
      shipment:      "Shipment Window",
    },
    "pt-br": {
      product:       "Produto",
      origin:        "País de Origem",
      destination:   "País de Destino",
      incoterm:      "Incoterm",
      volume:        "Volume",
      totalValue:    "Valor Total",
      validity:      "Validade",
      payment:       "Condições de Pagamento",
      shipment:      "Janela de Embarque",
    },
  };

  const L = labels[lang] || labels.en;

  return Object.freeze({
    zone: "OPERATION_SUMMARY",
    rows: Object.freeze([
      { key: "product",     label: L.product,     value: product     || "—" },
      { key: "origin",      label: L.origin,      value: origin      || "—" },
      { key: "destination", label: L.destination, value: destination || "—" },
      { key: "incoterm",    label: L.incoterm,    value: incoterm    || "—" },
      { key: "volume",      label: L.volume,      value: volume ? `${volume} ${volumeUnit || ""}`.trim() : "—" },
      { key: "totalValue",  label: L.totalValue,  value: totalValue && currency ? `${currency} ${totalValue}` : "—" },
      { key: "validity",    label: L.validity,    value: validityDate || "—" },
      { key: "payment",     label: L.payment,     value: paymentTerms || "—" },
      { key: "shipment",    label: L.shipment,    value: shipmentWindow || "—" },
    ]),
    lang,
    background:   EXECUTIVE_COLORS.SURFACE_ALT,
    accentColor:  EXECUTIVE_COLORS.ACCENT_GOLD,
    _zone:        4,
  });
}

/**
 * Build Zone 5 — Enterprise Trust Indicators.
 * Contains: trust badges (audit-ready, multi-country, compliance, export coordination).
 *
 * @param {object} params
 * @param {string} [params.category]
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildTrustIndicators({ category = null, lang = "es" }) {
  const badges = {
    es: [
      { id: "AUDIT_READY",    label: "Auditoría Lista",          icon: "shield-check" },
      { id: "MULTI_COUNTRY",  label: "Operación Multinacional",  icon: "world" },
      { id: "COMPLIANCE",     label: "Cumplimiento Internacional",icon: "certificate" },
      { id: "EXPORT_COORD",   label: "Coordinación de Exportación", icon: "ship" },
    ],
    en: [
      { id: "AUDIT_READY",    label: "Audit Ready",              icon: "shield-check" },
      { id: "MULTI_COUNTRY",  label: "Multi-Country Operation",  icon: "world" },
      { id: "COMPLIANCE",     label: "International Compliance",  icon: "certificate" },
      { id: "EXPORT_COORD",   label: "Export Coordination",      icon: "ship" },
    ],
    "pt-br": [
      { id: "AUDIT_READY",    label: "Pronto para Auditoria",    icon: "shield-check" },
      { id: "MULTI_COUNTRY",  label: "Operação Multinacional",   icon: "world" },
      { id: "COMPLIANCE",     label: "Conformidade Internacional",icon: "certificate" },
      { id: "EXPORT_COORD",   label: "Coordenação de Exportação",icon: "ship" },
    ],
  };

  return Object.freeze({
    zone:        "TRUST_INDICATORS",
    badges:      Object.freeze(badges[lang] || badges.en),
    category,
    background:  EXECUTIVE_COLORS.PRIMARY_DARK,
    accentColor: EXECUTIVE_COLORS.ACCENT_GOLD,
    textColor:   EXECUTIVE_COLORS.TEXT_LIGHT,
    _zone:       5,
  });
}

// ─── Full cover assembly ────────────────────────────────────────────────────────

/**
 * Assemble the complete executive cover page data from a document payload.
 * Returns all 5 zone blocks in render order.
 *
 * @param {object} params
 * @returns {object}
 */
export function assembleExecutiveCover({
  documentType   = "SCO",
  documentRef,
  entityName,
  buyerName,
  date,
  validityDate   = null,
  category,
  heroImagePath  = null,
  productName,
  origin,
  destination,
  incoterm,
  volume,
  volumeUnit,
  currency,
  totalValue,
  paymentTerms,
  shipmentWindow,
  lang           = "es",
}) {
  return Object.freeze({
    zones: Object.freeze([
      buildHeroHeader({ entityName, documentRef, lang }),
      buildExecutiveTitle({ documentType, documentRef, date, validityDate, lang }),
      buildProductHeroZone({ category, heroImagePath, productName, lang }),
      buildOperationSummaryBlock({ product: productName, origin, destination, incoterm, volume, volumeUnit, currency, totalValue, validityDate, paymentTerms, shipmentWindow, lang }),
      buildTrustIndicators({ category, lang }),
    ]),
    documentRef,
    documentType,
    lang,
    _assembled:  new Date().toISOString(),
    _schema:     "GLV_EXECUTIVE_COVER_V2",
    _renderNote: "Consume zones[n] in order. Each zone.background and zone.accentColor drives styling.",
  });
}
