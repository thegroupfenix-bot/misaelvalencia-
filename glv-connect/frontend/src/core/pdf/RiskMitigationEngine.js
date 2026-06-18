/**
 * RiskMitigationEngine.js — GLV GOS — Phase 6A.2 Engine 4
 *
 * Category-aware structured risk-management content.
 * Supply continuity, quality controls, inspection, shipment monitoring,
 * document verification, cold-chain, multi-origin sourcing.
 * Factual, no sales language.
 */

const RISK_CONTROLS = Object.freeze({
  LIVE_ANIMALS: {
    en: [
      { area: "Supply Continuity", control: "Multi-origin sourcing across 5 Latin American countries. Breed-specific producer relationships ensure lot availability even during seasonal demand peaks (Eid al-Adha, Ramadan)." },
      { area: "Veterinary Compliance", control: "Official zoo-sanitary certification from exporting country government authority. Mandatory quarantine (minimum 21 days) with daily veterinary monitoring and disease-free status verification." },
      { area: "Quality Inspection", control: "SGS live-weight and quantity verification at loading. Breed certificate and genealogical registry confirmation. All inspection costs borne by seller." },
      { area: "Animal Welfare", control: "OIE-compliant transport protocols: minimum space per head, ventilation, water access, on-board veterinary supervision, and mortality monitoring throughout maritime transit." },
      { area: "Shipment Monitoring", control: "GPS vessel tracking, daily veterinary status reports during transit, and port arrival notification with health clearance coordination." },
      { area: "Document Verification", control: "Zoo-sanitary certificate, vaccination records, quarantine clearance, breed certificate, SGS weight certificate, Halal certificate, bill of lading — all verified before vessel departure." },
    ],
    es: [
      { area: "Continuidad de Suministro", control: "Sourcing multi-origen en 5 países de Latinoamérica. Relaciones con productores por raza específica aseguran disponibilidad de lote incluso durante picos estacionales de demanda (Eid al-Adha, Ramadán)." },
      { area: "Cumplimiento Veterinario", control: "Certificación zoosanitaria oficial de la autoridad gubernamental del país exportador. Cuarentena obligatoria (mínimo 21 días) con monitoreo veterinario diario y verificación de estatus libre de enfermedades." },
      { area: "Inspección de Calidad", control: "Verificación SGS de peso vivo y cantidad en carga. Confirmación de certificado de raza y registro genealógico. Todos los costos de inspección a cargo del vendedor." },
      { area: "Bienestar Animal", control: "Protocolos de transporte OIE: espacio mínimo por cabeza, ventilación, acceso a agua, supervisión veterinaria a bordo y monitoreo de mortalidad durante tránsito marítimo." },
      { area: "Monitoreo de Embarque", control: "Rastreo GPS del buque, informes diarios de estatus veterinario durante tránsito y notificación de llegada a puerto con coordinación de habilitación sanitaria." },
      { area: "Verificación Documental", control: "Certificado zoosanitario, registros de vacunación, habilitación de cuarentena, certificado de raza, certificado SGS de peso, certificado Halal, conocimiento de embarque — todos verificados antes de la partida del buque." },
    ],
  },
  OILS: {
    en: [
      { area: "Supply Continuity", control: "Dual-origin sourcing from Colombian and South American production facilities. Multi-format inventory allocation ensures delivery schedule adherence." },
      { area: "Quality Controls", control: "SGS quality inspection at production facility: free fatty acid, peroxide value, iodine number, color, moisture, and heavy metals analysis. Laboratory report provided per lot." },
      { area: "Food Safety", control: "HACCP/ISO 22000 certified production. Food-grade packaging materials certified for direct food contact. Shelf-life and storage condition documentation provided." },
      { area: "Container Integrity", control: "Flexitank integrity testing before filling. Container cleanliness inspection. Seal verification and tamper-evident closure. Food-grade liner certification." },
      { area: "Shipment Monitoring", control: "Container GPS tracking, temperature monitoring for temperature-sensitive products, and arrival notification with customs documentation pre-clearance." },
      { area: "Document Verification", control: "Certificate of origin, food-grade quality certificate, SGS inspection report, RSPO/Non-GMO certification, health certificate, bill of lading — all verified before departure." },
    ],
    es: [
      { area: "Continuidad de Suministro", control: "Sourcing dual-origen de plantas de producción colombianas y sudamericanas. Asignación de inventario multi-formato asegura adherencia al cronograma de entrega." },
      { area: "Controles de Calidad", control: "Inspección SGS de calidad en planta de producción: ácidos grasos libres, valor de peróxido, número de yodo, color, humedad y análisis de metales pesados. Informe de laboratorio proporcionado por lote." },
      { area: "Seguridad Alimentaria", control: "Producción certificada HACCP/ISO 22000. Materiales de empaque grado alimenticio certificados para contacto directo con alimentos. Documentación de vida útil y condiciones de almacenamiento proporcionada." },
      { area: "Integridad de Contenedor", control: "Prueba de integridad de flexitank antes del llenado. Inspección de limpieza de contenedor. Verificación de sello y cierre anti-manipulación. Certificación de liner grado alimenticio." },
      { area: "Monitoreo de Embarque", control: "Rastreo GPS de contenedor, monitoreo de temperatura para productos sensibles y notificación de llegada con pre-despacho de documentación aduanera." },
      { area: "Verificación Documental", control: "Certificado de origen, certificado de calidad grado alimenticio, informe de inspección SGS, certificación RSPO/Non-GMO, certificado sanitario, conocimiento de embarque — todos verificados antes de la partida." },
    ],
  },
  GRAINS: {
    en: [
      { area: "Supply Continuity", control: "Multi-origin harvest sourcing from Mercosur countries (Argentina, Brazil, Paraguay). Silo concentration at origin with lot segregation and quality monitoring." },
      { area: "Quality Controls", control: "SGS quality inspection at load port: moisture content, broken percentage, foreign matter, aflatoxin levels, protein content, and physical characteristics. Results per lot." },
      { area: "Fumigation", control: "Certified fumigation treatment at origin using approved agents (phosphine/methyl bromide). Fumigation certificate with concentration readings, exposure time, and operator license." },
      { area: "Phytosanitary", control: "Official government phytosanitary certificate confirming pest-free status, disease absence, and compliance with importing country quarantine requirements." },
      { area: "Shipment Monitoring", control: "Vessel GPS tracking, draft survey at loading and discharge, and arrival notification with port authority coordination for bulk cargo discharge." },
      { area: "Document Verification", control: "Certificate of origin, phytosanitary certificate, fumigation certificate, SGS quality report, weight certificate, bill of lading — all verified before vessel departure." },
    ],
    es: [
      { area: "Continuidad de Suministro", control: "Sourcing de cosecha multi-origen desde países del Mercosur (Argentina, Brasil, Paraguay). Concentración en silo de origen con segregación de lote y monitoreo de calidad." },
      { area: "Controles de Calidad", control: "Inspección SGS de calidad en puerto de carga: contenido de humedad, porcentaje de quebrado, materia extraña, niveles de aflatoxinas, contenido de proteína y características físicas. Resultados por lote." },
      { area: "Fumigación", control: "Tratamiento de fumigación certificado en origen con agentes aprobados (fosfina/bromuro de metilo). Certificado de fumigación con lecturas de concentración, tiempo de exposición y licencia del operador." },
      { area: "Fitosanitario", control: "Certificado fitosanitario oficial gubernamental confirmando estatus libre de plagas, ausencia de enfermedades y cumplimiento con requisitos de cuarentena del país importador." },
      { area: "Monitoreo de Embarque", control: "Rastreo GPS del buque, draft survey en carga y descarga, y notificación de llegada con coordinación de autoridad portuaria para descarga de carga a granel." },
      { area: "Verificación Documental", control: "Certificado de origen, certificado fitosanitario, certificado de fumigación, informe SGS de calidad, certificado de peso, conocimiento de embarque — todos verificados antes de la partida del buque." },
    ],
  },
  FRUIT_PRODUCTS: {
    en: [
      { area: "Supply Continuity", control: "Multi-origin orchard sourcing from Colombia, Ecuador, Peru, Brazil, and Central America. Harvest scheduling aligned with seasonal availability and buyer demand windows." },
      { area: "Cold Chain Integrity", control: "Continuous temperature monitoring from harvest through reefer loading: 7-12°C for fresh, -18°C for frozen. Digital temperature loggers with tamper-evident seals per container." },
      { area: "Quality Controls", control: "Post-harvest quality grading: size, color, Brix content, maturity index, and defect sorting. SGS inspection with laboratory analysis report per lot." },
      { area: "Phytosanitary", control: "Official phytosanitary certificate with pest-free area declarations. Cold treatment protocols for markets requiring vapor heat treatment or irradiation." },
      { area: "Shipment Monitoring", control: "Reefer container GPS and temperature tracking throughout transit. Real-time alerts for temperature deviations. Arrival notification with customs pre-clearance." },
      { area: "Document Verification", control: "Certificate of origin, phytosanitary certificate, cold chain certificate, GlobalG.A.P. number, SGS quality report, bill of lading — all verified before departure." },
    ],
    es: [
      { area: "Continuidad de Suministro", control: "Sourcing de fincas multi-origen en Colombia, Ecuador, Perú, Brasil y Centroamérica. Programación de cosecha alineada con disponibilidad estacional y ventanas de demanda del comprador." },
      { area: "Integridad Cadena de Frío", control: "Monitoreo continuo de temperatura desde cosecha hasta carga reefer: 7-12°C para fresco, -18°C para congelado. Registradores digitales de temperatura con sellos anti-manipulación por contenedor." },
      { area: "Controles de Calidad", control: "Clasificación de calidad post-cosecha: tamaño, color, contenido Brix, índice de madurez y selección de defectos. Inspección SGS con informe de análisis de laboratorio por lote." },
      { area: "Fitosanitario", control: "Certificado fitosanitario oficial con declaraciones de área libre de plagas. Protocolos de tratamiento de frío para mercados que requieren tratamiento de calor por vapor o irradiación." },
      { area: "Monitoreo de Embarque", control: "Rastreo GPS y temperatura de contenedor reefer durante tránsito. Alertas en tiempo real por desviaciones de temperatura. Notificación de llegada con pre-despacho aduanero." },
      { area: "Verificación Documental", control: "Certificado de origen, certificado fitosanitario, certificado de cadena de frío, número GlobalG.A.P., informe SGS de calidad, conocimiento de embarque — todos verificados antes de la partida." },
    ],
  },
  FROZEN_PRODUCTS: {
    en: [
      { area: "Supply Continuity", control: "Multi-origin processor sourcing from certified HACCP/BRC facilities. Production scheduling with inventory buffer management for delivery adherence." },
      { area: "Cold Chain -18°C", control: "Continuous cold chain from processing facility through reefer container delivery at -18°C. Pre-cooling verification, temperature set-point monitoring, and tamper-evident seals." },
      { area: "Quality Controls", control: "SGS quality inspection: microbiological analysis (total plate count, E. coli, Salmonella), chemical analysis (moisture, protein, fat), and physical inspection (color, texture, foreign matter)." },
      { area: "Processing Certification", control: "HACCP and/or BRC certified facilities with regular third-party audits. Full traceability from raw material to finished product with lot-specific documentation." },
      { area: "Shipment Monitoring", control: "40ft reefer container GPS and temperature tracking. Real-time temperature deviation alerts. Pre-cooling verification at container yard before loading." },
      { area: "Document Verification", control: "Veterinary/sanitary certificate, HACCP/BRC certificate, SGS quality report, cold chain certificate, traceability documentation, bill of lading — all verified before departure." },
    ],
    es: [
      { area: "Continuidad de Suministro", control: "Sourcing de procesadores multi-origen de plantas certificadas HACCP/BRC. Programación de producción con gestión de buffer de inventario para adherencia a entregas." },
      { area: "Cadena de Frío -18°C", control: "Cadena de frío continua desde planta de procesamiento hasta entrega en contenedor reefer a -18°C. Verificación de pre-enfriamiento, monitoreo de temperatura y sellos anti-manipulación." },
      { area: "Controles de Calidad", control: "Inspección SGS de calidad: análisis microbiológico (recuento total en placa, E. coli, Salmonella), análisis químico (humedad, proteína, grasa) e inspección física (color, textura, materia extraña)." },
      { area: "Certificación de Procesamiento", control: "Plantas certificadas HACCP y/o BRC con auditorías regulares de terceros. Trazabilidad completa desde materia prima hasta producto terminado con documentación por lote." },
      { area: "Monitoreo de Embarque", control: "Rastreo GPS y temperatura de contenedor reefer 40ft. Alertas en tiempo real por desviación de temperatura. Verificación de pre-enfriamiento en patio de contenedores antes de la carga." },
      { area: "Verificación Documental", control: "Certificado veterinario/sanitario, certificado HACCP/BRC, informe SGS de calidad, certificado de cadena de frío, documentación de trazabilidad, conocimiento de embarque — todos verificados antes de la partida." },
    ],
  },
});

