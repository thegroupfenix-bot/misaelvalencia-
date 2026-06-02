/**
 * ExecutiveClientSummaryEngine.js — GLV GOS Executive PDF V2 — Client Summary Engine V1.0
 *
 * Produces executive summary panels for PDF documents:
 *   - Buyer summary block
 *   - Seller summary block
 *   - Operation overview
 *   - Product overview
 *   - Logistics overview
 *   - Compliance overview
 *   - Executive highlights
 *
 * STATUS: ACTIVE — Executive PDF V2
 * No JSX. No @react-pdf. Pure data — consumed by GlvPDF.jsx.
 */

import { EXECUTIVE_COLORS, EXECUTIVE_TYPOGRAPHY, EXECUTIVE_SPACING, TABLE_RULES } from "./ExecutiveVisualIdentityEngine.js";

// ─── Panel type constants ───────────────────────────────────────────────────────

export const PANEL_TYPES = Object.freeze({
  BUYER:       "BUYER",
  SELLER:      "SELLER",
  OPERATION:   "OPERATION",
  PRODUCT:     "PRODUCT",
  LOGISTICS:   "LOGISTICS",
  COMPLIANCE:  "COMPLIANCE",
  HIGHLIGHTS:  "HIGHLIGHTS",
});

// ─── Label maps ─────────────────────────────────────────────────────────────────

const L = {
  es: {
    buyer:           "Comprador",
    seller:          "Vendedor",
    company:         "Empresa",
    country:         "País",
    contact:         "Contacto",
    address:         "Dirección",
    taxId:           "NIT / Tax ID",
    operation:       "Resumen de Operación",
    operationRef:    "Referencia",
    category:        "Categoría",
    currency:        "Moneda",
    incoterm:        "Incoterm",
    workflowState:   "Estado",
    product:         "Producto",
    specification:   "Especificación",
    grade:           "Grado",
    packing:         "Empaque",
    origin:          "Origen",
    logistics:       "Logística",
    container:       "Contenedor",
    portLoading:     "Puerto de Embarque",
    portDest:        "Puerto de Destino",
    transitTime:     "Tiempo en Tránsito",
    compliance:      "Cumplimiento",
    certification:   "Certificación",
    inspection:      "Inspección",
    traceability:    "Trazabilidad",
    highlights:      "Puntos Clave",
  },
  en: {
    buyer:           "Buyer",
    seller:          "Seller",
    company:         "Company",
    country:         "Country",
    contact:         "Contact",
    address:         "Address",
    taxId:           "Tax ID",
    operation:       "Operation Summary",
    operationRef:    "Reference",
    category:        "Category",
    currency:        "Currency",
    incoterm:        "Incoterm",
    workflowState:   "Status",
    product:         "Product",
    specification:   "Specification",
    grade:           "Grade",
    packing:         "Packing",
    origin:          "Origin",
    logistics:       "Logistics",
    container:       "Container",
    portLoading:     "Port of Loading",
    portDest:        "Port of Destination",
    transitTime:     "Transit Time",
    compliance:      "Compliance",
    certification:   "Certification",
    inspection:      "Inspection",
    traceability:    "Traceability",
    highlights:      "Key Highlights",
  },
  "pt-br": {
    buyer:           "Comprador",
    seller:          "Vendedor",
    company:         "Empresa",
    country:         "País",
    contact:         "Contato",
    address:         "Endereço",
    taxId:           "CNPJ / Tax ID",
    operation:       "Resumo da Operação",
    operationRef:    "Referência",
    category:        "Categoria",
    currency:        "Moeda",
    incoterm:        "Incoterm",
    workflowState:   "Status",
    product:         "Produto",
    specification:   "Especificação",
    grade:           "Grau",
    packing:         "Embalagem",
    origin:          "Origem",
    logistics:       "Logística",
    container:       "Contêiner",
    portLoading:     "Porto de Embarque",
    portDest:        "Porto de Destino",
    transitTime:     "Tempo de Trânsito",
    compliance:      "Conformidade",
    certification:   "Certificação",
    inspection:      "Inspeção",
    traceability:    "Rastreabilidade",
    highlights:      "Destaques",
  },
};

function getL(lang) { return L[lang] || L.en; }

// ─── Panel schema helper ────────────────────────────────────────────────────────

function makePanel(type, title, rows, lang, options = {}) {
  return Object.freeze({
    panelType:   type,
    title,
    rows:        Object.freeze(rows.filter(r => r.value && r.value !== "—" || !options.filterEmpty)),
    lang,
    background:  options.background || EXECUTIVE_COLORS.SURFACE_ALT,
    accentColor: options.accent     || EXECUTIVE_COLORS.ACCENT_GOLD,
    textColor:   EXECUTIVE_COLORS.TEXT_PRIMARY,
    labelColor:  EXECUTIVE_COLORS.TEXT_MUTED,
    typography:  EXECUTIVE_TYPOGRAPHY.SECTION,
    tableStyle:  TABLE_RULES.SUMMARY_PANEL,
    _schema:     "GLV_SUMMARY_PANEL_V2",
  });
}

// ─── Block builders ─────────────────────────────────────────────────────────────

/**
 * Build the buyer summary panel.
 */
export function buildBuyerBlock({ buyerName, buyerCountry, buyerContact = null, buyerAddress = null, lang = "es" }) {
  const lx = getL(lang);
  return makePanel(PANEL_TYPES.BUYER, lx.buyer, [
    { label: lx.company,  value: buyerName    || "—" },
    { label: lx.country,  value: buyerCountry || "—" },
    { label: lx.contact,  value: buyerContact || "—" },
    { label: lx.address,  value: buyerAddress || "—" },
  ], lang);
}

/**
 * Build the seller summary panel.
 */
