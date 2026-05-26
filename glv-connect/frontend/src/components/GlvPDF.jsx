import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Font, pdf, Image,
} from "@react-pdf/renderer";
import { generatePaymentText } from "../utils/paymentText.js";
import { getPDFTextKey } from "../engines/categoryEngine.js";

// ─── V8.1: Safe PDF context resolver ─────────────────────────────────────────
// Wraps any field extraction in a try/catch with a typed fallback.
// Prevents undefined/null/circular-JSON from crashing @react-pdf/renderer.
function safeField(fn, fallback = "") {
  try {
    const v = fn();
    if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) return fallback;
    return v;
  } catch {
    return fallback;
  }
}
function safeStr(v, fallback = "")  { return (v != null && String(v).trim()) ? String(v) : fallback; }
function safeNum(v, fallback = 0)   { const n = parseFloat(v); return isNaN(n) ? fallback : n; }
function safeArr(v)                 { return Array.isArray(v) ? v : []; }

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2" },
  ],
});

// ─── Bilingual translations for PDF document terms ────────────────────────────
const PDF_T = {
  en: {
    seller:         "SELLER / EXPORTER",
    buyer:          "BUYER / CLIENT",
    parties:        "1. IDENTIFICATION OF PARTIES",
    product:        "2. PRODUCT DESCRIPTION",
    price:          "3. PRICE, VOLUME & VALUE",
    certs:          "4. CERTIFICATIONS & QUALITY",
    payment:        "5. PAYMENT TERMS",
    timeline:       "6. OPERATIONAL TIMELINE",
    mandatory:      "7. MANDATORY INFORMATION",
    observations:   "8. SPECIAL OBSERVATIONS",
    tc:             "9. TERMS & CONDITIONS",
    agent_sig:      "10. AGENT SIGNATURE",
    buyer_sig:      "11. BUYER'S ACCEPTANCE",
    indicative:     "INDICATIVE — NON-BINDING",
    firm:           "FIRM OFFER — BINDING",
    origin_lbl:     "Origin",
    port_lbl:       "CFR Destination Port",
    transit_lbl:    "Estimated Transit",
    heads_lbl:      "Number of Heads",
    weight_lbl:     "Average Weight Reference",
    qty_lbl:        "Quantity",
    price_lbl:      "CFR Price (USD/kg)",
    total_kg_lbl:   "Estimated Total Weight",
    shipment_val_lbl: "Value per Shipment / Lot",
    total_val_lbl:  "Total Contract Value",
    currency_lbl:   "Currency",
    validity_lbl:   "Offer Validity",
    sblc_lbl:       "SBLC / Guarantee Entity",
    unit_lbl:       "Unit of Measure",
    sco_note:       "This offer is indicative. Prices and conditions are subject to confirmation via Full Corporate Offer (FCO). This does not constitute a contractual commitment.",
    fco_note:       "This offer is firm and binding for {days} days from the issue date ({date}). Buyer's acceptance activates the SPA process.",
    buyer_accept:   "By signing this document, the buyer confirms they have read, understood and accepted all conditions of this Full Corporate Offer.",
    buyer_sign:     "Buyer signature / representative",
    company_stamp:  "Company stamp / date",
    name_position:  "Name and position",
    footer_copy:    "Automatic copy to: contabilidad@glvservicesexp.com • info@glvglobalfoodservices.com",
  },
  zh: {
    seller:         "卖方 / 出口商",
    buyer:          "买方 / 客户",
    parties:        "1. 合同各方信息",
    product:        "2. 产品描述",
    price:          "3. 价格、数量与价值",
    certs:          "4. 认证与质量",
    payment:        "5. 付款条款",
    timeline:       "6. 操作时间表",
    mandatory:      "7. 强制信息",
    observations:   "8. 特别说明",
    tc:             "9. 条款与条件",
    agent_sig:      "10. 代理人签名",
    buyer_sig:      "11. 买方确认",
    indicative:     "参考报价 — 非约束性",
    firm:           "正式报价 — 具有约束力",
    origin_lbl:     "产地",
    port_lbl:       "CFR目的港",
    transit_lbl:    "预计运输时间",
    heads_lbl:      "头数",
    weight_lbl:     "参考平均体重",
    price_lbl:      "CFR价格 (美元/千克)",
    total_kg_lbl:   "预计总重量",
    total_val_lbl:  "参考总价值",
    currency_lbl:   "货币",
    validity_lbl:   "报价有效期",
    sblc_lbl:       "SBLC / 担保机构",
    unit_lbl:       "计量单位",
    sco_note:       "本报价为参考性质。价格和条件须通过正式公司报价(FCO)确认。不构成合同承诺。",
    fco_note:       "本报价自发出之日起 {days} 天内具有法律约束力（{date}）。买方接受即启动SPA流程。",
    buyer_accept:   "签署本文件，买方确认已阅读、理解并接受本正式公司报价的所有条件。",
    buyer_sign:     "买方/代表签名",
    company_stamp:  "公司印章/日期",
    name_position:  "姓名及职位",
    footer_copy:    "自动抄送: contabilidad@glvservicesexp.com • info@glvglobalfoodservices.com",
  },
  ar: {
    seller:         "البائع / المُصدِّر",
    buyer:          "المشتري / العميل",
    parties:        "١. تحديد الأطراف",
    product:        "٢. وصف المنتج",
    price:          "٣. السعر والحجم والقيمة",
    certs:          "٤. الشهادات والجودة",
    payment:        "٥. شروط الدفع",
    timeline:       "٦. الجدول الزمني التشغيلي",
    mandatory:      "٧. المعلومات الإلزامية",
    observations:   "٨. ملاحظات خاصة",
    tc:             "٩. الشروط والأحكام",
    agent_sig:      "١٠. توقيع الوكيل",
    buyer_sig:      "١١. قبول المشتري",
    indicative:     "عرض استرشادي — غير ملزم",
    firm:           "عرض رسمي — ملزم قانوناً",
    origin_lbl:     "بلد المنشأ",
    port_lbl:       "ميناء التسليم CFR",
    transit_lbl:    "وقت العبور التقديري",
    heads_lbl:      "عدد الرؤوس",
    weight_lbl:     "متوسط الوزن المرجعي",
    price_lbl:      "سعر CFR (دولار/كغ)",
    total_kg_lbl:   "إجمالي الوزن التقديري",
    total_val_lbl:  "إجمالي القيمة المرجعية",
    currency_lbl:   "العملة",
    validity_lbl:   "صلاحية العرض",
    sblc_lbl:       "SBLC / جهة الضمان",
    unit_lbl:       "وحدة القياس",
    sco_note:       "هذا العرض استرشادي. تخضع الأسعار والشروط للتأكيد عبر العرض الرسمي (FCO). لا يُشكّل التزاماً تعاقدياً.",
    fco_note:       "هذا العرض ملزم لمدة {days} يوماً من تاريخ الإصدار ({date}). قبول المشتري يُفعّل عملية SPA.",
    buyer_accept:   "بالتوقيع على هذه الوثيقة، يؤكد المشتري أنه قرأ وفهم وقبل جميع شروط هذا العرض الرسمي.",
    buyer_sign:     "توقيع المشتري / الممثل",
    company_stamp:  "ختم الشركة / التاريخ",
    name_position:  "الاسم والمنصب",
    footer_copy:    "نسخة تلقائية إلى: contabilidad@glvservicesexp.com • info@glvglobalfoodservices.com",
  },
  fr: {
    seller:         "VENDEUR / EXPORTATEUR",
    buyer:          "ACHETEUR / CLIENT",
    parties:        "1. IDENTIFICATION DES PARTIES",
    product:        "2. DESCRIPTION DU PRODUIT",
    price:          "3. PRIX, VOLUME ET VALEUR",
    certs:          "4. CERTIFICATIONS ET QUALITÉ",
    payment:        "5. CONDITIONS DE PAIEMENT",
    timeline:       "6. CALENDRIER OPÉRATIONNEL",
    mandatory:      "7. INFORMATIONS OBLIGATOIRES",
    observations:   "8. OBSERVATIONS SPÉCIALES",
    tc:             "9. TERMES ET CONDITIONS GÉNÉRAUX",
    agent_sig:      "10. SIGNATURE DE L'AGENT",
    buyer_sig:      "11. ACCEPTATION DE L'ACHETEUR",
    indicative:     "INDICATIF — NON CONTRAIGNANT",
    firm:           "OFFRE FERME — CONTRAIGNANTE",
    origin_lbl:     "Origine",
    port_lbl:       "Port de destination CFR",
    transit_lbl:    "Transit estimé",
    heads_lbl:      "Nombre de têtes",
    weight_lbl:     "Poids moyen référence",
    price_lbl:      "Prix CFR (USD/kg)",
    total_kg_lbl:   "Poids total estimé",
    total_val_lbl:  "Valeur totale référentielle",
    currency_lbl:   "Devise",
    validity_lbl:   "Validité de l'offre",
    sblc_lbl:       "SBLC / Entité de garantie",
    unit_lbl:       "Unité de mesure",
    sco_note:       "Cette offre est indicative. Les prix et conditions sont soumis à confirmation par Full Corporate Offer (FCO). Elle ne constitue pas un engagement contractuel.",
    fco_note:       "Cette offre est ferme et contraignante pendant {days} jours à compter de la date d'émission ({date}). L'acceptation de l'acheteur active le processus SPA.",
    buyer_accept:   "En signant ce document, l'acheteur confirme avoir lu, compris et accepté toutes les conditions de la présente Full Corporate Offer.",
    buyer_sign:     "Signature de l'acheteur / représentant",
    company_stamp:  "Cachet de la société / date",
    name_position:  "Nom et fonction",
    footer_copy:    "Copie automatique à: contabilidad@glvservicesexp.com • info@glvglobalfoodservices.com",
  },
};

PDF_T.es = {
  seller:       "VENDEDOR / EXPORTADOR",
  buyer:        "COMPRADOR / CLIENTE",
  parties:      "1. IDENTIFICACIÓN DE PARTES",
  product:      "2. DESCRIPCIÓN DEL PRODUCTO",
  price:        "3. PRECIO, VOLUMEN Y VALOR",
  certs:        "4. CERTIFICACIONES Y CALIDAD",
  payment:      "5. TÉRMINOS DE PAGO",
  timeline:     "6. CICLO OPERATIVO — TIMELINE ESTIMADO",
  mandatory:    "7. INFORMACIÓN MANDATORIA",
  observations: "8. OBSERVACIONES ESPECIALES",
  tc:           "9. TÉRMINOS Y CONDICIONES GENERALES",
  agent_sig:    "10. FIRMA DEL AGENTE",
  buyer_sig:    "11. ACEPTACIÓN DEL COMPRADOR",
  indicative:   "INDICATIVA — NO VINCULANTE",
  firm:         "OFERTA FIRME — VINCULANTE",
  origin_lbl:   "Origen",
  port_lbl:     "Puerto destino CFR",
  transit_lbl:  "Tránsito estimado",
  heads_lbl:    "Número de Cabezas",
  weight_lbl:   "Peso Promedio Referencia",
  qty_lbl:      "Cantidad",
  price_lbl:    "Precio CFR (USD/kg)",
  total_kg_lbl: "Peso Total Estimado",
  shipment_val_lbl: "Valor por Embarque / Lote",
  total_val_lbl:"Valor Total del Contrato",
  currency_lbl: "Moneda",
  validity_lbl: "Validez de la Oferta",
  sblc_lbl:     "Entidad SBLC / Garantía",
  unit_lbl:     "Unidad de medida",
  sco_note:     "Esta oferta es de carácter indicativo. Los precios y condiciones están sujetos a confirmación mediante Full Corporate Offer (FCO). No constituye compromiso contractual.",
  fco_note:     "Esta oferta es firme y vinculante durante {days} días desde la fecha de emisión ({date}). La aceptación del comprador activa el proceso SPA.",
  buyer_accept: "Al firmar este documento, el comprador confirma haber leído, comprendido y aceptado todas las condiciones de esta Full Corporate Offer.",
  buyer_sign:   "Firma del comprador / representante",
  company_stamp:"Sello de la empresa / fecha",
  name_position:"Nombre y cargo",
  footer_copy:  "Copia automática a: contabilidad@glvservicesexp.com • info@glvglobalfoodservices.com",
};

