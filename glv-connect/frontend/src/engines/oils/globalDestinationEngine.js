/**
 * globalDestinationEngine.js — V8.1 Global Export Destination Engine
 *
 * V8.0 was region-limited. V8.1 supports ANY country / ANY port globally.
 * Regional presets from exportFreightEngine.js become DEFAULT MARKET PROFILES —
 * not hard limitations.
 *
 * New rules:
 *   - Any destination can be selected
 *   - Custom free-text country entry always allowed
 *   - Presets provide default freight/insurance estimates
 *   - Manual override always available for freight and insurance
 */

// ─── Global regions with default freight estimates ────────────────────────────
// freightUSD: estimated base ocean freight per 40HQ in USD
// insuranceRatio: decimal fraction of CIF value

export const GLOBAL_REGIONS = [
  { id: "Caribbean",   label: "Caribbean",       freightUSD: 1750, insuranceRatio: 0.0022, portSurcharge: 130 },
  { id: "Venezuela",   label: "Venezuela",        freightUSD: 1800, insuranceRatio: 0.0025, portSurcharge: 150 },
  { id: "LATAM_North", label: "LATAM — North",    freightUSD: 1900, insuranceRatio: 0.0022, portSurcharge: 140 },
  { id: "LATAM_South", label: "LATAM — South",    freightUSD: 2200, insuranceRatio: 0.0025, portSurcharge: 160 },
  { id: "West_Africa", label: "West Africa",      freightUSD: 2800, insuranceRatio: 0.0030, portSurcharge: 200 },
  { id: "East_Africa", label: "East Africa",      freightUSD: 3200, insuranceRatio: 0.0030, portSurcharge: 220 },
  { id: "North_Africa",label: "North Africa",     freightUSD: 2400, insuranceRatio: 0.0025, portSurcharge: 180 },
  { id: "MiddleEast",  label: "Middle East",      freightUSD: 2600, insuranceRatio: 0.0025, portSurcharge: 180 },
  { id: "SouthAsia",   label: "South Asia",       freightUSD: 3000, insuranceRatio: 0.0028, portSurcharge: 200 },
  { id: "SoutheastAsia",label:"Southeast Asia",   freightUSD: 3400, insuranceRatio: 0.0028, portSurcharge: 220 },
  { id: "NorthAmerica",label: "North America",    freightUSD: 2200, insuranceRatio: 0.0020, portSurcharge: 160 },
  { id: "Europe",      label: "Europe",           freightUSD: 2800, insuranceRatio: 0.0022, portSurcharge: 180 },
  { id: "Oceania",     label: "Oceania",           freightUSD: 4200, insuranceRatio: 0.0030, portSurcharge: 260 },
  { id: "Custom",      label: "Other / Custom",   freightUSD: 2500, insuranceRatio: 0.0025, portSurcharge: 150 },
];

// ─── Preset country profiles (from V8 exportFreightEngine — now soft defaults) ─

