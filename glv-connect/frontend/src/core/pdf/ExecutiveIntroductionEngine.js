/**
 * ExecutiveIntroductionEngine.js — GLV GOS — Phase 6A.2 Engine 1
 *
 * Product-adaptive opening narratives per category.
 * Consumes ProductIntelligenceRegistry data: executiveDescription,
 * supplyProgramDescription, marketApplications, keyAdvantages.
 *
 * Resolution: Product profile → category fallback → generic default.
 */

import {
  resolveProductProfile,
  getProductDescription,
  getProductSupplyDescription,
  getProductMarketApplications,
  getProductKeyAdvantages,
  getProductOriginCountries,
} from "../product/ProductIntelligenceRegistry.js";

const CATEGORY_INTROS = Object.freeze({
  LIVE_ANIMALS: {
    en: {
      what: "An integrated livestock export program managing the complete supply chain from ranch-level lot selection through veterinary quarantine, international certification, and specialized vessel loading.",
      buyerValue: "Single-operator accountability from origin ranch to destination port — reducing coordination risk, ensuring veterinary compliance, and guaranteeing animal welfare standards throughout transit.",
      supplyModel: "Multi-origin sourcing across Latin America with breed-specific selection, quarantine-managed lot concentration, and SGS-certified live-weight verification at loading.",
      scope: "Full-service export coordination: producer relationships, veterinary documentation, quarantine supervision, port logistics, vessel booking, and destination customs clearance.",
      destination: "Programs designed for Middle East, North Africa, and Asian markets with Halal certification, importing country veterinary protocol compliance, and seasonal demand scalability.",
    },
    es: {
      what: "Un programa integrado de exportación pecuaria que gestiona la cadena de suministro completa desde la selección de lote en finca hasta la cuarentena veterinaria, certificación internacional y embarque en buque especializado.",
      buyerValue: "Responsabilidad de operador único desde la finca de origen hasta el puerto de destino — reduciendo riesgo de coordinación, asegurando cumplimiento veterinario y garantizando estándares de bienestar animal durante el tránsito.",
      supplyModel: "Sourcing multi-origen en Latinoamérica con selección por raza específica, concentración de lote con cuarentena gestionada y verificación SGS de peso vivo certificada en carga.",
      scope: "Coordinación de exportación integral: relaciones con productores, documentación veterinaria, supervisión de cuarentena, logística portuaria, reserva de buque y despacho aduanero en destino.",
      destination: "Programas diseñados para mercados de Medio Oriente, Norte de África y Asia con certificación Halal, cumplimiento de protocolos veterinarios del país importador y escalabilidad de demanda estacional.",
    },
  },
  OILS: {
    en: {
      what: "A multi-format vegetable oil supply program — from bulk flexitank operations to retail-ready PET packaging — with sustainability certification and third-party quality verification.",
      buyerValue: "Format flexibility from industrial bulk to consumer-ready packaging, SGS-verified quality at production facility, and RSPO/Non-GMO certification for market access.",
      supplyModel: "Dual-origin sourcing from Colombian and South American production facilities with format-specific packaging allocation and food-grade certification.",
      scope: "Production scheduling, quality control, SGS inspection coordination, container loading supervision, food-grade documentation, and trade finance support.",
      destination: "Programs serving food manufacturing, retail distribution, HORECA, and institutional supply channels across Middle East, Africa, Asia, and Europe.",
    },
    es: {
      what: "Un programa de suministro de aceite vegetal multi-formato — desde operaciones en flexitank a granel hasta empaque PET listo para retail — con certificación de sostenibilidad y verificación de calidad por terceros.",
      buyerValue: "Flexibilidad de formato desde granel industrial hasta empaque listo para consumidor, calidad verificada SGS en planta de producción, y certificación RSPO/Non-GMO para acceso a mercados.",
      supplyModel: "Sourcing dual-origen desde plantas de producción colombianas y sudamericanas con asignación de empaque por formato y certificación grado alimenticio.",
      scope: "Programación de producción, control de calidad, coordinación de inspección SGS, supervisión de carga de contenedor, documentación grado alimenticio y soporte de financiamiento comercial.",
      destination: "Programas para manufactura de alimentos, distribución retail, HORECA y canales de suministro institucional en Medio Oriente, África, Asia y Europa.",
    },
  },
  GRAINS: {
    en: {
      what: "A bulk agricultural commodity supply program with grade-specific sourcing, SGS quality verification, and flexible logistics — bulk vessel or containerized bags.",
      buyerValue: "Grade-specific procurement with SGS-verified quality parameters (moisture, protein, aflatoxin), phytosanitary compliance, and high-volume vessel capacity.",
      supplyModel: "Multi-origin harvest sourcing from Mercosur countries with silo concentration, fumigation management, and load-port quality inspection.",
      scope: "Harvest selection, silo coordination, SGS quality inspection, fumigation certification, vessel loading supervision, and CIF delivery management.",
      destination: "Programs for national food security, wholesale distribution, government procurement, and industrial processing across Africa, Middle East, and Asia.",
    },
    es: {
      what: "Un programa de suministro de commodities agrícolas a granel con sourcing por grado específico, verificación SGS de calidad y logística flexible — buque granelero o sacos en contenedor.",
      buyerValue: "Adquisición por grado específico con parámetros de calidad verificados SGS (humedad, proteína, aflatoxinas), cumplimiento fitosanitario y capacidad de alto volumen en buque.",
      supplyModel: "Sourcing de cosecha multi-origen desde países del Mercosur con concentración en silo, gestión de fumigación e inspección de calidad en puerto de carga.",
      scope: "Selección de cosecha, coordinación de silo, inspección SGS de calidad, certificación de fumigación, supervisión de carga del buque y gestión de entrega CIF.",
      destination: "Programas para seguridad alimentaria nacional, distribución mayorista, compras gubernamentales y procesamiento industrial en África, Medio Oriente y Asia.",
    },
  },
  FRUIT_PRODUCTS: {
    en: {
      what: "A tropical fruit supply program — fresh, frozen, and processed formats — from certified Latin American orchards with cold chain integrity and phytosanitary compliance.",
      buyerValue: "Multi-format availability (fresh, IQF, pulp, concentrate), GlobalG.A.P. certified production, and continuous cold chain from harvest through reefer delivery.",
      supplyModel: "Certified orchard sourcing with post-harvest processing, cold treatment, and reefer container loading at controlled temperatures.",
      scope: "Harvest scheduling, post-harvest processing, quality grading, cold chain management, phytosanitary documentation, and reefer container logistics.",
      destination: "Programs for juice manufacturing, retail distribution, food processing, and HORECA supply across Europe, Middle East, Asia, and North America.",
    },
    es: {
      what: "Un programa de suministro de frutas tropicales — formatos fresco, congelado y procesado — desde fincas certificadas en Latinoamérica con integridad de cadena de frío y cumplimiento fitosanitario.",
      buyerValue: "Disponibilidad multi-formato (fresco, IQF, pulpa, concentrado), producción certificada GlobalG.A.P. y cadena de frío continua desde cosecha hasta entrega en reefer.",
      supplyModel: "Sourcing de fincas certificadas con procesamiento post-cosecha, tratamiento de frío y carga en contenedor reefer a temperaturas controladas.",
      scope: "Programación de cosecha, procesamiento post-cosecha, clasificación de calidad, gestión de cadena de frío, documentación fitosanitaria y logística de contenedor reefer.",
      destination: "Programas para manufactura de jugos, distribución retail, procesamiento de alimentos y suministro HORECA en Europa, Medio Oriente, Asia y Norteamérica.",
    },
  },
  FROZEN_PRODUCTS: {
    en: {
      what: "A frozen protein and perishable goods export program with continuous cold chain management, HACCP-certified processing, and reefer container logistics.",
      buyerValue: "HACCP and BRC certified processing, SGS-verified quality, continuous cold chain at -18°C, and full traceability from processing facility to destination.",
      supplyModel: "Certified processor sourcing with cold chain integrity, reefer container loading, and temperature monitoring throughout maritime transit.",
      scope: "Processor coordination, quality inspection, cold chain certification, reefer container management, veterinary/sanitary documentation, and CIF delivery.",
      destination: "Programs for retail, foodservice, and industrial processing markets across Middle East, Asia, Africa, and Europe.",
    },
    es: {
      what: "Un programa de exportación de proteínas congeladas y perecibles con gestión continua de cadena de frío, procesamiento certificado HACCP y logística de contenedor reefer.",
      buyerValue: "Procesamiento certificado HACCP y BRC, calidad verificada SGS, cadena de frío continua a -18°C y trazabilidad completa desde planta hasta destino.",
      supplyModel: "Sourcing de procesadores certificados con integridad de cadena de frío, carga en contenedor reefer y monitoreo de temperatura durante tránsito marítimo.",
      scope: "Coordinación de procesadores, inspección de calidad, certificación de cadena de frío, gestión de contenedor reefer, documentación veterinaria/sanitaria y entrega CIF.",
      destination: "Programas para mercados retail, foodservice y procesamiento industrial en Medio Oriente, Asia, África y Europa.",
    },
  },
});