const GENERIC_CONTROLS = Object.freeze({
  en: [
    { area: "Supply Continuity", control: "Multi-origin sourcing from certified Latin American producers. Diversified supplier network reduces single-point-of-failure risk." },
    { area: "Quality Controls", control: "SGS or Bureau Veritas quality inspection at origin. Product specifications verified against contract terms before loading." },
    { area: "Inspection", control: "Third-party inspection coordination at production facility and load port. Inspection costs and responsibilities clearly allocated in SPA." },
    { area: "Shipment Monitoring", control: "Container or vessel GPS tracking throughout transit. Arrival notification with customs documentation pre-clearance coordination." },
    { area: "Document Verification", control: "Complete export documentation package verified before departure: certificate of origin, quality certificates, health/sanitary certificates, and bill of lading." },
    { area: "Multi-Origin Sourcing", control: "Geographic diversification across multiple Latin American origins reduces country-specific regulatory, weather, and supply chain risks." },
  ],
  es: [
    { area: "Continuidad de Suministro", control: "Sourcing multi-origen de productores certificados en Latinoamérica. Red diversificada de proveedores reduce riesgo de punto único de falla." },
    { area: "Controles de Calidad", control: "Inspección SGS o Bureau Veritas de calidad en origen. Especificaciones de producto verificadas contra términos contractuales antes de la carga." },
    { area: "Inspección", control: "Coordinación de inspección de terceros en planta de producción y puerto de carga. Costos y responsabilidades de inspección claramente asignados en SPA." },
    { area: "Monitoreo de Embarque", control: "Rastreo GPS de contenedor o buque durante tránsito. Notificación de llegada con coordinación de pre-despacho de documentación aduanera." },
    { area: "Verificación Documental", control: "Paquete completo de documentación de exportación verificado antes de la partida: certificado de origen, certificados de calidad, certificados sanitarios y conocimiento de embarque." },
    { area: "Sourcing Multi-Origen", control: "Diversificación geográfica en múltiples orígenes latinoamericanos reduce riesgos regulatorios, climáticos y de cadena de suministro por país." },
  ],
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

export function buildRiskMitigation({ category, lang = "en" }) {
  const l = lang === "es" ? "es" : "en";
  const catKey = resolveCategory(category);
  const controls = catKey ? (RISK_CONTROLS[catKey]?.[l] || GENERIC_CONTROLS[l]) : GENERIC_CONTROLS[l];

  return {
    title: l === "en" ? "RISK MANAGEMENT & CONTROLS" : "GESTIÓN DE RIESGOS Y CONTROLES",
    controls,
  };
}
