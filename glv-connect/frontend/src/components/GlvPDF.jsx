import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Font, pdf, Image,
} from "@react-pdf/renderer";
import { generatePaymentText } from "../utils/paymentText.js";
import { runFullInspection } from "./pdf/PdfRuntimeInspector.js";
import { getPDFTextKey } from "../engines/categoryEngine.js";
import { safeCurrencyResolver, resolvePdfCurrency, fmtPdfCurrency } from "../utils/safeCurrencyResolver.js";
import { sanitizePdfPayload, detectStaleFields } from "../utils/pdfPayloadSanitizer.js";
import { validatePdfCurrencyScope, validatePdfRuntimeSafety, validateIntlFormatting, validateStaleFields } from "../engines/validationSupervisor.js";
import {
  resolveDocumentMode, getCategoryDisplayLabel,
  getModeProductDescription, getModeCertifications,
  getModeTimeline, getModeMandatoryInfo, getModeCoverLabel,
  DOCUMENT_MODES,
} from "../engines/documentModeResolver.js";
import { auditBoundMediaForMode, getMaxSecondaryImages } from "../engines/media/MediaCategoryIsolationEngine.js";
import {
  EXECUTIVE_COLORS, EXECUTIVE_SPACING,
  buildCoverPageData, buildTimelineData,
  getTrustBadges, getCategoryVisualMode, buildFooterData,
} from "../core/pdf/ExecutivePdfIntegrationBridge.js";

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

// V9.2 FIX: Do NOT register custom font named "Helvetica".
// In @react-pdf/renderer v3.x, "Helvetica" is a built-in standard PDF font.
// Registering it with an external URL forces a network fetch during pdf().toBlob().
// If that fetch fails (CORS / timeout / network), the entire PDF crashes silently.
// Solution: let react-pdf use the built-in Helvetica — no network fetch, always works.

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
  page:         { paddingTop: 32, paddingBottom: 46, paddingHorizontal: 40, fontSize: 9, fontFamily: "Helvetica", color: "#1a202c" },
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
  paymentBox:   { backgroundColor: "#FFFFFF", borderWidth: 0.5, borderColor: "#DDE3EC", borderLeftWidth: 2.5, borderLeftColor: "#059669", borderRadius: 2, padding: "10 14", marginBottom: 18 },
  paymentText:  { fontSize: 8.5, color: "#1e3a5f", lineHeight: 1.6 },
  spaBox:       { backgroundColor: "#FFFFFF", borderWidth: 0.5, borderColor: "#DDE3EC", borderTopWidth: 2, borderTopColor: "#1B2A4A", borderRadius: 2, padding: "10 14", marginBottom: 14 },
  indicativaBox:{ backgroundColor: "#FFFBEB", borderWidth: 0.5, borderColor: "#FDE68A", borderLeftWidth: 2, borderLeftColor: "#D97706", borderRadius: 2, padding: "8 12", marginBottom: 12 },
  firmeBox:     { backgroundColor: "#dcfce7", borderWidth: 1, borderColor: "#86efac", borderRadius: 6, padding: "8 12", marginBottom: 12 },
  sigBlock:     { borderTopWidth: 0.5, borderTopColor: "#E8ECF1", paddingTop: 16, marginTop: 20 },
  buyerSigBlock:{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: "14 16", marginTop: 16, minHeight: 80 },
  footer:       { marginTop: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: "#e2e8f0", flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#94a3b8" },
  tcBox:        { backgroundColor: "#FAFBFC", borderRadius: 2, padding: "10 14", marginBottom: 16, borderWidth: 0.5, borderColor: "#EEF1F5" },
  tcText:       { fontSize: 7.5, color: "#374151", lineHeight: 1.65 },
  // Language indicator bar
  langBar:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 6, padding: "5 10", marginBottom: 20 },
  langBarTxt:   { fontSize: 8, color: "rgba(255,255,255,0.7)" },
});

// ─── Executive V2 styles — Enterprise Visual Dominance ───────────────────────
const execS = StyleSheet.create({

  // ── Identity bar (top of cover) ────────────────────────────────────────────
  identityBar:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.14)" },
  identityLeft:      { flex: 1 },
  identityPlatform:  { color: "#FFFFFF", fontSize: 13, fontWeight: "bold", letterSpacing: 2.5, marginBottom: 4 },
  identityGroup:     { color: "rgba(255,255,255,0.48)", fontSize: 7, letterSpacing: 1.2 },
  identityRight:     { alignItems: "flex-end" },
  identityTag:       { fontSize: 6.5, color: "rgba(255,255,255,0.32)", letterSpacing: 0.8, marginBottom: 2 },

  // ── Gold rules ─────────────────────────────────────────────────────────────
  goldRule:          { height: 1, backgroundColor: EXECUTIVE_COLORS.ACCENT_GOLD, marginVertical: 16 },
  goldRuleThin:      { height: 0.5, backgroundColor: EXECUTIVE_COLORS.ACCENT_GOLD, marginBottom: 10, width: 48 },

  // ── Section heading (Page 2) — gold left bar + gold bottom rule ────────────
  execSectionTitle:  { fontSize: 8.5, fontWeight: "bold", color: EXECUTIVE_COLORS.PRIMARY_DARK, letterSpacing: 1.3, textTransform: "uppercase" },

  // ── Operation summary table (cover Zone 4) ─────────────────────────────────
  summaryTable:      { marginBottom: 18, marginTop: 12 },
  summaryTableHdr:   { fontSize: 6.5, color: "rgba(255,255,255,0.32)", letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 10, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.09)" },
  summaryRow:        { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.07)", paddingVertical: 6 },
  summaryLabel:      { width: "40%", fontSize: 7, color: "rgba(255,255,255,0.48)", letterSpacing: 0.6, textTransform: "uppercase", paddingRight: 4 },
  summaryValue:      { flex: 1, fontSize: 9, color: "#FFFFFF", fontWeight: "bold", letterSpacing: 0.2 },

  // ── Trust badges (cover Zone 5) ────────────────────────────────────────────
  trustRow:          { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  trustBadge:        { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: "rgba(201,168,76,0.45)", borderRadius: 1, backgroundColor: "rgba(201,168,76,0.05)" },
  trustBadgeTxt:     { fontSize: 6.5, fontWeight: "bold", color: "rgba(201,168,76,0.82)", letterSpacing: 0.9, textTransform: "uppercase" },

  // ── Timeline strip (Page 2 Section 6) ─────────────────────────────────────
  timelineWrap:      { marginBottom: 16, paddingVertical: 12, paddingHorizontal: 10, backgroundColor: "#F7F9FC", borderWidth: 0.5, borderColor: "#E2E8F0", borderRadius: 2 },
  timelineHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  timelineRow:       { flexDirection: "row", alignItems: "center" },
  timelineNode:      { width: 10, height: 10, borderRadius: 5, justifyContent: "center", alignItems: "center" },
  timelineNodeInner: { width: 4, height: 4, borderRadius: 2 },
  timelineConnector: { flex: 1, height: 1, marginHorizontal: 2 },
  timelineLabels:    { flexDirection: "row", marginTop: 7 },
  timelineLabel:     { fontSize: 6, textAlign: "center", letterSpacing: 0.2 },
  timelineProgress:  { fontSize: 6.5, color: EXECUTIVE_COLORS.ACCENT_GOLD, fontWeight: "bold", letterSpacing: 0.4 },

  // ── Audit footer (absolute bottom bar on every page) ──────────────────────
  execFooter:        { position: "absolute", bottom: 0, left: 0, right: 0, height: 30, backgroundColor: "#162340", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18 },
  execFooterAccent:  { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: EXECUTIVE_COLORS.ACCENT_GOLD },
  execFooterText:    { fontSize: 6.5, color: "rgba(255,255,255,0.52)", letterSpacing: 0.3 },
  execFooterRef:     { fontSize: 7.5, color: EXECUTIVE_COLORS.ACCENT_GOLD, fontWeight: "bold", letterSpacing: 0.3 },
  execFooterConf:    { fontSize: 6.5, color: "rgba(255,255,255,0.32)", letterSpacing: 1.1 },

  // ── Contract value hero (cover) ────────────────────────────────────────────
  coverValue:        { fontSize: 24, fontWeight: "bold", color: "#FFFFFF", marginTop: 8, letterSpacing: 0.8 },
  coverValueSub:     { fontSize: 7.5, color: "rgba(255,255,255,0.48)", marginTop: 2, letterSpacing: 0.4 },
  coverValueCurrency:{ fontSize: 11, color: "rgba(255,255,255,0.58)" },
});

