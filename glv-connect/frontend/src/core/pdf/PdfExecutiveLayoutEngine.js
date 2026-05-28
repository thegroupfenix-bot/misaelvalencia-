/**
 * PdfExecutiveLayoutEngine.js — GLV GOS Core Domain — PDF Executive Layout Foundation V1.0
 *
 * Defines executive layout blocks for @react-pdf/renderer documents:
 * cover blocks, corporate header zones, company hierarchy sections,
 * operational chain blocks, audit footer zones, QR/document verification zones.
 *
 * STATUS: FOUNDATION — layout data schema and block configuration defined.
 * React-PDF JSX rendering components to be implemented in GlvPDF.jsx using these specs.
 *
 * DESIGN CONTRACT:
 *   - This engine emits layout DATA objects only — no JSX, no @react-pdf imports.
 *   - GlvPDF.jsx consumes these objects to render styled blocks.
 *   - DO NOT modify commercial calculations, pricing formulas, or logistics formulas.
 */

// ─── Layout zone constants ──────────────────────────────────────────────────────

export const PDF_ZONES = Object.freeze({
  COVER:            "COVER",
  CORPORATE_HEADER: "CORPORATE_HEADER",
  ENTITY_HIERARCHY: "ENTITY_HIERARCHY",
  OPERATION_CHAIN:  "OPERATION_CHAIN",
  CONTENT_BODY:     "CONTENT_BODY",
  AUDIT_FOOTER:     "AUDIT_FOOTER",
  VERIFICATION:     "VERIFICATION",
});

export const PDF_LAYOUT_THEME = Object.freeze({
  PRIMARY_DARK:   "#1B2A4A",
  PRIMARY_MEDIUM: "#243656",
  ACCENT_GOLD:    "#C9A84C",
  ACCENT_BLUE:    "#2D6BC4",
  TEXT_LIGHT:     "#FFFFFF",
  TEXT_DARK:      "#0F172A",
  TEXT_MUTED:     "#64748B",
  BORDER:         "#E2E8F0",
  BACKGROUND:     "#F8FAFC",
});

// ─── Cover block ────────────────────────────────────────────────────────────────

/**
 * Build the executive cover block data for a PDF document.
 *
 * @param {object} params
 * @param {string} params.documentRef      — e.g. "SCO-GLV-2026-047"
 * @param {string} params.documentType     — e.g. "Sales Confirmation Offer"
 * @param {string} params.coverLabel       — category-specific label
 * @param {string} params.entityName       — issuing entity name
 * @param {string} params.buyerName
 * @param {string} params.date
 * @param {string} [params.coverImagePath]
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildCoverBlock({
  documentRef,
  documentType,
  coverLabel,
  entityName,
  buyerName,
  date,
  coverImagePath = null,
  lang           = "es",
}) {
  return Object.freeze({
    zone:           PDF_ZONES.COVER,
    documentRef,
    documentType,
    coverLabel,
    entityName,
    buyerName,
    date,
    coverImagePath,
    lang,
    theme:          PDF_LAYOUT_THEME.PRIMARY_DARK,
    accentColor:    PDF_LAYOUT_THEME.ACCENT_GOLD,
    _schema:        "GLV_PDF_COVER_V1",
  });
}

// ─── Corporate header ───────────────────────────────────────────────────────────

/**
 * Build the corporate header zone data.
 *
 * @param {object} params
 * @param {string} params.entityName
 * @param {string} params.documentRef
 * @param {string} params.documentType
 * @param {string} [params.logoPath]
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildCorporateHeader({
  entityName,
  documentRef,
  documentType,
  logoPath = null,
  lang     = "es",
}) {
  return Object.freeze({
    zone:        PDF_ZONES.CORPORATE_HEADER,
    entityName,
    documentRef,
    documentType,
    logoPath,
    lang,
    background:  PDF_LAYOUT_THEME.PRIMARY_DARK,
    textColor:   PDF_LAYOUT_THEME.TEXT_LIGHT,
    accentColor: PDF_LAYOUT_THEME.ACCENT_GOLD,
    _schema:     "GLV_PDF_HEADER_V1",
  });
}

// ─── Entity hierarchy block ─────────────────────────────────────────────────────

/**
 * Build the entity hierarchy section — shows GLV entity → buyer chain.
 *
 * @param {object} params
 * @param {string} params.sellerName
 * @param {string} params.sellerCountry
 * @param {string} params.buyerName
 * @param {string} params.buyerCountry
 * @param {string} [params.intermediary]
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildEntityHierarchy({
  sellerName,
  sellerCountry,
  buyerName,
  buyerCountry,
  intermediary = null,
  lang         = "es",
}) {
  return Object.freeze({
    zone:          PDF_ZONES.ENTITY_HIERARCHY,
    seller:        Object.freeze({ name: sellerName, country: sellerCountry }),
    buyer:         Object.freeze({ name: buyerName, country: buyerCountry }),
    intermediary:  intermediary || null,
    lang,
    _schema:       "GLV_PDF_HIERARCHY_V1",
  });
}

// ─── Operation chain block ──────────────────────────────────────────────────────

/**
 * Build the operational chain summary block for PDF display.
 *
 * @param {object} chainSummary  — output of getOperationChainSummary()
 * @param {string} [lang]
 * @returns {object}
 */