export function buildSellerBlock({ sellerName, sellerCountry, sellerContact = null, sellerAddress = null, lang = "es" }) {
  const lx = getL(lang);
  return makePanel(PANEL_TYPES.SELLER, lx.seller, [
    { label: lx.company,  value: sellerName    || "—" },
    { label: lx.country,  value: sellerCountry || "—" },
    { label: lx.contact,  value: sellerContact || "—" },
    { label: lx.address,  value: sellerAddress || "—" },
  ], lang, { background: EXECUTIVE_COLORS.SURFACE });
}

/**
 * Build the operation overview panel.
 */
export function buildOperationOverviewBlock({
  operationRef,
  category,
  currency,
  incoterm,
  workflowState,
  origin,
  destination,
  lang = "es",
}) {
  const lx = getL(lang);
  return makePanel(PANEL_TYPES.OPERATION, lx.operation, [
    { label: lx.operationRef,  value: operationRef  || "—" },
    { label: lx.category,      value: category      || "—" },
    { label: lx.currency,      value: currency      || "—" },
    { label: lx.incoterm,      value: incoterm      || "—" },
    { label: lx.workflowState, value: workflowState || "—" },
    { label: lx.country,       value: origin        || "—" },
    { label: "→",              value: destination   || "—" },
  ], lang, { accent: EXECUTIVE_COLORS.PRIMARY_MEDIUM });
}

/**
 * Build the product overview panel.
 */
export function buildProductOverviewBlock({
  productName,
  specification = null,
  grade         = null,
  packing       = null,
  origin        = null,
  lang          = "es",
}) {
  const lx = getL(lang);
  return makePanel(PANEL_TYPES.PRODUCT, lx.product, [
    { label: lx.product,       value: productName    || "—" },
    { label: lx.specification, value: specification  || "—" },
    { label: lx.grade,         value: grade          || "—" },
    { label: lx.packing,       value: packing        || "—" },
    { label: lx.origin,        value: origin         || "—" },
  ], lang);
}

/**
 * Build the logistics overview panel.
 */
export function buildLogisticsOverviewBlock({
  containerType  = null,
  portOfLoading  = null,
  portOfDest     = null,
  transitTime    = null,
  loadingDate    = null,
  lang           = "es",
}) {
  const lx = getL(lang);
  const dateLabel = lang === "en" ? "Loading Date" : lang === "pt-br" ? "Data de Embarque" : "Fecha de Embarque";
  return makePanel(PANEL_TYPES.LOGISTICS, lx.logistics, [
    { label: lx.container,    value: containerType || "—" },
    { label: lx.portLoading,  value: portOfLoading || "—" },
    { label: lx.portDest,     value: portOfDest    || "—" },
    { label: lx.transitTime,  value: transitTime   || "—" },
    { label: dateLabel,        value: loadingDate   || "—" },
  ], lang, { background: EXECUTIVE_COLORS.SURFACE });
}

/**
 * Build the compliance overview panel.
 */
export function buildComplianceOverviewBlock({
  certifications = [],
  inspectionBody = null,
  traceability   = null,
  lang           = "es",
}) {
  const lx = getL(lang);
  const certsValue = certifications.length > 0 ? certifications.join(" · ") : "—";
  return makePanel(PANEL_TYPES.COMPLIANCE, lx.compliance, [
    { label: lx.certification, value: certsValue      },
    { label: lx.inspection,    value: inspectionBody || "—" },
    { label: lx.traceability,  value: traceability  || "—" },
  ], lang, { accent: EXECUTIVE_COLORS.STATUS_GREEN });
}

/**
 * Build the executive highlights panel.
 * Compact bullet list of the key operational facts.
 */
export function buildExecutiveHighlightsBlock({
  highlights = [],
  lang       = "es",
}) {
  const lx = getL(lang);
  return Object.freeze({
    panelType:    PANEL_TYPES.HIGHLIGHTS,
    title:        lx.highlights,
    highlights:   Object.freeze(highlights.map(h => ({ text: h }))),
    lang,
    background:   EXECUTIVE_COLORS.PRIMARY_DARK,
    textColor:    EXECUTIVE_COLORS.TEXT_LIGHT,
    accentColor:  EXECUTIVE_COLORS.ACCENT_GOLD,
    bulletColor:  EXECUTIVE_COLORS.ACCENT_GOLD,
    typography:   EXECUTIVE_TYPOGRAPHY.SECTION,
    _schema:      "GLV_HIGHLIGHTS_PANEL_V2",
  });
}

// ─── Full client summary assembly ───────────────────────────────────────────────

/**
 * Assemble all summary panels for a document.
 * Returns an ordered array of panels for PDF rendering.
 *
 * @param {object} params
 * @returns {object[]}
 */
export function assembleClientSummary({
  buyerName, buyerCountry, buyerContact,
  sellerName, sellerCountry,
  operationRef, category, currency, incoterm, workflowState,
  origin, destination,
  productName, specification, grade, packing,
  containerType, portOfLoading, portOfDest, transitTime, loadingDate,
  certifications, inspectionBody,
  highlights,
  lang = "es",
}) {
  return Object.freeze([
    buildSellerBlock({ sellerName, sellerCountry, lang }),
    buildBuyerBlock({ buyerName, buyerCountry, buyerContact, lang }),
    buildOperationOverviewBlock({ operationRef, category, currency, incoterm, workflowState, origin, destination, lang }),
    buildProductOverviewBlock({ productName, specification, grade, packing, origin, lang }),
    buildLogisticsOverviewBlock({ containerType, portOfLoading, portOfDest, transitTime, loadingDate, lang }),
    buildComplianceOverviewBlock({ certifications, inspectionBody, lang }),
    buildExecutiveHighlightsBlock({ highlights: highlights || [], lang }),
  ]);
}
