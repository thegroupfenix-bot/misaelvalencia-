import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Font, pdf, Image,
} from "@react-pdf/renderer";
import { generatePaymentText } from "../utils/paymentText.js";

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
    price_lbl:      "CFR Price (USD/kg)",
    total_kg_lbl:   "Estimated Total Weight",
    total_val_lbl:  "Total Reference Value",
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

// ─── Language detection by destination ───────────────────────────────────────
function detectDocLang(doc) {
  const dest = (doc.destination || "").toLowerCase();
  if (dest.includes("saudi") || dest.includes("uae") || dest.includes("arab")) return "ar";
  if (dest.includes("china")) return "zh";
  return doc.lang || "en";
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
  sectionSub:   { fontSize: 7.5, color: "#64748b", marginBottom: 8 },
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

// Spanish section labels (primary)
const ES = {
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
};

const LANG_LABELS = {
  en: "Bilingual Document: Spanish / English",
  zh: "双语文件: 西班牙语 / 中文  |  Bilingual: Spanish / Chinese",
  ar: "وثيقة ثنائية اللغة: الإسبانية / العربية  |  Bilingüe: Español / Árabe",
  fr: "Document bilingue: Espagnol / Français",
};

function isLivestock(product) {
  if (!product) return false;
  return ["ovino", "bovino", "animal", "vivo"].some(k => product.toLowerCase().includes(k));
}
function isGrain(product) {
  if (!product) return false;
  return ["soya", "maíz", "maiz", "grano"].some(k => product.toLowerCase().includes(k));
}

// ─── Bilingual Section Header ─────────────────────────────────────────────────
function SectionTitle({ esText, secText }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.sectionTitle}>{esText}</Text>
      {secText && secText !== esText && (
        <Text style={s.sectionSub}>{secText}</Text>
      )}
    </View>
  );
}

// ─── Bilingual InfoBox ────────────────────────────────────────────────────────
function BiInfoBox({ esLabel, secLabel, value, style, highlight }) {
  return (
    <View style={[s.infoBox, style]}>
      <Text style={s.infoLabel}>{esLabel}</Text>
      {secLabel && <Text style={s.infoLabelSec}>{secLabel}</Text>}
      <Text style={[s.infoValue, highlight ? s.highlight : {}]}>{value}</Text>
    </View>
  );
}