export function buildOperationChainBlock(chainSummary = {}, lang = "es") {
  return Object.freeze({
    zone:          PDF_ZONES.OPERATION_CHAIN,
    operationId:   chainSummary.operationId || "—",
    salesEntity:   chainSummary.salesEntity || "—",
    invoiceEntity: chainSummary.invoiceEntity || "—",
    logistics:     chainSummary.logisticsEntity || "—",
    banking:       chainSummary.bankingEntity || "—",
    origin:        chainSummary.originCountry || "—",
    destination:   chainSummary.destinationCountry || "—",
    lang,
    _schema:       "GLV_PDF_CHAIN_V1",
  });
}

// ─── Audit footer block ─────────────────────────────────────────────────────────

/**
 * Build the audit footer zone data — shown at bottom of every page.
 *
 * @param {object} params
 * @param {string} params.documentRef
 * @param {string} params.generatedAt
 * @param {string} [params.generatedBy]
 * @param {string} [params.version]
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildAuditFooter({
  documentRef,
  generatedAt,
  generatedBy  = "GLV GOS",
  version      = "1.0",
  lang         = "es",
}) {
  return Object.freeze({
    zone:        PDF_ZONES.AUDIT_FOOTER,
    documentRef,
    generatedAt,
    generatedBy,
    version,
    lang,
    confidentialLabel: lang === "en" ? "Confidential" : "Confidencial",
    _schema:     "GLV_PDF_FOOTER_V1",
  });
}

// ─── Verification zone ──────────────────────────────────────────────────────────

/**
 * Build the document verification zone data (QR / hash / digital seal area).
 *
 * @param {object} params
 * @param {string} params.documentRef
 * @param {string} [params.verificationCode]  — short hash or reference code
 * @param {string} [params.verificationUrl]   — URL for document verification portal
 * @param {string} [params.lang]
 * @returns {object}
 */
export function buildVerificationZone({
  documentRef,
  verificationCode = null,
  verificationUrl  = null,
  lang             = "es",
}) {
  return Object.freeze({
    zone:             PDF_ZONES.VERIFICATION,
    documentRef,
    verificationCode: verificationCode || `GLV-${documentRef}-VFY`,
    verificationUrl:  verificationUrl || null,
    lang,
    label:            lang === "en" ? "Document Verification" : "Verificación del Documento",
    _schema:          "GLV_PDF_VERIFICATION_V1",
  });
}

// ─── Full layout assembly ───────────────────────────────────────────────────────

/**
 * Assemble a complete executive layout spec from document data.
 * Returns all zone block configurations for GlvPDF.jsx to render.
 *
 * @param {object} params
 * @param {string} params.documentRef
 * @param {string} params.documentType
 * @param {string} params.coverLabel
 * @param {string} params.entityName
 * @param {string} params.buyerName
 * @param {string} params.sellerCountry
 * @param {string} params.buyerCountry
 * @param {string} params.date
 * @param {string} [params.coverImagePath]
 * @param {string} [params.lang]
 * @param {object} [params.chainSummary]
 * @returns {object}
 */
export function assembleExecutiveLayout({
  documentRef,
  documentType,
  coverLabel,
  entityName,
  buyerName,
  sellerCountry,
  buyerCountry,
  date,
  coverImagePath = null,
  lang           = "es",
  chainSummary   = null,
}) {
  return Object.freeze({
    cover:      buildCoverBlock({ documentRef, documentType, coverLabel, entityName, buyerName, date, coverImagePath, lang }),
    header:     buildCorporateHeader({ entityName, documentRef, documentType, lang }),
    hierarchy:  buildEntityHierarchy({ sellerName: entityName, sellerCountry, buyerName, buyerCountry, lang }),
    chain:      chainSummary ? buildOperationChainBlock(chainSummary, lang) : null,
    footer:     buildAuditFooter({ documentRef, generatedAt: new Date().toISOString(), lang }),
    verification: buildVerificationZone({ documentRef, lang }),
    _assembled: new Date().toISOString(),
    _schema:    "GLV_PDF_LAYOUT_V1",
  });
}
