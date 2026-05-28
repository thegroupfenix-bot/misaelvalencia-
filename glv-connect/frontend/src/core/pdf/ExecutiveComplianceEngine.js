/**
 * ExecutiveComplianceEngine.js — GLV GOS Executive PDF V2 — Compliance Engine V1.0
 *
 * Produces executive compliance blocks for PDF documents:
 *   - Certifications visual block
 *   - Compliance structure
 *   - Audit-ready footer
 *   - QR-ready future section
 *   - Traceability structure
 *   - Verification-ready layout
 *
 * STATUS: ACTIVE — Executive PDF V2
 * No JSX. No @react-pdf. Pure data — consumed by GlvPDF.jsx.
 */

import { EXECUTIVE_COLORS, EXECUTIVE_TYPOGRAPHY, EXECUTIVE_SPACING, BADGE_STYLES } from "./ExecutiveVisualIdentityEngine.js";

// ─── Certification registry ─────────────────────────────────────────────────────
// Known certifications with labels and category associations.

export const CERTIFICATION_REGISTRY = Object.freeze({

  // Universal
  HACCP:      { id: "HACCP",       label: "HACCP",                  category: null,          icon: "shield-check" },
  ISO22000:   { id: "ISO22000",    label: "ISO 22000",              category: null,          icon: "certificate" },
  ISO9001:    { id: "ISO9001",     label: "ISO 9001",               category: null,          icon: "certificate" },
  GMP:        { id: "GMP",         label: "GMP",                    category: null,          icon: "shield" },
  BRC:        { id: "BRC",         label: "BRC Global Standard",    category: null,          icon: "certificate" },
  FSSC22000:  { id: "FSSC22000",   label: "FSSC 22000",             category: null,          icon: "certificate" },

  // Oils
  NON_GMO:    { id: "NON_GMO",     label: "Non-GMO",                category: "OILS",        icon: "leaf" },
  RSPO:       { id: "RSPO",        label: "RSPO",                   category: "OILS",        icon: "leaf" },
  USDA_ORGANIC:{ id:"USDA_ORGANIC",label: "USDA Organic",           category: "OILS",        icon: "leaf" },
  HALAL:      { id: "HALAL",       label: "Halal Certified",        category: "OILS",        icon: "star" },
  KOSHER:     { id: "KOSHER",      label: "Kosher",                 category: "OILS",        icon: "star" },

  // Live animals
  OIE:        { id: "OIE",         label: "OIE Compliant",          category: "LIVE_ANIMALS",icon: "shield-check" },
  SENASA:     { id: "SENASA",      label: "SENASA Cert.",           category: "LIVE_ANIMALS",icon: "certificate" },
  MAPA:       { id: "MAPA",        label: "MAPA Cert.",             category: "LIVE_ANIMALS",icon: "certificate" },
  INAC:       { id: "INAC",        label: "INAC Cert.",             category: "LIVE_ANIMALS",icon: "certificate" },

  // Grains
  CBOT:       { id: "CBOT",        label: "CBOT Standard",          category: "GRAINS",      icon: "chart-bar" },
  GAFTA:      { id: "GAFTA",       label: "GAFTA",                  category: "GRAINS",      icon: "certificate" },

  // Cold chain
  REEFER:     { id: "REEFER",      label: "Cold Chain Certified",   category: "FROZEN",      icon: "thermometer" },

  // Regulatory
  SGS:        { id: "SGS",         label: "SGS Inspection",         category: null,          icon: "search" },
  PHYTO:      { id: "PHYTO",       label: "Phytosanitary",          category: null,          icon: "leaf" },
  COO:        { id: "COO",         label: "Certificate of Origin",  category: null,          icon: "map-pin" },

});

// ─── Compliance block builders ──────────────────────────────────────────────────

/**
 * Build the certifications visual block.
 * Returns an array of badge-ready certification objects.
 *
 * @param {object} params
 * @param {string[]} params.certIds    — CERTIFICATION_REGISTRY keys
 * @param {string}   [params.category] — filter to relevant certs if provided
 * @param {string}   [params.lang]
 * @returns {object}
 */
