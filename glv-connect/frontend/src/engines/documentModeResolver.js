/**
 * documentModeResolver.js — Document Intelligence Mode Router V1.0
 *
 * Maps a document's category and configuration to an isolated rendering mode.
 * Each mode controls: terminology, section visibility, technical fields,
 * certifications, timeline, and media rules.
 *
 * Modes:
 *   BULK_GRAINS_MODE         — cereals, oilseeds, bulk agricultural commodities
 *   RETAIL_OILS_MODE         — bottled/pouched edible oils (PET, glass, pouch)
 *   FLEXITANK_MODE           — bulk liquid oil in flexitank / ISO tank
 *   INDUSTRIAL_OILS_MODE     — jerrycan, drum, IBC — industrial foodservice supply
 *   LIVE_ANIMALS_MODE        — livestock (sheep, cattle, goats)
 *   FROZEN_PRODUCTS_MODE     — frozen meat, seafood, frozen goods
 *   CUSTOM_PRIVATE_LABEL_MODE — custom formulation / OEM / private label
 *   GENERAL_FOOD_MODE        — default (fruits, vegetables, processed food)
 *
 * Safety contract: never throws, never returns undefined.
 */

import {
  LIVE_ANIMAL_CATEGORIES,
  FROZEN_CATEGORIES,
  FRUIT_CATEGORIES,
  GRAIN_CATEGORIES,
} from "./categoryEngine.js";
import { PRODUCT_CATEGORIES } from "../config/productCategories.js";

// ─── Mode constants ────────────────────────────────────────────────────────────

export const DOCUMENT_MODES = Object.freeze({
  BULK_GRAINS:          "BULK_GRAINS_MODE",
  RETAIL_OILS:          "RETAIL_OILS_MODE",
  FLEXITANK:            "FLEXITANK_MODE",
  INDUSTRIAL_OILS:      "INDUSTRIAL_OILS_MODE",
  LIVE_ANIMALS:         "LIVE_ANIMALS_MODE",
  FROZEN_PRODUCTS:      "FROZEN_PRODUCTS_MODE",
  CUSTOM_PRIVATE_LABEL: "CUSTOM_PRIVATE_LABEL_MODE",
  GENERAL_FOOD:         "GENERAL_FOOD_MODE",
});

// ─── Packaging type sets for OILS sub-classification ─────────────────────────

const OILS_RETAIL_PKG = new Set([
  "PET_BOTTLE","GLASS_BOTTLE","TETRA_PAK","DOYPACK","SACHET",
  "RETAIL_POUCH","PILLOW_POUCH","STAND_UP_POUCH","SPOUT_POUCH",
  "GUSSET_POUCH","SIDE_SEAL_POUCH","BAG_IN_BOX","RETAIL_DOYPACK",
  "PREMIUM_BOTTLE","CAN_TIN","PLASTIC_GALLON",
]);

const OILS_FLEXITANK_PKG = new Set(["FLEXITANK","ISO_TANK","BULK_VESSEL"]);

const OILS_INDUSTRIAL_PKG = new Set(["IBC_1000L","DRUM_200L","JERRYCAN_20L","JERRYCAN_10L","JERRYCAN_5L"]);

// ─── Mode resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve the document rendering mode from the first CommercialEngine row.
 * @param {object} firstCdRow — sanitized first CommercialEngine row
 * @param {object} doc        — document object
 * @returns {string}           — one of DOCUMENT_MODES values
 */
