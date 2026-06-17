/**
 * ProductIntelligenceRegistry.js — GLV GOS Core — Product Intelligence Layer V1.0
 *
 * Per-product content profiles that replace category/mode-level generic text
 * with product-specific descriptions, certifications, logistics, timelines,
 * and executive narratives.
 *
 * Resolution chain: Product → Category → Mode → Default
 * Backward compatible — products without profiles fall back to existing
 * mode-level functions in documentModeResolver.js.
 *
 * STATUS: ACTIVE — 11 priority product profiles implemented.
 */

import {
  getModeProductDescription,
  getModeCertifications,
  getModeTimeline,
  getModeMandatoryInfo,
  resolveDocumentMode,
  DOCUMENT_MODES,
} from "../../engines/documentModeResolver.js";

// ─── Certification Metadata ────────────────────────────────────────────────────

export const CERTIFICATION_CATALOG = Object.freeze({
  ZOO_SANITARY:       { es: "Certificado zoosanitario oficial del país exportador",                   en: "Official zoo-sanitary certificate (exporting country)",        badge: "ZOO-SANITARY",    color: "#7c3aed", scope: "ANIMAL" },
  HALAL:              { es: "Certificado Halal — autoridad reconocida internacionalmente",            en: "Halal certificate — internationally recognized authority",      badge: "HALAL",           color: "#059669", scope: "ANIMAL" },
  SGS_LIVE_WEIGHT:    { es: "Certificado SGS de peso vivo y cantidad",                               en: "SGS live weight and quantity certificate",                     badge: "SGS",             color: "#1e40af", scope: "ANIMAL" },
  VETERINARY_HEALTH:  { es: "Declaración oficial de salud veterinaria del lote",                     en: "Official veterinary health declaration for the lot",            badge: "VETERINARY",      color: "#7c3aed", scope: "ANIMAL" },
  QUARANTINE:         { es: "Aprobación del período de cuarentena",                                  en: "Quarantine period approval certificate",                       badge: "QUARANTINE",      color: "#b45309", scope: "ANIMAL" },
  VACCINATION:        { es: "Certificado de vacunación y libre de enfermedades del lote",            en: "Lot vaccination and disease-free certificate",                 badge: "VACCINATION",     color: "#dc2626", scope: "ANIMAL" },
  ANIMAL_WELFARE:     { es: "Certificado de bienestar animal en transporte",                         en: "Animal welfare in transport certificate",                      badge: "WELFARE",         color: "#0e7490", scope: "ANIMAL" },
  BREED_CERTIFICATE:  { es: "Certificado de raza y registro genealógico",                            en: "Breed certificate and genealogical registry",                  badge: "BREED",           color: "#6d28d9", scope: "ANIMAL" },

  FOOD_GRADE:         { es: "Certificado de calidad grado alimenticio",                              en: "Food-grade quality certificate",                               badge: "FOOD-GRADE",      color: "#059669", scope: "FOOD" },
  ORIGIN:             { es: "Certificado de origen",                                                 en: "Certificate of origin",                                        badge: "ORIGIN",          color: "#1e40af", scope: "UNIVERSAL" },
  SGS_QUALITY:        { es: "Inspección SGS de calidad y cantidad en carga",                         en: "SGS quality and quantity inspection at loading",                badge: "SGS",             color: "#1e40af", scope: "UNIVERSAL" },
  NON_GMO:            { es: "Declaración de no-GMO",                                                 en: "Non-GMO declaration",                                          badge: "NON-GMO",         color: "#16a34a", scope: "AGRICULTURE" },
  SHELF_LIFE:         { es: "Certificado de vida útil y condiciones de almacenamiento",              en: "Shelf life and storage conditions certificate",                badge: "SHELF-LIFE",      color: "#0e7490", scope: "FOOD" },
  KOSHER_HALAL:       { es: "Certificado Kosher / Halal (cuando aplica)",                            en: "Kosher / Halal certificate (when applicable)",                 badge: "KOSHER/HALAL",    color: "#059669", scope: "FOOD" },
  RSPO:               { es: "Certificación RSPO de palma sostenible",                                en: "RSPO sustainable palm certification",                          badge: "RSPO",            color: "#ea580c", scope: "OILS" },

  PHYTOSANITARY:      { es: "Certificado fitosanitario oficial de exportación",                      en: "Official phytosanitary export certificate",                    badge: "PHYTOSANITARY",   color: "#16a34a", scope: "PLANT" },
  FUMIGATION:         { es: "Certificado de fumigación y tratamiento",                               en: "Fumigation and treatment certificate",                         badge: "FUMIGATION",      color: "#b45309", scope: "GRAIN" },
  MOISTURE_ANALYSIS:  { es: "Informe de análisis de humedad y calidad",                              en: "Moisture and quality analysis report",                         badge: "MOISTURE",        color: "#0284c7", scope: "GRAIN" },
  PROTEIN_ANALYSIS:   { es: "Análisis de proteína y composición nutricional",                        en: "Protein and nutritional composition analysis",                 badge: "PROTEIN",         color: "#7c3aed", scope: "GRAIN" },

  VETERINARY_SANITARY:{ es: "Certificado veterinario / sanitario de exportación",                    en: "Veterinary/sanitary export certificate",                       badge: "VET-SANITARY",    color: "#7c3aed", scope: "ANIMAL" },
  COLD_CHAIN:         { es: "Certificado de cumplimiento de cadena de frío",                         en: "Cold chain compliance certificate",                            badge: "COLD-CHAIN",      color: "#0ea5e9", scope: "TEMPERATURE" },
  HACCP:              { es: "Certificación HACCP de la planta",                                      en: "Plant HACCP certification",                                    badge: "HACCP",           color: "#dc2626", scope: "FOOD_SAFETY" },
  TRACEABILITY:       { es: "Documentación de trazabilidad del lote",                                en: "Lot traceability documentation",                               badge: "TRACEABILITY",    color: "#6d28d9", scope: "UNIVERSAL" },

  GLOBAL_GAP:         { es: "Certificación GlobalG.A.P.",                                            en: "GlobalG.A.P. certification",                                   badge: "GLOBAL-GAP",      color: "#0284c7", scope: "AGRICULTURE" },
  BRC:                { es: "BRC Food Safety",                                                       en: "BRC Food Safety certification",                                badge: "BRC",             color: "#9333ea", scope: "FOOD_SAFETY" },
  BIOSECURITY:        { es: "Certificado de bioseguridad",                                           en: "Biosecurity certificate",                                      badge: "BIOSECURITY",     color: "#dc2626", scope: "ANIMAL" },
  SANITARY_PHYTO:     { es: "Certificado sanitario / fitosanitario de exportación",                  en: "Sanitary / phytosanitary export certificate",                  badge: "SANITARY",        color: "#16a34a", scope: "PLANT" },
});

