/**
 * ExecutivePdfIntegrationBridge.js — GLV GOS Executive PDF V2 — Integration Bridge V1.0
 *
 * Orchestrates all executive PDF engines into normalized render payloads
 * consumed by GlvPDF.jsx. Isolates the presentation layer from business logic.
 *
 * DESIGN CONTRACT:
 *   - This module knows about executive engines, not about commercial calculations.
 *   - GlvPDF.jsx passes extracted business data (already calculated) into this bridge.
 *   - No calculations here. No currency logic here. No validator calls here.
 *   - All numbers arrive PRE-COMPUTED from GlvPDF.jsx scope.
 *
 * STATUS: ACTIVE — Executive PDF V2 Integration
 */

import { assembleExecutiveCover, CATEGORY_VISUAL_MODES }                       from "./ExecutiveCoverEngine.js";
import { buildExecutiveTimeline, buildCompactTimeline, TIMELINE_STAGES }       from "./ExecutiveTimelineEngine.js";
import { assembleClientSummary }                                                from "./ExecutiveClientSummaryEngine.js";
import { buildAuditFooterBlock, buildCertificationsBlock, buildTraceabilityBlock } from "./ExecutiveComplianceEngine.js";
import { EXECUTIVE_COLORS, EXECUTIVE_TYPOGRAPHY, EXECUTIVE_SPACING, BADGE_STYLES } from "./ExecutiveVisualIdentityEngine.js";

// ─── Re-export visual tokens for GlvPDF.jsx consumption ────────────────────────
export { EXECUTIVE_COLORS, EXECUTIVE_TYPOGRAPHY, EXECUTIVE_SPACING, BADGE_STYLES };

// ─── Cover page data builder ────────────────────────────────────────────────────

/**
 * Build normalized cover page data from GlvPDF.jsx's pre-computed values.
 * All inputs arrive ALREADY CALCULATED — bridge only maps to executive format.
 *
 * @param {object} params
 * @param {string} params.documentType   — "SCO" | "FCO" | "SPA"
 * @param {string} params.documentRef    — doc.id
 * @param {string} params.entityName     — exporter
 * @param {string} params.clientName     — doc.client
 * @param {string} params.date           — doc.date
 * @param {string} params.validityDays
 * @param {string} params.category       — firstCdRow.category
 * @param {string} params.product        — doc.product / custom name
 * @param {string} params.origin         — doc.origin
 * @param {string} params.destination    — doc.destination
 * @param {string} params.incoterm       — cdInc
 * @param {number} params.totalValue     — already computed by GlvPDF.jsx
 * @param {string} params.currency       — resolvedCurrency (already computed)
 * @param {string} params.paymentTerms
 * @param {string} params.containerType
 * @param {string} params.heroImagePath  — boundMedia.main
 * @param {string} params.lang
 * @returns {object}
 */
