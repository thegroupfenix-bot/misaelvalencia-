/**
 * CountryContextEngine.js — GLV GOS Multi-Country Foundation V1.0
 *
 * Defines per-country configuration for workflows, currencies, compliance rules,
 * accounting integrations, and operational permissions.
 *
 * STATUS: FOUNDATION — country registry and schema defined.
 * Per-country workflow logic to be implemented per module as needed.
 */

// ─── Supported countries ───────────────────────────────────────────────────────

export const SUPPORTED_COUNTRIES = Object.freeze({

  BRAZIL: {
    id:           "BRAZIL",
    iso:          "BR",
    name:         "Brazil",
    nameLocal:    "Brasil",
    flag:         "🇧🇷",
    currency:     "BRL",
    timezone:     "America/Sao_Paulo",
    glvEntity:    "GLV Global Foods Brasil Ltda.",
    regulatoryBody: "MAPA (Ministério da Agricultura, Pecuária e Abastecimento)",
    exportCerts:  ["MAPA", "ANVISA", "SISCOMEX"],
    bankFormats:  ["FEBRABAN_240", "FEBRABAN_150"],
    payrollFormat:"eSocial",
    accountingInt:"SPED_Fiscal",
    status:       "active",
  },

  ARGENTINA: {
    id:           "ARGENTINA",
    iso:          "AR",
    name:         "Argentina",
    nameLocal:    "Argentina",
    flag:         "🇦🇷",
    currency:     "ARS",
    timezone:     "America/Argentina/Buenos_Aires",
    glvEntity:    "GLV Global Group / SENASA Associates",
    regulatoryBody: "SENASA (Servicio Nacional de Sanidad y Calidad Agroalimentaria)",
    exportCerts:  ["SENASA", "INDEC", "AFIP"],
    bankFormats:  ["INTERBANKING"],
    payrollFormat:"AFIP_SiCore",
    accountingInt:"AFIP_Contable",
    status:       "active",
  },

  CHILE: {
    id:           "CHILE",
    iso:          "CL",
    name:         "Chile",
    nameLocal:    "Chile",
    flag:         "🇨🇱",
    currency:     "CLP",
    timezone:     "America/Santiago",
    glvEntity:    "GLV Global Group / SAG Associates",
    regulatoryBody: "SAG (Servicio Agrícola y Ganadero)",
    exportCerts:  ["SAG", "SERNAPESCA", "SII"],
    bankFormats:  ["ABIF"],
    payrollFormat:"PreviredFormat",
    accountingInt:"SII_DTE",
    status:       "active",
  },

  URUGUAY: {
    id:           "URUGUAY",
    iso:          "UY",
    name:         "Uruguay",
    nameLocal:    "Uruguay",
    flag:         "🇺🇾",
    currency:     "UYU",
    timezone:     "America/Montevideo",
    glvEntity:    "GLV Global Group / INAC Associates",
    regulatoryBody: "INAC (Instituto Nacional de Carnes)",
    exportCerts:  ["INAC", "MGAP", "DGSA"],
    bankFormats:  ["BROU_Format"],
    payrollFormat:"BPS_Format",
    accountingInt:"DGI_eFactura",
    status:       "active",
  },

  COLOMBIA: {
    id:           "COLOMBIA",
    iso:          "CO",
    name:         "Colombia",
    nameLocal:    "Colombia",
    flag:         "🇨🇴",
    currency:     "COP",
    timezone:     "America/Bogota",
    glvEntity:    "GLV Services SAS",
    regulatoryBody: "ICA (Instituto Colombiano Agropecuario)",
    exportCerts:  ["ICA", "INVIMA", "DIAN"],
    bankFormats:  ["ACH_Colombia"],
    payrollFormat:"PILA_Format",
    accountingInt:"DIAN_eFactura",
    status:       "active",
  },

  DOMINICAN_REPUBLIC: {
    id:           "DOMINICAN_REPUBLIC",
    iso:          "DO",
    name:         "Dominican Republic",
    nameLocal:    "República Dominicana",
    flag:         "🇩🇴",
    currency:     "DOP",
    timezone:     "America/Santo_Domingo",
    glvEntity:    "GLV Holding Group",
    regulatoryBody: "DIGEGA / CENASA",
    exportCerts:  ["DIGEGA", "CENASA", "DGII"],
    bankFormats:  ["ACH_RD"],
    payrollFormat:"TSS_Format",
    accountingInt:"DGII_eFactura",
    status:       "planned",
  },

  TRINIDAD_TOBAGO: {
    id:           "TRINIDAD_TOBAGO",
    iso:          "TT",
    name:         "Trinidad & Tobago",
    nameLocal:    "Trinidad & Tobago",
    flag:         "🇹🇹",
    currency:     "TTD",
    timezone:     "America/Port_of_Spain",
    glvEntity:    "GLV Holding Group",
    regulatoryBody: "TTBS / Ministry of Agriculture",
    exportCerts:  ["TTBS", "MAL"],
    bankFormats:  ["ACH_TT"],
    payrollFormat:"NIS_Format",
    accountingInt:"IRD_Format",
    status:       "planned",
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