export function resolveDocumentMode(firstCdRow = {}, doc = {}) {
  try {
    const cat = (firstCdRow.category || "").toUpperCase();

    if (LIVE_ANIMAL_CATEGORIES.has(cat)) return DOCUMENT_MODES.LIVE_ANIMALS;

    if (cat === "OILS") {
      const pkg = (firstCdRow.oilsConfig?.packagingType || "").toUpperCase();
      if (OILS_FLEXITANK_PKG.has(pkg))   return DOCUMENT_MODES.FLEXITANK;
      if (OILS_INDUSTRIAL_PKG.has(pkg))  return DOCUMENT_MODES.INDUSTRIAL_OILS;
      return DOCUMENT_MODES.RETAIL_OILS; // default: retail oil (PET / pouch)
    }

    if (GRAIN_CATEGORIES.has(cat)) return DOCUMENT_MODES.BULK_GRAINS;

    if (FROZEN_CATEGORIES.has(cat)) return DOCUMENT_MODES.FROZEN_PRODUCTS;

    if (FRUIT_CATEGORIES.has(cat)) return DOCUMENT_MODES.GENERAL_FOOD;

    // Custom / OEM / private label
    if (doc.product === "Otro" || doc.custom_product_name || doc.customProductName) {
      return DOCUMENT_MODES.CUSTOM_PRIVATE_LABEL;
    }

    return DOCUMENT_MODES.GENERAL_FOOD;
  } catch {
    return DOCUMENT_MODES.GENERAL_FOOD;
  }
}

// ─── Executive category labels ─────────────────────────────────────────────────

// UTF-8 NOTE: All label strings use direct UTF-8 encoding.
// @react-pdf/renderer built-in fonts (Helvetica/WinAnsi) support the full Latin-1
// + Windows-1252 range, which covers all Spanish/Portuguese/English characters
// used here (a-z, A-Z, 0-9, plus aá eé ií oó uú nñ uü).
// NEVER use HTML entities or escape sequences — always embed the literal UTF-8 glyph.
const CATEGORY_LABELS = {
  OILS:                    { es: "Programa de Exportación de Aceites Vegetales", en: "Vegetable Oils Export Program" },
  LIVE_ANIMALS:            { es: "Programa de Exportación Animal",               en: "Live Animal Export Program" },
  COMMODITIES:             { es: "Programa de Commodities Agrícolas",            en: "Agricultural Commodities Program" },
  GRAINS:                  { es: "Programa de Commodities Agrícolas",            en: "Agricultural Commodities Program" },
  BEANS:                   { es: "Programa de Legumbres de Exportación",         en: "Export Legumes Program" },
  LENTILS:                 { es: "Programa de Lentejas",                              en: "Lentils Export Program" },
  CHICKPEAS:               { es: "Programa de Garbanzos",                             en: "Chickpeas Export Program" },
  ANIMAL_FEED:             { es: "Programa de Alimento Animal",                       en: "Animal Feed Program" },
  FROZEN_MEAT:             { es: "Productos Cárnicos Congelados",                en: "Frozen Meat Products" },
  FROZEN_POULTRY:          { es: "Productos Avícolas Congelados",                en: "Frozen Poultry Products" },
  FRUIT_PRODUCTS:          { es: "Productos Frutícolas Congelados",              en: "Frozen Fruit Products" },
  COLOMBIAN_EXOTIC_FRUITS: { es: "Frutas Exóticas Colombianas",                  en: "Colombian Exotic Fruits" },
  CANNED_MEAT:             { es: "Carne en Conserva",                                 en: "Canned Meat Products" },
  EGGS:                    { es: "Programa de Exportación de Huevos",            en: "Export Eggs Program" },
};

/**
 * Get an executive-quality display label for a category.
 * Replaces raw DB values like "LIVE_ANIMALS" with professional terminology.
 */
export function getCategoryDisplayLabel(category = "", lang = "es") {
  const entry = CATEGORY_LABELS[category.toUpperCase()];
  if (entry) return entry[lang] || entry.es;
  // Fallback: clean underscores and capitalize
  return category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "—";
}

// ─── Product-level identity (Phase 3D — product identity correction) ──────────
// A document must always represent the actual commercial product (e.g. CATTLE,
// PALM_OIL) rather than the broader category it belongs to (e.g. LIVE_ANIMALS,
// OILS). Category-level labels above are used ONLY when no product is selected.