export function buildCoverPageData({
  documentType,
  documentRef,
  entityName,
  clientName,
  date,
  validityDays,
  category,
  product,
  origin,
  destination,
  incoterm,
  totalValue,
  currency,
  paymentTerms   = null,
  containerType  = null,
  heroImagePath  = null,
  lang           = "es",
}) {
  const validityDate = validityDays
    ? (() => {
        try {
          const d = new Date(date);
          d.setDate(d.getDate() + parseInt(validityDays, 10));
          return d.toISOString().split("T")[0];
        } catch { return null; }
      })()
    : null;

  const fmtValue = totalValue
    ? `${currency || "USD"} ${Number(totalValue).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : null;

  const shipmentWindow = containerType
    ? (lang === "en" ? `${containerType} — 30-45 days` : `${containerType} — 30-45 días`)
    : null;

  return assembleExecutiveCover({
    documentType,
    documentRef,
    entityName,
    buyerName:     clientName,
    date,
    validityDate,
    category:      category || "FOOD",
    heroImagePath,
    productName:   product,
    origin,
    destination,
    incoterm,
    currency,
    totalValue:    fmtValue,
    paymentTerms,
    shipmentWindow,
    lang,
  });
}

// ─── Timeline data builder ──────────────────────────────────────────────────────

/**
 * Build the executive timeline for the current workflow state.
 *
 * @param {string} workflowState  — e.g. "QUOTED" | "APPROVED"
 * @param {string} [lang]
 * @returns {object}
 */
export function buildTimelineData(workflowState = "QUOTED", lang = "es") {
  return buildExecutiveTimeline(workflowState, lang);
}

/**
 * Build compact timeline for inline display in PDF headers.
 *
 * @param {string} workflowState
 * @param {string} [lang]
 * @returns {object}
 */
export function buildCompactTimelineData(workflowState = "QUOTED", lang = "es") {
  return buildCompactTimeline(workflowState, lang);
}

// ─── Client summary builder ─────────────────────────────────────────────────────

/**
 * Build all client summary panels from GlvPDF.jsx pre-computed values.
 *
 * @param {object} params
 * @returns {object[]}
 */
export function buildSummaryPanels({
  sellerName, sellerCountry,
  clientName, clientCountry, clientContact,
  documentRef, category, currency, incoterm, workflowState, origin, destination,
  productName, containerType, portOfLoading, portOfDest, transitTime, loadingDate,
  certifications, lang,
}) {
  return assembleClientSummary({
    sellerName,
    sellerCountry:     sellerCountry || "USA",
    buyerName:         clientName,
    buyerCountry:      clientCountry,
    buyerContact:      clientContact,
    operationRef:      documentRef,
    category,
    currency,
    incoterm,
    workflowState,
    origin,
    destination,
    productName,
    containerType,
    portOfLoading,
    portOfDest,
    transitTime,
    loadingDate,
    certifications:    certifications || [],
    highlights:        buildHighlights({ category, incoterm, origin, destination, currency, lang }),
    lang,
  });
}

/**
 * Build executive highlights bullets from operation data.
 *
 * @param {object} params
 * @returns {string[]}
 */
export function buildHighlights({ category, incoterm, origin, destination, currency, lang = "es" }) {
  const bullets = {
    es: [
      category    ? `Categoría de producto: ${category}` : null,
      incoterm    ? `Condición de entrega: ${incoterm} Incoterms 2020` : null,
      origin      ? `País de origen: ${origin}` : null,
      destination ? `País de destino: ${destination}` : null,
      currency    ? `Moneda de la operación: ${currency}` : null,
      "Auditoría lista — documento trazable GLV GOS",
    ],
    en: [
      category    ? `Product category: ${category}` : null,
      incoterm    ? `Delivery condition: ${incoterm} Incoterms 2020` : null,
      origin      ? `Country of origin: ${origin}` : null,
      destination ? `Country of destination: ${destination}` : null,
      currency    ? `Operation currency: ${currency}` : null,
      "Audit ready — traceable document GLV GOS",
    ],
    "pt-br": [
      category    ? `Categoria de produto: ${category}` : null,
      incoterm    ? `Condição de entrega: ${incoterm} Incoterms 2020` : null,
      origin      ? `País de origem: ${origin}` : null,
      destination ? `País de destino: ${destination}` : null,
      currency    ? `Moeda da operação: ${currency}` : null,
      "Pronto para auditoria — documento rastreável GLV GOS",
    ],
  };

  return (bullets[lang] || bullets.en).filter(Boolean);
}

// ─── Audit footer builder ───────────────────────────────────────────────────────

/**
 * Build the audit footer data for PDF page footers.
 *
 * @param {object} params
 * @param {string} params.documentRef
 * @param {string} params.date
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildFooterData({ documentRef, date, lang = "es" }) {
  return buildAuditFooterBlock({
    documentRef,
    generatedAt: date || new Date().toISOString().slice(0, 10),
    platform:    "GLV GOS",
    lang,
  });
}

// ─── Category visual mode resolver ─────────────────────────────────────────────

/**
 * Get visual identity config for a product category.
 *
 * @param {string} category
 * @returns {object}
 */
export function getCategoryVisualMode(category) {
  return CATEGORY_VISUAL_MODES[category] || CATEGORY_VISUAL_MODES.FOOD;
}

// ─── Trust indicators data ──────────────────────────────────────────────────────

/**
 * Get trust indicator badges for a language.
 *
 * @param {string} [lang]
 * @returns {object[]}
 */
export function getTrustBadges(lang = "es") {
  const badges = {
    es: [
      { id: "AUDIT_READY",   label: "Auditoría Lista" },
      { id: "MULTI_COUNTRY", label: "Multinacional" },
      { id: "COMPLIANCE",    label: "Cumplimiento Intl." },
      { id: "EXPORT_COORD",  label: "Coordinación Export" },
    ],
    en: [
      { id: "AUDIT_READY",   label: "Audit Ready" },
      { id: "MULTI_COUNTRY", label: "Multinational" },
      { id: "COMPLIANCE",    label: "Intl. Compliance" },
      { id: "EXPORT_COORD",  label: "Export Coordination" },
    ],
    "pt-br": [
      { id: "AUDIT_READY",   label: "Auditoria Pronta" },
      { id: "MULTI_COUNTRY", label: "Multinacional" },
      { id: "COMPLIANCE",    label: "Conformidade Intl." },
      { id: "EXPORT_COORD",  label: "Coord. Exportação" },
    ],
  };
  return badges[lang] || badges.en;
}
