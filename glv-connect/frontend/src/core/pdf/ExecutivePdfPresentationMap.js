/**
 * ExecutivePdfPresentationMap.js — GLV GOS Core PDF — Executive Presentation Map V1.0
 *
 * Architecture preparation for the future executive visual hierarchy.
 * Defines all PDF zones, their render order, content sources, and layout rules.
 *
 * STATUS: ARCHITECTURE PREPARATION — zone definitions only.
 * DO NOT redesign current PDF rendering.
 * GlvPDF.jsx rendering components will be updated per zone in future phases.
 *
 * DESIGN CONTRACT:
 *   - This file defines zone specifications as frozen data objects.
 *   - No JSX. No @react-pdf imports. No calculation changes.
 *   - Rendering engineers implement zones by consuming these specs.
 */

// ─── Zone identifiers ────────────────────────────────────────────────────────────

export const PDF_PRESENTATION_ZONES = Object.freeze({
  EXECUTIVE_COVER:       "EXECUTIVE_COVER",
  PRODUCT_INTELLIGENCE:  "PRODUCT_INTELLIGENCE",
  COMMERCIAL_SUMMARY:    "COMMERCIAL_SUMMARY",
  OPERATIONAL_CHAIN:     "OPERATIONAL_CHAIN",
  COMPLIANCE_CERTS:      "COMPLIANCE_CERTS",
  LOGISTICS_INTELLIGENCE:"LOGISTICS_INTELLIGENCE",
  LEGAL_BANKING:         "LEGAL_BANKING",
  AUDIT_FOOTER:          "AUDIT_FOOTER",
  QR_VALIDATION:         "QR_VALIDATION",
  DIGITAL_VERIFICATION:  "DIGITAL_VERIFICATION",
});

// ─── Zone specifications ─────────────────────────────────────────────────────────