// Livestock trade terminology — the species, not the generic category, is the
// commercially correct term for an export program title (BOVINE/OVINE/CAPRINE).
const LIVESTOCK_PROGRAM_LABELS = {
  CATTLE: { es: "Programa de Exportación Bovina",  en: "Bovine Export Program" },
  SHEEP:  { es: "Programa de Exportación Ovina",   en: "Live Sheep Export Program" },
  GOAT:   { es: "Programa de Exportación Caprina", en: "Caprine Export Program" },
};

const LIVESTOCK_IDENTITY_TAGS = {
  CATTLE: { es: "EXPORTACIÓN BOVINA",  en: "BOVINE EXPORT" },
  SHEEP:  { es: "EXPORTACIÓN OVINA",   en: "OVINE EXPORT" },
  GOAT:   { es: "EXPORTACIÓN CAPRINA", en: "CAPRINE EXPORT" },
};

const LIVESTOCK_SHORT_NAMES = {
  CATTLE: { es: "Ganado Bovino en Pie", en: "Live Bovine Cattle" },
  SHEEP:  { es: "Ovinos en Pie",        en: "Live Sheep" },
  GOAT:   { es: "Caprinos en Pie",      en: "Live Goats" },
};

/**
 * Resolve the cover/program-level title for a document. Uses the product's
 * trade terminology when one exists; falls back to the category label only
 * when no product code is present or no product-level mapping exists.
 */
export function getProductDisplayLabel(category = "", productCode = "", lang = "es") {
  const code = (productCode || "").toUpperCase();
  if (LIVESTOCK_PROGRAM_LABELS[code]) {
    return LIVESTOCK_PROGRAM_LABELS[code][lang] || LIVESTOCK_PROGRAM_LABELS[code].es;
  }
  const prodLabel = PRODUCT_CATEGORIES[category]?.products?.[code]?.label;
  if (prodLabel) return prodLabel[lang] || prodLabel.es || prodLabel.en;
  return getCategoryDisplayLabel(category, lang);
}

/**
 * Resolve the short identity-bar tag (e.g. "BOVINE EXPORT"). Returns null
 * when no product-level tag exists so callers can keep their existing
 * category-level tag as a fallback — never block rendering.
 */
export function getProductIdentityTag(productCode = "", lang = "es") {
  const code = (productCode || "").toUpperCase();
  const entry = LIVESTOCK_IDENTITY_TAGS[code];
  return entry ? (entry[lang] || entry.es) : null;
}

/**
 * Resolve a short, body-friendly product name (e.g. "Live Bovine Cattle").
 * Falls back to the product master's catalog label, then null.
 */
export function getProductShortName(category = "", productCode = "", lang = "es") {
  const code = (productCode || "").toUpperCase();
  if (LIVESTOCK_SHORT_NAMES[code]) {
    return LIVESTOCK_SHORT_NAMES[code][lang] || LIVESTOCK_SHORT_NAMES[code].es;
  }
  const prodLabel = PRODUCT_CATEGORIES[category]?.products?.[code]?.label;
  if (prodLabel) return prodLabel[lang] || prodLabel.es || prodLabel.en;
  return null;
}

// ─── Mode-specific product descriptions ────────────────────────────────────────

