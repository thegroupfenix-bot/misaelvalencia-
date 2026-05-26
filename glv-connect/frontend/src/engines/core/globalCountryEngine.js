/**
 * globalCountryEngine.js — V9.1 World Export Destination Engine
 *
 * Full world country search with:
 *   - Searchable dropdown (all countries)
 *   - Optional port auto-suggestion
 *   - Region auto-detection for freight estimation
 *   - Custom free-text override
 *   - No restrictions — any country, any port
 *
 * Uses WORLD_COUNTRIES from worldCountries.js config.
 * Adds freight estimation by region via REGION_FREIGHT_ESTIMATES.
 *
 * NOT limited to Caribbean. Supports Angola, Qatar, Malaysia, Singapore,
 * Chile, Peru, Ghana, Ivory Coast, Panama — all countries worldwide.
 */

import { WORLD_COUNTRIES, searchCountries } from "../../config/worldCountries.js";

// Re-export for consumers that only want the engine interface
export { searchCountries };

// ─── Region freight estimates (USD per 40HQ container from Colombia/Miami) ───

export const REGION_FREIGHT_ESTIMATES = {
  "Caribbean":       { freightUSD: 1800,  transitDays: "5–12",  description: "Caribbean ports" },
  "Central America": { freightUSD: 1600,  transitDays: "4–8",   description: "Central American ports" },
  "South America":   { freightUSD: 2200,  transitDays: "7–14",  description: "South American ports" },
  "North America":   { freightUSD: 1400,  transitDays: "3–7",   description: "US / Canada ports" },
  "Europe":          { freightUSD: 3800,  transitDays: "14–22", description: "European ports" },
  "Middle East":     { freightUSD: 4200,  transitDays: "22–30", description: "Middle East ports" },
  "Africa":          { freightUSD: 3500,  transitDays: "18–28", description: "West / East Africa" },
  "Asia":            { freightUSD: 5200,  transitDays: "28–40", description: "Asian ports" },
  "Oceania":         { freightUSD: 5800,  transitDays: "32–45", description: "Oceania ports" },
};

// Countries with known direct freight presets (override regional estimate)
const PRESET_FREIGHT = {
  "VE": { freightUSD: 1200, port: "Puerto de La Guaira / Puerto Cabello", transitDays: "4–7"  },
  "DO": { freightUSD: 1600, port: "Puerto de Caucedo / Puerto de Haina",  transitDays: "5–8"  },
  "JM": { freightUSD: 1800, port: "Kingston Container Terminal",          transitDays: "6–10" },
  "TT": { freightUSD: 2000, port: "Port of Port of Spain",                transitDays: "5–9"  },
  "GY": { freightUSD: 2200, port: "Port of Georgetown",                   transitDays: "6–10" },
  "BB": { freightUSD: 1900, port: "Bridgetown Port",                      transitDays: "5–9"  },
  "CW": { freightUSD: 1700, port: "Willemstad (Curaçao)",                 transitDays: "4–7"  },
  "AW": { freightUSD: 1750, port: "Oranjestad Port",                      transitDays: "4–7"  },
  "HT": { freightUSD: 1900, port: "Port-au-Prince",                       transitDays: "5–8"  },
  "CO": { freightUSD:  900, port: "Puerto de Barranquilla / Cartagena",   transitDays: "2–4"  },
  "PA": { freightUSD: 1500, port: "Puerto de Balboa / Manzanillo",        transitDays: "4–6"  },
  "EC": { freightUSD: 1800, port: "Puerto de Guayaquil",                  transitDays: "5–8"  },
  "PE": { freightUSD: 2200, port: "Puerto del Callao",                    transitDays: "8–12" },
  "CL": { freightUSD: 2400, port: "San Antonio / Valparaíso",             transitDays: "10–14"},
  "BR": { freightUSD: 2600, port: "Santos / Paranaguá",                   transitDays: "10–16"},
  "NG": { freightUSD: 3200, port: "Apapa Port, Lagos",                    transitDays: "18–24"},
  "GH": { freightUSD: 3000, port: "Tema Port",                            transitDays: "17–22"},
  "SN": { freightUSD: 3400, port: "Port of Dakar",                        transitDays: "16–22"},
  "SA": { freightUSD: 4000, port: "Jeddah / Dammam",                      transitDays: "24–32"},
  "AE": { freightUSD: 4200, port: "Jebel Ali, Dubai",                     transitDays: "25–30"},
  "EG": { freightUSD: 3600, port: "Port of Alexandria / Port Said",       transitDays: "20–26"},
  "US": { freightUSD: 1800, port: "Miami / Houston / NY",                  transitDays: "4–8"  },
  "CA": { freightUSD: 2200, port: "Montreal / Vancouver",                  transitDays: "8–14" },
  "ES": { freightUSD: 3600, port: "Port of Barcelona / Valencia",         transitDays: "14–20"},
  "DE": { freightUSD: 4000, port: "Port of Hamburg / Bremen",             transitDays: "16–22"},
  "NL": { freightUSD: 4200, port: "Port of Rotterdam",                    transitDays: "16–22"},
  "IN": { freightUSD: 5000, port: "Nhava Sheva (Mumbai) / Chennai",       transitDays: "28–36"},
  "CN": { freightUSD: 5200, port: "Shanghai / Tianjin / Guangzhou",       transitDays: "32–40"},
};