export const PDF_ZONE_SPECS = Object.freeze({

  EXECUTIVE_COVER: {
    id:          "EXECUTIVE_COVER",
    order:       1,
    page:        1,
    description: "Full-bleed cover page with document identity, buyer/seller, and product cover image",
    contentSources: ["documentRef", "documentType", "coverLabel", "entityName", "buyerName", "coverImage", "date"],
    layoutRules: {
      background:     "PRIMARY_DARK",
      textColor:      "TEXT_LIGHT",
      accentColor:    "ACCENT_GOLD",
      fullPage:       true,
      logoPosition:   "top-left",
      imagePosition:  "center-right",
    },
    status:      "planned",
  },

  PRODUCT_INTELLIGENCE: {
    id:          "PRODUCT_INTELLIGENCE",
    order:       2,
    page:        2,
    description: "Product identity block: category, mode, specs, certifications, quality standards",
    contentSources: ["category", "docMode", "productDescription", "specs", "qualityCerts", "productImages"],
    layoutRules: {
      background:     "BACKGROUND",
      twoColumn:      true,
      imageMaxCount:  2,
    },
    status:      "planned",
  },

  COMMERCIAL_SUMMARY: {
    id:          "COMMERCIAL_SUMMARY",
    order:       3,
    page:        2,
    description: "Price, quantity, incoterm, payment terms, and commercial detail table",
    contentSources: ["cdRows", "totalPrice", "currency", "incoterm", "paymentTerms", "commercialBasis"],
    layoutRules: {
      background:     "BACKGROUND",
      tableStyle:     "enterprise",
      highlightTotal: true,
    },
    status:      "planned",
    // NOTE: DO NOT modify commercial calculation formulas that feed this zone.
  },

  OPERATIONAL_CHAIN: {
    id:          "OPERATIONAL_CHAIN",
    order:       4,
    page:        3,
    description: "Entity chain visualization: seller → invoice entity → supplier → logistics → buyer",
    contentSources: ["operationChain", "entityHierarchy", "originCountry", "destinationCountry"],
    layoutRules: {
      background:     "PRIMARY_MEDIUM",
      textColor:      "TEXT_LIGHT",
      chainDirection: "horizontal",
    },
    status:      "planned",
  },

  COMPLIANCE_CERTS: {
    id:          "COMPLIANCE_CERTS",
    order:       5,
    page:        3,
    description: "Required certifications, regulatory compliance, and quality seals per category/country",
    contentSources: ["modeCertifications", "exportCerts", "categoryCompliance", "countryRegulations"],
    layoutRules: {
      background:     "BACKGROUND",
      iconGrid:       true,
      maxCerts:       8,
    },
    status:      "planned",
  },

  LOGISTICS_INTELLIGENCE: {
    id:          "LOGISTICS_INTELLIGENCE",
    order:       6,
    page:        4,
    description: "Container type, port of loading, destination port, transit time, shipping line, Incoterm details",
    contentSources: ["containerType", "portOfLoading", "portOfDestination", "transitTime", "loadingDate", "incoterm"],
    layoutRules: {
      background:     "BACKGROUND",
      twoColumn:      true,
    },
    status:      "planned",
    // NOTE: DO NOT modify logistics calculation formulas that feed this zone.
  },

  LEGAL_BANKING: {
    id:          "LEGAL_BANKING",
    order:       7,
    page:        4,
    description: "Banking entity, payment instructions reference, legal terms, governing law",
    contentSources: ["bankingEntity", "paymentInstructionsRef", "legalTerms", "governingLaw"],
    layoutRules: {
      background:     "BACKGROUND_TERTIARY",
      condensed:      true,
    },
    status:      "planned",
    // NOTE: Bank account details are injected server-side only — never in client payload.
  },

  AUDIT_FOOTER: {
    id:          "AUDIT_FOOTER",
    order:       8,
    page:        "all",
    description: "Per-page footer: document ref, page number, platform identity, confidential label, audit timestamp",
    contentSources: ["documentRef", "pageNumber", "platform", "generatedAt", "auditReference"],
    layoutRules: {
      position:       "bottom",
      height:         32,
      background:     "PRIMARY_DARK",
      textColor:      "TEXT_LIGHT",
      fontSize:       8,
    },
    status:      "active",
  },

  QR_VALIDATION: {
    id:          "QR_VALIDATION",
    order:       9,
    page:        "last",
    description: "QR code linking to document verification portal with hash reference",
    contentSources: ["documentRef", "verificationCode", "verificationUrl"],
    layoutRules: {
      position:       "bottom-right",
      size:           80,
    },
    status:      "planned",
  },

  DIGITAL_VERIFICATION: {
    id:          "DIGITAL_VERIFICATION",
    order:       10,
    page:        "last",
    description: "Digital signature zone, document hash, GLV GOS seal, issuer identity",
    contentSources: ["issuerEntity", "documentHash", "digitalSeal", "signatureRef"],
    layoutRules: {
      background:     "BACKGROUND",
      sealPosition:   "right",
    },
    status:      "planned",
  },

});

// ─── Presentation map resolver ──────────────────────────────────────────────────

/**
 * Get all active PDF zones in render order.
 *
 * @returns {object[]}
 */
export function getActivePdfZones() {
  return Object.values(PDF_ZONE_SPECS)
    .filter(z => z.status === "active")
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all planned PDF zones.
 *
 * @returns {object[]}
 */
export function getPlannedPdfZones() {
  return Object.values(PDF_ZONE_SPECS)
    .filter(z => z.status === "planned")
    .sort((a, b) => a.order - b.order);
}

/**
 * Get a zone spec by ID.
 *
 * @param {string} zoneId  — PDF_PRESENTATION_ZONES value
 * @returns {object|null}
 */
export function getZoneSpec(zoneId) {
  return PDF_ZONE_SPECS[zoneId] || null;
}

/**
 * Get all content sources required across all zones for a given page.
 *
 * @param {number|"all"|"last"} page
 * @returns {string[]}
 */
export function getContentSourcesForPage(page) {
  const zones = Object.values(PDF_ZONE_SPECS).filter(
    z => z.page === page || z.page === "all"
  );
  const sources = new Set(zones.flatMap(z => z.contentSources || []));
  return [...sources];
}