export function getModeProductDescription(mode, firstCdRow = {}, doc = {}, lang = "es") {
  const oilsConfig = firstCdRow.oilsConfig || {};

  if (mode === DOCUMENT_MODES.LIVE_ANIMALS) {
    return lang === "en"
      ? "Live animals sourced from registered, export-certified facilities. All animals meet international sanitary requirements and are certified by competent zoo-sanitary authorities in the country of origin."
      : "Animales vivos procedentes de establecimientos registrados y habilitados para exportación. Los animales cumplen con todos los requisitos sanitarios internacionales y son certificados por autoridades zoosanitarias competentes del país de origen.";
  }

  if (mode === DOCUMENT_MODES.BULK_GRAINS) {
    return lang === "en"
      ? "High-quality bulk agricultural commodity. Moisture, protein, and aflatoxin analysis within international export standards. Fumigation and phytosanitary treatment included."
      : "Producto agrícola a granel de alta calidad. Análisis de humedad, proteína y aflatoxinas dentro de los estándares internacionales de exportación. Fumigación y tratamiento fitosanitario incluidos.";
  }

  if (mode === DOCUMENT_MODES.RETAIL_OILS) {
    const oilType = oilsConfig.productId ? oilsConfig.productId.replace(/_/g, " ") : (lang === "en" ? "Edible Oil" : "Aceite Comestible");
    return lang === "en"
      ? `${oilType} — food-grade, certified origin, export-ready retail packaging. Product meets international food safety standards and is suitable for retail and foodservice distribution.`
      : `${oilType} — grado alimenticio, origen certificado, empaque retail listo para exportación. El producto cumple con los estándares internacionales de inocuidad alimentaria y es apto para distribución retail y foodservice.`;
  }

  if (mode === DOCUMENT_MODES.FLEXITANK) {
    const oilType = oilsConfig.productId ? oilsConfig.productId.replace(/_/g, " ") : (lang === "en" ? "Edible Oil" : "Aceite Comestible");
    return lang === "en"
      ? `${oilType} — bulk export via flexitank / ISO tank. Food-grade certified, continuous-flow supply chain. Suitable for industrial refinery, food manufacturing, and HORECA distribution.`
      : `${oilType} — exportación a granel vía flexitank / ISO tank. Certificado grado alimenticio, cadena de suministro de flujo continuo. Apto para refinería industrial, manufactura de alimentos y distribución HORECA.`;
  }

  if (mode === DOCUMENT_MODES.INDUSTRIAL_OILS) {
    const oilType = oilsConfig.productId ? oilsConfig.productId.replace(/_/g, " ") : (lang === "en" ? "Edible Oil" : "Aceite Comestible");
    return lang === "en"
      ? `${oilType} — industrial packaging (jerrycan / drum / IBC). Food-grade certified for HORECA, foodservice, and institutional bulk supply.`
      : `${oilType} — empaque industrial (jerrycan / bidón / IBC). Certificado grado alimenticio para HORECA, foodservice y suministro institucional a granel.`;
  }

  if (mode === DOCUMENT_MODES.FROZEN_PRODUCTS) {
    return lang === "en"
      ? "Frozen export product, maintained under continuous cold chain from processing to destination port. Meets international food safety and cold chain standards."
      : "Producto congelado de exportación, mantenido bajo cadena de frío continua desde el procesamiento hasta el puerto de destino. Cumple con los estándares internacionales de inocuidad y cadena de frío.";
  }

  if (mode === DOCUMENT_MODES.CUSTOM_PRIVATE_LABEL) {
    return lang === "en"
      ? "The Buyer acknowledges that the final technical specifications, formulations, packaging structure, and production parameters shall be governed by the mutually approved Product Technical Specification Sheet submitted during the SPA execution process."
      : "El Comprador reconoce que las especificaciones técnicas finales, formulaciones, estructura de empaque y parámetros de producción serán regidos por la Hoja de Especificaciones Técnicas del Producto aprobada mutuamente durante el proceso de ejecución del SPA.";
  }

  // GENERAL_FOOD default
  return lang === "en"
    ? "Export food product meeting international quality and food safety standards established by GLV Global Food Services LLC."
    : "Producto alimenticio de exportación que cumple con los estándares de calidad e inocuidad internacional establecidos por GLV Global Food Services LLC.";
}

// ─── Mode-specific certifications ─────────────────────────────────────────────

