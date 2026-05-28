/**
 * CountryContextEngine.js — GLV GOS Multi-Country Foundation V2.0
 *
 * Defines per-country configuration for workflows, currencies, compliance rules,
 * accounting integrations, operational permissions, timezones, banking formats,
 * payroll export types, document formatting rules, default languages,
 * regional certifications, and regional compliance rules.
 *
 * STATUS: ACTIVE — 10-country registry (V2 extends V1 with USA, Italy, UAE + enriched fields).
 */

// ─── Supported countries ───────────────────────────────────────────────────────

export const SUPPORTED_COUNTRIES = Object.freeze({

  BRAZIL: {
    id:              "BRAZIL",
    iso:             "BR",
    name:            "Brazil",
    nameLocal:       "Brasil",
    flag:            "🇧🇷",
    currency:        "BRL",
    timezone:        "America/Sao_Paulo",
    defaultLanguage: "pt-br",
    glvEntity:       "GLV Global Foods Brasil Ltda.",
    regulatoryBody:  "MAPA (Ministério da Agricultura, Pecuária e Abastecimento)",
    exportCerts:     ["MAPA", "ANVISA", "SISCOMEX"],
    bankFormats:     ["FEBRABAN_240", "FEBRABAN_150"],
    payrollFormat:   "eSocial",
    accountingInt:   "SPED_Fiscal",
    documentFormatRules: { dateFormat: "DD/MM/YYYY", decimalSeparator: ",", thousandsSeparator: "." },
    regionalCerts:   ["CERT_ORGANICO_BRASIL", "ABNT_NBR", "INMETRO"],
    complianceRules: { requiresSISCOMEX: true, requiresMAPACert: true, vatSystem: "ICMS/IPI" },
    status:          "active",
  },

  ARGENTINA: {
    id:              "ARGENTINA",
    iso:             "AR",
    name:            "Argentina",
    nameLocal:       "Argentina",
    flag:            "🇦🇷",
    currency:        "ARS",
    timezone:        "America/Argentina/Buenos_Aires",
    defaultLanguage: "es",
    glvEntity:       "GLV Global Group / SENASA Associates",
    regulatoryBody:  "SENASA (Servicio Nacional de Sanidad y Calidad Agroalimentaria)",
    exportCerts:     ["SENASA", "INDEC", "AFIP"],
    bankFormats:     ["INTERBANKING"],
    payrollFormat:   "AFIP_SiCore",
    accountingInt:   "AFIP_Contable",
    documentFormatRules: { dateFormat: "DD/MM/YYYY", decimalSeparator: ",", thousandsSeparator: "." },
    regionalCerts:   ["SENASA_EXPORTACION", "IRAM"],
    complianceRules: { requiresSENASACert: true, requiresAFIPRegistration: true, vatSystem: "IVA" },
    status:          "active",
  },

  CHILE: {
    id:              "CHILE",
    iso:             "CL",
    name:            "Chile",
    nameLocal:       "Chile",
    flag:            "🇨🇱",
    currency:        "CLP",
    timezone:        "America/Santiago",
    defaultLanguage: "es",
    glvEntity:       "GLV Global Group / SAG Associates",
    regulatoryBody:  "SAG (Servicio Agrícola y Ganadero)",
    exportCerts:     ["SAG", "SERNAPESCA", "SII"],
    bankFormats:     ["ABIF"],
    payrollFormat:   "PreviredFormat",
    accountingInt:   "SII_DTE",
    documentFormatRules: { dateFormat: "DD-MM-YYYY", decimalSeparator: ",", thousandsSeparator: "." },
    regionalCerts:   ["SAG_EXPORTACION", "INN"],
    complianceRules: { requiresSAGCert: true, requiresSIIRegistration: true, vatSystem: "IVA" },
    status:          "active",
  },

  URUGUAY: {
    id:              "URUGUAY",
    iso:             "UY",
    name:            "Uruguay",
    nameLocal:       "Uruguay",
    flag:            "🇺🇾",
    currency:        "UYU",
    timezone:        "America/Montevideo",
    defaultLanguage: "es",
    glvEntity:       "GLV Global Group / INAC Associates",
    regulatoryBody:  "INAC (Instituto Nacional de Carnes)",
    exportCerts:     ["INAC", "MGAP", "DGSA"],
    bankFormats:     ["BROU_Format"],
    payrollFormat:   "BPS_Format",
    accountingInt:   "DGI_eFactura",
    documentFormatRules: { dateFormat: "DD/MM/YYYY", decimalSeparator: ",", thousandsSeparator: "." },
    regionalCerts:   ["INAC_EXPORTACION", "LATU"],
    complianceRules: { requiresINACCert: true, requiresDGIRegistration: true, vatSystem: "IVA" },
    status:          "active",
  },

  COLOMBIA: {
    id:              "COLOMBIA",
    iso:             "CO",
    name:            "Colombia",
    nameLocal:       "Colombia",
    flag:            "🇨🇴",
    currency:        "COP",
    timezone:        "America/Bogota",
    defaultLanguage: "es",
    glvEntity:       "GLV Services SAS",
    regulatoryBody:  "ICA (Instituto Colombiano Agropecuario)",
    exportCerts:     ["ICA", "INVIMA", "DIAN"],
    bankFormats:     ["ACH_Colombia"],
    payrollFormat:   "PILA_Format",
    accountingInt:   "DIAN_eFactura",
    documentFormatRules: { dateFormat: "DD/MM/YYYY", decimalSeparator: ",", thousandsSeparator: "." },
    regionalCerts:   ["ICA_EXPORTACION", "ICONTEC"],
    complianceRules: { requiresICAPermit: true, requiresDIANRegistration: true, vatSystem: "IVA" },
    status:          "active",
  },

  DOMINICAN_REPUBLIC: {
    id:              "DOMINICAN_REPUBLIC",
    iso:             "DO",
    name:            "Dominican Republic",
    nameLocal:       "República Dominicana",
    flag:            "🇩🇴",
    currency:        "DOP",
    timezone:        "America/Santo_Domingo",
    defaultLanguage: "es",
    glvEntity:       "GLV Holding Group",
    regulatoryBody:  "DIGEGA / CENASA",
    exportCerts:     ["DIGEGA", "CENASA", "DGII"],
    bankFormats:     ["ACH_RD"],
    payrollFormat:   "TSS_Format",
    accountingInt:   "DGII_eFactura",
    documentFormatRules: { dateFormat: "MM/DD/YYYY", decimalSeparator: ".", thousandsSeparator: "," },
    regionalCerts:   ["DIGEGA_CERT", "CESAC"],
    complianceRules: { requiresDIGEGACert: true, requiresDGIIRegistration: true, vatSystem: "ITBIS" },
    status:          "planned",
  },

  TRINIDAD_TOBAGO: {
    id:              "TRINIDAD_TOBAGO",
    iso:             "TT",
    name:            "Trinidad & Tobago",
    nameLocal:       "Trinidad & Tobago",
    flag:            "🇹🇹",
    currency:        "TTD",
    timezone:        "America/Port_of_Spain",
    defaultLanguage: "en",
    glvEntity:       "GLV Holding Group",
    regulatoryBody:  "TTBS / Ministry of Agriculture",
    exportCerts:     ["TTBS", "MAL"],
    bankFormats:     ["ACH_TT"],
    payrollFormat:   "NIS_Format",
    accountingInt:   "IRD_Format",
    documentFormatRules: { dateFormat: "DD/MM/YYYY", decimalSeparator: ".", thousandsSeparator: "," },
    regionalCerts:   ["TTBS_CERT"],
    complianceRules: { requiresTTBSCert: true, vatSystem: "VAT" },
    status:          "planned",
  },

  USA: {
    id:              "USA",
    iso:             "US",
    name:            "United States",
    nameLocal:       "United States",
    flag:            "🇺🇸",
    currency:        "USD",
    timezone:        "America/New_York",
    defaultLanguage: "en",
    glvEntity:       "GLV Global Food Services LLC",
    regulatoryBody:  "USDA / FDA",
    exportCerts:     ["USDA", "FDA", "APHIS"],
    bankFormats:     ["ACH_NACHA", "WIRE_FEDWIRE"],
    payrollFormat:   "ADP_Format",
    accountingInt:   "IRS_Format",
    documentFormatRules: { dateFormat: "MM/DD/YYYY", decimalSeparator: ".", thousandsSeparator: "," },
    regionalCerts:   ["USDA_ORGANIC", "FDA_APPROVED", "HACCP"],
    complianceRules: { requiresFDARegistration: true, requiresUSDAInspection: true, vatSystem: "SALES_TAX" },
    status:          "active",
  },

  ITALY: {
    id:              "ITALY",
    iso:             "IT",
    name:            "Italy",
    nameLocal:       "Italia",
    flag:            "🇮🇹",
    currency:        "EUR",
    timezone:        "Europe/Rome",
    defaultLanguage: "en",
    glvEntity:       "GLV Global Foods Italia SRL",
    regulatoryBody:  "MIPAAF / ICQRF",
    exportCerts:     ["MIPAAF", "ICQRF", "CCIAA"],
    bankFormats:     ["SEPA_CREDIT_TRANSFER", "SEPA_DIRECT_DEBIT"],
    payrollFormat:   "INPS_Format",
    accountingInt:   "SDI_eFactura",
    documentFormatRules: { dateFormat: "DD/MM/YYYY", decimalSeparator: ",", thousandsSeparator: "." },
    regionalCerts:   ["DOP", "IGP", "BIO_EU"],
    complianceRules: { requiresCCIAARegistration: true, requiresICQRFInspection: true, vatSystem: "IVA" },
    status:          "active",
  },

  UAE: {
    id:              "UAE",
    iso:             "AE",
    name:            "United Arab Emirates",
    nameLocal:       "الإمارات العربية المتحدة",
    flag:            "🇦🇪",
    currency:        "USD",
    timezone:        "Asia/Dubai",
    defaultLanguage: "en",
    glvEntity:       "GLV Global Commodities Trading FZ-LLC",
    regulatoryBody:  "MOCCAE / Dubai Municipality",
    exportCerts:     ["MOCCAE", "ESMA", "HALAL_CERT"],
    bankFormats:     ["SWIFT_WIRE", "UAEFTS"],
    payrollFormat:   "WPS_Format",
    accountingInt:   "FTA_VAT",
    documentFormatRules: { dateFormat: "DD/MM/YYYY", decimalSeparator: ".", thousandsSeparator: "," },
    regionalCerts:   ["HALAL", "ISO22000", "ESMA_APPROVED"],
    complianceRules: { requiresHalalCert: true, requiresESMAApproval: true, vatSystem: "VAT_5PCT" },
    status:          "active",
  },

});

