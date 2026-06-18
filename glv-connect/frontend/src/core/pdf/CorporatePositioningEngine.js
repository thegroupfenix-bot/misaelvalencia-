/**
 * CorporatePositioningEngine.js — GLV GOS — Phase 6A.2 Engine 2
 *
 * Reusable GLV positioning blocks with product-specific emphasis.
 * Blocks: Network, Operational Structure, Compliance Framework,
 * Supply Capacity, Market Access, Multi-Origin Sourcing.
 */

const POSITIONING_BLOCKS = Object.freeze({
  NETWORK: {
    en: {
      title: "GLV GLOBAL NETWORK",
      items: [
        { t: "Export Countries", v: "Brazil  ·  Colombia  ·  Argentina  ·  Paraguay  ·  Uruguay" },
        { t: "Export Hubs", v: "Santos  ·  Paranaguá  ·  Buenaventura  ·  Buenos Aires  ·  Montevideo" },
        { t: "Supplier Network", v: "200+ certified producers and processors across Latin America" },
        { t: "Intl. Reach", v: "Middle East  ·  North Africa  ·  Asia  ·  Europe  ·  40+ destination countries" },
      ],
    },
    es: {
      title: "RED GLOBAL GLV",
      items: [
        { t: "Países de Exportación", v: "Brasil  ·  Colombia  ·  Argentina  ·  Paraguay  ·  Uruguay" },
        { t: "Hubs de Exportación", v: "Santos  ·  Paranaguá  ·  Buenaventura  ·  Buenos Aires  ·  Montevideo" },
        { t: "Red de Proveedores", v: "200+ productores y procesadores certificados en Latinoamérica" },
        { t: "Alcance Intl.", v: "Medio Oriente  ·  Norte de África  ·  Asia  ·  Europa  ·  40+ países destino" },
      ],
    },
  },

  CAPABILITIES: {
    en: [
      { t: "Global Sourcing", d: "Multi-origin supply network across Latin America, ensuring competitive pricing and reliable inventory." },
      { t: "Compliance Mgmt", d: "Full regulatory compliance: GACC, USDA, EU, Halal, veterinary and sanitary certifications." },
      { t: "Export Documentation", d: "Complete documentation management: certificates of origin, phytosanitary, bills of lading." },
      { t: "Inspection Coord.", d: "SGS, Bureau Veritas, and local authority coordination for pre-shipment quality assurance." },
      { t: "Logistics Supervision", d: "End-to-end logistics: inland transport, port handling, vessel booking, cold chain integrity." },
      { t: "Trade Support", d: "Incoterms advisory, SBLC/LC structuring, payment facilitation, and SPA contract management." },
    ],
    es: [
      { t: "Sourcing Global", d: "Red de suministro multi-origen en Latinoamérica, asegurando precios competitivos e inventario confiable." },
      { t: "Gestión Cumplimiento", d: "Cumplimiento regulatorio completo: GACC, USDA, UE, Halal, certificaciones veterinarias y sanitarias." },
      { t: "Documentación Export", d: "Gestión completa de documentación: certificados de origen, fitosanitarios, conocimientos de embarque." },
      { t: "Coord. Inspección", d: "Coordinación SGS, Bureau Veritas y autoridades locales para aseguramiento pre-embarque." },
      { t: "Supervisión Logística", d: "Logística integral: transporte interno, manejo portuario, reserva de buque, cadena de frío." },
      { t: "Soporte Comercial", d: "Asesoría Incoterms, estructuración SBLC/LC, facilitación de pagos y gestión de contratos SPA." },
    ],
  },

  OPERATIONAL_ADVANTAGES: {
    en: [
      { t: "Direct Sourcing", d: "First-hand relationships with certified producers — no intermediaries, competitive pricing." },
      { t: "Quality Control", d: "Multi-point quality verification: origin farm, processing, pre-shipment, and arrival." },
      { t: "Inspection Coord.", d: "SGS, Bureau Veritas, and government authority inspection management." },
      { t: "Documentation Mgmt", d: "Export permits, certificates, customs declarations, and trade finance documents." },
      { t: "Trade Support", d: "Incoterms advisory, LC/SBLC structuring, and SPA contract management." },
    ],
    es: [
      { t: "Sourcing Directo", d: "Relación directa con productores certificados — sin intermediarios, precios competitivos." },
      { t: "Control de Calidad", d: "Verificación multi-punto: finca de origen, procesamiento, pre-embarque y llegada." },
      { t: "Coord. Inspección", d: "Gestión de inspecciones SGS, Bureau Veritas y autoridades gubernamentales." },
      { t: "Gestión Documental", d: "Permisos de exportación, certificados, declaraciones aduaneras y documentos financieros." },
      { t: "Soporte Comercial", d: "Asesoría Incoterms, estructuración LC/SBLC y gestión de contratos SPA." },
    ],
  },
});