const GENERIC_INTRO = Object.freeze({
  en: {
    what: "An international food export program with multi-origin sourcing, third-party quality verification, and end-to-end logistics coordination.",
    buyerValue: "Single-operator coordination from certified production to destination delivery, with SGS quality verification and full export documentation management.",
    supplyModel: "Multi-origin sourcing from certified Latin American producers with format-specific logistics and international compliance management.",
    scope: "Producer coordination, quality inspection, export documentation, container logistics, trade finance support, and destination clearance.",
    destination: "Programs serving international markets across Middle East, Africa, Asia, Europe, and the Americas.",
  },
  es: {
    what: "Un programa de exportación de alimentos internacionales con sourcing multi-origen, verificación de calidad por terceros y coordinación logística integral.",
    buyerValue: "Coordinación de operador único desde producción certificada hasta entrega en destino, con verificación SGS de calidad y gestión completa de documentación de exportación.",
    supplyModel: "Sourcing multi-origen de productores certificados en Latinoamérica con logística por formato y gestión de cumplimiento internacional.",
    scope: "Coordinación de productores, inspección de calidad, documentación de exportación, logística de contenedor, soporte de financiamiento comercial y despacho en destino.",
    destination: "Programas para mercados internacionales en Medio Oriente, África, Asia, Europa y las Américas.",
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

export function buildExecutiveIntroduction({ productCode, category, lang = "en" }) {
  const l = lang === "es" ? "es" : "en";
  const profile = resolveProductProfile(productCode);
  const catKey = resolveCategory(category);
  const catIntro = catKey ? CATEGORY_INTROS[catKey]?.[l] : null;
  const intro = catIntro || GENERIC_INTRO[l];

  const supplyDesc = profile?.supplyProgramDescription?.[l] || null;
  const marketApps = profile?.marketApplications?.[l] || null;
  const keyAdvantages = profile?.keyAdvantages?.[l] || null;
  const originCountries = profile?.originCountries || null;

  return {
    narrative: intro,
    supplyProgramDescription: supplyDesc,
    marketApplications: marketApps,
    keyAdvantages: keyAdvantages,
    originCountries: originCountries,
    hasProductProfile: !!profile,
  };
}