export function getModeCertifications(mode, lang = "es") {
  if (mode === DOCUMENT_MODES.LIVE_ANIMALS) {
    return lang === "en"
      ? "• Official zoo-sanitary certificate (exporting country)\n• Halal certificate — internationally recognized authority\n• SGS live weight and quantity certificate\n• Official veterinary health declaration for the lot\n• Quarantine period approval certificate\n• Lot vaccination and disease-free certificate"
      : "• Certificado zoosanitario oficial del país exportador\n• Certificado Halal — autoridad reconocida internacionalmente\n• Certificado SGS de peso vivo y cantidad\n• Declaración oficial de salud del lote por médico veterinario\n• Aprobación del período de cuarentena\n• Certificado de vacunación y libre de enfermedades del lote";
  }

  if (mode === DOCUMENT_MODES.BULK_GRAINS) {
    return lang === "en"
      ? "• Official phytosanitary export certificate\n• Certificate of origin\n• SGS quality and weight inspection at load port\n• Non-GMO declaration (or GMO status certificate)\n• Fumigation and treatment certificate\n• Moisture and quality analysis report"
      : "• Certificado fitosanitario oficial de exportación\n• Certificado de origen\n• Inspección SGS de calidad y peso en puerto de carga\n• Declaración no-GMO (o certificado de estado GMO)\n• Certificado de fumigación y tratamiento\n• Informe de análisis de humedad y calidad";
  }

  if (mode === DOCUMENT_MODES.RETAIL_OILS || mode === DOCUMENT_MODES.FLEXITANK || mode === DOCUMENT_MODES.INDUSTRIAL_OILS) {
    return lang === "en"
      ? "• Food-grade quality certificate\n• Certificate of origin\n• SGS quality and quantity inspection at loading\n• Non-GMO declaration\n• Shelf life and storage conditions certificate\n• Kosher / Halal certificate (when applicable per buyer requirements)"
      : "• Certificado de calidad grado alimenticio\n• Certificado de origen\n• Inspección SGS de calidad y cantidad en carga\n• Declaración de no-GMO\n• Certificado de vida útil y condiciones de almacenamiento\n• Certificado Kosher / Halal (cuando aplica según requerimiento del comprador)";
  }

  if (mode === DOCUMENT_MODES.FROZEN_PRODUCTS) {
    return lang === "en"
      ? "• Veterinary/sanitary export certificate\n• Certificate of origin\n• Cold chain compliance certificate\n• SGS quality and weight inspection\n• Plant HACCP certification\n• Lot traceability documentation"
      : "• Certificado veterinario / sanitario de exportación\n• Certificado de origen\n• Certificado de cumplimiento de cadena de frío\n• Inspección SGS de calidad y peso\n• Certificación HACCP de la planta\n• Documentación de trazabilidad del lote";
  }

  // GENERAL_FOOD / CUSTOM_PRIVATE_LABEL default
  return lang === "en"
    ? "• Official certificate of origin\n• Sanitary / phytosanitary export certificate\n• SGS inspection (or agreed equivalent)\n• Lot traceability documentation"
    : "• Certificado de origen oficial\n• Certificado sanitario / fitosanitario de exportación\n• Inspección SGS (o equivalente acordado)\n• Documentación de trazabilidad del lote";
}

// ─── Mode-specific operational timeline ───────────────────────────────────────