const CATEGORY_EMPHASIS = Object.freeze({
  LIVE_ANIMALS: {
    en: [
      { t: "Supply Security", d: "Guaranteed product availability through diversified multi-origin sourcing across Latin America." },
      { t: "Veterinary Compliance", d: "Full zoo-sanitary, quarantine, and vaccination management for all livestock programs." },
      { t: "Animal Welfare", d: "International animal welfare protocols during concentration, loading, and maritime transit." },
      { t: "Breed Selection", d: "Breed-specific lot selection and genealogical registry verification for quality assurance." },
      { t: "Intl. Supervision", d: "SGS, Bureau Veritas, and third-party inspection coordination at origin and destination." },
    ],
    es: [
      { t: "Seguridad de Suministro", d: "Disponibilidad garantizada mediante sourcing diversificado multi-origen en Latinoamérica." },
      { t: "Cumplimiento Veterinario", d: "Gestión completa zoosanitaria, cuarentena y vacunación para todos los programas pecuarios." },
      { t: "Bienestar Animal", d: "Protocolos internacionales de bienestar animal durante concentración, embarque y tránsito marítimo." },
      { t: "Selección de Raza", d: "Selección de lote por raza específica y verificación de registro genealógico para aseguramiento de calidad." },
      { t: "Supervisión Intl.", d: "Coordinación SGS, Bureau Veritas e inspecciones de terceros en origen y destino." },
    ],
  },
  OILS: {
    en: [
      { t: "Format Flexibility", d: "Multi-format supply: flexitank bulk, industrial drums/IBC, and consumer-ready PET packaging." },
      { t: "Sustainability", d: "RSPO certification for sustainable palm oil programs and Non-GMO options available." },
      { t: "Food Safety", d: "Food-grade quality certification and HACCP-compliant processing facilities." },
      { t: "Production Scheduling", d: "Coordinated production runs with packaging allocation and delivery windows." },
      { t: "Intl. Supervision", d: "SGS quality verification at production facility with shelf-life and composition analysis." },
    ],
    es: [
      { t: "Flexibilidad de Formato", d: "Suministro multi-formato: flexitank a granel, bidones/IBC industriales y empaque PET retail." },
      { t: "Sostenibilidad", d: "Certificación RSPO para programas de palma sostenible y opciones Non-GMO disponibles." },
      { t: "Seguridad Alimentaria", d: "Certificación de calidad grado alimenticio e instalaciones de procesamiento HACCP." },
      { t: "Programación de Producción", d: "Corridas de producción coordinadas con asignación de empaque y ventanas de entrega." },
      { t: "Supervisión Intl.", d: "Verificación SGS de calidad en planta de producción con análisis de vida útil y composición." },
    ],
  },
  GRAINS: {
    en: [
      { t: "Grade Selection", d: "Grade-specific sourcing with SGS-verified moisture, protein, and aflatoxin parameters." },
      { t: "Scalable Volume", d: "From container programs to Panamax/Supramax bulk vessel operations." },
      { t: "Fumigation Mgmt", d: "Certified fumigation and phytosanitary treatment at origin before loading." },
      { t: "Silo Coordination", d: "Harvest concentration at certified silos with quality monitoring and lot segregation." },
      { t: "Intl. Supervision", d: "SGS quality and weight inspection at load port with full documentation package." },
    ],
    es: [
      { t: "Selección por Grado", d: "Sourcing por grado específico con parámetros SGS verificados de humedad, proteína y aflatoxinas." },
      { t: "Volumen Escalable", d: "Desde programas por contenedor hasta operaciones en buque granelero Panamax/Supramax." },
      { t: "Gestión de Fumigación", d: "Fumigación certificada y tratamiento fitosanitario en origen antes de la carga." },
      { t: "Coordinación de Silo", d: "Concentración de cosecha en silos certificados con monitoreo de calidad y segregación de lote." },
      { t: "Supervisión Intl.", d: "Inspección SGS de calidad y peso en puerto de carga con paquete documental completo." },
    ],
  },
  FRUIT_PRODUCTS: {
    en: [
      { t: "Cold Chain Integrity", d: "Continuous temperature control from harvest through reefer container delivery." },
      { t: "Multi-Format", d: "Fresh, IQF frozen, pulp, and concentrate formats from certified orchards." },
      { t: "GlobalG.A.P.", d: "GlobalG.A.P. certified production with full phytosanitary compliance." },
      { t: "Seasonal Planning", d: "Harvest scheduling and orchard selection aligned with buyer demand windows." },
      { t: "Intl. Supervision", d: "SGS quality inspection with Brix analysis, cold treatment, and traceability documentation." },
    ],
    es: [
      { t: "Integridad Cadena de Frío", d: "Control de temperatura continuo desde cosecha hasta entrega en contenedor reefer." },
      { t: "Multi-Formato", d: "Formatos fresco, IQF congelado, pulpa y concentrado desde fincas certificadas." },
      { t: "GlobalG.A.P.", d: "Producción certificada GlobalG.A.P. con cumplimiento fitosanitario completo." },
      { t: "Planificación Estacional", d: "Programación de cosecha y selección de finca alineada con ventanas de demanda del comprador." },
      { t: "Supervisión Intl.", d: "Inspección SGS de calidad con análisis Brix, tratamiento de frío y documentación de trazabilidad." },
    ],
  },
  FROZEN_PRODUCTS: {
    en: [
      { t: "Cold Chain -18°C", d: "Continuous cold chain at -18°C from processing facility through reefer delivery." },
      { t: "HACCP Processing", d: "HACCP and BRC certified processing facilities with full traceability." },
      { t: "Reefer Logistics", d: "40ft reefer container management with temperature monitoring and GPS tracking." },
      { t: "Quality Standards", d: "SGS-verified quality with microbiological, chemical, and physical analysis." },
      { t: "Intl. Supervision", d: "Third-party inspection at processing, loading, and destination with cold chain certification." },
    ],
    es: [
      { t: "Cadena de Frío -18°C", d: "Cadena de frío continua a -18°C desde planta de procesamiento hasta entrega en reefer." },
      { t: "Procesamiento HACCP", d: "Plantas de procesamiento certificadas HACCP y BRC con trazabilidad completa." },
      { t: "Logística Reefer", d: "Gestión de contenedor reefer 40ft con monitoreo de temperatura y rastreo GPS." },
      { t: "Estándares de Calidad", d: "Calidad verificada SGS con análisis microbiológico, químico y físico." },
      { t: "Supervisión Intl.", d: "Inspección de terceros en procesamiento, carga y destino con certificación de cadena de frío." },
    ],
  },
});