// ─── Language resolution ──────────────────────────────────────────────────────
function resolveDocLang(lang, doc) {
  if (lang === "en") return "en";
  return "es";
}

// ─── Build bilingual label: "ES / Secondary" ─────────────────────────────────
function bi(esText, secText) {
  if (!secText || secText === esText) return esText;
  return `${esText}  /  ${secText}`;
}

const fmtCurrency = (n) =>
  n != null
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
    : "—";

const COVER_COLORS = {
  SCO: "#1B2A4A",
  FCO: "#064e3b",
  SPA: "#1B2A4A",
};

const s = StyleSheet.create({
  page:         { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#1a202c" },
  coverPage:    { padding: 0, fontSize: 9, fontFamily: "Helvetica" },
  coverBg:      { padding: 40, minHeight: "100%", justifyContent: "space-between" },
  coverLogo:    { width: 60, height: 60, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 24 },
  coverLogoTxt: { color: "#ffffff", fontSize: 32, fontWeight: "bold" },
  coverTitle:   { color: "#ffffff", fontSize: 26, fontWeight: "bold", marginBottom: 6 },
  coverSub:     { color: "rgba(255,255,255,0.75)", fontSize: 11, marginBottom: 4 },
  coverBiSub:   { color: "rgba(255,255,255,0.5)", fontSize: 9, marginBottom: 2 },
  badge:        { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, fontSize: 9, fontWeight: "bold", alignSelf: "flex-start", marginBottom: 16 },
  langBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, fontSize: 8, fontWeight: "bold", alignSelf: "flex-start", marginBottom: 20,
                  backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.3)" },
  // Section headers — bilingual
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: "#1B2A4A", marginBottom: 2, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  sectionSub:   { fontSize: 7.5, color: "#64748b", marginBottom: 8, lineHeight: 1.6 },
  grid:         { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  infoBox:      { width: "48%", backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10" },
  infoLabel:    { fontSize: 7, color: "#64748b", fontWeight: "bold", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 1 },
  infoLabelSec: { fontSize: 6.5, color: "#94a3b8", marginBottom: 3 },
  infoValue:    { fontSize: 9, color: "#0f172a", fontWeight: "bold" },
  highlight:    { color: "#059669" },
  chinaBox:     { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#f59e0b", borderRadius: 6, padding: "8 12", marginBottom: 12 },
  chinaText:    { fontSize: 9, color: "#92400e", fontWeight: "bold" },
  paymentBox:   { backgroundColor: "#f0f4ff", borderWidth: 0.5, borderColor: "#c7d2fe", borderRadius: 6, padding: "10 12", marginBottom: 12 },
  paymentText:  { fontSize: 8.5, color: "#1e3a5f", lineHeight: 1.5 },
  spaBox:       { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#86efac", borderRadius: 6, padding: "10 12", marginBottom: 12 },
  indicativaBox:{ backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fde68a", borderRadius: 6, padding: "8 12", marginBottom: 12 },
  firmeBox:     { backgroundColor: "#dcfce7", borderWidth: 1, borderColor: "#86efac", borderRadius: 6, padding: "8 12", marginBottom: 12 },
  sigBlock:     { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 16, marginTop: 20 },
  buyerSigBlock:{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: "14 16", marginTop: 16, minHeight: 80 },
  footer:       { marginTop: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: "#e2e8f0", flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#94a3b8" },
  tcBox:        { backgroundColor: "#f8fafc", borderRadius: 6, padding: "10 12", marginBottom: 12, borderWidth: 0.5, borderColor: "#e2e8f0" },
  tcText:       { fontSize: 7.5, color: "#374151", lineHeight: 1.5 },
  // Language indicator bar
  langBar:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 6, padding: "5 10", marginBottom: 20 },
  langBarTxt:   { fontSize: 8, color: "rgba(255,255,255,0.7)" },
});

const PRICE_TABLE = {
  "UAE":                 { port: "Jebel Ali / Port Rashid, Dubai",   price: 5.70, transit: "25–28" },
  "Saudi Arabia (East)": { port: "Port of Dammam",                   price: 5.80, transit: "27–30" },
  "Saudi Arabia (West)": { port: "Port of Jeddah",                   price: 5.85, transit: "29–32" },
  "Türkiye (South)":     { port: "Port of Mersin",                   price: 5.95, transit: "20–24" },
  "Türkiye (Northwest)": { port: "Port of Derince / Istanbul",       price: 6.00, transit: "22–26" },
  "China":               { port: "Port of Shanghai / Tianjin",       price: 5.65, transit: "32–38" },
};

// ─── Fuzzy PRICE_TABLE lookup ─────────────────────────────────────────────────
function findPortInfo(dest) {
  if (!dest) return null;
  if (PRICE_TABLE[dest]) return PRICE_TABLE[dest];
  const d = dest.toLowerCase();
  if (d.includes("arab emirate") || d.includes("uae") || d.includes("dubai") || d.includes("abu dhabi")) return PRICE_TABLE["UAE"];
  if (d.includes("saudi") && d.includes("east")) return PRICE_TABLE["Saudi Arabia (East)"];
  if (d.includes("saudi") && d.includes("west")) return PRICE_TABLE["Saudi Arabia (West)"];
  if (d.includes("saudi")) return PRICE_TABLE["Saudi Arabia (East)"];
  if (d.includes("china")) return PRICE_TABLE["China"];
  if (d.includes("turk")) return PRICE_TABLE["Türkiye (South)"];
  return null;
}


function isLivestock(product) {
  if (!product) return false;
  return ["ovino", "bovino", "animal", "vivo"].some(k => product.toLowerCase().includes(k));
}
function isGrain(product) {
  if (!product) return false;
  return ["soya", "maíz", "maiz", "grano"].some(k => product.toLowerCase().includes(k));
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionTitle({ text }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.sectionTitle}>{text}</Text>
    </View>
  );
}

// ─── InfoBox ──────────────────────────────────────────────────────────────────
function BiInfoBox({ esLabel, secLabel, value, style, highlight }) {
  return (
    <View style={[s.infoBox, style]}>
      <Text style={s.infoLabel}>{esLabel}</Text>
      <Text style={[s.infoValue, highlight ? s.highlight : {}]}>{value}</Text>
    </View>
  );
}

function DocPDF({ doc, agentProfile, boundMedia, lang = "es" }) {
  const docLang = resolveDocLang(lang, doc);
  const L = PDF_T[docLang] || PDF_T.es;

  const isChina = (doc.destination || "").toLowerCase().includes("china");
  const coverBg = COVER_COLORS[doc.type] || "#1B2A4A";
  const isSCO = doc.type === "SCO";
  const isFCO = doc.type === "FCO";
  const isSPA = doc.type === "SPA";
  const portInfo = findPortInfo(doc.destination);
  // Read price from CommercialEngine row when doc.pricePerKg not saved
  const cdRows = ((typeof (doc.commercialData || doc.commercial_data) === "string")
    ? (() => { try { return JSON.parse(doc.commercialData || doc.commercial_data); } catch { return {}; } })()
    : (doc.commercialData || doc.commercial_data || {}))?.rows || [];
  const firstCdRow = cdRows[0] || {};
  const cdInc = (firstCdRow.incoterms || ["CFR"])[0];
  const containerType = firstCdRow.containerType || null;
  const CONTAINER_LABELS = { "20FT":"20FT Dry","40FT":"40FT Dry","40HC":"40HC High Cube","REEFER_20":"Reefer 20FT","REEFER_40":"Reefer 40FT","FLEXITANK":"Flexitank","ISO_TANK":"ISO Tank","BULK_VESSEL":"Bulk Vessel","LIVESTOCK_VESSEL":"Livestock Vessel","AIR_CARGO":"Air Cargo" };
  // V5: liquid/packaged engine fields
  const packagingMode    = firstCdRow.packagingMode    || null;
  const packagingType    = firstCdRow.packagingType    || null;
  const presentationSize = firstCdRow.presentationSize || null;
  const commercialUnit   = firstCdRow.commercialUnit   || null;
  const unitsPerBox      = parseFloat(firstCdRow.unitsPerBox || 0);
  const netWeightPerUnit = parseFloat(firstCdRow.netWeightPerUnit || 0);
  // V6: Multi-SKU export engine fields
  const exportFormat     = firstCdRow.exportFormat     || null;
  const rowSkus          = Array.isArray(firstCdRow.skus) ? firstCdRow.skus : [];
  // V7: Pouch packaging configuration
  const pouchConfig      = firstCdRow.pouchConfig      || {};
  // V7.1: canonical size — always read normalizedPresentationSize, never pouchConfig.presentationSize directly
  const normalizedPresentationSize = firstCdRow.normalizedPresentationSize || pouchConfig.presentationSize || null;
  const POUCH_FORMAT_IDS = new Set(["RETAIL_POUCH","PILLOW_POUCH","STAND_UP_POUCH","SPOUT_POUCH","GUSSET_POUCH","SIDE_SEAL_POUCH","BAG_IN_BOX","RETAIL_DOYPACK"]);
  const isPouchFormat    = POUCH_FORMAT_IDS.has(exportFormat);
  // Category-aware row classification — MUST be declared before isOilsRow
  // (const TDZ: isLiveAnimalRow must precede any reference to it)
  const isLiveAnimalRow  = firstCdRow.category === "LIVE_ANIMALS";
  // V8: Oils Export Engine configuration — only used when category === "OILS"
  const oilsConfig       = firstCdRow.oilsConfig       || {};
  const isOilsRow        = firstCdRow.category === "OILS" && !isLiveAnimalRow;
  const COMMERCIAL_UNIT_LABELS = { perKg:"/kg", perMT:"/MT", perLiter:"/L", perBox:"/box", perCarton:"/carton", perPouch:"/pouch", perUnit:"/unit", perContainer:"/container", perDrum:"/drum", perJerrycan:"/jerrycan", perBottle:"/bottle", perPallet:"/pallet", perIBC:"/IBC", perFlexitank:"/flexitank" };
  // Dynamic price label: "Precio CFR /pouch" instead of always "Precio CFR (USD/kg)"
  const cuAbbr = COMMERCIAL_UNIT_LABELS[commercialUnit] || null;
  const dynamicPriceLbl = cuAbbr && cuAbbr !== "/kg"
    ? (docLang === "en" ? `${cdInc} Price (USD${cuAbbr})` : `Precio ${cdInc} (USD${cuAbbr})`)
    : (L.price_lbl || (docLang === "en" ? `${cdInc} Price (USD/kg)` : `Precio ${cdInc} (USD/kg)`));
  // Export format display label (V6/V7)
  const exportFormatLabel = exportFormat ? exportFormat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null;
  const PACKAGING_TYPE_LABELS  = { FLEXITANK:"Flexi Tank",ISO_TANK:"ISO Tank",IBC_1000L:"IBC 1000L",DRUM_200L:"Drum 200L",JERRYCAN_20L:"Jerrycan 20L",JERRYCAN_10L:"Jerrycan 10L",JERRYCAN_5L:"Jerrycan 5L",BIG_BAG_1MT:"Big Bag 1MT",SACK_50KG:"Saco 50kg",BULK_VESSEL:"Granel Cisterna",PET_BOTTLE:"PET Bottle",GLASS_BOTTLE:"Glass Bottle",TETRA_PAK:"Tetra Pak",DOYPACK:"Doypack",SACHET:"Sachet",PLASTIC_GALLON:"Plastic Gallon",PREMIUM_BOTTLE:"Premium Bottle",CAN_TIN:"Can / Tin",RETAIL_BOX:"Retail Box",PILLOW_POUCH:"Pillow Pouch",STAND_UP_POUCH:"Stand Up Pouch",SPOUT_POUCH:"Spout Pouch",GUSSET_POUCH:"Gusset Pouch",SIDE_SEAL_POUCH:"Side Seal Pouch",BAG_IN_BOX:"Bag In Box" };
  const FILM_STRUCTURE_LABELS  = { PET_PE:"PET + PE (Standard)",PET_NYLON_PE:"PET + NYLON + PE (Premium)",BOPP_METPET_PE:"BOPP + MET PET + PE (Export Heavy Duty)" };
  const engineUnitPrice = parseFloat(
    firstCdRow.incotermPrices?.[cdInc] ||
    Object.values(firstCdRow.incotermPrices || {}).find(v => parseFloat(v) > 0) ||
    firstCdRow.unitPrice || 0
  );
  // isLiveAnimalRow declared above (before isOilsRow) to avoid const TDZ crash
  // engineHeads: ONLY for LIVE_ANIMALS; other categories must not inherit headCount into quantity
  const engineHeads = isLiveAnimalRow
    ? parseFloat(firstCdRow.specs?.headCount || firstCdRow.quantity || doc.headcount || 0)
    : 0;
  // engineAvgW: ONLY meaningful for LIVE_ANIMALS (default 45 kg/head); never inject into non-livestock
  const engineAvgW = isLiveAnimalRow
    ? parseFloat(firstCdRow.specs?.avgWeight || doc.avgWeight || 45)
    : 0;
  // Direct quantity for non-livestock categories (kg, MT, units — whatever was entered)
  const engineQty = isLiveAnimalRow ? 0 : parseFloat(firstCdRow.quantity || 0);
  // Unit type string e.g. "MT / Toneladas Métricas", "KG / Kilogramos"
  const engineUnitType = firstCdRow.unitType || "";
  const isMT = engineUnitType.includes("MT") || engineUnitType.includes("Tonelada");

  // pricePerKg — CommercialEngine ONLY. doc.pricePerKg is PRICE_TABLE-contaminated at save time.
  const pricePerKg = engineUnitPrice || null;

  // totalKgDisplay — live animals: head×weight; food/commodity: MT→kg conversion applied
  const totalKgDisplay = isLiveAnimalRow
    ? (engineHeads * engineAvgW)
    : (isMT ? engineQty * 1000 : engineQty);

  // Contract value: CommercialEngine summary first, then category-aware recompute, then doc fallback
  let engineContractValue = cdRows.reduce((s, r) => s + (r.summary?.contractValue || 0), 0);
  if (engineContractValue === 0 && engineUnitPrice > 0) {
    const baseQty = isLiveAnimalRow ? engineHeads * engineAvgW : engineQty;
    if (baseQty > 0) {
      const shipV = baseQty * engineUnitPrice;
      const freq  = firstCdRow.deliveryFrequency || "ONE_SHIPMENT";
      const spY   = freq === "MONTHLY" ? 12 : freq === "QUARTERLY" ? 4 : freq === "BIMONTHLY" ? 6 : parseFloat(firstCdRow.numShipments || 1);
      const dur   = parseFloat(firstCdRow.contractDuration || 12);
      const mV    = freq === "ONE_SHIPMENT" ? shipV : shipV * spY / 12;
      engineContractValue = mV * dur;
    }
  }
  const totalValue = engineContractValue || parseFloat(doc.totalValue) || null;

  // Shipment value = value for a single delivery/lot — category-isolated recompute
  const engineShipmentValue =
    cdRows.reduce((s, r) => s + (r.summary?.shipmentValue || 0), 0) ||
    (() => {
      const baseQty = isLiveAnimalRow ? engineHeads * engineAvgW : engineQty;
      return (baseQty > 0 && engineUnitPrice > 0) ? baseQty * engineUnitPrice : 0;
    })();

  const validityDays = doc.validityDays || doc.validity_days || 15;
  const productCategory = doc.product || "";
  const pdfTextKey = firstCdRow?.category
    ? getPDFTextKey(firstCdRow.category)
    : isLivestock(productCategory) ? "livestock"
    : isGrain(productCategory) ? "grain"
    : "food";

  const paymentOption = doc.paymentOption || doc.payment_option || doc.paymentMethod || "SBLC";
  const docTrigger = doc.docTrigger || doc.doc_trigger || "DOC-A";
  const hasGuarantee = doc.hasGuarantee || doc.has_guarantee;
  const guaranteeType = doc.guaranteeType || doc.guarantee_type;
  const bankName = doc.guaranteeBank || doc.guarantee_bank;

  const paymentText = generatePaymentText({
    productCategory,
    paymentOption,
    docTrigger,
    totalValue,
    currency: "USD",
    guaranteeType: hasGuarantee ? guaranteeType : null,
    bankName,
  });

  let productDesc = "";
  if (doc.product === "Otro" || doc.custom_product_name) {
    productDesc = doc.custom_product_desc || doc.customProductDesc || "";
  } else if (pdfTextKey === "livestock") {
    productDesc = docLang === "en"
      ? `Live animals sourced from registered, export-certified facilities. All animals meet international sanitary requirements and are certified by competent zoo-sanitary authorities in the country of origin.`
      : `Animales vivos procedentes de establecimientos registrados y habilitados para exportación. Los animales cumplen con todos los requisitos sanitarios internacionales y son certificados por autoridades zoosanitarias competentes del país de origen.`;
  } else if (pdfTextKey === "grain") {
    productDesc = docLang === "en"
      ? `High-quality bulk agricultural commodity with moisture, protein and aflatoxin analysis within international export standards.`
      : `Producto agrícola a granel de alta calidad, con análisis de humedad, proteína y aflatoxinas dentro de los estándares internacionales de exportación.`;
  } else {
    productDesc = docLang === "en"
      ? `Export food product meeting international quality standards established by GLV Global Food Services LLC.`
      : `Producto alimenticio de exportación que cumple con los estándares de calidad internacional establecidos por GLV Global Food Services LLC.`;
  }

  const exporter = doc.exporter || "GLV Global Food Services LLC (Miami, FL)";
  const domain = doc.domain || "glvglobalfoodservices.com";

  let certifications = docLang === "en"
    ? "• Official certificate of origin\n• Sanitary / phytosanitary export certificate\n• SGS inspection (or agreed equivalent)\n• Lot traceability documentation"
    : "• Certificado de origen oficial\n• Certificado sanitario/fitosanitario de exportación\n• Inspección SGS (o equivalente acordado)\n• Documentación de trazabilidad del lote";
  if (pdfTextKey === "livestock") {
    certifications = docLang === "en"
      ? "• Official zoo-sanitary certificate from the exporting country\n• Halal certificate (internationally recognized authority)\n• SGS live weight and quantity certificate\n• Official veterinary health declaration for the lot\n• Quarantine period approval certificate\n• Lot vaccination certificate"
      : "• Certificado zoosanitario oficial del país exportador\n• Certificado Halal (autoridad reconocida internacionalmente)\n• Certificado SGS de peso vivo y cantidad\n• Declaración de salud del lote por médico veterinario oficial\n• Aprobación del período de cuarentena\n• Certificado de vacunación del lote";
  }

  let timeline = "";
  if (pdfTextKey === "livestock") {
    timeline = docLang === "en"
      ? "Week 1–2: Contract signing (SPA) and advance payment\nWeek 3–6: Lot selection and concentration at origin\nWeek 7–10: Official quarantine period (minimum 21 days)\nWeek 11: SGS inspection, certification and SBLC activation\nWeek 12: Loading on specialized livestock vessel\nWeek 13–16: Maritime transit to CFR destination\nWeek 16+: Port delivery and final settlement"
      : "Semana 1–2: Firma de contrato (SPA) y pago del anticipo\nSemana 3–6: Selección y concentración del lote en origen\nSemana 7–10: Período de cuarentena oficial (mínimo 21 días)\nSemana 11: Inspección SGS, certificación y activación de SBLC\nSemana 12: Embarque en buque ganadero especializado\nSemana 13–16: Tránsito marítimo hacia destino CFR\nSemana 16+: Entrega en puerto y liquidación final";
  } else {
    timeline = docLang === "en"
      ? "Week 1: Contract signing and advance payment\nWeek 2–3: Lot preparation and consolidation\nWeek 4: Quality inspection and certifications\nWeek 5: Loading and dispatch at origin\nWeek 6+: Maritime transit and CFR delivery at destination"
      : "Semana 1: Firma de contrato y pago del anticipo\nSemana 2–3: Preparación y consolidación del lote\nSemana 4: Inspección de calidad y certificaciones\nSemana 5: Carga y despacho en origen\nSemana 6+: Tránsito marítimo y entrega CFR en destino";
  }

  let mandatoryInfo = null;
  if (pdfTextKey === "livestock") {
    mandatoryInfo = docLang === "en"
      ? "MANDATORY INFORMATION — LIVE ANIMALS:\n• All shipments comply with the OIE Terrestrial Animal Health Code\n• Vessels used are specialized livestock carriers with certified ventilation systems\n• Sexual composition of the lot shall be certified by an official veterinarian\n• The buyer is responsible for obtaining import permits in the destination country\n• Animals are certified free of notifiable diseases\n• TRANSIT MORTALITY: Invoicing is based on the certified loaded quantity at origin. Any mortality during transport is the buyer's sole responsibility and must be covered by their live cargo insurance policy. The seller applies no commercial deduction for transit mortality."
      : "INFORMACIÓN MANDATORIA — ANIMALES VIVOS:\n• Todos los embarques cumplen con el Código Sanitario para los Animales Terrestres de la OIE\n• Los buques utilizados son especializados en transporte de ganado vivo con sistema de ventilación certificado\n• La composición sexual del lote será certificada por veterinario oficial\n• El comprador es responsable de gestionar los permisos de importación en el país destino\n• Los animales son certificados libres de enfermedades de declaración obligatoria\n• MORTALIDAD EN TRÁNSITO: La facturación se realiza sobre la cantidad cargada certificada en origen. Cualquier mortalidad durante el transporte es responsabilidad exclusiva del comprador y deberá estar cubierta por su póliza de seguro de carga viva. El vendedor no aplica deducción comercial por mortalidad en tránsito.";
  } else if (pdfTextKey === "grain") {
    mandatoryInfo = docLang === "en"
      ? "MANDATORY INFORMATION — GRAINS AND CEREALS:\n• Product free of GMOs not authorized at destination\n• Maximum moisture content guaranteed per contract\n• Free of pests and contaminants per Codex Alimentarius standards\n• Fumigation and phytosanitary treatment included in CFR price"
      : "INFORMACIÓN MANDATORIA — GRANOS Y CEREALES:\n• Producto libre de organismos genéticamente modificados no autorizados en destino\n• Humedad máxima garantizada según contrato\n• Libre de plagas y contaminantes según normativa Codex Alimentarius\n• Fumigación y tratamiento fitosanitario incluidos en el precio CFR";
  }

  const tcText = docLang === "en"
    ? `GENERAL TERMS AND CONDITIONS:\n1. This offer is issued by ${exporter} in its capacity as a certified international exporter.\n2. Prices are per the agreed Incoterm(s) in accordance with Incoterms 2020, at the indicated destination port.\n3. Formal acceptance of this offer activates the SPA (Sales Purchase Agreement) process.\n4. All prices are denominated in the currency stated in the offer.\n5. Any dispute shall be resolved by international arbitration under ICC rules (Paris).\n6. The applicable law shall be as established in the definitive contract (SPA).\n7. GLV Global Food Services LLC reserves the right to modify prices due to force majeure or changes in international sanitary regulations.`
    : `TÉRMINOS Y CONDICIONES GENERALES:\n1. La presente oferta es emitida por ${exporter} en su calidad de exportador internacional certificado.\n2. Los precios son según el/los Incoterm(s) pactado(s) conforme a Incoterms 2020, en el puerto de destino indicado.\n3. La aceptación formal de esta oferta activa el proceso de elaboración del SPA (Sales Purchase Agreement).\n4. Todos los precios están denominados en la moneda indicada en la oferta.\n5. Cualquier controversia será resuelta mediante arbitraje internacional según las reglas de la CCI (París).\n6. La ley aplicable es la establecida en el contrato definitivo (SPA).\n7. GLV Global Food Services LLC se reserva el derecho de modificar precios por causas de fuerza mayor o cambios en normativas sanitarias internacionales.`;

  const fcoNote = (L.fco_note || "").replace("{days}", validityDays).replace("{date}", doc.date);

  return (
    <Document>
      {/* PAGE 1 — COVER */}
      <Page size="A4" style={s.coverPage}>
        <View style={[s.coverBg, { backgroundColor: coverBg }]}>
          <View>
            {/* Logo */}
            <View style={s.coverLogo}>
              <Text style={s.coverLogoTxt}>G</Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, marginBottom: 4 }}>
              GLV Global Food Services LLC — {domain}
            </Text>

            {/* Language indicator */}
            <View style={s.langBar}>
              <Text style={s.langBarTxt}>{docLang === "en" ? "Document in English" : "Documento en Español"}</Text>
              <Text style={s.langBarTxt}>{doc.type}</Text>
            </View>

            {/* Status badge */}
            {(isSCO || isFCO) && (
              <View style={[s.badge, {
                backgroundColor: isSCO ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.2)",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.4)"
              }]}>
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "bold" }}>
                  {isSCO ? L.indicative : L.firm}
                </Text>
              </View>
            )}

            <Text style={s.coverTitle}>{doc.id}</Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "bold", marginBottom: 3 }}>
              {isSCO ? "Soft Corporate Offer" : isFCO ? "Full Corporate Offer" : "Sales Purchase Agreement"}
            </Text>

            <Text style={s.coverSub}>Cliente / Client: {doc.client}</Text>
            <Text style={s.coverSub}>Producto / Product: {doc.product}</Text>
            <Text style={s.coverSub}>Destino / Destination: {doc.destination}{(() => { const p = doc.commercialData?.destinationPort || doc.commercial_data?.destinationPort || portInfo?.port; return p ? ` — ${p}` : ""; })()}</Text>
            <Text style={s.coverSub}>Fecha / Date: {doc.date}</Text>
            {totalValue && (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold", marginTop: 12 }}>
                {fmtCurrency(totalValue)} USD
              </Text>
            )}
          </View>

          <View>
            {isSCO && (
              <View style={[s.indicativaBox, { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.3)" }]}>
                <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.8)" }}>{L.sco_note}</Text>
              </View>
            )}
            {isFCO && (
              <View style={[s.firmeBox, { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.3)" }]}>
                <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.8)" }}>{fcoNote}</Text>
              </View>
            )}
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>
              GLV Holding Group © 2026 | {exporter}
            </Text>
          </View>
        </View>
      </Page>

      {/* PAGE 2 — MAIN CONTENT */}
      <Page size="A4" style={s.page}>

        {/* Bound media images */}
        {boundMedia?.main && (
          <View style={{ marginBottom: 16 }}>
            <Text style={s.sectionTitle}>Producto / Product</Text>
            <View style={{ flexDirection: "row", marginTop: 6 }}>
              <Image src={boundMedia.main} style={{ width: 190, height: 130, objectFit: "cover", borderRadius: 4, marginRight: 8 }} />
              {boundMedia.secondary?.[0] && (
                <Image src={boundMedia.secondary[0]} style={{ width: 110, height: 130, objectFit: "cover", borderRadius: 4, marginRight: 8 }} />
              )}
              {boundMedia.branding && (
                <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "flex-end" }}>
                  <Image src={boundMedia.branding} style={{ width: 80, height: 45, objectFit: "contain" }} />
                </View>
              )}
            </View>
          </View>
        )}

        {/* Section 1: Parties */}
        <SectionTitle text={L.parties} />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          <View style={[s.infoBox, { width: "48%", backgroundColor: "#f0f4ff" }]}>
            <Text style={[s.infoLabel, { color: "#1e3a5f" }]}>{L.seller}</Text>
            <Text style={{ fontSize: 9, fontWeight: "bold", color: "#1B2A4A", marginBottom: 2 }}>{exporter}</Text>
            <Text style={{ fontSize: 8, color: "#374151" }}>19790 W Dixie Hwy, Unit 1115{"\n"}Miami, FL 33180, USA</Text>
            <Text style={{ fontSize: 8, color: "#374151", marginTop: 2 }}>{domain}</Text>
            {isChina && <Text style={{ fontSize: 8, color: "#d97706", fontWeight: "bold", marginTop: 3 }}>GACC No. YA11000PDY110K805</Text>}
          </View>
          <View style={[s.infoBox, { width: "48%", backgroundColor: "#f8fafc" }]}>
            <Text style={s.infoLabel}>{L.buyer}</Text>
            <Text style={{ fontSize: 9, fontWeight: "bold", color: "#1B2A4A", marginBottom: 2 }}>{doc.client}</Text>
            {doc.clientCountry && <Text style={{ fontSize: 8, color: "#374151" }}>{docLang === "en" ? "Country:" : "País:"} {doc.clientCountry}</Text>}
            {(doc.clientRepresentative || doc.client_representative) && (
              <Text style={{ fontSize: 8, color: "#374151" }}>Rep: {doc.clientRepresentative || doc.client_representative}</Text>
            )}
            {(doc.clientEmail || doc.client_email) && (
              <Text style={{ fontSize: 8, color: "#374151" }}>{doc.clientEmail || doc.client_email}</Text>
            )}
            {(doc.clientPhone || doc.client_phone) && (
              <Text style={{ fontSize: 8, color: "#374151" }}>Tel: {doc.clientPhone || doc.client_phone}</Text>
            )}
          </View>
        </View>

        {/* Section 2: Product */}
        <SectionTitle text={L.product} />
        <View style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10", marginBottom: 16, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
          <Text style={{ fontSize: 9, fontWeight: "bold", color: "#1B2A4A", marginBottom: 4 }}>
            {doc.custom_product_name || doc.customProductName || doc.product}
          </Text>
          <Text style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.5 }}>{productDesc}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>{L.origin_lbl}</Text>
              <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{doc.origin || "Brazil"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>{L.port_lbl}</Text>
              <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>
                {doc.commercialData?.destinationPort || doc.commercial_data?.destinationPort || portInfo?.port || doc.destination}
              </Text>
            </View>
            {portInfo?.transit && (
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>{L.transit_lbl}</Text>
                <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{portInfo.transit} {docLang === "en" ? "days" : "días"}</Text>
              </View>
            )}
            {containerType && (
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>{docLang === "en" ? "Container / Vessel" : "Contenedor / Buque"}</Text>
                <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{CONTAINER_LABELS[containerType] || containerType}</Text>
              </View>
            )}
          </View>

          {/* V6/V7: Export Logistics line — shown when exportFormat or containerType is set */}
          {(exportFormat || containerType) && !isLiveAnimalRow && (
            <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: "#e2e8f0", flexDirection: "row", gap: 8 }}>
              {exportFormat && (
                <View style={{ flex: 1 }}>
                  <Text style={s.infoLabel}>{docLang === "en" ? "Export Format" : "Formato de exportación"}</Text>
                  <Text style={{ fontSize: 9, color: isPouchFormat ? "#6d28d9" : "#1e40af", fontWeight: "bold" }}>{exportFormatLabel}</Text>
                </View>
              )}
              {containerType && (
                <View style={{ flex: 1 }}>
                  <Text style={s.infoLabel}>{docLang === "en" ? "Export Logistics" : "Logística de exportación"}</Text>
                  <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{CONTAINER_LABELS[containerType] || containerType}</Text>
                </View>
              )}
              {commercialUnit && (
                <View style={{ flex: 1 }}>
                  <Text style={s.infoLabel}>{docLang === "en" ? "Commercial Basis" : "Base comercial"}</Text>
                  <Text style={{ fontSize: 9, color: "#059669", fontWeight: "bold" }}>USD {cuAbbr || "/unit"}</Text>
                </View>
              )}
            </View>
          )}

          {/* V7: Pouch Packaging Details — shown when a POUCH export format is active */}
          {isPouchFormat && !isLiveAnimalRow && (
            <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: "#ddd6fe", background: "#faf5ff" }}>
              <Text style={{ fontSize: 8, fontWeight: "bold", color: "#5b21b6", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {docLang === "en" ? "Pouch Packaging Specification" : "Especificación de Empaque Flexible"}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
                {pouchConfig.filmStructure && (
                  <View style={{ flex: 1, minWidth: "45%" }}>
                    <Text style={s.infoLabel}>{docLang === "en" ? "Film Structure" : "Estructura de Film"}</Text>
                    <Text style={{ fontSize: 8.5, color: "#1e40af", fontWeight: "bold" }}>
                      {FILM_STRUCTURE_LABELS[pouchConfig.filmStructure] || pouchConfig.filmStructure}
                    </Text>
                  </View>
                )}
                {pouchConfig.pouchType && (
                  <View style={{ flex: 1, minWidth: "45%" }}>
                    <Text style={s.infoLabel}>{docLang === "en" ? "Pouch Type" : "Tipo de Pouch"}</Text>
                    <Text style={{ fontSize: 8.5, color: "#5b21b6", fontWeight: "bold" }}>
                      {PACKAGING_TYPE_LABELS[pouchConfig.pouchType] || pouchConfig.pouchType}
                    </Text>
                  </View>
                )}
                {normalizedPresentationSize && (
                  <View style={{ flex: 1, minWidth: "30%" }}>
                    <Text style={s.infoLabel}>{docLang === "en" ? "Presentation Size" : "Tamaño"}</Text>
                    <Text style={{ fontSize: 8.5, color: "#0f172a", fontWeight: "bold" }}>{normalizedPresentationSize}</Text>
                  </View>
                )}
                {pouchConfig.unitsPerCarton && (
                  <View style={{ flex: 1, minWidth: "30%" }}>
                    <Text style={s.infoLabel}>{docLang === "en" ? "Units / Carton" : "Unidades / Cartón"}</Text>
                    <Text style={{ fontSize: 8.5, color: "#0f172a", fontWeight: "bold" }}>{pouchConfig.unitsPerCarton}</Text>
                  </View>
                )}
                {pouchConfig.sealType && (
                  <View style={{ flex: 1, minWidth: "30%" }}>
                    <Text style={s.infoLabel}>{docLang === "en" ? "Seal Type" : "Tipo de Sello"}</Text>
                    <Text style={{ fontSize: 8.5, color: "#374151", fontWeight: "bold" }}>{pouchConfig.sealType?.replace(/_/g," ")}</Text>
                  </View>
                )}
                {pouchConfig.valveOption && pouchConfig.valveOption !== "NONE" && (
                  <View style={{ flex: 1, minWidth: "30%" }}>
                    <Text style={s.infoLabel}>{docLang === "en" ? "Valve / Spout" : "Válvula / Espita"}</Text>
                    <Text style={{ fontSize: 8.5, color: "#374151", fontWeight: "bold" }}>{pouchConfig.valveOption?.replace(/_/g," ")}</Text>
                  </View>
                )}
                {pouchConfig.printType && (
                  <View style={{ flex: 1, minWidth: "30%" }}>
                    <Text style={s.infoLabel}>{docLang === "en" ? "Print" : "Impresión"}</Text>
                    <Text style={{ fontSize: 8.5, color: "#374151", fontWeight: "bold" }}>{pouchConfig.printType?.replace(/_/g," ")}</Text>
                  </View>
                )}
                {pouchConfig.oemCapabilities?.length > 0 && (
                  <View style={{ flex: 1, minWidth: "45%" }}>
                    <Text style={s.infoLabel}>{docLang === "en" ? "OEM / Label" : "OEM / Etiqueta"}</Text>
                    <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>
                      {pouchConfig.oemCapabilities.map(c => c.replace(/_/g," ")).join(" · ")}
                    </Text>
                  </View>
                )}
                {pouchConfig.certifications?.length > 0 && (
                  <View style={{ flex: 2, minWidth: "90%" }}>
                    <Text style={s.infoLabel}>{docLang === "en" ? "Food Grade Certifications" : "Certificaciones"}</Text>
                    <Text style={{ fontSize: 8.5, color: "#059669", fontWeight: "bold" }}>
                      {pouchConfig.certifications.join(" · ")}
                    </Text>
                  </View>
                )}
              </View>
              {/* Pouch commercial description */}
              <Text style={{ fontSize: 7.5, color: "#374151", lineHeight: 1.4, marginTop: 4, fontStyle: "italic" }}>
                {docLang === "en"
                  ? "Flexible multilayer food-grade pouch packaging designed for high-volume export distribution, optimized for freight efficiency, cost reduction, and large-scale retail and wholesale markets."
                  : "Empaque flexible multicapa de grado alimenticio diseñado para distribución de exportación de alto volumen, optimizado para eficiencia de flete, reducción de costos y mercados minoristas y mayoristas a gran escala."
                }
              </Text>
            </View>
          )}

          {/* V8.1: Oil Technical Specification + Export Logistics Summary — only for OILS */}
          {isOilsRow && (() => {
            // Safe extraction — never crash PDF rendering
            const oProductId   = safeStr(oilsConfig.productId, "");
            const oPackaging   = safeStr(oilsConfig.packagingType, "");
            const oSizeId      = safeStr(oilsConfig.sizeId, "");
            const oIncoterm    = safeStr(oilsConfig.incoterm, "FOB");
            const oMarket      = safeStr(oilsConfig.market, "");
            const oDest        = safeStr(oilsConfig.customCountry || oilsConfig.destination, "");
            const oGrade       = safeStr(oilsConfig.grade, "");
            const oGmo         = safeStr(oilsConfig.gmoStatus, "");
            const oOrigin      = safeStr(oilsConfig.origin, "");
            const oShelfLife   = safeStr(oilsConfig.shelfLife, "");
            const oPouchType   = safeStr(oilsConfig.pouchType, "");
            const oFilm        = safeStr(oilsConfig.filmMaterial, "");
            const oSeal        = safeStr(oilsConfig.sealType, "");
            const oUnits       = safeNum(oilsConfig.unitsPerContainer, 0);
            const oBasePrice   = safeNum(oilsConfig.basePrice, 0);
            const oFreight     = safeNum(oilsConfig.freightUSD, 0);
            const oFoodGrade   = safeArr(oilsConfig.foodGrade);
            const oOemCaps     = safeArr(oilsConfig.oemCaps);
            const oCerts       = safeArr(oilsConfig.certifications);
            const oContainerType = safeStr(oilsConfig.containerType, "40HQ");
            const oMoq         = safeStr(oilsConfig.moq, "");
            const oFrequency   = safeStr(oilsConfig.frequency, "");
            const oContractDur = safeStr(oilsConfig.contractDuration, "");
            const oGroupLabel  = oPackaging.includes("POUCH") || oPackaging.includes("DOYPACK") ? "Pouch"
                               : (oPackaging.includes("JERRY") || oPackaging.includes("DRUM") || oPackaging.includes("IBC") || oPackaging.includes("FLEXITANK") || oPackaging.includes("ISOTANK")) ? "Industrial"
                               : "PET";
            const hasOilData = oProductId || oPackaging;
            if (!hasOilData) return null;

            return (
              <>
                {/* OIL TECHNICAL SPECIFICATION */}
                <View style={{ marginBottom: 8, padding: 10, backgroundColor: "#f5f3ff", borderRadius: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: "bold", color: "#4c1d95", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {docLang === "en" ? "Oil Technical Specification" : "Especificación Técnica — Aceite"}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {oProductId && <View style={{ flex: 1, minWidth: "28%" }}>
                      <Text style={s.infoLabel}>{docLang === "en" ? "Oil Type" : "Tipo de Aceite"}</Text>
                      <Text style={{ fontSize: 8.5, color: "#4c1d95", fontWeight: "bold" }}>{oProductId.replace(/_/g," ")}</Text>
                    </View>}
                    {oGrade && <View style={{ flex: 1, minWidth: "28%" }}>
                      <Text style={s.infoLabel}>Grade</Text>
                      <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>{oGrade}</Text>
                    </View>}
                    {oGmo && <View style={{ flex: 1, minWidth: "28%" }}>
                      <Text style={s.infoLabel}>GMO Status</Text>
                      <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>{oGmo}</Text>
                    </View>}
                    {oOrigin && <View style={{ flex: 1, minWidth: "28%" }}>
                      <Text style={s.infoLabel}>{docLang === "en" ? "Origin" : "Origen"}</Text>
                      <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>{oOrigin}</Text>
                    </View>}
                    {oShelfLife && <View style={{ flex: 1, minWidth: "28%" }}>
                      <Text style={s.infoLabel}>{docLang === "en" ? "Shelf Life" : "Vida Útil"}</Text>
                      <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>{oShelfLife}</Text>
                    </View>}
                    {oPackaging && <View style={{ flex: 1, minWidth: "28%" }}>
                      <Text style={s.infoLabel}>{docLang === "en" ? "Packaging Format" : "Formato"}</Text>
                      <Text style={{ fontSize: 8.5, color: "#4c1d95", fontWeight: "bold" }}>{oPackaging.replace(/_/g," ")}</Text>
                    </View>}
                    {oSizeId && <View style={{ flex: 1, minWidth: "28%" }}>
                      <Text style={s.infoLabel}>{docLang === "en" ? "Presentation Size" : "Tamaño"}</Text>
                      <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>{oSizeId}</Text>
                    </View>}
                    {oMarket && <View style={{ flex: 1, minWidth: "28%" }}>
                      <Text style={s.infoLabel}>{docLang === "en" ? "Export Market" : "Mercado"}</Text>
                      <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>{oMarket}</Text>
                    </View>}
                    {oFoodGrade.length > 0 && <View style={{ flex: 1, minWidth: "55%" }}>
                      <Text style={s.infoLabel}>{docLang === "en" ? "Food Grade / Certs" : "Grado Alimenticio"}</Text>
                      <Text style={{ fontSize: 8.5, color: "#065f46", fontWeight: "bold" }}>{oFoodGrade.join(" · ")}</Text>
                    </View>}
                    {oCerts.length > 0 && <View style={{ flex: 1, minWidth: "55%" }}>
                      <Text style={s.infoLabel}>{docLang === "en" ? "Certifications" : "Certificaciones"}</Text>
                      <Text style={{ fontSize: 8.5, color: "#065f46", fontWeight: "bold" }}>{oCerts.join(" · ")}</Text>
                    </View>}
                  </View>

                  {/* Packaging-type specific technical fields */}
                  {oGroupLabel === "Pouch" && (oPouchType || oFilm || oSeal) && (
                    <View style={{ marginTop: 6, padding: "4px 8px", backgroundColor: "#ede9fe", borderRadius: 4 }}>
                      <Text style={{ fontSize: 8, color: "#4c1d95", fontWeight: "bold" }}>
                        {[oPouchType, oFilm, oSeal].filter(Boolean).map(v => v.replace(/_/g," ")).join(" · ")}
                      </Text>
                      <Text style={{ fontSize: 7.5, color: "#6d28d9", marginTop: 2 }}>
                        {docLang === "en" ? "Multilayer flexible packaging — food grade, grease-resistant, export ready"
                          : "Empaque flexible multicapa — grado alimenticio, resistente a grasas, apto exportación"}
                      </Text>
                    </View>
                  )}
                  {oGroupLabel === "PET" && oSizeId && (
                    <View style={{ marginTop: 6, padding: "4px 8px", backgroundColor: "#e0f2fe", borderRadius: 4 }}>
                      <Text style={{ fontSize: 7.5, color: "#0369a1" }}>
                        {docLang === "en"
                          ? `PET bottle ${oSizeId} — food grade, tamper-evident cap, export carton structure`
                          : `Botella PET ${oSizeId} — grado alimenticio, tapa inviolable, estructura cartón exportación`}
                      </Text>
                    </View>
                  )}
                  {oGroupLabel === "Industrial" && (
                    <View style={{ marginTop: 6, padding: "4px 8px", backgroundColor: "#f0fdf4", borderRadius: 4 }}>
                      <Text style={{ fontSize: 7.5, color: "#065f46" }}>
                        {docLang === "en"
                          ? `Industrial grade — stackable, horeca compatible, bulk foodservice supply`
                          : `Grado industrial — apilable, compatible horeca, suministro a granel`}
                      </Text>
                    </View>
                  )}
                  {oOemCaps.length > 0 && (
                    <Text style={{ fontSize: 8, color: "#7c3aed", marginTop: 4 }}>
                      {oOemCaps.join(" · ")}
                    </Text>
                  )}
                </View>

                {/* EXPORT LOGISTICS SUMMARY */}
                {(oContainerType || oUnits > 0 || oBasePrice > 0 || oMoq) && (
                  <View style={{ marginBottom: 8, padding: 10, backgroundColor: "#f0fdf4", borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: "bold", color: "#065f46", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {docLang === "en" ? "Export Logistics Summary" : "Resumen Logístico de Exportación"}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {oContainerType && <View style={{ flex: 1, minWidth: "28%" }}>
                        <Text style={s.infoLabel}>{docLang === "en" ? "Container Type" : "Tipo Contenedor"}</Text>
                        <Text style={{ fontSize: 8.5, color: "#065f46", fontWeight: "bold" }}>{oContainerType}</Text>
                      </View>}
                      {oPackaging && <View style={{ flex: 1, minWidth: "28%" }}>
                        <Text style={s.infoLabel}>{docLang === "en" ? "Packaging Format" : "Formato Empaque"}</Text>
                        <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>{oGroupLabel} — {oSizeId || "—"}</Text>
                      </View>}
                      {oIncoterm && <View style={{ flex: 1, minWidth: "28%" }}>
                        <Text style={s.infoLabel}>{docLang === "en" ? "Commercial Basis" : "Base Comercial"}</Text>
                        <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>{oIncoterm}</Text>
                      </View>}
                      {oUnits > 0 && <View style={{ flex: 1, minWidth: "28%" }}>
                        <Text style={s.infoLabel}>{docLang === "en" ? "Units / Container" : "Unidades / Contenedor"}</Text>
                        <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>{oUnits.toLocaleString()}</Text>
                      </View>}
                      {oBasePrice > 0 && oUnits > 0 && <View style={{ flex: 1, minWidth: "28%" }}>
                        <Text style={s.infoLabel}>{docLang === "en" ? "Shipment FOB Value" : "Valor FOB Embarque"}</Text>
                        <Text style={{ fontSize: 8.5, color: "#065f46", fontWeight: "bold" }}>${(oBasePrice * oUnits).toFixed(0)} USD</Text>
                      </View>}
                      {oFreight > 0 && <View style={{ flex: 1, minWidth: "28%" }}>
                        <Text style={s.infoLabel}>{docLang === "en" ? "Freight / Container" : "Flete / Contenedor"}</Text>
                        <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>${oFreight.toFixed(0)} USD</Text>
                      </View>}
                      {oDest && <View style={{ flex: 1, minWidth: "28%" }}>
                        <Text style={s.infoLabel}>{docLang === "en" ? "Destination" : "Destino"}</Text>
                        <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>{oDest.replace(/([A-Z])/g," $1").trim()}</Text>
                      </View>}
                      {oMoq && <View style={{ flex: 1, minWidth: "28%" }}>
                        <Text style={s.infoLabel}>MOQ</Text>
                        <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>{Number(oMoq).toLocaleString()} {docLang === "en" ? "units" : "unidades"}</Text>
                      </View>}
                      {oFrequency && <View style={{ flex: 1, minWidth: "28%" }}>
                        <Text style={s.infoLabel}>{docLang === "en" ? "Shipment Frequency" : "Frecuencia"}</Text>
                        <Text style={{ fontSize: 8.5, color: "#1B2A4A", fontWeight: "bold" }}>{oFrequency}{oContractDur ? ` / ${oContractDur}` : ""}</Text>
                      </View>}
                    </View>
                  </View>
                )}
              </>
            );
          })()}

          {/* V5: Liquid/Packaged packaging details — 4-layer display */}
          {(packagingType || presentationSize || commercialUnit) && !isLiveAnimalRow && (() => {
            // Resolve human-readable labels for PDF display
            const LIQUID_RETAIL_SIZE_LABELS = { "100ml":"100 ml","125ml":"125 ml","200ml":"200 ml","250ml":"250 ml","330ml":"330 ml","350ml":"350 ml","500ml":"500 ml","750ml":"750 ml","900ml":"900 ml","1000ml":"1 L","1L":"1 L","2L":"2 L","3L":"3 L","5L":"5 L","10L":"10 L","20L":"20 L" };
            const COMMERCIAL_UNIT_FULL_EN   = { perKg:"per KG",perMT:"per MT",perLiter:"per Liter",perBox:"per Box",perUnit:"per Unit",perContainer:"per Container",perDrum:"per Drum",perJerrycan:"per Jerrycan",perBottle:"per Bottle",perPallet:"per Pallet",perIBC:"per IBC",perFlexitank:"per Flexitank" };
            const COMMERCIAL_UNIT_FULL_ES   = { perKg:"por KG",perMT:"por MT",perLiter:"por Litro",perBox:"por Caja",perUnit:"por Unidad",perContainer:"por Contenedor",perDrum:"por Bidón",perJerrycan:"por Jerrycan",perBottle:"por Botella",perPallet:"por Paleta",perIBC:"por IBC",perFlexitank:"por Flexitank" };
            const ptLabel    = PACKAGING_TYPE_LABELS[packagingType] || packagingType || "";
            const sizeLabel  = LIQUID_RETAIL_SIZE_LABELS[presentationSize] || presentationSize || "";
            const cuLabelEn  = COMMERCIAL_UNIT_FULL_EN[commercialUnit] || commercialUnit || "";
            const cuLabelEs  = COMMERCIAL_UNIT_FULL_ES[commercialUnit] || commercialUnit || "";
            const cuAbbrLocal = COMMERCIAL_UNIT_LABELS[commercialUnit] || commercialUnit || "";
            const hasBoxEngine = unitsPerBox > 0 && presentationSize;
            const netKgPerCarton = unitsPerBox > 0 && netWeightPerUnit > 0 ? (unitsPerBox * netWeightPerUnit).toFixed(2) : null;
            return (
              <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: "#e2e8f0" }}>
                {/* Layer 1+2: Packaging type + presentation size inline */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                  {packagingType && (
                    <View style={{ flex: 1 }}>
                      <Text style={s.infoLabel}>{docLang === "en" ? "Packaging / Presentation" : "Empaque / Presentación"}</Text>
                      <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>
                        {ptLabel}{sizeLabel ? ` ${sizeLabel}` : ""}
                      </Text>
                    </View>
                  )}
                  {commercialUnit && (
                    <View style={{ flex: 1 }}>
                      <Text style={s.infoLabel}>{docLang === "en" ? "Commercial Sale Basis" : "Base Comercial de Venta"}</Text>
                      <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>
                        {docLang === "en" ? cuLabelEn : cuLabelEs}
                      </Text>
                    </View>
                  )}
                </View>
                {/* Layer 3: Box engine carton summary — e.g. "20 PET Bottles × 900 ml per export carton" */}
                {hasBoxEngine && (
                  <View style={{ marginTop: 4, backgroundColor: "#eff6ff", borderRadius: 4, padding: "5 8" }}>
                    <Text style={{ fontSize: 8.5, color: "#1e40af", fontWeight: "bold" }}>
                      {`${unitsPerBox} ${ptLabel}${presentationSize ? ` × ${sizeLabel}` : ""} ${docLang === "en" ? "per export carton" : "por caja de exportación"}`}
                    </Text>
                    {netKgPerCarton && (
                      <Text style={{ fontSize: 7.5, color: "#374151", marginTop: 2 }}>
                        {docLang === "en" ? `Net weight per carton: ${netKgPerCarton} kg` : `Peso neto por caja: ${netKgPerCarton} kg`}
                      </Text>
                    )}
                  </View>
                )}
                {/* Layer 4: Commercial basis line */}
                {commercialUnit && (
                  <View style={{ marginTop: 4, backgroundColor: "#fefce8", borderRadius: 4, padding: "4 8" }}>
                    <Text style={{ fontSize: 8, color: "#78350f", fontWeight: "bold" }}>
                      {docLang === "en" ? "Commercial basis:" : "Base comercial:"} {currency} {docLang === "en" ? cuLabelEn : cuLabelEs}
                      {containerType ? ` — ${CONTAINER_LABELS[containerType] || containerType}` : ""}
                    </Text>
                  </View>
                )}
              </View>
            );
          })()}

          {/* V6: Multi-SKU retail breakdown table */}
          {rowSkus.length > 0 && !isLiveAnimalRow && (() => {
            const SKU_PKG_LABELS = { PET_BOTTLE:"PET Bottle", GLASS_BOTTLE:"Glass Bottle", TETRA_PAK:"Tetra Pak", DOYPACK:"Doypack", SACHET:"Sachet", CAN_TIN:"Can / Tin", PREMIUM_BOTTLE:"Premium Bottle" };
            const SIZE_LABELS    = { "100ml":"100 ml","125ml":"125 ml","200ml":"200 ml","250ml":"250 ml","330ml":"330 ml","350ml":"350 ml","500ml":"500 ml","750ml":"750 ml","900ml":"900 ml","1000ml":"1 L","1L":"1 L","2L":"2 L","3L":"3 L","5L":"5 L","10L":"10 L","20L":"20 L" };
            const CU_ABBR        = { perBox:"/box", perUnit:"/unit", perBottle:"/bottle", perLiter:"/L", perKg:"/kg" };
            const fmtV = (v, cur = "USD") => v ? new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v) : "—";
            const totalShipV = rowSkus.reduce((s, sk) => s + (parseFloat(sk.quantity) || 0) * (parseFloat(sk.price) || 0), 0);
            const currency = firstCdRow.currency || "USD";
            return (
              <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: "#e2e8f0" }}>
                <Text style={{ fontSize: 7.5, color: "#64748b", fontWeight: "bold", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
                  {docLang === "en" ? `SKU Breakdown — ${rowSkus.length} Presentation${rowSkus.length > 1 ? "s" : ""}` : `Desglose SKU — ${rowSkus.length} Presentación${rowSkus.length > 1 ? "es" : ""}`}
                </Text>
                {/* Column headers */}
                <View style={{ flexDirection: "row", backgroundColor: "#1B2A4A", borderRadius: 4, padding: "4 6", marginBottom: 2 }}>
                  {["SKU", docLang === "en" ? "Packaging" : "Empaque", docLang === "en" ? "Size" : "Tamaño", docLang === "en" ? "Units/Carton" : "Unid/Caja", docLang === "en" ? "Qty" : "Cant.", docLang === "en" ? "Price" : "Precio", docLang === "en" ? "Shipment Value" : "Valor Embarque"].map((h, i) => (
                    <Text key={i} style={{ flex: i === 0 ? 0.4 : i >= 4 ? 1 : 1.2, fontSize: 6.5, color: "#fff", fontWeight: "bold", textAlign: i >= 4 ? "right" : "left" }}>{h}</Text>
                  ))}
                </View>
                {rowSkus.map((sk, i) => {
                  const pkgLabel  = SKU_PKG_LABELS[sk.packagingType] || sk.packagingType || "—";
                  const sizeLabel = SIZE_LABELS[sk.presentationSize] || sk.presentationSize || "—";
                  const qty       = parseFloat(sk.quantity) || 0;
                  const price     = parseFloat(sk.price) || 0;
                  const sv        = qty * price;
                  const cuAbbr    = CU_ABBR[sk.commercialUnit] || sk.commercialUnit || "";
                  const upb       = parseFloat(sk.unitsPerCarton) || 0;
                  return (
                    <View key={i} style={{ flexDirection: "row", backgroundColor: i % 2 === 0 ? "#f8fafc" : "#fff", padding: "4 6", borderRadius: 3 }}>
                      <Text style={{ flex: 0.4, fontSize: 7.5, color: "#1B2A4A", fontWeight: "bold" }}>{i + 1}</Text>
                      <Text style={{ flex: 1.2, fontSize: 7.5, color: "#374151" }}>{pkgLabel}</Text>
                      <Text style={{ flex: 1.2, fontSize: 7.5, color: "#374151" }}>{sizeLabel}</Text>
                      <Text style={{ flex: 1.2, fontSize: 7.5, color: "#374151", textAlign: "right" }}>{upb > 0 ? upb : "—"}</Text>
                      <Text style={{ flex: 1, fontSize: 7.5, color: "#374151", textAlign: "right" }}>{qty > 0 ? new Intl.NumberFormat("en-US").format(qty) : "—"}</Text>
                      <Text style={{ flex: 1, fontSize: 7.5, color: "#374151", textAlign: "right" }}>{price > 0 ? `${currency} ${price}${cuAbbr}` : "—"}</Text>
                      <Text style={{ flex: 1, fontSize: 7.5, color: "#059669", fontWeight: "bold", textAlign: "right" }}>{fmtV(sv, currency)}</Text>
                    </View>
                  );
                })}
                {/* Total shipment value row */}
                {totalShipV > 0 && (
                  <View style={{ flexDirection: "row", backgroundColor: "#1B2A4A", padding: "5 6", borderRadius: 4, marginTop: 2 }}>
                    <Text style={{ flex: 5, fontSize: 7.5, color: "#fff", fontWeight: "bold" }}>
                      {docLang === "en" ? "TOTAL SHIPMENT VALUE" : "VALOR TOTAL POR EMBARQUE"}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 8, color: "#4ade80", fontWeight: "bold", textAlign: "right" }}>{fmtV(totalShipV, currency)}</Text>
                  </View>
                )}
                {/* Export format indicator */}
                {exportFormat && (
                  <View style={{ marginTop: 4, backgroundColor: "#fefce8", borderRadius: 4, padding: "4 8" }}>
                    <Text style={{ fontSize: 7.5, color: "#78350f" }}>
                      {docLang === "en" ? "Export Format:" : "Formato de exportación:"} {exportFormat.replace(/_/g, " ")}
                      {containerType ? ` — ${CONTAINER_LABELS[containerType] || containerType}` : ""}
                    </Text>
                  </View>
                )}
              </View>
            );
          })()}

          {(doc.custom_unit || doc.customUnit) && (
            <View style={{ marginTop: 6 }}>
              <Text style={s.infoLabel}>{L.unit_lbl}</Text>
              <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{doc.custom_unit || doc.customUnit}</Text>
            </View>
          )}
        </View>

        {/* Commercial data table — multi-product rows from CommercialEngine */}
        {(() => {
          const cd = doc.commercialData || doc.commercial_data;
          const rows = cd?.rows?.filter(r => r.category && (r.quantity || (Array.isArray(r.skus) && r.skus.length > 0))) || [];
          if (rows.length === 0) return null;
          return (
            <View style={{ marginBottom: 16 }}>
              <View style={{ backgroundColor: "#1B2A4A", borderRadius: 6, padding: "6 10", marginBottom: 4 }}>
                <View style={{ flexDirection: "row" }}>
                  {(docLang === "en"
                    ? ["Product", "Origin", "Quantity", "Unit", "Incoterm", "Price/U", "Shipment Value", "Contract Value"]
                    : ["Producto", "Origen", "Cantidad", "Unidad", "Incoterm", "Precio/U", "Valor Embarque", "Valor Contrato"]
                  ).map(h => (
                    <Text key={h} style={{ flex: 1, fontSize: 7, color: "#fff", fontWeight: "bold", textAlign: "center" }}>{h}</Text>
                  ))}
                </View>
              </View>
              {rows.map((row, i) => {
                const catLabel = row.category || "—";
                const inc = (row.incoterms || ["CFR"])[0];
                const price = parseFloat(row.incotermPrices?.[inc] || row.unitPrice || 0);
                const isSkuRow = Array.isArray(row.skus) && row.skus.length > 0;
                let sv = row.summary?.shipmentValue || 0;
                let cv = row.summary?.contractValue || 0;

                // Recompute if summary is zero — category-isolated formula
                if (sv === 0 && price > 0) {
                  const isLiveRow = row.category === "LIVE_ANIMALS";
                  if (isLiveRow) {
                    const heads = parseFloat(row.specs?.headCount || row.quantity || 0);
                    const avgW  = parseFloat(row.specs?.avgWeight || 45);
                    sv = heads * avgW * price;
                  } else {
                    sv = parseFloat(row.quantity || 0) * price;
                  }
                  if (sv > 0) {
                    const freq = row.deliveryFrequency || "ONE_SHIPMENT";
                    const spYear = freq === "MONTHLY" ? 12 : freq === "QUARTERLY" ? 4 : freq === "BIMONTHLY" ? 6 : parseFloat(row.numShipments || 1);
                    const dur = parseFloat(row.contractDuration || 12);
                    const monthV = freq === "ONE_SHIPMENT" ? sv : sv * spYear / 12;
                    cv = monthV * dur;
                  }
                }

                const currency = row.currency || "USD";
                const fmtV = (v) => v ? new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v) : "—";
                return (
                  <View key={i} style={{ flexDirection: "row", backgroundColor: i % 2 === 0 ? "#f8fafc" : "#fff", padding: "5 10", borderRadius: 4 }}>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#1B2A4A", fontWeight: "bold" }}>{catLabel}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#374151" }}>{row.origin || "—"}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#374151", textAlign: "center" }}>{isSkuRow ? `${row.skus.length} SKU` : (row.quantity || "—")}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#374151", textAlign: "center" }}>{isSkuRow ? "Multi-SKU" : (row.unitType || "").split("/")[0].trim()}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#374151", textAlign: "center" }}>{inc}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#374151", textAlign: "right" }}>{isSkuRow ? "—" : (price ? `${currency} ${price}` : "—")}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#059669", fontWeight: "bold", textAlign: "right" }}>{fmtV(sv)}</Text>
                    <Text style={{ flex: 1, fontSize: 8, color: "#1B2A4A", fontWeight: "bold", textAlign: "right" }}>{fmtV(cv)}</Text>
                  </View>
                );
              })}
              {rows.length > 1 && (() => {
                const currency = rows[0]?.currency || "USD";
                const totalCV = rows.reduce((s, r) => s + (r.summary?.contractValue || 0), 0);
                const fmtV = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
                return (
                  <View style={{ flexDirection: "row", backgroundColor: "#1B2A4A", padding: "6 10", borderRadius: 4, marginTop: 2 }}>
                    <Text style={{ flex: 6, fontSize: 8, color: "#fff", fontWeight: "bold" }}>
                      {docLang === "en" ? `TOTAL EXPORT PROGRAM (${rows.length} products)` : `TOTAL PROGRAMA EXPORTACIÓN (${rows.length} productos)`}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 8.5, color: "#4ade80", fontWeight: "bold", textAlign: "right" }}>{fmtV(totalCV)}</Text>
                  </View>
                );
              })()}
            </View>
          );
        })()}

        {/* Section 3: Price */}
        <SectionTitle text={L.price} />

        {/* Shipment value — primary operational figure, displayed prominently above the grid */}
        {engineShipmentValue > 0 && (
          <View style={{ backgroundColor: "#1e3a5f", borderRadius: 8, padding: "12 14", marginBottom: 10 }}>
            <Text style={{ fontSize: 7.5, color: "rgba(255,255,255,0.65)", fontWeight: "bold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>
              {L.shipment_val_lbl}
            </Text>
            <Text style={{ fontSize: 18, color: "#ffffff", fontWeight: "bold" }}>
              {fmtCurrency(engineShipmentValue)}
            </Text>
          </View>
        )}

        {/* Total contract value — full-width secondary card when shipment value is also shown */}
        {totalValue && totalValue > 0 && (engineShipmentValue <= 0 || Math.abs(totalValue - engineShipmentValue) > 1) && (
          <View style={{ backgroundColor: "#f0fdf4", borderRadius: 8, padding: "10 12", marginBottom: 10, borderWidth: 0.5, borderColor: "#86efac" }}>
            <Text style={{ fontSize: 7.5, color: "#166534", fontWeight: "bold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>
              {L.total_val_lbl}
            </Text>
            <Text style={{ fontSize: 14, color: "#059669", fontWeight: "bold" }}>
              {fmtCurrency(totalValue)}
            </Text>
          </View>
        )}

        <View style={s.grid}>
          {isLiveAnimalRow && (engineHeads > 0 || doc.headcount) && (
            <BiInfoBox esLabel={L.heads_lbl}
              value={new Intl.NumberFormat().format(engineHeads || doc.headcount)} />
          )}
          {isLiveAnimalRow && (engineAvgW > 0 || doc.avgWeight) && (
            <BiInfoBox esLabel={L.weight_lbl}
              value={`${engineAvgW || doc.avgWeight} kg`} />
          )}
          {!isLiveAnimalRow && engineQty > 0 && (
            <BiInfoBox esLabel={L.qty_lbl}
              value={`${new Intl.NumberFormat().format(engineQty)} ${engineUnitType.split("/")[0].trim() || "unid."}`} />
          )}
          {pricePerKg && (
            <BiInfoBox esLabel={dynamicPriceLbl}
              value={`USD ${Number(pricePerKg).toFixed(2)}${cuAbbr || "/kg"}`} />
          )}
          {totalKgDisplay > 0 && (
            <BiInfoBox esLabel={L.total_kg_lbl}
              value={`${new Intl.NumberFormat().format(totalKgDisplay)} kg`} />
          )}
          <BiInfoBox esLabel={L.currency_lbl}
            value={doc.commercialData?.currency || doc.commercial_data?.currency || "USD — Dólares Americanos"} />
          <BiInfoBox esLabel={L.validity_lbl}
            value={`${validityDays} días / days`} />
          {(paymentOption.includes?.("SBLC") || paymentOption.includes?.("LC")) && (
            <BiInfoBox esLabel={L.sblc_lbl}
              value={doc.guaranteeBank || doc.guarantee_bank || "Por confirmar en contrato"} />
          )}
        </View>

        {/* Section 4: Certifications */}
        <SectionTitle text={L.certs} />
        <View style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10", marginBottom: 16, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
          <Text style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.6 }}>{certifications}</Text>
        </View>

        {/* Section 5: Payment */}
        <SectionTitle text={L.payment} />
        <View style={s.paymentBox}>
          <Text style={s.paymentText}>{paymentText}</Text>
        </View>

        {/* Section 6: Timeline */}
        <SectionTitle text={L.timeline} />
        <View style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10", marginBottom: 16, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
          <Text style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.6 }}>{timeline}</Text>
        </View>

        {/* Section 7: Mandatory */}
        {mandatoryInfo && (
          <>
            <SectionTitle text={L.mandatory} />
            <View style={[s.chinaBox, { backgroundColor: "#fff7ed", borderColor: "#fed7aa" }]}>
              <Text style={{ fontSize: 8.5, color: "#7c2d12", lineHeight: 1.5 }}>{mandatoryInfo}</Text>
            </View>
          </>
        )}

        {/* China alert box */}
        {isChina && (
          <View style={s.chinaBox}>
            <Text style={s.chinaText}>FILTRO CHINA — Entidad: GLV Services SAS (Colombia) | GACC No. YA11000PDY110K805</Text>
            {docLang === "zh" && (
              <Text style={{ fontSize: 8, color: "#92400e", marginTop: 4 }}>
                中国过滤器已激活 — 实体: GLV Services SAS (哥伦比亚) | GACC编号: YA11000PDY110K805
              </Text>
            )}
          </View>
        )}

        {/* SPA */}
        {isSPA && (
          <View style={s.spaBox}>
            <Text style={[s.sectionTitle, { color: "#166534", marginBottom: 6 }]}>
              {docLang === "en" ? "Contract Structure — SPA Model 2026-03-01" : "Estructura del Contrato — Modelo SPA2026-03-01"}
            </Text>
            <Text style={{ fontSize: 8, color: "#14532d" }}>
              {docLang === "en"
                ? "43 active legal clauses: Subject matter, Entities, Addresses, Constitutive documents, Product, Lot, Sexual composition, Volume, Invoicing basis, CFR Price, Currency, Destinations, Payment/SBLC (Clauses 13–15), SGS inspection, Halal, Quarantine, Maritime transport, Lot documents, Responsibilities, Insurance, Force majeure, Default, Penalties, Arbitration (ICC Paris), Applicable law."
                : "43 cláusulas legales activas: Objeto, Entidades, Domicilios, Documentos constitutivos, Producto, Lote, Composición sexual, Volumen, Base de facturación, Precio CFR, Moneda, Destinos, Pago/SBLC (Cláusulas 13–15), Inspección SGS, Halal, Cuarentena, Transporte marítimo, Documentos de lote, Responsabilidades, Seguros, Fuerza mayor, Incumplimiento, Penalidades, Arbitraje (CCI Paris), Ley aplicable."
              }
            </Text>
          </View>
        )}

        {/* Section 8: Observations */}
        {doc.observations && (
          <>
            <SectionTitle text={L.observations} />
            <View style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10", marginBottom: 16, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
              <Text style={{ fontSize: 8.5, color: "#374151" }}>{doc.observations}</Text>
            </View>
          </>
        )}

        {/* Section 9: T&C */}
        <SectionTitle text={L.tc} />
        <View style={s.tcBox}>
          <Text style={s.tcText}>{tcText}</Text>
        </View>

        {/* Section 10: Agent signature */}
        <View style={s.sigBlock}>
          <SectionTitle text={L.agent_sig} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              {agentProfile?.signature_b64 ? (
                <View style={{ marginBottom: 8, height: 60, justifyContent: "flex-end" }}>
                  <Image src={agentProfile.signature_b64} style={{ height: 50, maxWidth: 200, objectFit: "contain" }} />
                </View>
              ) : (
                <View style={{ height: 50, borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 8, width: 200 }} />
              )}
              <Text style={{ fontSize: 9, fontWeight: "bold", color: "#1B2A4A" }}>
                {agentProfile?.name || doc.agent}
              </Text>
              {agentProfile?.cargo && (
                <Text style={{ fontSize: 8, color: "#374151", marginTop: 2 }}>{agentProfile.cargo}</Text>
              )}
              <Text style={{ fontSize: 8, color: "#374151", marginTop: 1 }}>GLV Global Food Services LLC</Text>
              {agentProfile?.email && (
                <Text style={{ fontSize: 8, color: "#6b7280", marginTop: 1 }}>
                  {agentProfile.email}{agentProfile.phone ? ` · ${agentProfile.phone}` : ""}
                </Text>
              )}
              <Text style={{ fontSize: 8, color: "#2563eb", marginTop: 1 }}>glvglobalfoodservices.com</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 8, color: "#6b7280" }}>{docLang === "en" ? "Document:" : "Documento:"} {doc.id}</Text>
              <Text style={{ fontSize: 8, color: "#6b7280" }}>{docLang === "en" ? "Issued:" : "Emitido:"} {doc.date}</Text>
              <Text style={{ fontSize: 8, color: "#6b7280" }}>{docLang === "en" ? "Agent:" : "Agente:"} {doc.agent}</Text>
            </View>
          </View>
        </View>

        {/* Section 11: Buyer acceptance (FCO only) */}
        {isFCO && (
          <View style={{ marginTop: 20 }}>
            <SectionTitle text={L.buyer_sig} />
            <View style={s.buyerSigBlock}>
              <Text style={{ fontSize: 8, color: "#6b7280", marginBottom: 3 }}>
                {L.buyer_accept}
              </Text>
              <View style={{ flexDirection: "row", gap: 24, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ height: 40, borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 4 }} />
                  <Text style={{ fontSize: 8, color: "#6b7280" }}>{L.buyer_sign}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ height: 40, borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 4 }} />
                  <Text style={{ fontSize: 8, color: "#6b7280" }}>{L.company_stamp}</Text>
                </View>
              </View>
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 8, fontWeight: "bold", color: "#374151" }}>
                  {L.name_position}: {doc.clientRepresentative || doc.client_representative || "_________________________"}
                </Text>
              </View>
            </View>
            <View style={s.firmeBox}>
              <Text style={{ fontSize: 8, color: "#14532d" }}>{fcoNote}</Text>
            </View>
          </View>
        )}

        {isSCO && (
          <View style={s.indicativaBox}>
            <Text style={{ fontSize: 8, color: "#92400e" }}>{L.sco_note}</Text>
          </View>
        )}

        {/* Footer — keep Latin text only to avoid bidirectional rendering issues */}
        <View style={s.footer}>
          <Text>Agente: {doc.agent} | {PDF_T.en.footer_copy}</Text>
          <Text>GLV Holding Group © 2026</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadPDF(doc, agentProfile, boundMedia, lang = "es") {
  // ── Destination / port / media isolation log ──────────────────────────────────
  console.log("[GLV-PDF] Pre-render isolation state —", doc.id, {
    destination:    doc.destination,
    cdDestination:  doc.commercialData?.destination || doc.commercial_data?.destination,
    cdPort:         doc.commercialData?.destinationPort || doc.commercial_data?.destinationPort,
    portFallback:   findPortInfo(doc.destination)?.port || null,
    category:       doc.commercialData?.category || doc.commercial_data?.category || doc.product,
    media: {
      main:      !!boundMedia?.main,
      mainLen:   boundMedia?.main?.length || 0,
      sec:       (boundMedia?.secondary || []).length,
      branding:  !!boundMedia?.branding,
      metaIds: {
        main:    boundMedia?.meta?.main?.id,
        sec:     (boundMedia?.meta?.secondary || []).map(a => a?.id),
        brand:   boundMedia?.meta?.branding?.[0]?.id,
      },
    },
  });
  // ── Pre-render state validation ───────────────────────────────────────────────
  try {
    const cd = doc.commercialData || doc.commercial_data;
    const parsedCd = typeof cd === "string" ? (() => { try { return JSON.parse(cd); } catch { return {}; } })() : (cd || {});
    const rows = parsedCd?.rows || [];
    const firstRow = rows[0] || {};
    const cdInc = (firstRow.incoterms || ["CFR"])[0];
    const ePrice = parseFloat(
      firstRow.incotermPrices?.[cdInc] ||
      Object.values(firstRow.incotermPrices || {}).find(v => parseFloat(v) > 0) ||
      firstRow.unitPrice || 0
    );
    const eHeads = parseFloat(firstRow.specs?.headCount || firstRow.quantity || 0);
    const eAvgW  = parseFloat(firstRow.specs?.avgWeight || 45);
    const eShipV = firstRow.summary?.shipmentValue || (eHeads * eAvgW * ePrice) || 0;
    const eTotalV = rows.reduce((s, r) => s + (r.summary?.contractValue || 0), 0);
    const legacyHeads = parseFloat(doc.headcount || 0);
    const legacyPrice = parseFloat(doc.pricePerKg || 0);
    const legacyTotal = parseFloat(doc.totalValue || 0);

    console.log("[GLV-PDF] Pre-render validation —", doc.id, {
      engine:  { heads: eHeads, avgW: eAvgW, price: ePrice, shipmentValue: eShipV, contractValue: eTotalV },
      legacy:  { heads: legacyHeads, price: legacyPrice, totalValue: legacyTotal },
      using:   "CommercialEngine (engine values take priority)",
    });

    const mismatch = {
      heads: legacyHeads > 0 && eHeads > 0 && legacyHeads !== eHeads,
      price: legacyPrice > 0 && ePrice > 0 && Math.abs(legacyPrice - ePrice) > 0.001,
      total: legacyTotal > 0 && eTotalV > 0 && Math.abs(legacyTotal - eTotalV) / eTotalV > 0.01,
    };
    if (mismatch.heads || mismatch.price || mismatch.total) {
      console.warn("[GLV-PDF] STALE DOC FIELDS DETECTED — PDF will render using CommercialEngine values. Stale fields:", {
        ...(mismatch.heads  && { headCount:      `doc=${legacyHeads}  engine=${eHeads}` }),
        ...(mismatch.price  && { pricePerKg:     `doc=${legacyPrice}  engine=${ePrice}` }),
        ...(mismatch.total  && { contractValue:  `doc=${legacyTotal}  engine=${eTotalV}` }),
      });
    } else {
      console.log("[GLV-PDF] All values consistent — no stale state detected.");
    }
  } catch (err) {
    console.warn("[GLV-PDF] Pre-render validation error:", err.message);
  }
  // ─────────────────────────────────────────────────────────────────────────────
  const blob = await pdf(<DocPDF doc={doc} agentProfile={agentProfile} boundMedia={boundMedia} lang={lang} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default DocPDF;