// ─── Country context resolver ──────────────────────────────────────────────────

/**
 * Get country context by name, ISO code, or ID.
 * @param {string} identifier — country name, ISO code, or ID
 * @returns {object|null}
 */
export function getCountryContext(identifier) {
  if (!identifier) return null;
  const upper = identifier.toUpperCase().trim();

  // Direct ID match
  if (SUPPORTED_COUNTRIES[upper]) return SUPPORTED_COUNTRIES[upper];

  // ISO match
  const byIso = Object.values(SUPPORTED_COUNTRIES).find(c => c.iso === upper);
  if (byIso) return byIso;

  // Name match (case-insensitive)
  const byName = Object.values(SUPPORTED_COUNTRIES).find(
    c => c.name.toLowerCase() === identifier.toLowerCase() ||
         c.nameLocal.toLowerCase() === identifier.toLowerCase()
  );
  return byName || null;
}

/**
 * Get all active countries.
 */
export function getActiveCountries() {
  return Object.values(SUPPORTED_COUNTRIES).filter(c => c.status === "active");
}

/**
 * Get currency for a country.
 */
export function getCountryCurrency(identifier) {
  return getCountryContext(identifier)?.currency || "USD";
}

/**
 * Check if a country supports a given export certificate type.
 */
export function countrySupportsExportCert(countryId, certType) {
  const ctx = SUPPORTED_COUNTRIES[countryId];
  return ctx?.exportCerts?.includes(certType) ?? false;
}