function resolveCategory(category) {
  if (!category) return null;
  const cat = category.toUpperCase();
  if (cat === "LIVE_ANIMALS") return "LIVE_ANIMALS";
  if (cat === "OILS") return "OILS";
  if (cat === "GRAINS") return "GRAINS";
  if (cat === "FRUIT_PRODUCTS" || cat === "FRESH_PRODUCE") return "FRUIT_PRODUCTS";
  if (cat === "FROZEN_PRODUCTS" || cat === "FROZEN_MEAT") return "FROZEN_PRODUCTS";
  return null;
}

export function buildCorporatePositioning({ category, lang = "en" }) {
  const l = lang === "es" ? "es" : "en";
  const catKey = resolveCategory(category);

  const network = POSITIONING_BLOCKS.NETWORK[l];
  const capabilities = POSITIONING_BLOCKS.CAPABILITIES[l];
  const operationalAdvantages = POSITIONING_BLOCKS.OPERATIONAL_ADVANTAGES[l];
  const programEmphasis = catKey ? (CATEGORY_EMPHASIS[catKey]?.[l] || null) : null;

  return {
    network,
    capabilities,
    operationalAdvantages,
    programEmphasis: programEmphasis || operationalAdvantages,
    whyGlvTitle: l === "en" ? "WHY GLV GLOBAL HOLDING" : "POR QUÉ GLV GLOBAL HOLDING",
    whyProgramTitle: l === "en" ? "WHY THIS PROGRAM" : "POR QUÉ ESTE PROGRAMA",
    networkTitle: network.title,
    advantagesTitle: l === "en" ? "OPERATIONAL ADVANTAGES" : "VENTAJAS OPERATIVAS",
  };
}