// ─── Product Profiles ──────────────────────────────────────────────────────────

const PRODUCT_PROFILES = Object.freeze({

  // ═══════════════════════════════════════════════════════════════════════════
  //  LIVE ANIMALS
  // ═══════════════════════════════════════════════════════════════════════════

  CATTLE: Object.freeze({
    productCode: "CATTLE",
    productName: { es: "Ganado Bovino en Pie", en: "Live Bovine Cattle" },
    executiveDescription: {
      en: "Premium live bovine cattle sourced from registered, export-certified ranches across Brazil, Colombia, Argentina, Paraguay and Uruguay. All animals are selected for breed quality, health certification, and compliance with international zoo-sanitary requirements including Halal slaughter standards. GLV manages the complete supply chain from ranch-level lot selection through quarantine supervision, SGS live-weight certification, and specialized livestock vessel loading.",
      es: "Ganado bovino en pie de primera calidad, procedente de haciendas registradas y certificadas para exportación en Brasil, Colombia, Argentina, Paraguay y Uruguay. Todos los animales son seleccionados por calidad de raza, certificación sanitaria y cumplimiento de requisitos zoosanitarios internacionales, incluyendo estándares de sacrificio Halal. GLV gestiona la cadena de suministro completa desde la selección del lote en finca hasta la supervisión de cuarentena, certificación SGS de peso vivo y embarque en buque ganadero especializado.",
    },
    supplyProgramDescription: {
      en: "An integrated bovine export program combining multi-origin sourcing, breed-specific selection, veterinary compliance, and door-to-port logistics under a single accountable operator.",
      es: "Un programa integrado de exportación bovina que combina sourcing multi-origen, selección por raza específica, cumplimiento veterinario y logística puerta-a-puerto bajo un solo operador responsable.",
    },
    certificationProfile: ["ZOO_SANITARY", "HALAL", "SGS_LIVE_WEIGHT", "VETERINARY_HEALTH", "QUARANTINE", "VACCINATION", "ANIMAL_WELFARE", "BREED_CERTIFICATE"],
    complianceBadges: ["VETERINARY_HEALTH", "HALAL", "SGS_LIVE_WEIGHT", "QUARANTINE", "ANIMAL_WELFARE"],
    timelineProfile: {
      estimatedWeeks: 16,
      steps: {
        en: "Week 1–2: Contract signing (SPA) and advance payment\nWeek 3–4: Breed selection and lot concentration at certified ranches\nWeek 5–8: Official quarantine period (minimum 21 days) with veterinary supervision\nWeek 9–10: SGS live-weight inspection, Halal certification, and SBLC activation\nWeek 11: Loading on specialized livestock vessel with animal welfare protocols\nWeek 12–16: Maritime transit to CFR destination with on-board veterinary monitoring\nWeek 16+: Port delivery, veterinary clearance, and final settlement",
        es: "Semana 1–2: Firma de contrato (SPA) y pago del anticipo\nSemana 3–4: Selección de raza y concentración del lote en haciendas certificadas\nSemana 5–8: Período de cuarentena oficial (mínimo 21 días) con supervisión veterinaria\nSemana 9–10: Inspección SGS de peso vivo, certificación Halal y activación de SBLC\nSemana 11: Embarque en buque ganadero especializado con protocolos de bienestar animal\nSemana 12–16: Tránsito marítimo hacia destino CFR con monitoreo veterinario a bordo\nSemana 16+: Entrega en puerto, habilitación veterinaria y liquidación final",
      },
    },
    logisticsProfile: {
      defaultContainer: "LIVESTOCK_VESSEL",
      cargoType: { es: "Animales Vivos", en: "Live Animals" },
      coldChain: false,
      quarantine: { required: true, days: 21 },
      specialVessel: true,
      animalWelfare: true,
    },
    marketApplications: {
      en: ["Halal-certified live cattle for Middle East and North Africa", "Breeding stock for genetic improvement programs", "Feedlot supply for international fattening operations", "Direct slaughter programs for domestic beef markets"],
      es: ["Ganado vivo certificado Halal para Medio Oriente y Norte de África", "Pie de cría para programas de mejoramiento genético", "Suministro para engorde en operaciones internacionales de feedlot", "Programas de sacrificio directo para mercados cárnicos domésticos"],
    },
    keyAdvantages: {
      en: ["Multi-origin sourcing across 5 Latin American countries", "Breed-specific lot selection (Nelore, Angus, Hereford, Brahman)", "21-day quarantine with veterinary supervision", "SGS live-weight and health certification at origin", "Specialized livestock vessel with on-board monitoring"],
      es: ["Sourcing multi-origen en 5 países de Latinoamérica", "Selección de lote por raza específica (Nelore, Angus, Hereford, Brahman)", "Cuarentena de 21 días con supervisión veterinaria", "Certificación SGS de peso vivo y salud en origen", "Buque ganadero especializado con monitoreo a bordo"],
    },
    originCountries: ["BR", "CO", "AR", "PY", "UY"],
    heroImageTags: ["cattle", "bovine", "livestock", "ranch"],
  }),

  SHEEP: Object.freeze({
    productCode: "SHEEP",
    productName: { es: "Ovinos en Pie", en: "Live Sheep" },
    executiveDescription: {
      en: "Live sheep sourced from registered farms specializing in export-quality breeds including Merino, Dorper, and Rambouillet. All animals undergo breed verification, veterinary inspection, and mandatory quarantine under official supervision. GLV coordinates the full logistics chain from farm-level concentration through port-side SGS certification and specialized livestock vessel loading with animal welfare compliance.",
      es: "Ovinos en pie procedentes de establecimientos registrados especializados en razas de exportación incluyendo Merino, Dorper y Rambouillet. Todos los animales pasan verificación de raza, inspección veterinaria y cuarentena obligatoria bajo supervisión oficial. GLV coordina la cadena logística completa desde la concentración en finca hasta la certificación SGS en puerto y embarque en buque ganadero especializado con cumplimiento de bienestar animal.",
    },
    supplyProgramDescription: {
      en: "A specialized ovine export program with breed-verified lot selection, mandatory quarantine management, and door-to-vessel logistics coordination for the Middle East and North Africa live sheep market.",
      es: "Un programa especializado de exportación ovina con selección de lote verificada por raza, gestión de cuarentena obligatoria y coordinación logística puerta-a-buque para el mercado de ovinos vivos en Medio Oriente y Norte de África.",
    },
    certificationProfile: ["ZOO_SANITARY", "HALAL", "SGS_LIVE_WEIGHT", "VETERINARY_HEALTH", "QUARANTINE", "VACCINATION"],
    complianceBadges: ["VETERINARY_HEALTH", "HALAL", "SGS_LIVE_WEIGHT", "QUARANTINE"],
    timelineProfile: {
      estimatedWeeks: 16,
      steps: {
        en: "Week 1–2: Contract signing (SPA) and advance payment\nWeek 3–6: Breed selection and lot concentration at origin farms\nWeek 7–10: Official quarantine period (minimum 21 days)\nWeek 11: SGS inspection, Halal certification and SBLC activation\nWeek 12: Loading on specialized livestock vessel\nWeek 13–16: Maritime transit to CFR destination\nWeek 16+: Port delivery and final settlement",
        es: "Semana 1–2: Firma de contrato (SPA) y pago del anticipo\nSemana 3–6: Selección de raza y concentración del lote en fincas de origen\nSemana 7–10: Período de cuarentena oficial (mínimo 21 días)\nSemana 11: Inspección SGS, certificación Halal y activación de SBLC\nSemana 12: Embarque en buque ganadero especializado\nSemana 13–16: Tránsito marítimo hacia destino CFR\nSemana 16+: Entrega en puerto y liquidación final",
      },
    },
    logisticsProfile: {
      defaultContainer: "LIVESTOCK_VESSEL",
      cargoType: { es: "Animales Vivos", en: "Live Animals" },
      coldChain: false,
      quarantine: { required: true, days: 21 },
      specialVessel: true,
      animalWelfare: true,
    },
    marketApplications: {
      en: ["Halal live sheep for seasonal demand peaks (Eid al-Adha)", "Breeding stock for flock genetic improvement", "Direct slaughter supply for MENA retail markets"],
      es: ["Ovinos vivos Halal para picos de demanda estacional (Eid al-Adha)", "Pie de cría para mejoramiento genético de rebaño", "Suministro de sacrificio directo para mercados retail MENA"],
    },
    keyAdvantages: {
      en: ["Breed-verified selection (Merino, Dorper, Rambouillet)", "Seasonal capacity scaling for Eid and Ramadan demand", "Quarantine management with daily veterinary supervision", "Competitive FOB pricing from Latin American origins"],
      es: ["Selección verificada por raza (Merino, Dorper, Rambouillet)", "Capacidad estacional escalable para demanda de Eid y Ramadán", "Gestión de cuarentena con supervisión veterinaria diaria", "Precios FOB competitivos desde orígenes latinoamericanos"],
    },
    originCountries: ["BR", "CO", "AR", "UY"],
    heroImageTags: ["sheep", "ovine", "livestock", "farm"],
  }),

  GOAT: Object.freeze({
    productCode: "GOAT",
    productName: { es: "Caprinos en Pie", en: "Live Goats" },
    executiveDescription: {
      en: "Live goats sourced from registered farms across Latin America, specializing in Boer and Saanen breeds for meat and dairy applications. All animals meet international zoo-sanitary requirements with mandatory veterinary inspection and quarantine prior to export. GLV manages lot selection, health certification, and specialized vessel logistics.",
      es: "Caprinos en pie procedentes de establecimientos registrados en Latinoamérica, especializados en razas Boer y Saanen para aplicaciones de carne y lácteos. Todos los animales cumplen requisitos zoosanitarios internacionales con inspección veterinaria obligatoria y cuarentena previa a la exportación. GLV gestiona la selección de lote, certificación sanitaria y logística en buque especializado.",
    },
    supplyProgramDescription: {
      en: "A caprine export program for Boer and Saanen breeds, with veterinary compliance, quarantine management, and door-to-vessel coordination.",
      es: "Un programa de exportación caprina para razas Boer y Saanen, con cumplimiento veterinario, gestión de cuarentena y coordinación puerta-a-buque.",
    },
    certificationProfile: ["ZOO_SANITARY", "HALAL", "SGS_LIVE_WEIGHT", "VETERINARY_HEALTH", "QUARANTINE"],
    complianceBadges: ["VETERINARY_HEALTH", "HALAL", "SGS_LIVE_WEIGHT", "QUARANTINE"],
    timelineProfile: {
      estimatedWeeks: 14,
      steps: {
        en: "Week 1–2: Contract signing and advance payment\nWeek 3–5: Lot concentration and breed verification\nWeek 6–8: Official quarantine period (minimum 14 days)\nWeek 9: SGS inspection and certification\nWeek 10: Loading on livestock vessel\nWeek 11–14: Maritime transit and delivery",
        es: "Semana 1–2: Firma de contrato y anticipo\nSemana 3–5: Concentración del lote y verificación de raza\nSemana 6–8: Período de cuarentena oficial (mínimo 14 días)\nSemana 9: Inspección y certificación SGS\nSemana 10: Embarque en buque ganadero\nSemana 11–14: Tránsito marítimo y entrega",
      },
    },
    logisticsProfile: {
      defaultContainer: "LIVESTOCK_VESSEL",
      cargoType: { es: "Animales Vivos", en: "Live Animals" },
      coldChain: false,
      quarantine: { required: true, days: 14 },
      specialVessel: true,
      animalWelfare: true,
    },
    marketApplications: {
      en: ["Halal live goats for Middle East markets", "Breeding stock for dairy and meat improvement programs"],
      es: ["Caprinos vivos Halal para mercados de Medio Oriente", "Pie de cría para programas de mejoramiento lechero y cárnico"],
    },
    keyAdvantages: {
      en: ["Boer and Saanen breed specialization", "Shorter quarantine period (14 days)", "Competitive pricing from Latin American origins"],
      es: ["Especialización en razas Boer y Saanen", "Período de cuarentena más corto (14 días)", "Precios competitivos desde orígenes latinoamericanos"],
    },
    originCountries: ["BR", "CO", "AR"],
    heroImageTags: ["goat", "caprine", "livestock"],
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  OILS
  // ═══════════════════════════════════════════════════════════════════════════

  PALM_OIL: Object.freeze({
    productCode: "PALM_OIL",
    productName: { es: "Aceite de Palma", en: "Palm Oil" },
    executiveDescription: {
      en: "Refined, Bleached & Deodorized (RBD) Palm Oil and Palm Olein sourced from certified Colombian and Brazilian production facilities. Available in flexitank bulk, industrial drums/IBC, and consumer-ready PET packaging. All production meets international food safety standards with RSPO sustainability certification and SGS quality verification at origin.",
      es: "Aceite de Palma RBD (Refinado, Blanqueado y Desodorizado) y Oleína de Palma procedente de plantas certificadas en Colombia y Brasil. Disponible en flexitank a granel, bidones/IBC industriales y empaque PET listo para consumidor. Toda la producción cumple estándares internacionales de inocuidad alimentaria con certificación RSPO de sostenibilidad y verificación SGS de calidad en origen.",
    },
    supplyProgramDescription: {
      en: "A multi-format palm oil supply program — from bulk flexitank operations to retail-ready PET packaging — with RSPO sustainability and SGS verification.",
      es: "Un programa de suministro de aceite de palma multi-formato — desde operaciones en flexitank a granel hasta empaque PET retail — con sostenibilidad RSPO y verificación SGS.",
    },
    certificationProfile: ["FOOD_GRADE", "ORIGIN", "SGS_QUALITY", "NON_GMO", "RSPO", "SHELF_LIFE", "KOSHER_HALAL"],
    complianceBadges: ["FOOD_GRADE", "SGS_QUALITY", "RSPO", "NON_GMO", "KOSHER_HALAL"],
    timelineProfile: {
      estimatedWeeks: 6,
      steps: {
        en: "Week 1: Contract signing and documentary advance payment\nWeek 2: Production scheduling and packaging/flexitank allocation\nWeek 3: Quality control, SGS inspection, and RSPO documentation\nWeek 4: Container loading and sealing with food-grade certification\nWeek 5–6: Maritime transit to CIF/CFR destination port\nWeek 6+: Delivery and final settlement",
        es: "Semana 1: Firma de contrato y anticipo documental\nSemana 2: Programación de producción y asignación de empaque/flexitank\nSemana 3: Control de calidad, inspección SGS y documentación RSPO\nSemana 4: Carga y sellado de contenedor con certificación grado alimenticio\nSemana 5–6: Tránsito marítimo hacia puerto destino CIF/CFR\nSemana 6+: Entrega y liquidación final",
      },
    },
    logisticsProfile: {
      defaultContainer: "FLEXITANK",
      cargoType: { es: "Líquido a Granel", en: "Liquid Bulk" },
      coldChain: false,
      temperatureRange: null,
    },
    marketApplications: {
      en: ["Food manufacturing and industrial refining", "Retail cooking oil under private label", "HORECA and institutional foodservice", "Confectionery and bakery ingredient supply"],
      es: ["Manufactura de alimentos y refinación industrial", "Aceite de cocina retail bajo marca privada", "HORECA y foodservice institucional", "Suministro de ingredientes para confitería y panadería"],
    },
    keyAdvantages: {
      en: ["RSPO sustainability certification", "Multi-format availability (flexitank, drum, PET)", "Colombian and Brazilian dual-origin sourcing", "SGS quality verification at production facility"],
      es: ["Certificación de sostenibilidad RSPO", "Disponibilidad multi-formato (flexitank, bidón, PET)", "Sourcing dual-origen Colombia y Brasil", "Verificación SGS de calidad en planta de producción"],
    },
    originCountries: ["CO", "BR"],
    heroImageTags: ["palm", "oil", "aceite", "palma"],
  }),

  SOYBEAN_OIL: Object.freeze({
    productCode: "SOYBEAN_OIL",
    productName: { es: "Aceite de Soja", en: "Soybean Oil" },
    executiveDescription: {
      en: "Refined soybean oil sourced from Argentine and Brazilian crushing facilities. Available in bulk flexitank, industrial packaging (drum/IBC/jerrycan), and retail-ready PET formats. Suitable for food manufacturing, cooking oil programs, and industrial ingredient supply with full Non-GMO certification available.",
      es: "Aceite de soja refinado procedente de plantas de crushing en Argentina y Brasil. Disponible en flexitank a granel, empaque industrial (bidón/IBC/jerrycan) y formatos PET retail. Apto para manufactura de alimentos, programas de aceite de cocina y suministro de ingredientes industriales con certificación Non-GMO completa disponible.",
    },
    supplyProgramDescription: {
      en: "A soybean oil supply program from Argentine and Brazilian origins — bulk and retail formats — with Non-GMO certification and SGS verification.",
      es: "Un programa de suministro de aceite de soja de orígenes argentinos y brasileños — formatos a granel y retail — con certificación Non-GMO y verificación SGS.",
    },
    certificationProfile: ["FOOD_GRADE", "ORIGIN", "SGS_QUALITY", "NON_GMO", "SHELF_LIFE"],
    complianceBadges: ["FOOD_GRADE", "SGS_QUALITY", "NON_GMO", "ORIGIN"],
    timelineProfile: {
      estimatedWeeks: 6,
      steps: {
        en: "Week 1: Contract signing and advance payment\nWeek 2: Production scheduling at crushing facility\nWeek 3: SGS quality inspection and Non-GMO documentation\nWeek 4: Loading and sealing\nWeek 5–6: Maritime transit and delivery",
        es: "Semana 1: Firma de contrato y anticipo\nSemana 2: Programación de producción en planta de crushing\nSemana 3: Inspección SGS de calidad y documentación Non-GMO\nSemana 4: Carga y sellado\nSemana 5–6: Tránsito marítimo y entrega",
      },
    },
    logisticsProfile: {
      defaultContainer: "FLEXITANK",
      cargoType: { es: "Líquido a Granel", en: "Liquid Bulk" },
      coldChain: false,
      temperatureRange: null,
    },
    marketApplications: {
      en: ["Industrial food manufacturing", "Retail cooking oil (private label)", "Margarine and shortening production", "Biodiesel feedstock"],
      es: ["Manufactura industrial de alimentos", "Aceite de cocina retail (marca privada)", "Producción de margarina y manteca", "Materia prima para biodiesel"],
    },
    keyAdvantages: {
      en: ["Argentine and Brazilian crushing origins", "Non-GMO certification available", "High-volume flexitank capacity", "Competitive pricing from Mercosur origins"],
      es: ["Orígenes de crushing argentinos y brasileños", "Certificación Non-GMO disponible", "Capacidad de alto volumen en flexitank", "Precios competitivos desde orígenes Mercosur"],
    },
    originCountries: ["AR", "BR"],
    heroImageTags: ["soybean", "oil", "aceite", "soja"],
  }),

  SUNFLOWER_OIL: Object.freeze({
    productCode: "SUNFLOWER_OIL",
    productName: { es: "Aceite de Girasol", en: "Sunflower Oil" },
    executiveDescription: {
      en: "Refined sunflower oil sourced from Argentine production facilities, available in retail PET packaging and bulk formats. High oleic and standard variants available for cooking oil, food manufacturing, and HORECA distribution channels.",
      es: "Aceite de girasol refinado procedente de plantas de producción argentinas, disponible en empaque PET retail y formatos a granel. Variantes alto oleico y estándar disponibles para aceite de cocina, manufactura de alimentos y canales de distribución HORECA.",
    },
    supplyProgramDescription: {
      en: "A sunflower oil export program from Argentine origins — retail and bulk formats — with high oleic variants and SGS verification.",
      es: "Un programa de exportación de aceite de girasol de orígenes argentinos — formatos retail y a granel — con variantes alto oleico y verificación SGS.",
    },
    certificationProfile: ["FOOD_GRADE", "ORIGIN", "SGS_QUALITY", "NON_GMO", "SHELF_LIFE"],
    complianceBadges: ["FOOD_GRADE", "SGS_QUALITY", "NON_GMO", "ORIGIN"],
    timelineProfile: {
      estimatedWeeks: 6,
      steps: {
        en: "Week 1: Contract signing and advance payment\nWeek 2: Production scheduling and packaging allocation\nWeek 3: SGS quality inspection\nWeek 4: Loading and sealing\nWeek 5–6: Maritime transit and delivery",
        es: "Semana 1: Firma de contrato y anticipo\nSemana 2: Programación de producción y asignación de empaque\nSemana 3: Inspección SGS de calidad\nSemana 4: Carga y sellado\nSemana 5–6: Tránsito marítimo y entrega",
      },
    },
    logisticsProfile: {
      defaultContainer: "FLEXITANK",
      cargoType: { es: "Líquido a Granel", en: "Liquid Bulk" },
      coldChain: false,
      temperatureRange: null,
    },
    marketApplications: {
      en: ["Retail cooking oil distribution", "Food manufacturing ingredient", "HORECA and institutional supply"],
      es: ["Distribución de aceite de cocina retail", "Ingrediente para manufactura de alimentos", "Suministro HORECA e institucional"],
    },
    keyAdvantages: {
      en: ["Argentine origin — global quality benchmark", "High oleic variants available", "Competitive Mercosur pricing"],
      es: ["Origen argentino — referencia global de calidad", "Variantes alto oleico disponibles", "Precios competitivos Mercosur"],
    },
    originCountries: ["AR"],
    heroImageTags: ["sunflower", "oil", "aceite", "girasol"],
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  GRAINS
  // ═══════════════════════════════════════════════════════════════════════════

  RICE: Object.freeze({
    productCode: "RICE",
    productName: { es: "Arroz", en: "Rice" },
    executiveDescription: {
      en: "White rice in multiple broken-grade specifications (5%, 15%, 25%, 50%) sourced from verified Pakistani and South American mills. Available in bulk vessel or containerized bagged formats. All lots undergo SGS quality inspection including moisture, broken percentage, and aflatoxin analysis at the load port.",
      es: "Arroz blanco en múltiples especificaciones de quebrado (5%, 15%, 25%, 50%) procedente de molinos verificados en Pakistán y Sudamérica. Disponible en buque granelero o formato de sacos en contenedor. Todos los lotes pasan inspección SGS de calidad incluyendo análisis de humedad, porcentaje de quebrado y aflatoxinas en puerto de carga.",
    },
    supplyProgramDescription: {
      en: "A multi-origin rice supply program with grade-specific sourcing, SGS quality verification, and flexible packaging (bulk vessel or containerized bags).",
      es: "Un programa de suministro de arroz multi-origen con sourcing por grado específico, verificación SGS de calidad y empaque flexible (buque granelero o sacos en contenedor).",
    },
    certificationProfile: ["PHYTOSANITARY", "ORIGIN", "SGS_QUALITY", "FUMIGATION", "MOISTURE_ANALYSIS"],
    complianceBadges: ["PHYTOSANITARY", "SGS_QUALITY", "FUMIGATION", "ORIGIN"],
    timelineProfile: {
      estimatedWeeks: 6,
      steps: {
        en: "Week 1: Contract signing and documentary advance\nWeek 2: Grade selection and mill allocation\nWeek 3: SGS quality inspection — moisture, broken %, aflatoxin\nWeek 4: Bagging or bulk loading at port\nWeek 5–6: Maritime transit to CIF destination\nWeek 6+: Delivery and final settlement",
        es: "Semana 1: Firma de contrato y anticipo documental\nSemana 2: Selección de grado y asignación en molino\nSemana 3: Inspección SGS de calidad — humedad, % quebrado, aflatoxinas\nSemana 4: Ensacado o carga a granel en puerto\nSemana 5–6: Tránsito marítimo hacia destino CIF\nSemana 6+: Entrega y liquidación final",
      },
    },
    logisticsProfile: {
      defaultContainer: "BULK_VESSEL",
      cargoType: { es: "Granel Seco", en: "Dry Bulk" },
      coldChain: false,
      fumigation: true,
      siloRequired: true,
    },
    marketApplications: {
      en: ["National food security programs", "Wholesale and retail distribution", "Government procurement and institutional supply", "Food processing and parboiled rice production"],
      es: ["Programas nacionales de seguridad alimentaria", "Distribución mayorista y retail", "Compras gubernamentales y suministro institucional", "Procesamiento de alimentos y producción de arroz parbolizado"],
    },
    keyAdvantages: {
      en: ["Multi-grade availability (5% to 50% broken)", "Pakistani and South American mill network", "SGS-verified moisture and quality at load port", "Bulk vessel capacity up to 50,000 MT per vessel"],
      es: ["Disponibilidad multi-grado (5% a 50% quebrado)", "Red de molinos en Pakistán y Sudamérica", "Humedad y calidad verificada SGS en puerto de carga", "Capacidad en buque granelero hasta 50.000 TM por buque"],
    },
    originCountries: ["PK", "BR", "AR", "UY", "PY"],
    heroImageTags: ["rice", "arroz", "grain"],
  }),

  CORN: Object.freeze({
    productCode: "CORN",
    productName: { es: "Maíz Amarillo", en: "Yellow Corn" },
    executiveDescription: {
      en: "Yellow corn (US #2 equivalent grade) sourced from Argentine and Brazilian harvests. Available in bulk vessel for industrial feed mills and food processing. All shipments include SGS quality verification for moisture, protein content, and aflatoxin levels at load port.",
      es: "Maíz amarillo (grado equivalente US #2) procedente de cosechas argentinas y brasileñas. Disponible en buque granelero para plantas industriales de alimento balanceado y procesamiento de alimentos. Todos los embarques incluyen verificación SGS de calidad para humedad, contenido de proteína y niveles de aflatoxinas en puerto de carga.",
    },
    supplyProgramDescription: {
      en: "A yellow corn bulk supply program from Mercosur origins with SGS quality verification and high-volume vessel capacity.",
      es: "Un programa de suministro de maíz amarillo a granel desde orígenes Mercosur con verificación SGS de calidad y capacidad de alto volumen en buque.",
    },
    certificationProfile: ["PHYTOSANITARY", "ORIGIN", "SGS_QUALITY", "NON_GMO", "FUMIGATION", "MOISTURE_ANALYSIS", "PROTEIN_ANALYSIS"],
    complianceBadges: ["PHYTOSANITARY", "SGS_QUALITY", "NON_GMO", "FUMIGATION"],
    timelineProfile: {
      estimatedWeeks: 6,
      steps: {
        en: "Week 1: Contract signing and documentary advance\nWeek 2–3: Harvest selection and silo concentration at origin\nWeek 4: SGS quality and weight inspection at load port\nWeek 5–6: Vessel loading and maritime transit\nWeek 6+: CIF delivery and final settlement",
        es: "Semana 1: Firma de contrato y anticipo documental\nSemana 2–3: Selección de cosecha y concentración en silo de origen\nSemana 4: Inspección SGS de calidad y peso en puerto de carga\nSemana 5–6: Carga del buque y tránsito marítimo\nSemana 6+: Entrega CIF y liquidación final",
      },
    },
    logisticsProfile: {
      defaultContainer: "BULK_VESSEL",
      cargoType: { es: "Granel Seco", en: "Dry Bulk" },
      coldChain: false,
      fumigation: true,
      siloRequired: true,
    },
    marketApplications: {
      en: ["Animal feed production", "Industrial food processing (starch, corn oil)", "Ethanol and biofuel production", "Government grain reserve programs"],
      es: ["Producción de alimento balanceado", "Procesamiento industrial de alimentos (almidón, aceite de maíz)", "Producción de etanol y biocombustibles", "Programas gubernamentales de reserva de granos"],
    },
    keyAdvantages: {
      en: ["Argentine and Brazilian harvest origins", "Non-GMO certification available on request", "High-volume Panamax/Supramax vessel capacity", "SGS protein and moisture verification"],
      es: ["Orígenes de cosecha argentinos y brasileños", "Certificación Non-GMO disponible a solicitud", "Capacidad de alto volumen en buques Panamax/Supramax", "Verificación SGS de proteína y humedad"],
    },
    originCountries: ["AR", "BR", "PY"],
    heroImageTags: ["corn", "maiz", "grain", "yellow"],
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  FRUITS
  // ═══════════════════════════════════════════════════════════════════════════

  MANGO: Object.freeze({
    productCode: "MANGO",
    productName: { es: "Mango", en: "Mango" },
    executiveDescription: {
      en: "Fresh and frozen mango (Mangifera indica) sourced from certified Colombian, Mexican, and Peruvian orchards. Available as whole fresh fruit, IQF chunks, or pasteurized pulp for industrial processing. Cold chain integrity maintained from harvest through reefer container loading at controlled temperatures (8–12°C fresh, −18°C frozen). GlobalG.A.P. certified production with full phytosanitary compliance.",
      es: "Mango fresco y congelado (Mangifera indica) procedente de fincas certificadas en Colombia, México y Perú. Disponible como fruta fresca entera, trozos IQF o pulpa pasteurizada para procesamiento industrial. Integridad de cadena de frío mantenida desde cosecha hasta embarque en contenedor reefer a temperatura controlada (8–12°C fresco, −18°C congelado). Producción certificada GlobalG.A.P. con cumplimiento fitosanitario completo.",
    },
    supplyProgramDescription: {
      en: "A tropical mango supply program — fresh, frozen, and pulp formats — from certified Latin American orchards with cold chain management and GlobalG.A.P. certification.",
      es: "Un programa de suministro de mango tropical — formatos fresco, congelado y pulpa — desde fincas certificadas en Latinoamérica con gestión de cadena de frío y certificación GlobalG.A.P.",
    },
    certificationProfile: ["PHYTOSANITARY", "ORIGIN", "SGS_QUALITY", "GLOBAL_GAP", "COLD_CHAIN", "TRACEABILITY"],
    complianceBadges: ["PHYTOSANITARY", "SGS_QUALITY", "GLOBAL_GAP", "COLD_CHAIN"],
    timelineProfile: {
      estimatedWeeks: 5,
      steps: {
        en: "Week 1: Contract signing and advance payment\nWeek 2: Harvest scheduling and orchard selection\nWeek 3: Post-harvest processing — washing, grading, cold treatment\nWeek 4: Reefer container loading at 8–12°C (fresh) or −18°C (frozen)\nWeek 5: Maritime transit under continuous cold chain\nWeek 5+: CIF delivery with phytosanitary clearance",
        es: "Semana 1: Firma de contrato y anticipo\nSemana 2: Programación de cosecha y selección de finca\nSemana 3: Procesamiento post-cosecha — lavado, clasificación, tratamiento de frío\nSemana 4: Carga en contenedor reefer a 8–12°C (fresco) o −18°C (congelado)\nSemana 5: Tránsito marítimo bajo cadena de frío continua\nSemana 5+: Entrega CIF con habilitación fitosanitaria",
      },
    },
    logisticsProfile: {
      defaultContainer: "REEFER_40",
      cargoType: { es: "Carga Refrigerada", en: "Refrigerated Cargo" },
      coldChain: true,
      temperatureRange: "8–12°C (fresh) / −18°C (frozen)",
      ethyleneControl: true,
    },
    marketApplications: {
      en: ["Fresh fruit retail distribution", "Juice and smoothie manufacturing", "Industrial pulp for food processing", "HORECA and foodservice supply"],
      es: ["Distribución retail de fruta fresca", "Manufactura de jugos y smoothies", "Pulpa industrial para procesamiento de alimentos", "Suministro HORECA y foodservice"],
    },
    keyAdvantages: {
      en: ["Mangifera indica — premium tropical fruit", "Colombian, Mexican, and Peruvian certified orchards", "Multi-format: fresh, IQF, pulp", "GlobalG.A.P. and phytosanitary certification", "Cold chain from harvest to delivery"],
      es: ["Mangifera indica — fruta tropical premium", "Fincas certificadas en Colombia, México y Perú", "Multi-formato: fresco, IQF, pulpa", "Certificación GlobalG.A.P. y fitosanitaria", "Cadena de frío desde cosecha hasta entrega"],
    },
    originCountries: ["CO", "MX", "PE", "BR", "EC"],
    heroImageTags: ["mango", "fruit", "tropical"],
  }),

  PINEAPPLE: Object.freeze({
    productCode: "PINEAPPLE",
    productName: { es: "Piña", en: "Pineapple" },
    executiveDescription: {
      en: "Fresh and frozen pineapple (Ananas comosus) sourced from certified Costa Rican, Colombian, and Ecuadorian farms. Available as whole fresh fruit, IQF chunks and rings, or concentrated juice for industrial processing. Controlled atmosphere reefer transport at 7–10°C for fresh product, −18°C for frozen formats.",
      es: "Piña fresca y congelada (Ananas comosus) procedente de fincas certificadas en Costa Rica, Colombia y Ecuador. Disponible como fruta fresca entera, trozos y aros IQF, o jugo concentrado para procesamiento industrial. Transporte reefer en atmósfera controlada a 7–10°C para producto fresco, −18°C para formatos congelados.",
    },
    supplyProgramDescription: {
      en: "A pineapple supply program — fresh, frozen, and juice concentrate — from certified Central and South American origins with cold chain and phytosanitary compliance.",
      es: "Un programa de suministro de piña — fresco, congelado y jugo concentrado — desde orígenes certificados en Centro y Sudamérica con cadena de frío y cumplimiento fitosanitario.",
    },
    certificationProfile: ["PHYTOSANITARY", "ORIGIN", "SGS_QUALITY", "GLOBAL_GAP", "COLD_CHAIN", "TRACEABILITY"],
    complianceBadges: ["PHYTOSANITARY", "SGS_QUALITY", "GLOBAL_GAP", "COLD_CHAIN"],
    timelineProfile: {
      estimatedWeeks: 5,
      steps: {
        en: "Week 1: Contract signing and advance payment\nWeek 2: Harvest scheduling and farm coordination\nWeek 3: Post-harvest processing and quality grading\nWeek 4: Reefer container loading at 7–10°C\nWeek 5: Maritime transit and CIF delivery",
        es: "Semana 1: Firma de contrato y anticipo\nSemana 2: Programación de cosecha y coordinación de finca\nSemana 3: Procesamiento post-cosecha y clasificación de calidad\nSemana 4: Carga en contenedor reefer a 7–10°C\nSemana 5: Tránsito marítimo y entrega CIF",
      },
    },
    logisticsProfile: {
      defaultContainer: "REEFER_40",
      cargoType: { es: "Carga Refrigerada", en: "Refrigerated Cargo" },
      coldChain: true,
      temperatureRange: "7–10°C (fresh) / −18°C (frozen)",
    },
    marketApplications: {
      en: ["Fresh fruit retail and wholesale", "Juice and beverage manufacturing", "Canned pineapple production", "Industrial processing (concentrate, rings)"],
      es: ["Retail y mayorista de fruta fresca", "Manufactura de jugos y bebidas", "Producción de piña en conserva", "Procesamiento industrial (concentrado, aros)"],
    },
    keyAdvantages: {
      en: ["Ananas comosus — Costa Rican and Colombian premium quality", "Multi-format: fresh, IQF, juice concentrate", "GlobalG.A.P. certified production", "Controlled atmosphere reefer at 7–10°C"],
      es: ["Ananas comosus — calidad premium costarricense y colombiana", "Multi-formato: fresco, IQF, jugo concentrado", "Producción certificada GlobalG.A.P.", "Reefer en atmósfera controlada a 7–10°C"],
    },
    originCountries: ["CR", "CO", "EC", "PH", "TH"],
    heroImageTags: ["pineapple", "pina", "fruit", "tropical"],
  }),

  PASSION_FRUIT: Object.freeze({
    productCode: "PASSION_FRUIT",
    productName: { es: "Maracuyá", en: "Passion Fruit" },
    executiveDescription: {
      en: "Frozen passion fruit pulp and concentrate (Passiflora edulis) sourced from certified Colombian, Brazilian, and Ecuadorian farms. Primarily available as pasteurized pulp for industrial juice production and food manufacturing. Cold chain integrity at −18°C from processing to destination port.",
      es: "Pulpa y concentrado de maracuyá congelado (Passiflora edulis) procedente de fincas certificadas en Colombia, Brasil y Ecuador. Disponible principalmente como pulpa pasteurizada para producción industrial de jugos y manufactura de alimentos. Integridad de cadena de frío a −18°C desde procesamiento hasta puerto de destino.",
    },
    supplyProgramDescription: {
      en: "A passion fruit pulp and concentrate supply program from Colombian, Brazilian, and Ecuadorian origins — industrial processing grade with cold chain at −18°C.",
      es: "Un programa de suministro de pulpa y concentrado de maracuyá desde orígenes colombianos, brasileños y ecuatorianos — grado procesamiento industrial con cadena de frío a −18°C.",
    },
    certificationProfile: ["PHYTOSANITARY", "ORIGIN", "SGS_QUALITY", "COLD_CHAIN", "HACCP", "TRACEABILITY"],
    complianceBadges: ["PHYTOSANITARY", "SGS_QUALITY", "COLD_CHAIN", "HACCP"],
    timelineProfile: {
      estimatedWeeks: 5,
      steps: {
        en: "Week 1: Contract signing and advance payment\nWeek 2: Pulp processing and pasteurization at certified facility\nWeek 3: SGS quality inspection and HACCP documentation\nWeek 4: Reefer container loading at −18°C\nWeek 5: Maritime transit and CIF delivery",
        es: "Semana 1: Firma de contrato y anticipo\nSemana 2: Procesamiento de pulpa y pasteurización en planta certificada\nSemana 3: Inspección SGS de calidad y documentación HACCP\nSemana 4: Carga en contenedor reefer a −18°C\nSemana 5: Tránsito marítimo y entrega CIF",
      },
    },
    logisticsProfile: {
      defaultContainer: "REEFER_40",
      cargoType: { es: "Carga Congelada", en: "Frozen Cargo" },
      coldChain: true,
      temperatureRange: "−18°C",
    },
    marketApplications: {
      en: ["Juice and beverage manufacturing", "Confectionery and dessert production", "Natural flavoring for food industry", "Concentrate for tropical juice blends"],
      es: ["Manufactura de jugos y bebidas", "Producción de confitería y postres", "Saborizante natural para industria alimentaria", "Concentrado para mezclas de jugos tropicales"],
    },
    keyAdvantages: {
      en: ["Passiflora edulis — high Brix concentration", "Colombian, Brazilian, and Ecuadorian origins", "HACCP-certified processing facilities", "Continuous cold chain at −18°C"],
      es: ["Passiflora edulis — alta concentración Brix", "Orígenes colombianos, brasileños y ecuatorianos", "Plantas de procesamiento certificadas HACCP", "Cadena de frío continua a −18°C"],
    },
    originCountries: ["CO", "BR", "EC", "PE"],
    heroImageTags: ["passion", "maracuya", "fruit", "pulp"],
  }),
});

// ─── Resolution Functions ──────────────────────────────────────────────────────

export function resolveProductProfile(productCode) {
  if (!productCode) return null;
  return PRODUCT_PROFILES[productCode.toUpperCase()] || null;
}

export function getProductDescription(productCode, mode, firstCdRow = {}, doc = {}, lang = "es") {
  const profile = resolveProductProfile(productCode);
  if (profile?.executiveDescription?.[lang]) return profile.executiveDescription[lang];
  return getModeProductDescription(mode, firstCdRow, doc, lang);
}

export function getProductCertifications(productCode, mode, lang = "es") {
  const profile = resolveProductProfile(productCode);
  if (profile?.certificationProfile) {
    return profile.certificationProfile
      .map(code => {
        const cert = CERTIFICATION_CATALOG[code];
        return cert ? `• ${cert[lang] || cert.en}` : `• ${code}`;
      })
      .join("\n");
  }
  return getModeCertifications(mode, lang);
}

export function getProductTimeline(productCode, mode, lang = "es") {
  const profile = resolveProductProfile(productCode);
  if (profile?.timelineProfile?.steps?.[lang]) return profile.timelineProfile.steps[lang];
  return getModeTimeline(mode, lang);
}

export function getProductComplianceBadges(productCode, lang = "es") {
  const profile = resolveProductProfile(productCode);
  if (profile?.complianceBadges) {
    return profile.complianceBadges.map(code => {
      const cert = CERTIFICATION_CATALOG[code];
      return cert
        ? { label: cert.badge || code, color: cert.color || "#64748B" }
        : { label: code, color: "#64748B" };
    });
  }
  return null;
}

export function getProductSupplyDescription(productCode, lang = "es") {
  const profile = resolveProductProfile(productCode);
  return profile?.supplyProgramDescription?.[lang] || null;
}

export function getProductMarketApplications(productCode, lang = "es") {
  const profile = resolveProductProfile(productCode);
  return profile?.marketApplications?.[lang] || null;
}

export function getProductKeyAdvantages(productCode, lang = "es") {
  const profile = resolveProductProfile(productCode);
  return profile?.keyAdvantages?.[lang] || null;
}

export function getProductLogistics(productCode) {
  const profile = resolveProductProfile(productCode);
  return profile?.logisticsProfile || null;
}

export function getProductOriginCountries(productCode) {
  const profile = resolveProductProfile(productCode);
  return profile?.originCountries || null;
}

export function hasProductProfile(productCode) {
  return !!resolveProductProfile(productCode);
}