/**
 * Get the default language for a country.
 *
 * @param {string} countryId
 * @returns {string}  — "es" | "en" | "pt-br"
 */
export function getCountryDefaultLanguage(countryId) {
  return SUPPORTED_COUNTRIES[countryId]?.defaultLanguage || "es";
}

/**
 * Get banking formats available for a country.
 *
 * @param {string} countryId
 * @returns {string[]}
 */
export function getCountryBankFormats(countryId) {
  return SUPPORTED_COUNTRIES[countryId]?.bankFormats || [];
}

/**
 * Get payroll export format for a country.
 *
 * @param {string} countryId
 * @returns {string|null}
 */
export function getCountryPayrollFormat(countryId) {
  return SUPPORTED_COUNTRIES[countryId]?.payrollFormat || null;
}

/**
 * Get document formatting rules for a country.
 *
 * @param {string} countryId
 * @returns {object}  — { dateFormat, decimalSeparator, thousandsSeparator }
 */
export function getCountryDocumentRules(countryId) {
  return SUPPORTED_COUNTRIES[countryId]?.documentFormatRules || {
    dateFormat:         "DD/MM/YYYY",
    decimalSeparator:   ".",
    thousandsSeparator: ",",
  };
}

/**
 * Get regional certifications available for a country.
 *
 * @param {string} countryId
 * @returns {string[]}
 */
export function getCountryRegionalCerts(countryId) {
  return SUPPORTED_COUNTRIES[countryId]?.regionalCerts || [];
}

/**
 * Get compliance rules for a country.
 *
 * @param {string} countryId
 * @returns {object}
 */
export function getCountryComplianceRules(countryId) {
  return SUPPORTED_COUNTRIES[countryId]?.complianceRules || {};
}

/**
 * Get operational timezone for a country.
 *
 * @param {string} countryId
 * @returns {string}  — IANA timezone string
 */
export function getCountryTimezone(countryId) {
  return SUPPORTED_COUNTRIES[countryId]?.timezone || "UTC";
}

/**
 * Get all countries supporting a given bank format.
 *
 * @param {string} formatId
 * @returns {object[]}
 */
export function getCountriesForBankFormat(formatId) {
  return Object.values(SUPPORTED_COUNTRIES).filter(
    c => c.bankFormats && c.bankFormats.includes(formatId)
  );
}