export function getModeTimeline(mode, lang = "es") {
  if (mode === DOCUMENT_MODES.LIVE_ANIMALS) {
    return lang === "en"
      ? "Week 1–2: Contract signing (SPA) and advance payment\nWeek 3–6: Lot selection and concentration at origin\nWeek 7–10: Official quarantine period (minimum 21 days)\nWeek 11: SGS inspection, certification and SBLC activation\nWeek 12: Loading on specialized livestock vessel\nWeek 13–16: Maritime transit to CFR destination\nWeek 16+: Port delivery and final settlement"
      : "Semana 1–2: Firma de contrato (SPA) y pago del anticipo\nSemana 3–6: Selección y concentración del lote en origen\nSemana 7–10: Período de cuarentena oficial (mínimo 21 días)\nSemana 11: Inspección SGS, certificación y activación de SBLC\nSemana 12: Embarque en buque ganadero especializado\nSemana 13–16: Tránsito marítimo hacia destino CFR\nSemana 16+: Entrega en puerto y liquidación final";
  }

  if (mode === DOCUMENT_MODES.BULK_GRAINS) {
    return lang === "en"
      ? "Week 1: Contract signing and documentary advance payment\nWeek 2–3: Crop selection and concentration at origin silo\nWeek 4: SGS quality and weight inspection at load port\nWeek 5–6: Vessel loading and departure from origin\nWeek 6+: Maritime transit and CFR delivery at destination port"
      : "Semana 1: Firma de contrato y anticipo documental\nSemana 2–3: Selección de cosecha y concentración en silo de origen\nSemana 4: Inspección SGS de calidad y peso en puerto de carga\nSemana 5–6: Carga del buque y zarpe desde origen\nSemana 6+: Tránsito marítimo y entrega CFR en puerto destino";
  }

  if (mode === DOCUMENT_MODES.FLEXITANK) {
    return lang === "en"
      ? "Week 1: Contract signing and payment confirmation\nWeek 2: Flexitank / ISO tank allocation and production order\nWeek 3: Quality inspection and food-grade certification at origin\nWeek 4: Loading, sealing, and export clearance\nWeek 5+: Maritime transit and CFR/FOB delivery at destination port"
      : "Semana 1: Firma de contrato y confirmación de pago\nSemana 2: Asignación de flexitank / ISO tank y orden de producción\nSemana 3: Inspección de calidad y certificación grado alimenticio en origen\nSemana 4: Carga, sellado y despacho aduanero de exportación\nSemana 5+: Tránsito marítimo y entrega CFR/FOB en puerto destino";
  }

  if (mode === DOCUMENT_MODES.RETAIL_OILS || mode === DOCUMENT_MODES.INDUSTRIAL_OILS) {
    return lang === "en"
      ? "Week 1: Contract signing and advance payment confirmation\nWeek 2–3: Production scheduling and packaging allocation at origin\nWeek 4: Quality inspection and food-grade certification\nWeek 5: Loading at origin and export customs clearance\nWeek 6+: Maritime transit and CFR/FOB delivery to destination port"
      : "Semana 1: Firma de contrato y confirmación de anticipo\nSemana 2–3: Programación de producción y asignación de empaque en origen\nSemana 4: Inspección de calidad y certificación grado alimenticio\nSemana 5: Carga en origen y despacho aduanero de exportación\nSemana 6+: Tránsito marítimo y entrega CFR/FOB en puerto destino";
  }

  if (mode === DOCUMENT_MODES.FROZEN_PRODUCTS) {
    return lang === "en"
      ? "Week 1: Contract signing and advance payment\nWeek 2: Production scheduling and cold-chain allocation\nWeek 3: Processing, packaging, and refrigeration certification\nWeek 4: SGS inspection and reefer container loading\nWeek 5+: Maritime transit under continuous cold chain to destination port"
      : "Semana 1: Firma de contrato y pago del anticipo\nSemana 2: Programación de producción y asignación de cadena de frío\nSemana 3: Procesamiento, empaque y certificación de refrigeración\nSemana 4: Inspección SGS y carga en contenedor reefer\nSemana 5+: Tránsito marítimo bajo cadena de frío continua hasta puerto destino";
  }

  // GENERAL_FOOD / CUSTOM_PRIVATE_LABEL default
  return lang === "en"
    ? "Week 1: Contract signing and advance payment\nWeek 2–3: Lot preparation and consolidation\nWeek 4: Quality inspection and certifications\nWeek 5: Loading and dispatch at origin\nWeek 6+: Maritime transit and CFR delivery at destination"
    : "Semana 1: Firma de contrato y pago del anticipo\nSemana 2–3: Preparación y consolidación del lote\nSemana 4: Inspección de calidad y certificaciones\nSemana 5: Carga y despacho en origen\nSemana 6+: Tránsito marítimo y entrega CFR en destino";
}

