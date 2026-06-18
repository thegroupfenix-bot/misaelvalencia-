/**
 * BuyerConfidenceEngine.js — GLV GOS — Phase 6A.2 Engine 3
 *
 * Confidence-building content from existing system data.
 * Different products highlight different strengths:
 *   livestock: animal welfare, quarantine, veterinary
 *   oils: food safety, packaging, QA
 *   grains: moisture, aflatoxin, fumigation
 */

import {
  resolveProductProfile,
  getProductLogistics,
} from "../product/ProductIntelligenceRegistry.js";

const CATEGORY_CONFIDENCE = Object.freeze({
  LIVE_ANIMALS: {
    en: {
      supplyCapacity: {
        volume: "Up to 120,000 heads/year",
        scalability: "Container to Strategic",
        readiness: "Active",
      },
      highlights: [
        { t: "Animal Welfare Standards", d: "All shipments comply with OIE (World Organisation for Animal Health) guidelines for live animal transport, including minimum space allocation, ventilation, water access, and veterinary monitoring throughout transit." },
        { t: "Quarantine Management", d: "21-day minimum quarantine period under official veterinary supervision at certified quarantine stations. Daily health monitoring, vaccination verification, and disease-free certification before loading." },
        { t: "Veterinary Documentation", d: "Complete veterinary documentation package: zoo-sanitary certificate, health declaration, vaccination records, breed certificate, and quarantine clearance — issued by official government authorities." },
        { t: "SGS Live-Weight Certification", d: "Independent SGS live-weight and quantity verification at loading. Certified weight certificates accepted by all major importing countries for customs and commercial settlement." },
      ],
      complianceNarrative: "GLV Global Holding maintains active compliance programs across all livestock export corridors. All animals are sourced from certified, export-registered ranches, inspected by accredited veterinary authorities, and documented to meet destination country import requirements. Country-specific veterinary protocols are managed on a per-operation basis.",
    },
    es: {
      supplyCapacity: {
        volume: "Hasta 120.000 cabezas/año",
        scalability: "Contenedor a Estratégico",
        readiness: "Activo",
      },
      highlights: [
        { t: "Estándares de Bienestar Animal", d: "Todos los embarques cumplen con las directrices de la OIE (Organización Mundial de Sanidad Animal) para transporte de animales vivos, incluyendo asignación mínima de espacio, ventilación, acceso a agua y monitoreo veterinario durante el tránsito." },
        { t: "Gestión de Cuarentena", d: "Período mínimo de cuarentena de 21 días bajo supervisión veterinaria oficial en estaciones de cuarentena certificadas. Monitoreo diario de salud, verificación de vacunación y certificación libre de enfermedades antes del embarque." },
        { t: "Documentación Veterinaria", d: "Paquete completo de documentación veterinaria: certificado zoosanitario, declaración de salud, registros de vacunación, certificado de raza y habilitación de cuarentena — emitidos por autoridades gubernamentales oficiales." },
        { t: "Certificación SGS de Peso Vivo", d: "Verificación independiente SGS de peso vivo y cantidad en carga. Certificados de peso aceptados por todos los principales países importadores para liquidación aduanera y comercial." },
      ],
      complianceNarrative: "GLV Global Holding mantiene programas de cumplimiento activos en todos los corredores de exportación pecuaria. Todos los animales provienen de haciendas certificadas y registradas para exportación, inspeccionados por autoridades veterinarias acreditadas y documentados para cumplir con los requisitos de importación del país destino. Los protocolos veterinarios específicos por país se gestionan por operación.",
    },
  },
  OILS: {
    en: {
      supplyCapacity: {
        volume: "Up to 50,000 MT/year",
        scalability: "Container to Strategic",
        readiness: "Active",
      },
      highlights: [
        { t: "Food Safety Certification", d: "All production facilities hold HACCP, ISO 22000, or BRC food safety certifications. Food-grade quality verified at every stage from refining through packaging and container loading." },
        { t: "Packaging Quality Assurance", d: "Multi-format packaging validation: flexitank integrity testing, drum seal verification, IBC food-grade compliance, and PET bottle quality control for consumer-ready products." },
        { t: "SGS Quality Verification", d: "Independent SGS quality inspection at production facility covering: free fatty acid content, peroxide value, iodine number, color, moisture, and heavy metals. Full laboratory analysis report provided." },
        { t: "Sustainability Certification", d: "RSPO certification available for palm oil programs. Non-GMO certification for soybean and sunflower oil. Kosher/Halal certification for applicable markets." },
      ],
      complianceNarrative: "GLV Global Holding maintains active compliance programs across all vegetable oil export corridors. All products are sourced from certified production facilities, inspected by accredited third parties, and documented to meet destination country food safety import requirements. Format-specific regulations are managed per operation.",
    },
    es: {
      supplyCapacity: {
        volume: "Hasta 50.000 TM/año",
        scalability: "Contenedor a Estratégico",
        readiness: "Activo",
      },
      highlights: [
        { t: "Certificación de Seguridad Alimentaria", d: "Todas las plantas de producción cuentan con certificaciones HACCP, ISO 22000 o BRC de seguridad alimentaria. Calidad grado alimenticio verificada en cada etapa desde refinación hasta empaque y carga de contenedor." },
        { t: "Aseguramiento de Calidad de Empaque", d: "Validación de empaque multi-formato: prueba de integridad de flexitank, verificación de sello de bidón, cumplimiento grado alimenticio de IBC y control de calidad de botella PET para productos listos para consumidor." },
        { t: "Verificación SGS de Calidad", d: "Inspección independiente SGS de calidad en planta de producción: contenido de ácidos grasos libres, valor de peróxido, número de yodo, color, humedad y metales pesados. Informe completo de análisis de laboratorio proporcionado." },
        { t: "Certificación de Sostenibilidad", d: "Certificación RSPO disponible para programas de aceite de palma. Certificación Non-GMO para aceite de soja y girasol. Certificación Kosher/Halal para mercados aplicables." },
      ],
      complianceNarrative: "GLV Global Holding mantiene programas de cumplimiento activos en todos los corredores de exportación de aceites vegetales. Todos los productos provienen de plantas de producción certificadas, inspeccionados por terceros acreditados y documentados para cumplir con los requisitos de seguridad alimentaria del país destino. Las regulaciones específicas por formato se gestionan por operación.",
    },
  },
  GRAINS: {
    en: {
      supplyCapacity: {
        volume: "Up to 500,000 MT/year",
        scalability: "Container to Panamax",
        readiness: "Active",
      },
      highlights: [
        { t: "Moisture & Quality Analysis", d: "SGS-certified moisture analysis at load port. All grain lots verified for moisture content, broken percentage, foreign matter, and physical characteristics before loading." },
        { t: "Aflatoxin Testing", d: "Mandatory aflatoxin analysis for all grain shipments. Maximum permitted levels comply with EU, GCC, and destination country regulations. Laboratory certificates provided with each lot." },
        { t: "Fumigation Certification", d: "Certified fumigation treatment at origin port using approved chemical agents. Fumigation certificates issued by licensed operators and accepted by all major importing countries." },
        { t: "Phytosanitary Compliance", d: "Official phytosanitary export certificates issued by government plant health authorities. All lots inspected for pest presence, disease, and quarantine-relevant organisms before loading." },
      ],
      complianceNarrative: "GLV Global Holding maintains active compliance programs across all agricultural export corridors. All grain lots are sourced from verified harvest origins, inspected by SGS at load port, and documented with phytosanitary, fumigation, and quality certificates to meet destination country import requirements.",
    },
    es: {
      supplyCapacity: {
        volume: "Hasta 500.000 TM/año",
        scalability: "Contenedor a Panamax",
        readiness: "Activo",
      },
      highlights: [
        { t: "Análisis de Humedad y Calidad", d: "Análisis de humedad certificado SGS en puerto de carga. Todos los lotes de granos verificados en contenido de humedad, porcentaje de quebrado, materia extraña y características físicas antes de la carga." },
        { t: "Prueba de Aflatoxinas", d: "Análisis obligatorio de aflatoxinas para todos los embarques de granos. Niveles máximos permitidos cumplen con regulaciones UE, GCC y del país destino. Certificados de laboratorio proporcionados con cada lote." },
        { t: "Certificación de Fumigación", d: "Tratamiento de fumigación certificado en puerto de origen con agentes químicos aprobados. Certificados de fumigación emitidos por operadores licenciados y aceptados por todos los principales países importadores." },
        { t: "Cumplimiento Fitosanitario", d: "Certificados fitosanitarios oficiales de exportación emitidos por autoridades gubernamentales de sanidad vegetal. Todos los lotes inspeccionados por presencia de plagas, enfermedades y organismos relevantes de cuarentena antes de la carga." },
      ],
      complianceNarrative: "GLV Global Holding mantiene programas de cumplimiento activos en todos los corredores de exportación agrícola. Todos los lotes de granos provienen de orígenes de cosecha verificados, inspeccionados por SGS en puerto de carga y documentados con certificados fitosanitarios, de fumigación y de calidad para cumplir con los requisitos de importación del país destino.",
    },
  },
  FRUIT_PRODUCTS: {
    en: {
      supplyCapacity: {
        volume: "Scalable per demand",
        scalability: "Container to Strategic",
        readiness: "Active",
      },
      highlights: [
        { t: "Cold Chain Verification", d: "Continuous temperature monitoring from harvest through reefer container loading at 7-12°C (fresh) or -18°C (frozen). Temperature logs provided with each shipment for buyer verification." },
        { t: "GlobalG.A.P. Production", d: "All sourcing orchards hold active GlobalG.A.P. certification. Good Agricultural Practices verified from planting through harvest, ensuring food safety, worker welfare, and environmental responsibility." },
        { t: "Post-Harvest Processing", d: "Certified post-harvest facilities for washing, sorting, grading, cold treatment, and packaging. HACCP-compliant processing for pulp and concentrate formats." },
        { t: "Phytosanitary Compliance", d: "Official phytosanitary export certificates with pest-free area declarations. Cold treatment protocols for destination countries requiring additional quarantine measures." },
      ],
      complianceNarrative: "GLV Global Holding maintains active compliance programs across all tropical fruit export corridors. All products are sourced from GlobalG.A.P. certified orchards, processed in HACCP-compliant facilities, and documented with phytosanitary, cold chain, and traceability certificates.",
    },
    es: {
      supplyCapacity: {
        volume: "Escalable según demanda",
        scalability: "Contenedor a Estratégico",
        readiness: "Activo",
      },
      highlights: [
        { t: "Verificación de Cadena de Frío", d: "Monitoreo continuo de temperatura desde cosecha hasta carga en contenedor reefer a 7-12°C (fresco) o -18°C (congelado). Registros de temperatura proporcionados con cada embarque para verificación del comprador." },
        { t: "Producción GlobalG.A.P.", d: "Todas las fincas de sourcing cuentan con certificación GlobalG.A.P. activa. Buenas Prácticas Agrícolas verificadas desde siembra hasta cosecha, asegurando seguridad alimentaria, bienestar laboral y responsabilidad ambiental." },
        { t: "Procesamiento Post-Cosecha", d: "Instalaciones certificadas de post-cosecha para lavado, selección, clasificación, tratamiento de frío y empaque. Procesamiento HACCP para formatos de pulpa y concentrado." },
        { t: "Cumplimiento Fitosanitario", d: "Certificados fitosanitarios oficiales de exportación con declaraciones de área libre de plagas. Protocolos de tratamiento de frío para países destino que requieren medidas de cuarentena adicionales." },
      ],
      complianceNarrative: "GLV Global Holding mantiene programas de cumplimiento activos en todos los corredores de exportación de frutas tropicales. Todos los productos provienen de fincas certificadas GlobalG.A.P., procesados en instalaciones HACCP y documentados con certificados fitosanitarios, de cadena de frío y trazabilidad.",
    },
  },
  FROZEN_PRODUCTS: {
    en: {
      supplyCapacity: {
        volume: "Scalable per demand",
        scalability: "Container to Strategic",
        readiness: "Active",
      },
      highlights: [
        { t: "Continuous Cold Chain -18°C", d: "Temperature-controlled supply chain from processing facility through reefer container delivery. Digital temperature loggers with tamper-evident seals provided with each shipment." },
        { t: "HACCP/BRC Processing", d: "All processing facilities hold HACCP and/or BRC food safety certifications. Regular third-party audits with full traceability from raw material to finished product." },
        { t: "Reefer Container Management", d: "40ft reefer containers with pre-cooling verification, temperature set-point monitoring, and GPS tracking throughout maritime transit." },
        { t: "Veterinary/Sanitary Certification", d: "Official veterinary or sanitary export certificates issued by government authorities. Microbiological, chemical, and physical analysis certificates for each lot." },
      ],
      complianceNarrative: "GLV Global Holding maintains active compliance programs across all frozen product export corridors. All products are processed in HACCP/BRC certified facilities, shipped under continuous cold chain at -18°C, and documented with veterinary/sanitary, quality, and traceability certificates.",
    },
    es: {
      supplyCapacity: {
        volume: "Escalable según demanda",
        scalability: "Contenedor a Estratégico",
        readiness: "Activo",
      },
      highlights: [
        { t: "Cadena de Frío Continua -18°C", d: "Cadena de suministro con temperatura controlada desde planta de procesamiento hasta entrega en contenedor reefer. Registradores digitales de temperatura con sellos de seguridad proporcionados con cada embarque." },
        { t: "Procesamiento HACCP/BRC", d: "Todas las plantas de procesamiento cuentan con certificaciones HACCP y/o BRC de seguridad alimentaria. Auditorías regulares de terceros con trazabilidad completa desde materia prima hasta producto terminado." },
        { t: "Gestión de Contenedor Reefer", d: "Contenedores reefer 40ft con verificación de pre-enfriamiento, monitoreo de temperatura y rastreo GPS durante tránsito marítimo." },
        { t: "Certificación Veterinaria/Sanitaria", d: "Certificados veterinarios o sanitarios oficiales de exportación emitidos por autoridades gubernamentales. Certificados de análisis microbiológico, químico y físico para cada lote." },
      ],
      complianceNarrative: "GLV Global Holding mantiene programas de cumplimiento activos en todos los corredores de exportación de productos congelados. Todos los productos son procesados en plantas certificadas HACCP/BRC, enviados bajo cadena de frío continua a -18°C y documentados con certificados veterinarios/sanitarios, de calidad y trazabilidad.",
    },
  },
});

