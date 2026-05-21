// Destination port catalog — keyed by country name as it appears in worldCountries.js
// Used by CommercialEngine to render a dynamic port selector after destination selection.

export const DESTINATION_PORTS = {
  "United Arab Emirates": ["Jebel Ali (Dubai)","Khalifa Port (Abu Dhabi)","Port Rashid (Dubai)","Fujairah Port"],
  "Saudi Arabia":          ["Jeddah Islamic Port","King Abdul Aziz Port — Dammam","Yanbu Commercial Port"],
  "China":                 ["Shanghai (SIPG)","Qingdao Port","Tianjin Xingang","Dalian Port","Zhanjiang Port","Guangzhou Nansha"],
  "Kuwait":                ["Shuwaikh Port","Shuaiba Industrial Port"],
  "Bahrain":               ["Khalifa Bin Salman Port"],
  "Qatar":                 ["Hamad Port","Doha Old Port"],
  "Oman":                  ["Port Sultan Qaboos — Muscat","Salalah Port","Sohar Industrial Port"],
  "Jordan":                ["Port of Aqaba"],
  "Iraq":                  ["Umm Qasr Port"],
  "Egypt":                 ["Port of Alexandria","Port Said","Damietta Port"],
  "Turkey":                ["Mersin Port","Derince Port — Kocaeli","Haydarpaşa — Istanbul","Izmir Port"],
  "Indonesia":             ["Tanjung Priok — Jakarta","Tanjung Perak — Surabaya","Belawan — Medan"],
  "Malaysia":              ["Port Klang","Penang Port","Johor Port"],
  "Singapore":             ["Port of Singapore (PSA)"],
  "Vietnam":               ["Cat Lai — Ho Chi Minh City","Cai Mep Int'l Terminal","Hai Phong Port"],
  "India":                 ["Nhava Sheva — Mumbai","Chennai Port","Mundra Port — Gujarat"],
  "Pakistan":              ["Karachi Port","Port Qasim"],
  "Philippines":           ["MICT — Manila","Batangas Port"],
  "South Korea":           ["Busan Port","Incheon Port"],
  "Japan":                 ["Kobe Port","Yokohama Port","Nagoya Port"],
  "Australia":             ["Port of Melbourne","Port Botany — Sydney","Fremantle — Perth"],
  "New Zealand":           ["Port of Auckland","Port of Tauranga"],
  "South Africa":          ["Port of Durban","Port of Cape Town"],
  "Kenya":                 ["Port of Mombasa"],
  "Tanzania":              ["Port of Dar es Salaam"],
  "Nigeria":               ["Apapa Port — Lagos","Tin Can Island Port"],
  "Ghana":                 ["Tema Port"],
  "Mozambique":            ["Port of Maputo","Port of Beira"],
  "Angola":                ["Port of Luanda"],
  "Morocco":               ["Tanger Med","Port of Casablanca"],
  "Algeria":               ["Port of Algiers","Port of Oran"],
  "Libya":                 ["Port of Tripoli","Port of Benghazi"],
  "Tunisia":               ["Radès Port — Tunis","Port of Sfax"],
  "Brazil":                ["Port of Santos","Port of Paranaguá","Port of Rio Grande","Port of Itajaí"],
  "Argentina":             ["Port of Buenos Aires","Port of Rosario","Port of San Lorenzo"],
  "Chile":                 ["Port of Valparaíso","Port of San Antonio","Port of Antofagasta"],
  "Colombia":              ["Port of Cartagena","Port of Buenaventura","Port of Barranquilla"],
  "Peru":                  ["Port of Callao"],
  "Mexico":                ["Port of Manzanillo","Port of Veracruz","Port of Altamira"],
  "Panama":                ["Balboa Port","Cristobal Port","Manzanillo Int'l Terminal"],
  "Spain":                 ["Port of Valencia","Port of Barcelona","Port of Algeciras"],
  "Netherlands":           ["Port of Rotterdam"],
  "Belgium":               ["Port of Antwerp","Port of Zeebrugge"],
  "Germany":               ["Port of Hamburg","Port of Bremen / Bremerhaven"],
  "France":                ["Port of Marseille","Port of Le Havre"],
  "Italy":                 ["Port of Genoa","Port of Gioia Tauro","Port of La Spezia"],
  "Greece":                ["Port of Piraeus","Port of Thessaloniki"],
  "Portugal":              ["Port of Sines","Port of Lisbon"],
  "United States":         ["Port of Los Angeles","Port of Long Beach","Port of New York / New Jersey","Port of Houston","Port of Savannah"],
  "Canada":                ["Port of Vancouver","Port of Montreal","Port of Halifax"],
  "Russia":                ["Port of Novorossiysk","Port of Vladivostok","Port of St. Petersburg"],
  "Israel":                ["Port of Ashdod","Port of Haifa"],
  "Iran":                  ["Bandar Abbas Port","Imam Khomeini Port"],
  "Kazakhstan":            ["Aktau Seaport (Caspian)"],
  "Ethiopia":              ["Port of Djibouti (gateway for landlocked)"],
};

/**
 * Get ports for a destination country.
 * Falls back to parsing the port string from worldCountries.js via the countryPort param.
 */
export function getPortsForCountry(countryName, fallbackPortString) {
  if (!countryName) return [];
  const exact = DESTINATION_PORTS[countryName];
  if (exact) return exact;
  // fuzzy match (e.g. "UAE" → "United Arab Emirates")
  const lower = countryName.toLowerCase();
  const fuzzy = Object.entries(DESTINATION_PORTS).find(([k]) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()));
  if (fuzzy) return fuzzy[1];
  // fallback: parse port string from worldCountries.js ("Port A / Port B")
  if (fallbackPortString) {
    return fallbackPortString.split(" / ").map(p => p.trim()).filter(Boolean);
  }
  return [];
}