export const PRESET_DESTINATIONS = [
  { id: "Venezuela",         label: "Venezuela",          region: "Venezuela",   freightUSD: 1800, insuranceRatio: 0.0025, portSurcharge: 150 },
  { id: "DominicanRepublic", label: "Dominican Republic", region: "Caribbean",   freightUSD: 1600, insuranceRatio: 0.0020, portSurcharge: 120 },
  { id: "Jamaica",           label: "Jamaica",            region: "Caribbean",   freightUSD: 1750, insuranceRatio: 0.0022, portSurcharge: 130 },
  { id: "TrinidadTobago",    label: "Trinidad & Tobago",  region: "Caribbean",   freightUSD: 1900, insuranceRatio: 0.0022, portSurcharge: 140 },
  { id: "Guyana",            label: "Guyana",             region: "Caribbean",   freightUSD: 2000, insuranceRatio: 0.0025, portSurcharge: 150 },
  { id: "Barbados",          label: "Barbados",           region: "Caribbean",   freightUSD: 1850, insuranceRatio: 0.0022, portSurcharge: 130 },
  { id: "Curacao",           label: "Curacao",            region: "Caribbean",   freightUSD: 1700, insuranceRatio: 0.0020, portSurcharge: 120 },
  { id: "Aruba",             label: "Aruba",              region: "Caribbean",   freightUSD: 1700, insuranceRatio: 0.0020, portSurcharge: 120 },
  { id: "Haiti",             label: "Haiti",              region: "Caribbean",   freightUSD: 1650, insuranceRatio: 0.0025, portSurcharge: 130 },
  { id: "Colombia",          label: "Colombia",           region: "LATAM_North", freightUSD: 1500, insuranceRatio: 0.0020, portSurcharge: 110 },
  { id: "Panama",            label: "Panama",             region: "LATAM_North", freightUSD: 1400, insuranceRatio: 0.0018, portSurcharge: 100 },
  { id: "Ecuador",           label: "Ecuador",            region: "LATAM_North", freightUSD: 1600, insuranceRatio: 0.0020, portSurcharge: 120 },
  { id: "Peru",              label: "Peru",               region: "LATAM_South", freightUSD: 2000, insuranceRatio: 0.0022, portSurcharge: 140 },
  { id: "Chile",             label: "Chile",              region: "LATAM_South", freightUSD: 2400, insuranceRatio: 0.0022, portSurcharge: 160 },
  { id: "Brazil",            label: "Brazil",             region: "LATAM_South", freightUSD: 2100, insuranceRatio: 0.0022, portSurcharge: 150 },
  { id: "Nigeria",           label: "Nigeria",            region: "West_Africa", freightUSD: 2800, insuranceRatio: 0.0030, portSurcharge: 200 },
  { id: "Ghana",             label: "Ghana",              region: "West_Africa", freightUSD: 2900, insuranceRatio: 0.0030, portSurcharge: 210 },
  { id: "SenegalWAfrica",    label: "Senegal",            region: "West_Africa", freightUSD: 2700, insuranceRatio: 0.0030, portSurcharge: 190 },
  { id: "SaudiArabia",       label: "Saudi Arabia",       region: "MiddleEast",  freightUSD: 2600, insuranceRatio: 0.0025, portSurcharge: 180 },
  { id: "UAE",               label: "United Arab Emirates",region:"MiddleEast",  freightUSD: 2700, insuranceRatio: 0.0025, portSurcharge: 185 },
  { id: "Egypt",             label: "Egypt",              region: "North_Africa",freightUSD: 2400, insuranceRatio: 0.0025, portSurcharge: 175 },
  { id: "USA",               label: "United States",      region: "NorthAmerica",freightUSD: 2200, insuranceRatio: 0.0020, portSurcharge: 160 },
  { id: "Canada",            label: "Canada",             region: "NorthAmerica",freightUSD: 2300, insuranceRatio: 0.0020, portSurcharge: 165 },
  { id: "Spain",             label: "Spain",              region: "Europe",      freightUSD: 2600, insuranceRatio: 0.0022, portSurcharge: 170 },
  { id: "Germany",           label: "Germany",            region: "Europe",      freightUSD: 2800, insuranceRatio: 0.0022, portSurcharge: 180 },
  { id: "Netherlands",       label: "Netherlands",        region: "Europe",      freightUSD: 2750, insuranceRatio: 0.0022, portSurcharge: 175 },
  { id: "India",             label: "India",              region: "SouthAsia",   freightUSD: 3000, insuranceRatio: 0.0028, portSurcharge: 200 },
  { id: "China",             label: "China",              region: "SoutheastAsia",freightUSD:3200, insuranceRatio: 0.0028, portSurcharge: 210 },
  { id: "Custom",            label: "Other Country (custom)", region: "Custom",  freightUSD: 2500, insuranceRatio: 0.0025, portSurcharge: 150 },
];

// ─── Destination resolver ─────────────────────────────────────────────────────

/**
 * Resolve freight parameters for a destination.
 * If destinationId matches a preset, use its values.
 * If custom, uses region fallback.
 * Always allows manual override via customFreightUSD.
 *
 * @param {string} destinationId
 * @param {string} [customCountry]      — free-text country name for "Custom"
 * @param {number} [customFreightUSD]   — manual override for freight
 * @param {string} [regionId]           — region for custom entries
 * @returns {{ freightUSD, insuranceRatio, portSurcharge, label, isCustom }}
 */
export function resolveDestination(destinationId, { customCountry = "", customFreightUSD = 0, regionId = "" } = {}) {
  const preset = PRESET_DESTINATIONS.find(d => d.id === destinationId);
  if (preset && destinationId !== "Custom") {
    return {
      ...preset,
      isCustom:    false,
      effectiveFreightUSD: customFreightUSD > 0 ? customFreightUSD : preset.freightUSD,
    };
  }

  // Custom or unknown — fall back to region profile
  const region = GLOBAL_REGIONS.find(r => r.id === regionId) || GLOBAL_REGIONS.find(r => r.id === "Custom");
  return {
    id:             destinationId || "Custom",
    label:          customCountry || "Custom Destination",
    region:         regionId || "Custom",
    freightUSD:     region?.freightUSD     || 2500,
    insuranceRatio: region?.insuranceRatio || 0.0025,
    portSurcharge:  region?.portSurcharge  || 150,
    isCustom:       true,
    effectiveFreightUSD: customFreightUSD > 0 ? customFreightUSD : (region?.freightUSD || 2500),
  };
}

/**
 * Calculate total container freight for a resolved destination.
 */
export function calcGlobalContainerFreight(destinationId, opts = {}) {
  const dest = resolveDestination(destinationId, opts);
  const base = dest.effectiveFreightUSD + dest.portSurcharge;
  return parseFloat(base.toFixed(2));
}

/**
 * Calculate insurance on a FOB value for a destination.
 */
export function calcGlobalInsurance(fobTotalUSD, destinationId, opts = {}) {
  const dest = resolveDestination(destinationId, opts);
  return parseFloat((fobTotalUSD * dest.insuranceRatio).toFixed(2));
}

/**
 * Get grouped preset list for UI dropdown.
 * Returns presets sorted by region, with custom at bottom.
 */
export function getPresetDestinationOptions() {
  return PRESET_DESTINATIONS;
}

/**
 * Check if a destination has preset freight data.
 */
export function hasPresetFreight(destinationId) {
  return PRESET_DESTINATIONS.some(d => d.id === destinationId && d.id !== "Custom");
}