const GENERIC_CONFIDENCE = Object.freeze({
  en: {
    supplyCapacity: {
      volume: "Scalable per demand",
      scalability: "Container to Strategic",
      readiness: "Active",
    },
    highlights: [
      { t: "Quality Verification", d: "SGS or Bureau Veritas quality inspection at origin, covering product specifications, weight, and packaging integrity." },
      { t: "Export Documentation", d: "Complete documentation package: certificate of origin, phytosanitary/sanitary certificate, bill of lading, and commercial invoice." },
      { t: "Logistics Coordination", d: "End-to-end logistics management from production facility to destination port, including inland transport and container loading." },
      { t: "Trade Finance Support", d: "LC/SBLC structuring, payment facilitation, and SPA contract management for all transaction types." },
    ],
    complianceNarrative: "GLV Global Holding maintains active compliance programs across all export corridors. All products are sourced from certified facilities, inspected by accredited third parties, and documented to meet destination country import requirements. Country-specific regulatory requirements are managed on a per-operation basis.",
  },
  es: {
    supplyCapacity: {
      volume: "Escalable según demanda",
      scalability: "Contenedor a Estratégico",
      readiness: "Activo",
    },
    highlights: [
      { t: "Verificación de Calidad", d: "Inspección de calidad SGS o Bureau Veritas en origen, cubriendo especificaciones de producto, peso e integridad de empaque." },
      { t: "Documentación de Exportación", d: "Paquete documental completo: certificado de origen, certificado fitosanitario/sanitario, conocimiento de embarque y factura comercial." },
      { t: "Coordinación Logística", d: "Gestión logística integral desde planta de producción hasta puerto de destino, incluyendo transporte interno y carga de contenedor." },
      { t: "Soporte Financiero Comercial", d: "Estructuración LC/SBLC, facilitación de pagos y gestión de contratos SPA para todos los tipos de transacción." },
    ],
    complianceNarrative: "GLV Global Holding mantiene programas de cumplimiento activos en todos los corredores de exportación. Todos los productos provienen de instalaciones certificadas, inspeccionados por terceros acreditados y documentados para cumplir con los requisitos de importación del país destino. Los requisitos regulatorios específicos por país se gestionan por operación.",
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

export function buildBuyerConfidence({ productCode, category, scaleLabel, lang = "en" }) {
  const l = lang === "es" ? "es" : "en";
  const catKey = resolveCategory(category);
  const catConf = catKey ? CATEGORY_CONFIDENCE[catKey]?.[l] : null;
  const conf = catConf || GENERIC_CONFIDENCE[l];

  const logistics = getProductLogistics(productCode);
  const capacity = { ...conf.supplyCapacity };
  if (scaleLabel) capacity.scalability = scaleLabel;

  return {
    supplyCapacity: capacity,
    highlights: conf.highlights,
    complianceNarrative: conf.complianceNarrative,
    logistics: logistics,
    supplyTitle: l === "en" ? "SUPPLY CAPACITY" : "CAPACIDAD DE SUMINISTRO",
    complianceTitle: l === "en" ? "GLOBAL COMPLIANCE" : "CUMPLIMIENTO GLOBAL",
  };
}