export function buildCertificationsBlock({ certIds = [], category = null, lang = "es" }) {
  const title = { es: "Certificaciones y Cumplimiento", en: "Certifications & Compliance", "pt-br": "Certificações e Conformidade" };

  const certs = certIds
    .map(id => CERTIFICATION_REGISTRY[id])
    .filter(Boolean)
    .filter(c => !c.category || !category || c.category === category);

  return Object.freeze({
    blockType:    "CERTIFICATIONS",
    title:        (title[lang] || title.en),
    certifications: Object.freeze(certs.map(c => Object.freeze({
      id:          c.id,
      label:       c.label,
      icon:        c.icon,
      category:    c.category,
      badgeStyle:  BADGE_STYLES.TRUST,
    }))),
    count:        certs.length,
    lang,
    background:   EXECUTIVE_COLORS.SURFACE_ALT,
    accentColor:  EXECUTIVE_COLORS.ACCENT_GOLD,
    typography:   EXECUTIVE_TYPOGRAPHY.SECTION,
    _schema:      "GLV_CERTIFICATIONS_V2",
  });
}

/**
 * Build the compliance structure block.
 * Shows regulatory framework and applicable compliance rules.
 *
 * @param {object} params
 * @param {string} [params.regulatoryBody]
 * @param {string} [params.exportStandard]
 * @param {string} [params.inspectionProtocol]
 * @param {string} [params.governingLaw]
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildComplianceStructure({
  regulatoryBody      = null,
  exportStandard      = null,
  inspectionProtocol  = null,
  governingLaw        = null,
  lang                = "es",
}) {
  const labels = {
    es: { title: "Marco de Cumplimiento", regBody: "Organismo Regulador", standard: "Estándar de Exportación", inspection: "Protocolo de Inspección", law: "Ley Aplicable" },
    en: { title: "Compliance Framework",  regBody: "Regulatory Body",     standard: "Export Standard",         inspection: "Inspection Protocol",     law: "Governing Law" },
    "pt-br": { title: "Estrutura de Conformidade", regBody: "Órgão Regulador", standard: "Padrão de Exportação", inspection: "Protocolo de Inspeção", law: "Lei Aplicável" },
  };
  const lx = labels[lang] || labels.en;

  return Object.freeze({
    blockType: "COMPLIANCE_STRUCTURE",
    title:     lx.title,
    rows: Object.freeze([
      { label: lx.regBody,     value: regulatoryBody     || "—" },
      { label: lx.standard,    value: exportStandard     || "—" },
      { label: lx.inspection,  value: inspectionProtocol || "—" },
      { label: lx.law,         value: governingLaw       || "—" },
    ]),
    lang,
    background:  EXECUTIVE_COLORS.SURFACE,
    accentColor: EXECUTIVE_COLORS.ACCENT_GOLD,
    _schema:     "GLV_COMPLIANCE_STRUCTURE_V2",
  });
}

/**
 * Build the audit-ready footer block.
 * Appears at the bottom of each PDF page.
 *
 * @param {object} params
 * @param {string} params.documentRef
 * @param {string} params.generatedAt
 * @param {string} [params.auditRef]
 * @param {string} [params.platform]
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildAuditFooterBlock({
  documentRef,
  generatedAt,
  auditRef   = null,
  platform   = "GLV GOS",
  lang       = "es",
}) {
  const confidential = { es: "CONFIDENCIAL", en: "CONFIDENTIAL", "pt-br": "CONFIDENCIAL" };
  const genBy        = { es: "Generado por", en: "Generated by", "pt-br": "Gerado por" };

  return Object.freeze({
    blockType:     "AUDIT_FOOTER",
    documentRef,
    generatedAt,
    auditRef:      auditRef || `AUD-${documentRef}`,
    platform,
    confidentialLabel: (confidential[lang] || confidential.en),
    generatedByLabel:  (genBy[lang] || genBy.en),
    lang,
    height:        EXECUTIVE_SPACING.FOOTER_HEIGHT,
    background:    EXECUTIVE_COLORS.PRIMARY_DARK,
    textColor:     EXECUTIVE_COLORS.TEXT_LIGHT,
    accentColor:   EXECUTIVE_COLORS.ACCENT_GOLD,
    typography:    EXECUTIVE_TYPOGRAPHY.FOOTER,
    _schema:       "GLV_AUDIT_FOOTER_V2",
  });
}

/**
 * Build the traceability structure block.
 * Links document to operation, entity, and audit chain.
 *
 * @param {object} params
 * @param {string} params.documentRef
 * @param {string} [params.operationId]
 * @param {string} [params.entityName]
 * @param {string} [params.auditRef]
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildTraceabilityBlock({
  documentRef,
  operationId = null,
  entityName  = null,
  auditRef    = null,
  lang        = "es",
}) {
  const labels = {
    es: { title: "Trazabilidad del Documento", doc: "Documento", op: "Operación", entity: "Entidad Emisora", audit: "Referencia de Auditoría" },
    en: { title: "Document Traceability",      doc: "Document",  op: "Operation", entity: "Issuing Entity",  audit: "Audit Reference" },
    "pt-br": { title: "Rastreabilidade do Documento", doc: "Documento", op: "Operação", entity: "Entidade Emissora", audit: "Referência de Auditoria" },
  };
  const lx = labels[lang] || labels.en;

  return Object.freeze({
    blockType: "TRACEABILITY",
    title:     lx.title,
    rows: Object.freeze([
      { label: lx.doc,    value: documentRef || "—" },
      { label: lx.op,     value: operationId || "—" },
      { label: lx.entity, value: entityName  || "—" },
      { label: lx.audit,  value: auditRef    || `AUD-${documentRef}` },
    ]),
    lang,
    background:  EXECUTIVE_COLORS.SURFACE_ALT,
    accentColor: EXECUTIVE_COLORS.ACCENT_GOLD,
    _schema:     "GLV_TRACEABILITY_V2",
  });
}

/**
 * Build the QR / digital verification zone.
 * Currently produces the data scaffold — QR image rendering is future implementation.
 *
 * @param {object} params
 * @param {string} params.documentRef
 * @param {string} [params.verificationCode]
 * @param {string} [params.verificationUrl]
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildVerificationZone({
  documentRef,
  verificationCode = null,
  verificationUrl  = null,
  lang             = "es",
}) {
  const labels = {
    es: { title: "Verificación Digital", scan: "Escanee para verificar", code: "Código de Verificación" },
    en: { title: "Digital Verification", scan: "Scan to verify",         code: "Verification Code" },
    "pt-br": { title: "Verificação Digital", scan: "Escaneie para verificar", code: "Código de Verificação" },
  };
  const lx = labels[lang] || labels.en;

  return Object.freeze({
    blockType:        "VERIFICATION",
    title:            lx.title,
    scanLabel:        lx.scan,
    codeLabel:        lx.code,
    documentRef,
    verificationCode: verificationCode || `GLV-${documentRef}-VFY`,
    verificationUrl:  verificationUrl  || null,
    qrReady:          !!verificationUrl,
    lang,
    size:             80,
    background:       EXECUTIVE_COLORS.SURFACE,
    accentColor:      EXECUTIVE_COLORS.ACCENT_GOLD,
    borderColor:      EXECUTIVE_COLORS.BORDER_MEDIUM,
    _schema:          "GLV_VERIFICATION_V2",
    _note:            "QR rendering to be implemented when verificationUrl is configured",
  });
}

// ─── Full compliance section assembly ───────────────────────────────────────────

/**
 * Assemble the full compliance section for a PDF document.
 *
 * @param {object} params
 * @returns {object[]}
 */
export function assembleComplianceSection({
  certIds          = [],
  category         = null,
  regulatoryBody   = null,
  exportStandard   = null,
  inspectionProtocol = null,
  governingLaw     = null,
  documentRef,
  operationId      = null,
  entityName       = null,
  generatedAt,
  auditRef         = null,
  verificationCode = null,
  verificationUrl  = null,
  lang             = "es",
}) {
  return Object.freeze([
    buildCertificationsBlock({ certIds, category, lang }),
    buildComplianceStructure({ regulatoryBody, exportStandard, inspectionProtocol, governingLaw, lang }),
    buildTraceabilityBlock({ documentRef, operationId, entityName, auditRef, lang }),
    buildVerificationZone({ documentRef, verificationCode, verificationUrl, lang }),
    buildAuditFooterBlock({ documentRef, generatedAt, auditRef, lang }),
  ]);
}