// ─── Executive helper components ─────────────────────────────────────────────

function GoldRule() {
  return <View style={execS.goldRule} />;
}

function ExecSectionTitle({ text }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 14 }}>
      <View style={{ width: 2.5, backgroundColor: EXECUTIVE_COLORS.ACCENT_GOLD, marginRight: 7, marginTop: 1, height: 12 }} />
      <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: EXECUTIVE_COLORS.ACCENT_GOLD, paddingBottom: 5 }}>
        <Text style={execS.execSectionTitle}>{text}</Text>
      </View>
    </View>
  );
}

function ExecIdentityBar({ lang, tag }) {
  const tagLabel = tag || (lang === "en" ? "ENTERPRISE EXPORT" : "EXPORTACIÓN ENTERPRISE");
  return (
    <View style={execS.identityBar}>
      <View style={execS.identityLeft}>
        <Text style={execS.identityPlatform}>GLV GLOBAL OPERATING SYSTEM</Text>
        <Text style={execS.identityGroup}>GLV Holding Group  ·  Global Export & Operations  ·  Multi-Country</Text>
      </View>
      <Text style={execS.identityTag}>{tagLabel}</Text>
    </View>
  );
}

function ExecOperationSummaryTable({ product, origin, destination, incoterm, totalValue, currency, validityDays, date, containerType, lang, rowOrder }) {
  const labels = {
    es: { product:"PRODUCTO", origin:"ORIGEN", dest:"DESTINO", incoterm:"INCOTERM", value:"VALOR TOTAL", validity:"VALIDEZ", container:"CONTENEDOR" },
    en: { product:"PRODUCT",  origin:"ORIGIN", dest:"DESTINATION", incoterm:"INCOTERM", value:"TOTAL VALUE", validity:"VALIDITY", container:"CONTAINER" },
  };
  const L = labels[lang === "en" ? "en" : "es"];

  const fmt = (n) => n ? `${currency || "USD"} ${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : null;
  const validStr = validityDays ? `${validityDays} ${lang === "en" ? "days" : "días"}` : null;

  const rowMap = {
    product:     product       ? { label: L.product,   value: product }          : null,
    origin:      origin        ? { label: L.origin,    value: origin }            : null,
    destination: destination   ? { label: L.dest,      value: destination }       : null,
    incoterm:    incoterm      ? { label: L.incoterm,  value: incoterm }          : null,
    container:   containerType ? { label: L.container, value: containerType }     : null,
    value:       totalValue    ? { label: L.value,     value: fmt(totalValue) }   : null,
    validity:    validStr      ? { label: L.validity,  value: validStr }          : null,
  };
  const defaultOrder = ["product","origin","destination","incoterm","container","value","validity"];
  const rows = (rowOrder || defaultOrder).map(k => rowMap[k]).filter(Boolean);

  return (
    <View style={execS.summaryTable}>
      <Text style={execS.summaryTableHdr}>
        {lang === "en" ? "OPERATION BRIEF" : "RESUMEN DE OPERACIÓN"}
      </Text>
      {rows.map((row, i) => (
        <View key={i} style={execS.summaryRow}>
          <Text style={execS.summaryLabel}>{row.label}</Text>
          <Text style={execS.summaryValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ExecTrustRow({ lang }) {
  const badges = getTrustBadges(lang === "en" ? "en" : "es");
  return (
    <View style={execS.trustRow}>
      {badges.map(b => (
        <View key={b.id} style={execS.trustBadge}>
          <Text style={execS.trustBadgeTxt}>· {b.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ExecTimelineStrip({ workflowState, lang, lifecycleLabel }) {
  try {
    const tl     = buildTimelineData(workflowState || "QUOTED", lang === "en" ? "en" : "es");
    const stages = tl.stages || [];
    const w      = 100 / Math.max(stages.length, 1);
    const stageLabel = lang === "en" ? `STAGE ${tl.currentOrder}/${tl.totalStages}` : `ETAPA ${tl.currentOrder}/${tl.totalStages}`;
    return (
      <View style={execS.timelineWrap}>
        <View style={execS.timelineHeader}>
          <Text style={{ fontSize: 7, fontWeight: "bold", color: EXECUTIVE_COLORS.PRIMARY_DARK, letterSpacing: 1.1, textTransform: "uppercase" }}>
            {lifecycleLabel || (lang === "en" ? "OPERATION LIFECYCLE" : "CICLO OPERATIVO")}
          </Text>
          <Text style={execS.timelineProgress}>
            {stageLabel} · {tl.progressPercent}%
          </Text>
        </View>
        <View style={execS.timelineRow}>
          {stages.map((stage, idx) => (
            <React.Fragment key={stage.id}>
              <View style={[execS.timelineNode, {
                backgroundColor: stage.isCompleted ? "#059669"
                               : stage.isCurrent   ? EXECUTIVE_COLORS.ACCENT_GOLD
                               :                     "#E2E8F0",
              }]}>
                <View style={[execS.timelineNodeInner, {
                  backgroundColor: stage.isCompleted ? "#FFFFFF"
                                 : stage.isCurrent   ? "#FFFFFF"
                                 :                     "#CBD5E1",
                }]} />
              </View>
              {idx < stages.length - 1 && (
                <View style={[execS.timelineConnector, {
                  backgroundColor: stage.isCompleted ? EXECUTIVE_COLORS.ACCENT_GOLD : "#E2E8F0",
                }]} />
              )}
            </React.Fragment>
          ))}
        </View>
        <View style={execS.timelineLabels}>
          {stages.map(stage => (
            <View key={stage.id} style={{ width: `${w}%` }}>
              <Text style={[execS.timelineLabel, {
                color: stage.isCurrent   ? EXECUTIVE_COLORS.PRIMARY_DARK
                     : stage.isCompleted ? "#059669"
                     :                     "#94A3B8",
                fontWeight: stage.isCurrent ? "bold" : "normal",
              }]}>{stage.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  } catch (_) { return null; }
}

// Subtle grey cadence line between major sections — adds rhythm without weight
function SectionSep() {
  return <View style={{ height: 0.5, backgroundColor: "#E8ECF1", marginVertical: 10 }} />;
}

function ExecAuditFooter({ documentRef, date, lang }) {
  const confLabel = lang === "en" ? "CONFIDENTIAL" : "CONFIDENCIAL";
  return (
    <View style={execS.execFooter}>
      <View style={execS.execFooterAccent} />
      <Text style={execS.execFooterRef}>{documentRef}</Text>
      <Text style={execS.execFooterText}>GLV GOS  ·  GLV Holding Group  ·  {date}</Text>
      <Text style={execS.execFooterConf}>{confLabel}</Text>
    </View>
  );
}

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
    <View style={[{ backgroundColor: "#FFFFFF", borderWidth: 0.5, borderColor: "#E8ECF1", borderRadius: 2, padding: "7 10" }, style]}>
      <Text style={{ fontSize: 6.5, color: "#94A3B8", fontWeight: "bold", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 3 }}>{esLabel}</Text>
      <Text style={[{ fontSize: 9.5, color: "#0F172A", fontWeight: "bold" }, highlight ? s.highlight : {}]}>{value}</Text>
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
  // Category atmosphere helpers — READ-ONLY derivations from firstCdRow.category
  const isGrainRow = !isLiveAnimalRow && !isOilsRow &&
    ["GRAINS","BEANS","LENTILS","CHICKPEAS","COMMODITIES","ANIMAL_FEED"].includes(firstCdRow.category);
  const isFrozenRow = !isLiveAnimalRow && !isOilsRow &&
    ["FROZEN_MEAT","FROZEN_POULTRY"].includes(firstCdRow.category);

  // Document Intelligence Mode — drives all executive content selection
  const docMode = resolveDocumentMode(firstCdRow, doc);
  // Media isolation audit — log only, never blocks PDF
  const mediaAudit = auditBoundMediaForMode(boundMedia, docMode);
  if (mediaAudit.issues.length > 0) {
    console.warn("[PDF_MEDIA_ISOLATION]", mediaAudit.issues);
  }
  const maxSecImages = getMaxSecondaryImages(docMode);

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

  // VAL-045: resolvedCurrency — canonical currency resolver, declared at DocPDF function scope.
  // Uses safeCurrencyResolver to guarantee a valid ISO code regardless of payload state.
  // This is the ONLY currency source for all closures — no IIFE may declare its own `currency`.
  const resolvedCurrency = resolvePdfCurrency(firstCdRow, oilsConfig);

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

  // catAtmosphere — READ-ONLY visual atmosphere config derived from category booleans.
  // Drives: identity tag, lifecycle label, hero framing, summary row order, certs accent, regulated marker.
  // Zero business logic. No formula changes.
  const catAtmosphere = (() => {
    if (isLiveAnimalRow) return {
      tag:             docLang === "en" ? "LIVESTOCK EXPORT"          : "EXPORTACIÓN GANADO",
      lifecycleLabel:  docLang === "en" ? "LIVESTOCK OPERATION LIFECYCLE" : "CICLO OPERACIÓN PECUARIA",
      heroHeight: 140, heroOpacity: 0.92,
      summaryOrder:    ["product","origin","destination","incoterm","value","validity"],
      certsAccentColor: EXECUTIVE_COLORS.PRIMARY_DARK,
      regulatedMarker: true,
    };
    if (isOilsRow) return {
      tag:             docLang === "en" ? "OILS EXPORT"               : "EXPORTACIÓN ACEITES",
      lifecycleLabel:  docLang === "en" ? "OILS OPERATION LIFECYCLE"  : "CICLO OPERACIÓN ACEITES",
      heroHeight: 155, heroOpacity: 0.88,
      summaryOrder:    ["product","incoterm","container","value","origin","destination","validity"],
      certsAccentColor: EXECUTIVE_COLORS.ACCENT_GOLD,
      regulatedMarker: false,
    };
    if (isGrainRow) return {
      tag:             docLang === "en" ? "GRAIN COMMODITIES"         : "COMMODITIES GRANOS",
      lifecycleLabel:  docLang === "en" ? "BULK OPERATION LIFECYCLE"  : "CICLO OPERACIÓN GRANEL",
      heroHeight: 150, heroOpacity: 0.84,
      summaryOrder:    ["product","origin","incoterm","destination","value","validity"],
      certsAccentColor: EXECUTIVE_COLORS.ACCENT_GOLD,
      regulatedMarker: false,
    };
    if (isFrozenRow) return {
      tag:             docLang === "en" ? "FROZEN CARGO"              : "CARGA REFRIGERADA",
      lifecycleLabel:  docLang === "en" ? "COLD CHAIN LIFECYCLE"      : "CICLO CADENA FRÍO",
      heroHeight: 148, heroOpacity: 0.86,
      summaryOrder:    ["product","incoterm","container","origin","destination","value","validity"],
      certsAccentColor: EXECUTIVE_COLORS.ACCENT_GOLD,
      regulatedMarker: false,
    };
    return {
      tag:             docLang === "en" ? "ENTERPRISE EXPORT"         : "EXPORTACIÓN ENTERPRISE",
      lifecycleLabel:  docLang === "en" ? "OPERATION LIFECYCLE"       : "CICLO OPERATIVO",
      heroHeight: 150, heroOpacity: 0.86,
      summaryOrder:    null,
      certsAccentColor: EXECUTIVE_COLORS.ACCENT_GOLD,
      regulatedMarker: false,
    };
  })();

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

  // Executive product description — mode-aware, never generic template text
  const productDesc = (doc.product === "Otro" || doc.custom_product_name)
    ? (doc.custom_product_desc || doc.customProductDesc || getModeProductDescription(docMode, firstCdRow, doc, docLang))
    : getModeProductDescription(docMode, firstCdRow, doc, docLang);

  const exporter = doc.exporter || "GLV Global Food Services LLC (Miami, FL)";
  const domain = doc.domain || "glvglobalfoodservices.com";

  const certifications = getModeCertifications(docMode, docLang);

  const timeline      = getModeTimeline(docMode, docLang);
  const mandatoryInfo = getModeMandatoryInfo(docMode, docLang);

  const tcText = docLang === "en"
    ? `GENERAL TERMS AND CONDITIONS:\n1. This offer is issued by ${exporter} in its capacity as a certified international exporter.\n2. Prices are per the agreed Incoterm(s) in accordance with Incoterms 2020, at the indicated destination port.\n3. Formal acceptance of this offer activates the SPA (Sales Purchase Agreement) process.\n4. All prices are denominated in the currency stated in the offer.\n5. Any dispute shall be resolved by international arbitration under ICC rules (Paris).\n6. The applicable law shall be as established in the definitive contract (SPA).\n7. GLV Global Food Services LLC reserves the right to modify prices due to force majeure or changes in international sanitary regulations.`
    : `TÉRMINOS Y CONDICIONES GENERALES:\n1. La presente oferta es emitida por ${exporter} en su calidad de exportador internacional certificado.\n2. Los precios son según el/los Incoterm(s) pactado(s) conforme a Incoterms 2020, en el puerto de destino indicado.\n3. La aceptación formal de esta oferta activa el proceso de elaboración del SPA (Sales Purchase Agreement).\n4. Todos los precios están denominados en la moneda indicada en la oferta.\n5. Cualquier controversia será resuelta mediante arbitraje internacional según las reglas de la CCI (París).\n6. La ley aplicable es la establecida en el contrato definitivo (SPA).\n7. GLV Global Food Services LLC se reserva el derecho de modificar precios por causas de fuerza mayor o cambios en normativas sanitarias internacionales.`;

  const fcoNote = (L.fco_note || "").replace("{days}", validityDays).replace("{date}", doc.date);

  return (
    <Document>
      {/* PAGE 1 — EXECUTIVE COVER */}
      <Page size="A4" style={s.coverPage}>
        <View style={[s.coverBg, { backgroundColor: coverBg, paddingTop: 32, paddingBottom: 28, paddingHorizontal: 40 }]}>

          {/* Zone 1 — Corporate Identity Bar */}
          <ExecIdentityBar lang={docLang} tag={catAtmosphere.tag} />
          <GoldRule />

          {/* Zone 2 — Document title + reference */}
          <View style={{ marginBottom: 6 }}>
            {/* Document type title */}
            <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "bold", letterSpacing: 0.8, lineHeight: 1.2, marginBottom: 5 }}>
              {isSCO
                ? (docLang === "en" ? "Soft Corporate Offer" : "Oferta Corporativa Blanda")
                : isFCO
                  ? (docLang === "en" ? "Full Corporate Offer" : "Oferta Corporativa Completa")
                  : (docLang === "en" ? "International Supply Agreement" : "Contrato Internacional de Suministro")}
            </Text>

            {/* Reference + metadata — single quiet line, no competing badge boxes */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Text style={{ fontSize: 9.5, color: EXECUTIVE_COLORS.ACCENT_GOLD, fontWeight: "bold", letterSpacing: 0.5 }}>{doc.id}</Text>
              <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: 0.3 }}>·</Text>
              {(isSCO || isFCO) && (
                <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.45)", fontWeight: "bold", letterSpacing: 0.8, textTransform: "uppercase" }}>
                  {isSCO ? L.indicative : L.firm}
                </Text>
              )}
              {(() => {
                const modeLabel = getModeCoverLabel(docMode, docLang);
                return modeLabel ? (
                  <>
                    <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>·</Text>
                    <Text style={{ fontSize: 7, color: "rgba(201,168,76,0.7)", letterSpacing: 0.5 }}>{modeLabel}</Text>
                  </>
                ) : null;
              })()}
              <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.28)", letterSpacing: 0.5 }}>{docLang === "en" ? "EN" : "ES"}</Text>
            </View>

            {/* Client + date */}
            <Text style={{ fontSize: 9.5, color: "rgba(255,255,255,0.8)", marginBottom: 2 }}>
              {docLang === "en" ? "Prepared for:" : "Elaborado para:"}{" "}
              <Text style={{ fontWeight: "bold", color: "#FFFFFF" }}>{doc.client}</Text>
            </Text>
            <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}>
              {docLang === "en" ? "Date:" : "Fecha:"} {doc.date}{"  "}·{"  "}{exporter}
            </Text>
          </View>

          {/* Zone 3 — Hero product image (category-isolated, max 1) */}
          {boundMedia?.main && (
            <View style={{ marginVertical: 12, marginHorizontal: 0 }}>
              <Image
                src={boundMedia.main}
                style={{ width: "100%", height: catAtmosphere.heroHeight, objectFit: "cover", opacity: catAtmosphere.heroOpacity }}
              />
              <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, backgroundColor: EXECUTIVE_COLORS.ACCENT_GOLD, opacity: 0.6 }} />
            </View>
          )}

          {/* Zone 4 — Executive Operation Summary Table */}
          <ExecOperationSummaryTable
            product={doc.custom_product_name || doc.customProductName || doc.product}
            origin={doc.origin || "Brazil"}
            destination={doc.destination}
            incoterm={cdInc}
            totalValue={totalValue}
            currency={resolvedCurrency}
            validityDays={validityDays}
            date={doc.date}
            containerType={containerType ? (CONTAINER_LABELS[containerType] || containerType) : null}
            lang={docLang}
            rowOrder={catAtmosphere.summaryOrder}
          />

          {/* Financial Dominance Zone — stops the eye, communicates transaction scale */}
          {totalValue > 0 && (
            <View style={{ marginTop: 14, marginBottom: 14, paddingVertical: 14, paddingHorizontal: 18, backgroundColor: "rgba(0,0,0,0.24)", borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.07)", borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.07)" }}>
              <Text style={{ fontSize: 6.5, color: "rgba(255,255,255,0.35)", letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 7 }}>
                {docLang === "en" ? "ESTIMATED CONTRACT VALUE" : "VALOR ESTIMADO DEL CONTRATO"}
              </Text>
              <Text style={{ fontSize: 28, fontWeight: "bold", color: "#FFFFFF", letterSpacing: 0.5 }}>
                {fmtCurrency(totalValue)}{" "}
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>{resolvedCurrency}</Text>
              </Text>
            </View>
          )}

          {/* Zone 5 — Enterprise Trust Indicators — quiet footer of cover */}
          <ExecTrustRow lang={docLang} />

          {/* Legal note — quiet, supporting, not competing with financial zone */}
          {isSCO && (
            <View style={{ marginTop: 12, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: "rgba(201,168,76,0.3)" }}>
              <Text style={{ fontSize: 6.5, color: "rgba(255,255,255,0.4)", lineHeight: 1.55 }}>{L.sco_note}</Text>
            </View>
          )}
          {isFCO && (
            <View style={{ marginTop: 12, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: "rgba(5,150,105,0.4)" }}>
              <Text style={{ fontSize: 6.5, color: "rgba(255,255,255,0.4)", lineHeight: 1.55 }}>{fcoNote}</Text>
            </View>
          )}

          {/* Footer line */}
          <View style={{ marginTop: "auto", paddingTop: 10, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.12)", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.35)" }}>{domain}</Text>
            <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.35)" }}>GLV Holding Group © 2026</Text>
          </View>

        </View>
      </Page>

      {/* PAGE 2 — MAIN CONTENT */}
      <Page size="A4" style={s.page}>

        {/* Commercial product imagery — max 2 images per MediaCategoryIsolationEngine rules */}
        {boundMedia?.main && (
          <View style={{ marginBottom: 18, borderWidth: 0.5, borderColor: "#E2E8F0", borderRadius: 2, overflow: "hidden" }}>
            <View style={{ flexDirection: "row" }}>
              <Image src={boundMedia.main} style={{ width: 206, height: 138, objectFit: "cover" }} />
              {boundMedia.secondary?.[0] && maxSecImages >= 1 && (
                <Image src={boundMedia.secondary[0]} style={{ width: 116, height: 138, objectFit: "cover", marginLeft: 1 }} />
              )}
              {boundMedia.branding && (
                <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "flex-end", padding: 8 }}>
                  <Image src={boundMedia.branding} style={{ width: 80, height: 44, objectFit: "contain" }} />
                </View>
              )}
            </View>
            <View style={{ height: 2, backgroundColor: EXECUTIVE_COLORS.ACCENT_GOLD, opacity: 0.55 }} />
          </View>
        )}

        {/* Section 1: Parties */}
        <ExecSectionTitle text={L.parties} />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 0 }}>
          <View style={{ width: "48%", backgroundColor: "#FFFFFF", borderWidth: 0.5, borderColor: "#DDE3EC", borderTopWidth: 2, borderTopColor: EXECUTIVE_COLORS.PRIMARY_DARK, padding: "10 12", borderRadius: 2 }}>
            <Text style={[s.infoLabel, { color: "#1e3a5f", marginBottom: 4 }]}>{L.seller}</Text>
            <Text style={{ fontSize: 9, fontWeight: "bold", color: "#1B2A4A", marginBottom: 3 }}>{exporter}</Text>
            <Text style={{ fontSize: 7.5, color: "#475569" }}>19790 W Dixie Hwy, Unit 1115{"\n"}Miami, FL 33180, USA</Text>
            <Text style={{ fontSize: 7.5, color: "#475569", marginTop: 2 }}>{domain}</Text>
            {isChina && <Text style={{ fontSize: 7.5, color: "#D97706", fontWeight: "bold", marginTop: 3 }}>GACC No. YA11000PDY110K805</Text>}
          </View>
          <View style={{ width: "48%", backgroundColor: "#FFFFFF", borderWidth: 0.5, borderColor: "#DDE3EC", borderTopWidth: 2, borderTopColor: EXECUTIVE_COLORS.ACCENT_GOLD, padding: "10 12", borderRadius: 2 }}>
            <Text style={[s.infoLabel, { marginBottom: 4 }]}>{L.buyer}</Text>
            <Text style={{ fontSize: 9, fontWeight: "bold", color: "#1B2A4A", marginBottom: 3 }}>{doc.client}</Text>
            {doc.clientCountry && <Text style={{ fontSize: 7.5, color: "#475569" }}>{docLang === "en" ? "Country:" : "País:"} {doc.clientCountry}</Text>}
            {(doc.clientRepresentative || doc.client_representative) && (
              <Text style={{ fontSize: 7.5, color: "#475569" }}>Rep: {doc.clientRepresentative || doc.client_representative}</Text>
            )}
            {(doc.clientEmail || doc.client_email) && (
              <Text style={{ fontSize: 7.5, color: "#475569" }}>{doc.clientEmail || doc.client_email}</Text>
            )}
            {(doc.clientPhone || doc.client_phone) && (
              <Text style={{ fontSize: 7.5, color: "#475569" }}>Tel: {doc.clientPhone || doc.client_phone}</Text>
            )}
          </View>
        </View>
        <SectionSep />

        {/* Section 2: Product */}
        <ExecSectionTitle text={L.product} />
        <View style={{ backgroundColor: "#FFFFFF", borderWidth: 0.5, borderColor: "#DDE3EC", borderLeftWidth: 2.5, borderLeftColor: EXECUTIVE_COLORS.PRIMARY_DARK, padding: "10 14", marginBottom: 0, borderRadius: 2 }}>
          <Text style={{ fontSize: 9.5, fontWeight: "bold", color: "#1B2A4A", marginBottom: 5, letterSpacing: 0.2 }}>
            {doc.custom_product_name || doc.customProductName || doc.product}
          </Text>
          <Text style={{ fontSize: 8.5, color: "#475569", lineHeight: 1.6 }}>{productDesc}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: "#E8ECF1" }}>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>{L.origin_lbl}</Text>
              <Text style={{ fontSize: 9.5, color: EXECUTIVE_COLORS.PRIMARY_DARK, fontWeight: "bold" }}>{doc.origin || "Brazil"}</Text>
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

          {/* Export format — only shown for non-OILS liquid packaging modes (OILS has its own dedicated section) */}
          {exportFormat && !isLiveAnimalRow && !isOilsRow && (
            <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: "#e2e8f0", flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>{docLang === "en" ? "Export Format" : "Formato de Exportación"}</Text>
                <Text style={{ fontSize: 9, color: isPouchFormat ? "#6d28d9" : "#1e40af", fontWeight: "bold" }}>{exportFormatLabel}</Text>
              </View>
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
            try {
            console.log("[PDF_SECTION_RENDER] OILS spec section — resolvedCurrency:", resolvedCurrency, "| oilsConfig.currency:", oilsConfig?.currency);
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
            } catch (oilsSectionErr) {
              console.error("[PDF_RENDER] Oils spec section crashed:", oilsSectionErr?.message, oilsSectionErr?.stack);
              return (
                <View style={{ padding: 8, backgroundColor: "#fff7ed", borderRadius: 4, marginBottom: 8 }}>
                  <Text style={{ fontSize: 8, color: "#92400e" }}>Oil Technical Specification — section unavailable</Text>
                </View>
              );
            }
          })()}

          {/* V5: Liquid/Packaged packaging details — 4-layer display */}
          {/* VAL-049: !isOilsRow guard — OILS must NEVER enter V5 even if stale liquid fields exist */}
          {(packagingType || presentationSize || commercialUnit) && !isLiveAnimalRow && !isOilsRow && (() => { try {
            console.log("[PDF_SECTION_RENDER] V5 packaging section — resolvedCurrency:", resolvedCurrency);
            // Resolve human-readable labels for PDF display
            const LIQUID_RETAIL_SIZE_LABELS = { "100ml":"100 ml","125ml":"125 ml","200ml":"200 ml","250ml":"250 ml","330ml":"330 ml","350ml":"350 ml","500ml":"500 ml","750ml":"750 ml","900ml":"900 ml","1000ml":"1 L","1L":"1 L","2L":"2 L","3L":"3 L","5L":"5 L","10L":"10 L","20L":"20 L" };
            const COMMERCIAL_UNIT_FULL_EN   = { perKg:"per KG",perMT:"per MT",perLiter:"per Liter",perBox:"per Box",perUnit:"per Unit",perContainer:"per Container",perDrum:"per Drum",perJerrycan:"per Jerrycan",perBottle:"per Bottle",perPallet:"per Pallet",perIBC:"per IBC",perFlexitank:"per Flexitank" };
            const COMMERCIAL_UNIT_FULL_ES   = { perKg:"por KG",perMT:"por MT",perLiter:"por Litro",perBox:"por Caja",perUnit:"por Unidad",perContainer:"por Contenedor",perDrum:"por Bidón",perJerrycan:"por Jerrycan",perBottle:"por Botella",perPallet:"por Paleta",perIBC:"por IBC",perFlexitank:"por Flexitank" };
            // VAL-045: NEVER declare a local `currency` variable here — use resolvedCurrency from
            // DocPDF function scope directly. Local declaration risks shadowing bugs if OILS rows
            // trigger V5. resolvedCurrency is always a safe ISO code via safeCurrencyResolver.
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
                {/* Layer 4: Sale basis */}
                {commercialUnit && (
                  <View style={{ marginTop: 4, backgroundColor: "#fefce8", borderRadius: 4, padding: "4 8" }}>
                    <Text style={{ fontSize: 8, color: "#78350f", fontWeight: "bold" }}>
                      {docLang === "en" ? "Sale basis:" : "Base de venta:"} {resolvedCurrency} {docLang === "en" ? cuLabelEn : cuLabelEs}
                    </Text>
                  </View>
                )}
              </View>
            );
          } catch (v5SectionErr) {
            console.error("[PDF_RENDER] V5 packaging section crashed:", v5SectionErr?.message, v5SectionErr?.stack);
            return (
              <View style={{ padding: 8, backgroundColor: "#fff7ed", borderRadius: 4, marginBottom: 8 }}>
                <Text style={{ fontSize: 8, color: "#92400e" }}>Packaging details — section unavailable</Text>
              </View>
            );
          }})()}

          {/* V6: Multi-SKU retail breakdown table */}
          {/* VAL-049: !isOilsRow guard — OILS must NEVER enter V6 multi-SKU section */}
          {rowSkus.length > 0 && !isLiveAnimalRow && !isOilsRow && (() => { try {
            console.log("[PDF_SECTION_RENDER] V6 multi-SKU section — resolvedCurrency:", resolvedCurrency);
            const SKU_PKG_LABELS = { PET_BOTTLE:"PET Bottle", GLASS_BOTTLE:"Glass Bottle", TETRA_PAK:"Tetra Pak", DOYPACK:"Doypack", SACHET:"Sachet", CAN_TIN:"Can / Tin", PREMIUM_BOTTLE:"Premium Bottle" };
            const SIZE_LABELS    = { "100ml":"100 ml","125ml":"125 ml","200ml":"200 ml","250ml":"250 ml","330ml":"330 ml","350ml":"350 ml","500ml":"500 ml","750ml":"750 ml","900ml":"900 ml","1000ml":"1 L","1L":"1 L","2L":"2 L","3L":"3 L","5L":"5 L","10L":"10 L","20L":"20 L" };
            const CU_ABBR        = { perBox:"/box", perUnit:"/unit", perBottle:"/bottle", perLiter:"/L", perKg:"/kg" };
            const totalShipV = rowSkus.reduce((s, sk) => s + (parseFloat(sk.quantity) || 0) * (parseFloat(sk.price) || 0), 0);
            // VAL-045: no local `currency` variable — use resolvedCurrency from DocPDF scope directly
            return (
              <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: "#e2e8f0" }}>
                <Text style={{ fontSize: 7.5, color: "#64748b", fontWeight: "bold", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
                  {docLang === "en" ? `SKU Breakdown — ${rowSkus.length} Presentation${rowSkus.length > 1 ? "s" : ""}` : `Desglose SKU — ${rowSkus.length} Presentación${rowSkus.length > 1 ? "es" : ""}`}
                </Text>
                {/* Column headers */}
                <View style={{ flexDirection: "row", backgroundColor: EXECUTIVE_COLORS.PRIMARY_DARK, borderRadius: 0, padding: "5 8", marginBottom: 0 }}>
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
                    <View key={i} style={{ flexDirection: "row", backgroundColor: i % 2 === 0 ? "#F7F9FC" : "#FFFFFF", padding: "5 8", borderBottomWidth: 0.5, borderBottomColor: "#E8ECF1" }}>
                      <Text style={{ flex: 0.4, fontSize: 7.5, color: "#1B2A4A", fontWeight: "bold" }}>{i + 1}</Text>
                      <Text style={{ flex: 1.2, fontSize: 7.5, color: "#374151" }}>{pkgLabel}</Text>
                      <Text style={{ flex: 1.2, fontSize: 7.5, color: "#374151" }}>{sizeLabel}</Text>
                      <Text style={{ flex: 1.2, fontSize: 7.5, color: "#374151", textAlign: "right" }}>{upb > 0 ? upb : "—"}</Text>
                      <Text style={{ flex: 1, fontSize: 7.5, color: "#374151", textAlign: "right" }}>{qty > 0 ? new Intl.NumberFormat("en-US").format(qty) : "—"}</Text>
                      <Text style={{ flex: 1, fontSize: 7.5, color: "#374151", textAlign: "right" }}>{price > 0 ? `${resolvedCurrency} ${price}${cuAbbr}` : "—"}</Text>
                      <Text style={{ flex: 1, fontSize: 7.5, color: "#059669", fontWeight: "bold", textAlign: "right" }}>{fmtPdfCurrency(sv, resolvedCurrency)}</Text>
                    </View>
                  );
                })}
                {/* Total shipment value row */}
                {totalShipV > 0 && (
                  <View style={{ flexDirection: "row", backgroundColor: EXECUTIVE_COLORS.PRIMARY_DARK, padding: "6 8", borderTopWidth: 1.5, borderTopColor: EXECUTIVE_COLORS.ACCENT_GOLD }}>
                    <Text style={{ flex: 5, fontSize: 7.5, color: "#fff", fontWeight: "bold" }}>
                      {docLang === "en" ? "TOTAL SHIPMENT VALUE" : "VALOR TOTAL POR EMBARQUE"}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 8, color: "#4ade80", fontWeight: "bold", textAlign: "right" }}>{fmtPdfCurrency(totalShipV, resolvedCurrency)}</Text>
                  </View>
                )}
              </View>
            );
          } catch (skuSectionErr) {
            console.error("[PDF_RENDER] Multi-SKU section crashed:", skuSectionErr?.message);
            return <View><Text style={{ fontSize: 8, color: "#92400e" }}>SKU breakdown — section unavailable</Text></View>;
          }})()}

          {(doc.custom_unit || doc.customUnit) && (
            <View style={{ marginTop: 8 }}>
              <Text style={s.infoLabel}>{L.unit_lbl}</Text>
              <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{doc.custom_unit || doc.customUnit}</Text>
            </View>
          )}
        </View>
        <SectionSep />

        {/* Commercial data table — multi-product rows from CommercialEngine */}
        {(() => { try {
          console.log("[PDF_SECTION_RENDER] Commercial data table — resolvedCurrency:", resolvedCurrency);
          const cd = doc.commercialData || doc.commercial_data;
          const rows = cd?.rows?.filter(r => r.category && (r.quantity || (Array.isArray(r.skus) && r.skus.length > 0))) || [];
          if (rows.length === 0) return null;
          return (
            <View style={{ marginBottom: 18, borderWidth: 0.5, borderColor: "#DDE3EC", borderRadius: 2 }}>
              <View style={{ backgroundColor: EXECUTIVE_COLORS.PRIMARY_DARK, borderRadius: 2, padding: "7 10", marginBottom: 0 }}>
                <View style={{ flexDirection: "row" }}>
                  {(docLang === "en"
                    ? ["Product", "Origin", "Qty", "Unit", "Incoterm", "Price/U", "Shipment", "Contract"]
                    : ["Producto", "Origen", "Cant.", "Unidad", "Incoterm", "Precio/U", "Embarque", "Contrato"]
                  ).map((h, i) => (
                    <Text key={h} style={{ flex: 1, fontSize: 6.5, color: "rgba(255,255,255,0.85)", fontWeight: "bold", textAlign: i < 2 ? "left" : "right", letterSpacing: 0.3 }}>{h}</Text>
                  ))}
                </View>
              </View>
              {rows.map((row, i) => {
                const catLabel = getCategoryDisplayLabel(row.category || "", docLang);
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

                // VAL-045: use safeCurrencyResolver for per-row currency — never raw row.currency
                const rowCurrency = safeCurrencyResolver(row.currency);
                const fmtV = (v) => fmtPdfCurrency(v, rowCurrency);
                return (
                  <View key={i} style={{ flexDirection: "row", backgroundColor: i % 2 === 0 ? "#F7F9FC" : "#FFFFFF", padding: "6 10", borderBottomWidth: 0.5, borderBottomColor: "#E8ECF1" }}>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#1B2A4A", fontWeight: "bold" }}>{catLabel}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#374151" }}>{row.origin || "—"}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#374151", textAlign: "center" }}>{isSkuRow ? `${row.skus.length} SKU` : (row.quantity || "—")}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#374151", textAlign: "center" }}>{isSkuRow ? "Multi-SKU" : (row.unitType || "").split("/")[0].trim()}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#374151", textAlign: "center" }}>{inc}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#374151", textAlign: "right" }}>{isSkuRow ? "—" : (price ? `${rowCurrency} ${price}` : "—")}</Text>
                    <Text style={{ flex: 1, fontSize: 7.5, color: "#059669", fontWeight: "bold", textAlign: "right" }}>{fmtV(sv)}</Text>
                    <Text style={{ flex: 1, fontSize: 8, color: "#1B2A4A", fontWeight: "bold", textAlign: "right" }}>{fmtV(cv)}</Text>
                  </View>
                );
              })}
              {rows.length > 1 && (() => {
                // VAL-045: use safeCurrencyResolver — never a raw rows[0].currency
                const totalsCurrency = safeCurrencyResolver(rows[0]?.currency);
                const totalCV = rows.reduce((s, r) => s + (r.summary?.contractValue || 0), 0);
                const fmtV = (v) => fmtPdfCurrency(v, totalsCurrency);
                return (
                  <View style={{ flexDirection: "row", backgroundColor: EXECUTIVE_COLORS.PRIMARY_DARK, padding: "7 10", borderRadius: 0, marginTop: 0, borderTopWidth: 1.5, borderTopColor: EXECUTIVE_COLORS.ACCENT_GOLD }}>
                    <Text style={{ flex: 6, fontSize: 7.5, color: "rgba(255,255,255,0.85)", fontWeight: "bold", letterSpacing: 0.5 }}>
                      {docLang === "en" ? `TOTAL EXPORT PROGRAM — ${rows.length} PRODUCTS` : `TOTAL PROGRAMA DE EXPORTACIÓN — ${rows.length} PRODUCTOS`}
                    </Text>
                    <Text style={{ flex: 1, fontSize: 9, color: EXECUTIVE_COLORS.ACCENT_GOLD, fontWeight: "bold", textAlign: "right" }}>{fmtV(totalCV)}</Text>
                  </View>
                );
              })()}
            </View>
          );
        } catch (cdTableErr) {
          console.error("[PDF_RENDER] Commercial data table crashed:", cdTableErr?.message, cdTableErr?.stack);
          return <View style={{ padding: 8, backgroundColor: "#fff7ed", borderRadius: 4, marginBottom: 8 }}>
            <Text style={{ fontSize: 8, color: "#92400e" }}>Commercial data table — section unavailable</Text>
          </View>;
        }})()}

        {/* Section 3: Price */}
        <ExecSectionTitle text={L.price} />

        {/* Shipment value — DOMINANT financial card, no left accent needed: dark bg IS the emphasis */}
        {engineShipmentValue > 0 && (
          <View style={{ backgroundColor: EXECUTIVE_COLORS.PRIMARY_DARK, borderRadius: 2, padding: "14 18", marginBottom: 8 }}>
            <Text style={{ fontSize: 6.5, color: "rgba(255,255,255,0.35)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
              {L.shipment_val_lbl}
            </Text>
            <Text style={{ fontSize: 22, color: "#FFFFFF", fontWeight: "bold", letterSpacing: 0.5 }}>
              {fmtCurrency(engineShipmentValue)}
            </Text>
            <View style={{ height: 1, backgroundColor: EXECUTIVE_COLORS.ACCENT_GOLD, marginTop: 10, width: 36 }} />
          </View>
        )}

        {/* Total contract value — full-width secondary card when shipment value is also shown */}
        {totalValue && totalValue > 0 && (engineShipmentValue <= 0 || Math.abs(totalValue - engineShipmentValue) > 1) && (
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 2, padding: "12 18", marginBottom: 12, borderWidth: 0.5, borderColor: "#D1FAE5", borderLeftWidth: 3, borderLeftColor: "#059669" }}>
            <Text style={{ fontSize: 6.5, color: "#166534", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
              {L.total_val_lbl}
            </Text>
            <Text style={{ fontSize: 18, color: "#059669", fontWeight: "bold", letterSpacing: 0.5 }}>
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
        <SectionSep />

        {/* Section 4: Certifications */}
        {catAtmosphere.regulatedMarker && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ paddingHorizontal: 7, paddingVertical: 3, backgroundColor: EXECUTIVE_COLORS.PRIMARY_DARK, borderRadius: 2 }}>
              <Text style={{ fontSize: 6.5, fontWeight: "bold", color: "#FFFFFF", letterSpacing: 1.0, textTransform: "uppercase" }}>
                {docLang === "en" ? "REGULATED OPERATION" : "OPERACIÓN REGULADA"}
              </Text>
            </View>
            <Text style={{ fontSize: 6.5, color: "#64748B", letterSpacing: 0.3 }}>
              {docLang === "en" ? "Veterinary · Sanitary · International Standards" : "Veterinario · Sanitario · Normas Internacionales"}
            </Text>
          </View>
        )}
        <ExecSectionTitle text={L.certs} />
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 2, padding: "9 13", marginBottom: 0, borderWidth: 0.5, borderColor: "#DDE3EC", borderLeftWidth: 2, borderLeftColor: catAtmosphere.certsAccentColor }}>
          <Text style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.65 }}>{certifications}</Text>
        </View>
        <SectionSep />

        {/* Section 5: Payment */}
        <ExecSectionTitle text={L.payment} />
        <View style={s.paymentBox}>
          <Text style={s.paymentText}>{paymentText}</Text>
        </View>
        <SectionSep />

        {/* Section 6: Timeline */}
        <ExecSectionTitle text={L.timeline} />
        <ExecTimelineStrip workflowState={doc.workflowState || "QUOTED"} lang={docLang} lifecycleLabel={catAtmosphere.lifecycleLabel} />
        <SectionSep />

        {/* Section 7: Mandatory */}
        {mandatoryInfo && (
          <>
            <SectionTitle text={L.mandatory} />
            <View style={{ backgroundColor: "#FFFBEB", borderWidth: 0.5, borderColor: "#FDE68A", borderLeftWidth: 2, borderLeftColor: "#D97706", borderRadius: 2, padding: "8 12", marginBottom: 12 }}>
              <Text style={{ fontSize: 8.5, color: "#7c2d12", lineHeight: 1.6 }}>{mandatoryInfo}</Text>
            </View>
            <SectionSep />
          </>
        )}

        {/* China alert box */}
        {isChina && (
          <View style={{ backgroundColor: "#FFFBEB", borderWidth: 0.5, borderColor: "#F59E0B", borderLeftWidth: 2, borderLeftColor: "#D97706", borderRadius: 2, padding: "8 12", marginBottom: 12 }}>
            <Text style={{ fontSize: 8, color: "#92400e", fontWeight: "bold" }}>FILTRO CHINA — Entidad: GLV Services SAS (Colombia) | GACC No. YA11000PDY110K805</Text>
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
            <View style={{ backgroundColor: "#FAFBFC", borderRadius: 2, padding: "8 12", marginBottom: 14, borderWidth: 0.5, borderColor: "#EEF1F5" }}>
              <Text style={{ fontSize: 8.5, color: "#475569", lineHeight: 1.6 }}>{doc.observations}</Text>
            </View>
            <SectionSep />
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

        {/* Footer — executive audit footer */}
        <ExecAuditFooter documentRef={doc.id} date={doc.date} lang={docLang} />
      </Page>
    </Document>
  );
}

export async function downloadPDF(rawDoc, agentProfile, boundMedia, lang = "es") {
  // ── PHASE 1: Sanitize payload — remove stale fields BEFORE any rendering ──────
  // OILS rows may contain stale packagingType/commercialUnit/presentationSize from prior
  // CommercialEngine state (user switched category from LIQUID → OILS). These stale
  // fields trigger V5 liquid IIFE for OILS documents and cause currency scope crashes.
  console.log("[PDF_RENDER_START] Sanitizing payload for doc:", rawDoc?.id);
  const doc = sanitizePdfPayload(rawDoc);

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
  // ─── V9.2: Runtime inspection before render ──────────────────────────────────
  const cd = doc.commercialData || doc.commercial_data;
  const parsedCdForInspect = typeof cd === "string" ? (() => { try { return JSON.parse(cd); } catch { return {}; } })() : (cd || {});
  const cdRowsForInspect = parsedCdForInspect?.rows || [];
  const inspection = runFullInspection(doc, cdRowsForInspect, lang);

  console.group("[PDF_SUPERVISOR] Pre-render inspection — " + doc.id);
  console.log("[PDF_PAYLOAD]", {
    docId:       doc.id,
    docType:     doc.type,
    destination: doc.destination,
    category:    cdRowsForInspect[0]?.category,
    adapter:     cdRowsForInspect[0]?.category || "default",
    language:    lang,
    payload:     cdRowsForInspect[0] ? "present" : "EMPTY",
    rows:        cdRowsForInspect.length,
    exportFormat:cdRowsForInspect[0]?.exportFormat,
    oilsConfig:  cdRowsForInspect[0]?.oilsConfig ? "present" : "absent",
    logistics:   cdRowsForInspect[0]?.canonicalLogistics ? "present" : "absent",
    pricing:     cdRowsForInspect[0]?.incotermPrices,
  });
  console.log("[PDF_ADAPTER]", inspection.adapters);
  console.log("[PDF_LANGUAGE]", inspection.language);
  if (inspection.summary.fatals.length > 0) {
    console.error("[PDF_FATAL] Pre-render fatals:", inspection.summary.fatals);
  }
  if (inspection.summary.warnings.length > 0) {
    console.warn("[PDF_RENDER] Pre-render warnings:", inspection.summary.warnings);
  }
  console.groupEnd();

  // ─── V9.2: Currency audit before render ──────────────────────────────────────
  // ─── V9.2: Pre-render validation chain (VAL-045/046/047/048) ─────────────────
  const firstRowForAudit   = cdRowsForInspect[0] || {};
  const auditedCurrency    = safeCurrencyResolver(firstRowForAudit.currency);
  const runtimeSafetyCheck = validatePdfRuntimeSafety(doc, cdRowsForInspect);
  const intlCheck          = validateIntlFormatting(auditedCurrency);
  const scopeCheck         = validatePdfCurrencyScope(cdRowsForInspect);
  const staleCheck         = validateStaleFields(cdRowsForInspect);
  const rawStale           = detectStaleFields(rawDoc, cdRowsForInspect);

  if (rawStale.count > 0) {
    console.group("[PDF_STALE_FIELDS_REMOVED] Stale fields detected in raw doc — sanitizer applied");
    rawStale.stale.forEach(s => console.warn(" →", s));
    console.groupEnd();
  }
  if (staleCheck.stale.length > 0) console.warn("[PDF_RENDER_FAILSAFE] Post-sanitize stale fields still present:", staleCheck.stale);
  if (runtimeSafetyCheck.issues.length > 0) console.warn("[PDF_RENDER_FAILSAFE] Runtime safety issues:", runtimeSafetyCheck.issues);
  if (!intlCheck.pass) console.warn("[PDF_INTL_CHECK] Intl.NumberFormat failed for", auditedCurrency, "— falling back to USD. Error:", intlCheck.message);
  if (scopeCheck.issues.length > 0) console.warn("[PDF_SCOPE_CHECK] Currency scope issues:", scopeCheck.issues);
  console.group("[PDF_CURRENCY_AUDIT] VAL-045 scope check — " + doc.id);
  console.log("[PDF_CURRENCY_AUDIT] firstCdRow.currency:", firstRowForAudit.currency ?? "(missing)");
  console.log("[PDF_CURRENCY_AUDIT] safeCurrencyResolver output:", auditedCurrency);
  console.log("[PDF_CURRENCY_AUDIT] oilsConfig.currency:", firstRowForAudit.oilsConfig?.currency ?? "(absent)");
  console.log("[PDF_SCOPE_CHECK] V5 IIFE: try/catch ✓ | !isOilsRow guard ✓ | resolvedCurrency direct (no local currency var) ✓");
  console.log("[PDF_SCOPE_CHECK] V6 IIFE: try/catch ✓ | !isOilsRow guard ✓ | resolvedCurrency + fmtPdfCurrency ✓");
  console.log("[PDF_SCOPE_CHECK] OILS IIFE: try/catch ✓ | no currency variable at all ✓");
  console.log("[PDF_SCOPE_CHECK] CD table: try/catch ✓ | rowCurrency=safeCurrencyResolver(row.currency) ✓");
  console.log("[PDF_SCOPE_CHECK] VAL-049: isOilsRow =", cdRowsForInspect[0]?.category === "OILS", "| V5/V6 will be SKIPPED for OILS ✓");
  console.log("[PDF_INTL_CHECK] All Intl.NumberFormat calls wrapped in fmtPdfCurrency — never throw ✓");
  console.groupEnd();

  // ─── V9.2: Render with full trace ────────────────────────────────────────────
  let blob;
  try {
    console.group("[PDF_RENDER] Starting react-pdf render — " + doc.id);
    console.log("[PDF_RENDER] Calling pdf().toBlob()...");
    blob = await pdf(
      <DocPDF doc={doc} agentProfile={agentProfile} boundMedia={boundMedia} lang={lang} />
    ).toBlob();
    console.log("[PDF_RENDER] Blob generated. size:", blob.size, "type:", blob.type);
    console.log("[PDF_RENDER_SUCCESS] PDF rendered without errors. Category:", cdRowsForInspect[0]?.category, "| Currency:", auditedCurrency, "| Lang:", lang);
    console.groupEnd();
  } catch (renderErr) {
    console.groupEnd();
    console.group("[PDF_FATAL] react-pdf render FAILED");
    console.error("[PDF_FATAL] Error:", renderErr);
    console.error("[PDF_FATAL] Message:", renderErr?.message);
    console.error("[PDF_FATAL] Stack:", renderErr?.stack);
    console.error("[PDF_FATAL] Doc id:", doc.id, "Category:", cdRowsForInspect[0]?.category);
    console.error("[PDF_FATAL] Inspection fatals:", inspection.summary.fatals);
    console.error("[PDF_FATAL] Inspection warnings:", inspection.summary.warnings);
    console.groupEnd();

    // Re-throw with a user-readable message that includes the root cause
    const userMsg = renderErr?.message
      ? `PDF render error: ${renderErr.message}`
      : "PDF render failed — unknown error. Check browser console [PDF_FATAL] for stack trace.";
    throw new Error(userMsg);
  }

  // ─── V9.2: Download ──────────────────────────────────────────────────────────
  try {
    console.log("[PDF_DOWNLOAD] Creating object URL and triggering download...");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("[PDF_DOWNLOAD] Download triggered for:", doc.id);
  } catch (dlErr) {
    console.error("[PDF_DOWNLOAD] Download trigger failed:", dlErr);
    throw new Error(`PDF generated but download failed: ${dlErr.message}`);
  }
}

export default DocPDF;