function DocPDF({ doc, agentProfile }) {
  const docLang = detectDocLang(doc);
  const L = PDF_T[docLang] || PDF_T.en;

  const isChina = doc.destination === "China";
  const coverBg = COVER_COLORS[doc.type] || "#1B2A4A";
  const isSCO = doc.type === "SCO";
  const isFCO = doc.type === "FCO";
  const isSPA = doc.type === "SPA";
  const portInfo = PRICE_TABLE[doc.destination];
  const pricePerKg = doc.pricePerKg || portInfo?.price;
  const totalKg = (doc.headcount || 0) * (doc.avgWeight || 0);
  const totalValue = doc.totalValue || (totalKg && pricePerKg ? totalKg * pricePerKg : null);
  const validityDays = doc.validityDays || doc.validity_days || 15;
  const productCategory = doc.product || "";

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
  } else if (isLivestock(productCategory)) {
    productDesc = `Animales vivos de la especie ${productCategory}, procedentes de establecimientos registrados y habilitados para exportación. Los animales cumplen con todos los requisitos sanitarios internacionales y son certificados por autoridades zoosanitarias competentes del país de origen.`;
  } else if (isGrain(productCategory)) {
    productDesc = `Producto agrícola a granel de alta calidad, con análisis de humedad, proteína y aflatoxinas dentro de los estándares internacionales de exportación.`;
  } else {
    productDesc = `Producto alimenticio de exportación que cumple con los estándares de calidad internacional establecidos por GLV Global Food Services LLC.`;
  }

  const exporter = doc.exporter || "GLV Global Food Services LLC (Miami, FL)";
  const domain = doc.domain || "glvglobalfoodservices.com";

  let certifications = "• Certificado de origen oficial\n• Certificado sanitario/fitosanitario de exportación\n• Inspección SGS (o equivalente acordado)\n• Documentación de trazabilidad del lote";
  if (isLivestock(productCategory)) {
    certifications = "• Certificado zoosanitario oficial del país exportador\n• Certificado Halal (autoridad reconocida internacionalmente)\n• Certificado SGS de peso vivo y cantidad\n• Declaración de salud del lote por médico veterinario oficial\n• Aprobación del período de cuarentena\n• Certificado de vacunación del lote";
  }

  let timeline = "";
  if (isLivestock(productCategory)) {
    timeline = "Semana 1–2: Firma de contrato (SPA) y pago del anticipo\nSemana 3–6: Selección y concentración del lote en origen\nSemana 7–10: Período de cuarentena oficial (mínimo 21 días)\nSemana 11: Inspección SGS, certificación y activación de SBLC\nSemana 12: Embarque en buque ganadero especializado\nSemana 13–16: Tránsito marítimo hacia destino CFR\nSemana 16+: Entrega en puerto y liquidación final";
  } else {
    timeline = "Semana 1: Firma de contrato y pago del anticipo\nSemana 2–3: Preparación y consolidación del lote\nSemana 4: Inspección de calidad y certificaciones\nSemana 5: Carga y despacho en origen\nSemana 6+: Tránsito marítimo y entrega CFR en destino";
  }

  let mandatoryInfo = null;
  if (isLivestock(productCategory)) {
    mandatoryInfo = "INFORMACIÓN MANDATORIA — ANIMALES VIVOS:\n• Todos los embarques cumplen con el Código Sanitario para los Animales Terrestres de la OIE\n• Los buques utilizados son especializados en transporte de ganado vivo con sistema de ventilación certificado\n• La composición sexual del lote será certificada por veterinario oficial\n• El comprador es responsable de gestionar los permisos de importación en el país destino\n• Los animales son certificados libres de enfermedades de declaración obligatoria";
  } else if (isGrain(productCategory)) {
    mandatoryInfo = "INFORMACIÓN MANDATORIA — GRANOS Y CEREALES:\n• Producto libre de organismos genéticamente modificados no autorizados en destino\n• Humedad máxima garantizada según contrato\n• Libre de plagas y contaminantes según normativa Codex Alimentarius\n• Fumigación y tratamiento fitosanitario incluidos en el precio CFR";
  }

  const tcText = `TÉRMINOS Y CONDICIONES GENERALES:\n1. La presente oferta es emitida por ${exporter} en su calidad de exportador internacional certificado.\n2. Los precios son CFR (Cost and Freight) según Incoterms 2020, en el puerto de destino indicado.\n3. La aceptación formal de esta oferta activa el proceso de elaboración del SPA (Sales Purchase Agreement).\n4. Todos los precios están denominados en Dólares Americanos (USD).\n5. Cualquier controversia será resuelta mediante arbitraje internacional según las reglas de la CCI (París).\n6. La ley aplicable es la establecida en el contrato definitivo (SPA).\n7. GLV Global Food Services LLC se reserva el derecho de modificar precios por causas de fuerza mayor o cambios en normativas sanitarias internacionales.\n8. La entidad SBLC designada es: Active Value International General Trading L.L.C — Dubai, UAE.`;

  const fcoNote = (L.fco_note || "").replace("{days}", validityDays).replace("{date}", doc.date);
  const scoNoteEs = "NOTA: Esta oferta es de carácter indicativo. Los precios y condiciones están sujetos a confirmación mediante Full Corporate Offer (FCO). No constituye compromiso contractual.";

  const langLabel = LANG_LABELS[docLang] || "";

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

            {/* Bilingual language indicator */}
            {langLabel ? (
              <View style={s.langBar}>
                <Text style={s.langBarTxt}>{langLabel}</Text>
                <Text style={s.langBarTxt}>BILINGUAL DOCUMENT</Text>
              </View>
            ) : <View style={{ height: 20 }} />}

            {/* Status badge — bilingual */}
            {(isSCO || isFCO) && (
              <View style={[s.badge, {
                backgroundColor: isSCO ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.2)",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.4)"
              }]}>
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "bold" }}>
                  {isSCO
                    ? bi(ES.indicative, L.indicative)
                    : bi(ES.firm, L.firm)}
                </Text>
              </View>
            )}

            <Text style={s.coverTitle}>{doc.id}</Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "bold", marginBottom: 3 }}>
              {isSCO ? "Soft Corporate Offer" : isFCO ? "Full Corporate Offer" : "Sales Purchase Agreement"}
            </Text>
            {docLang === "zh" && (
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, marginBottom: 8 }}>
                {isSCO ? "软报价" : isFCO ? "正式公司报价" : "销售购买协议"}
              </Text>
            )}
            {docLang === "ar" && (
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, marginBottom: 8 }}>
                {isSCO ? "عرض شركة أولي" : isFCO ? "عرض شركة رسمي" : "اتفاقية بيع وشراء"}
              </Text>
            )}
            {docLang === "fr" && (
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, marginBottom: 8 }}>
                {isSCO ? "Offre préliminaire" : isFCO ? "Offre commerciale complète" : "Contrat de vente"}
              </Text>
            )}

            <Text style={s.coverSub}>Cliente / {L.buyer?.split("/")[0]?.trim() || "Client"}: {doc.client}</Text>
            <Text style={s.coverSub}>Producto / {docLang === "zh" ? "产品" : docLang === "ar" ? "المنتج" : docLang === "fr" ? "Produit" : "Product"}: {doc.product}</Text>
            <Text style={s.coverSub}>Destino / {L.port_lbl}: {doc.destination}{portInfo ? ` — ${portInfo.port}` : ""}</Text>
            <Text style={s.coverSub}>Fecha / {docLang === "zh" ? "日期" : docLang === "ar" ? "التاريخ" : docLang === "fr" ? "Date" : "Date"}: {doc.date}</Text>
            {totalValue && (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold", marginTop: 12 }}>
                {fmtCurrency(totalValue)} USD
              </Text>
            )}
          </View>

          <View>
            {isSCO && (
              <View style={[s.indicativaBox, { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.3)" }]}>
                <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.8)", marginBottom: 3 }}>
                  Esta oferta es de carácter indicativo. Sujeta a confirmación mediante FCO.
                </Text>
                {docLang !== "es" && (
                  <Text style={{ fontSize: 7.5, color: "rgba(255,255,255,0.6)" }}>{L.sco_note}</Text>
                )}
              </View>
            )}
            {isFCO && (
              <View style={[s.firmeBox, { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.3)" }]}>
                <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.8)", marginBottom: 3 }}>
                  Esta oferta es firme y vinculante durante {validityDays} días desde la fecha de emisión.
                </Text>
                {docLang !== "es" && (
                  <Text style={{ fontSize: 7.5, color: "rgba(255,255,255,0.6)" }}>{fcoNote}</Text>
                )}
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

        {/* Section 1: Parties */}
        <SectionTitle esText={ES.parties} secText={L.parties} />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          <View style={[s.infoBox, { width: "48%", backgroundColor: "#f0f4ff" }]}>
            <Text style={[s.infoLabel, { color: "#1e3a5f" }]}>{ES.seller}</Text>
            {docLang !== "es" && <Text style={s.infoLabelSec}>{L.seller}</Text>}
            <Text style={{ fontSize: 9, fontWeight: "bold", color: "#1B2A4A", marginBottom: 2 }}>{exporter}</Text>
            <Text style={{ fontSize: 8, color: "#374151" }}>19790 W Dixie Hwy, Unit 1115{"\n"}Miami, FL 33180, USA</Text>
            <Text style={{ fontSize: 8, color: "#374151", marginTop: 2 }}>{domain}</Text>
            {isChina && <Text style={{ fontSize: 8, color: "#d97706", fontWeight: "bold", marginTop: 3 }}>GACC No. YA11000PDY110K805</Text>}
          </View>
          <View style={[s.infoBox, { width: "48%", backgroundColor: "#f8fafc" }]}>
            <Text style={s.infoLabel}>{ES.buyer}</Text>
            {docLang !== "es" && <Text style={s.infoLabelSec}>{L.buyer}</Text>}
            <Text style={{ fontSize: 9, fontWeight: "bold", color: "#1B2A4A", marginBottom: 2 }}>{doc.client}</Text>
            {doc.clientCountry && <Text style={{ fontSize: 8, color: "#374151" }}>País: {doc.clientCountry}</Text>}
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
        <SectionTitle esText={ES.product} secText={L.product} />
        <View style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10", marginBottom: 16, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
          <Text style={{ fontSize: 9, fontWeight: "bold", color: "#1B2A4A", marginBottom: 4 }}>
            {doc.custom_product_name || doc.customProductName || doc.product}
          </Text>
          <Text style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.5 }}>{productDesc}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Origen</Text>
              {docLang !== "es" && <Text style={s.infoLabelSec}>{L.origin_lbl}</Text>}
              <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{doc.origin || "Brazil"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Puerto destino CFR</Text>
              {docLang !== "es" && <Text style={s.infoLabelSec}>{L.port_lbl}</Text>}
              <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{portInfo?.port || doc.destination}</Text>
            </View>
            {portInfo?.transit && (
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>Tránsito estimado</Text>
                {docLang !== "es" && <Text style={s.infoLabelSec}>{L.transit_lbl}</Text>}
                <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{portInfo.transit} días</Text>
              </View>
            )}
          </View>
          {(doc.custom_unit || doc.customUnit) && (
            <View style={{ marginTop: 6 }}>
              <Text style={s.infoLabel}>Unidad de medida</Text>
              {docLang !== "es" && <Text style={s.infoLabelSec}>{L.unit_lbl}</Text>}
              <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{doc.custom_unit || doc.customUnit}</Text>
            </View>
          )}
        </View>

        {/* Section 3: Price */}
        <SectionTitle esText={ES.price} secText={L.price} />
        <View style={s.grid}>
          {isLivestock(productCategory) && doc.headcount && (
            <BiInfoBox esLabel="Número de cabezas" secLabel={docLang !== "es" ? L.heads_lbl : null}
              value={new Intl.NumberFormat().format(doc.headcount)} />
          )}
          {isLivestock(productCategory) && doc.avgWeight && (
            <BiInfoBox esLabel="Peso promedio referencia" secLabel={docLang !== "es" ? L.weight_lbl : null}
              value={`${doc.avgWeight} kg`} />
          )}
          {pricePerKg && (
            <BiInfoBox esLabel="Precio CFR (USD/kg)" secLabel={docLang !== "es" ? L.price_lbl : null}
              value={`USD ${Number(pricePerKg).toFixed(2)}/kg`} />
          )}
          {totalKg > 0 && (
            <BiInfoBox esLabel="Peso total estimado" secLabel={docLang !== "es" ? L.total_kg_lbl : null}
              value={`${new Intl.NumberFormat().format(totalKg)} kg`} />
          )}
          {totalValue && (
            <BiInfoBox esLabel="Valor total referencial" secLabel={docLang !== "es" ? L.total_val_lbl : null}
              value={fmtCurrency(totalValue)} style={{ backgroundColor: "#f0fdf4" }} highlight />
          )}
          <BiInfoBox esLabel="Moneda" secLabel={docLang !== "es" ? L.currency_lbl : null}
            value="USD — Dólares Americanos" />
          <BiInfoBox esLabel="Validez de la oferta" secLabel={docLang !== "es" ? L.validity_lbl : null}
            value={`${validityDays} días / days`} />
          <BiInfoBox esLabel="Entidad SBLC / Garantía" secLabel={docLang !== "es" ? L.sblc_lbl : null}
            value="Active Value International General Trading L.L.C" />
        </View>

        {/* Section 4: Certifications */}
        <SectionTitle esText={ES.certs} secText={L.certs} />
        <View style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10", marginBottom: 16, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
          <Text style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.6 }}>{certifications}</Text>
        </View>

        {/* Section 5: Payment */}
        <SectionTitle esText={ES.payment} secText={L.payment} />
        <View style={s.paymentBox}>
          <Text style={s.paymentText}>{paymentText}</Text>
        </View>

        {/* Section 6: Timeline */}
        <SectionTitle esText={ES.timeline} secText={L.timeline} />
        <View style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10", marginBottom: 16, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
          <Text style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.6 }}>{timeline}</Text>
        </View>

        {/* Section 7: Mandatory */}
        {mandatoryInfo && (
          <>
            <SectionTitle esText={ES.mandatory} secText={L.mandatory} />
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
            <Text style={[s.sectionTitle, { color: "#166534", marginBottom: 6 }]}>Estructura del Contrato — Modelo SPA2026-03-01</Text>
            <Text style={{ fontSize: 8, color: "#14532d" }}>
              43 cláusulas legales activas: Objeto, Entidades, Domicilios, Documentos constitutivos, Producto, Lote,
              Composición sexual, Volumen, Base de facturación, Precio CFR, Moneda, Destinos, Pago/SBLC (Cláusulas 13–15),
              Inspección SGS, Halal, Cuarentena, Transporte marítimo, Documentos de lote, Responsabilidades, Seguros,
              Fuerza mayor, Incumplimiento, Penalidades, Arbitraje (CCI Paris), Ley aplicable.
            </Text>
          </View>
        )}

        {/* Section 8: Observations */}
        {doc.observations && (
          <>
            <SectionTitle esText={ES.observations} secText={L.observations} />
            <View style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10", marginBottom: 16, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
              <Text style={{ fontSize: 8.5, color: "#374151" }}>{doc.observations}</Text>
            </View>
          </>
        )}

        {/* Section 9: T&C */}
        <SectionTitle esText={ES.tc} secText={L.tc} />
        <View style={s.tcBox}>
          <Text style={s.tcText}>{tcText}</Text>
        </View>

        {/* Section 10: Agent signature */}
        <View style={s.sigBlock}>
          <SectionTitle esText={ES.agent_sig} secText={L.agent_sig} />
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
              <Text style={{ fontSize: 8, color: "#6b7280" }}>Documento: {doc.id}</Text>
              <Text style={{ fontSize: 8, color: "#6b7280" }}>Emitido: {doc.date}</Text>
              <Text style={{ fontSize: 8, color: "#6b7280" }}>Agente: {doc.agent}</Text>
              {docLang !== "es" && (
                <Text style={{ fontSize: 7, color: "#94a3b8", marginTop: 4 }}>
                  {docLang === "zh" ? "文件 / 签发 / 代理人" :
                   docLang === "ar" ? "وثيقة / تاريخ الإصدار / وكيل" :
                   "Document / Date / Agent"}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Section 11: Buyer acceptance (FCO only) */}
        {isFCO && (
          <View style={{ marginTop: 20 }}>
            <SectionTitle esText={ES.buyer_sig} secText={L.buyer_sig} />
            <View style={s.buyerSigBlock}>
              <Text style={{ fontSize: 8, color: "#6b7280", marginBottom: 3 }}>
                Al firmar el presente documento, el comprador confirma haber leído, comprendido y aceptado todas las condiciones de la presente Full Corporate Offer.
              </Text>
              {docLang !== "es" && (
                <Text style={{ fontSize: 7.5, color: "#94a3b8", marginBottom: 8 }}>{L.buyer_accept}</Text>
              )}
              <View style={{ flexDirection: "row", gap: 24, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ height: 40, borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 4 }} />
                  <Text style={{ fontSize: 8, color: "#6b7280" }}>
                    Firma del comprador / representante{docLang !== "es" ? `\n${L.buyer_sign}` : ""}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ height: 40, borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 4 }} />
                  <Text style={{ fontSize: 8, color: "#6b7280" }}>
                    Sello de la empresa / fecha{docLang !== "es" ? `\n${L.company_stamp}` : ""}
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 8, fontWeight: "bold", color: "#374151" }}>
                  Nombre y cargo / {L.name_position}: {doc.clientRepresentative || doc.client_representative || "_________________________"}
                </Text>
              </View>
            </View>
            <View style={s.firmeBox}>
              <Text style={{ fontSize: 8, color: "#14532d", marginBottom: 2 }}>
                Esta oferta es firme y vinculante durante {validityDays} días desde la fecha de emisión ({doc.date}). La aceptación del comprador activa el proceso de SPA.
              </Text>
              {docLang !== "es" && <Text style={{ fontSize: 7.5, color: "#166534" }}>{fcoNote}</Text>}
            </View>
          </View>
        )}

        {isSCO && (
          <View style={s.indicativaBox}>
            <Text style={{ fontSize: 8, color: "#92400e", marginBottom: 2 }}>{scoNoteEs}</Text>
            {docLang !== "es" && <Text style={{ fontSize: 7.5, color: "#b45309" }}>{L.sco_note}</Text>}
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text>Agente: {doc.agent} | {L.footer_copy}</Text>
          <Text>GLV Holding Group © 2026</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadPDF(doc, agentProfile) {
  const blob = await pdf(<DocPDF doc={doc} agentProfile={agentProfile} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default DocPDF;