// ─── Core engine functions ────────────────────────────────────────────────────

/**
 * Get all countries as an option list for dropdowns.
 * @returns {Array<{ id: string, label: string, port: string, region: string }>}
 */
export function getAllCountryOptions() {
  return WORLD_COUNTRIES.map(c => ({
    id: c.code,
    label: c.name,
    port: c.port || "",
    region: c.region || "",
    hasPresetFreight: !!PRESET_FREIGHT[c.code],
  }));
}

/**
 * Search countries by query string (name, port, code).
 * Wraps worldCountries.searchCountries with engine metadata.
 * @param {string} query
 * @returns {Array}
 */
export function searchWorldCountries(query) {
  if (!query || query.length < 1) return getAllCountryOptions().slice(0, 20);
  const results = searchCountries(query);
  return results.map(c => ({
    id: c.code,
    label: c.name,
    port: c.port || "",
    region: c.region || "",
    hasPresetFreight: !!PRESET_FREIGHT[c.code],
  }));
}

/**
 * Resolve export destination data for a country code.
 * Returns freight estimate (preset or regional), ports, transit days.
 *
 * @param {string} countryCode — ISO 3166-1 alpha-2 code OR "CUSTOM"
 * @param {{ customCountry?: string, customFreightUSD?: number, regionId?: string }} opts
 * @returns {object} destination data
 */
export function resolveExportDestination(countryCode, opts = {}) {
  const { customCountry, customFreightUSD, regionId } = opts;

  if (countryCode === "CUSTOM" || !countryCode) {
    const region = regionId ? REGION_FREIGHT_ESTIMATES[regionId] : null;
    const freight = customFreightUSD > 0 ? customFreightUSD : region?.freightUSD || 0;
    return {
      isCustom: true,
      countryCode: "CUSTOM",
      countryName: customCountry || "Custom Destination",
      port: "",
      freightUSD: freight,
      insurancePct: 0.004,
      transitDays: region?.transitDays || "—",
      region: regionId || "",
    };
  }

  const preset = PRESET_FREIGHT[countryCode];
  const country = WORLD_COUNTRIES.find(c => c.code === countryCode);
  const regionEst = country?.region ? REGION_FREIGHT_ESTIMATES[country.region] : null;

  const freightUSD = customFreightUSD > 0
    ? customFreightUSD
    : (preset?.freightUSD || regionEst?.freightUSD || 0);

  return {
    isCustom: false,
    countryCode,
    countryName: country?.name || countryCode,
    port: preset?.port || country?.port || "",
    freightUSD,
    insurancePct: 0.004,
    transitDays: preset?.transitDays || regionEst?.transitDays || "—",
    region: country?.region || "",
    hasPresetFreight: !!preset,
  };
}

/**
 * Calculate freight for a destination.
 */
export function calcDestinationFreight(countryCode, opts = {}) {
  const dest = resolveExportDestination(countryCode, opts);
  return dest.freightUSD;
}

/**
 * Calculate insurance (0.4% of FOB value, standard marine cargo).
 * @param {number} fobTotal
 * @param {number} insurancePct — default 0.004 (0.4%)
 */
export function calcMarineInsurance(fobTotal, insurancePct = 0.004) {
  if (!fobTotal || fobTotal <= 0) return 0;
  return Math.round(fobTotal * insurancePct);
}