// ─── Mode-specific mandatory information ──────────────────────────────────────

export function getModeMandatoryInfo(mode, lang = "es") {
  if (mode === DOCUMENT_MODES.LIVE_ANIMALS) {
    return lang === "en"
      ? "MANDATORY INFORMATION — LIVE ANIMALS:\n• All shipments comply with the OIE Terrestrial Animal Health Code\n• Vessels used are specialized livestock carriers with certified ventilation systems\n• Sexual composition of the lot shall be certified by an official veterinarian\n• The buyer is responsible for obtaining import permits in the destination country\n• Animals are certified free of notifiable diseases\n• TRANSIT MORTALITY: Invoicing is based on the certified loaded quantity at origin. Any mortality during transport is the buyer's sole responsibility and must be covered by their live cargo insurance policy. The seller applies no commercial deduction for transit mortality."
      : "INFORMACIÓN MANDATORIA — ANIMALES VIVOS:\n• Todos los embarques cumplen con el Código Sanitario para los Animales Terrestres de la OIE\n• Los buques utilizados son especializados en transporte de ganado vivo con sistema de ventilación certificado\n• La composición sexual del lote será certificada por veterinario oficial\n• El comprador es responsable de gestionar los permisos de importación en el país destino\n• Los animales son certificados libres de enfermedades de declaración obligatoria\n• MORTALIDAD EN TRÁNSITO: La facturación se realiza sobre la cantidad cargada certificada en origen. Cualquier mortalidad durante el transporte es responsabilidad exclusiva del comprador y deberá estar cubierta por su póliza de seguro de carga viva. El vendedor no aplica deducción comercial por mortalidad en tránsito.";
  }

  if (mode === DOCUMENT_MODES.BULK_GRAINS) {
    return lang === "en"
      ? "MANDATORY INFORMATION — GRAINS & CEREALS:\n• Product free of GMOs not authorized at the destination country\n• Maximum moisture content guaranteed per contract specifications\n• Free of pests and contaminants per Codex Alimentarius standards\n• Fumigation and phytosanitary treatment included in CFR price\n• Final weight and quality determined by SGS at load port — bill of lading quantity is binding"
      : "INFORMACIÓN MANDATORIA — GRANOS Y CEREALES:\n• Producto libre de organismos genéticamente modificados no autorizados en el país destino\n• Humedad máxima garantizada según especificaciones del contrato\n• Libre de plagas y contaminantes según normativa Codex Alimentarius\n• Fumigación y tratamiento fitosanitario incluidos en el precio CFR\n• El peso y calidad finales son determinados por SGS en puerto de carga — la cantidad del conocimiento de embarque es vinculante";
  }

  return null;
}

// ─── Mode-specific cover badge text ───────────────────────────────────────────

const MODE_COVER_LABELS = {
  BULK_GRAINS_MODE:          { es: "Granos y Cereales",            en: "Grains & Cereals" },
  RETAIL_OILS_MODE:          { es: "Aceites Comestibles — Retail", en: "Edible Oils — Retail" },
  FLEXITANK_MODE:            { es: "Aceite a Granel — Flexitank",  en: "Bulk Oil — Flexitank" },
  INDUSTRIAL_OILS_MODE:      { es: "Aceite Industrial — Jerrycan", en: "Industrial Oil — Jerrycan" },
  LIVE_ANIMALS_MODE:         { es: "Animales Vivos",               en: "Live Animals" },
  FROZEN_PRODUCTS_MODE:      { es: "Productos Congelados",         en: "Frozen Products" },
  CUSTOM_PRIVATE_LABEL_MODE: { es: "Formulación Privada / OEM",   en: "Private Label / OEM" },
  GENERAL_FOOD_MODE:         { es: "Productos Alimenticios",       en: "Food Products" },
};

export function getModeCoverLabel(mode, lang = "es") {
  const entry = MODE_COVER_LABELS[mode];
  if (!entry) return "";
  return entry[lang] || entry.es;
}
