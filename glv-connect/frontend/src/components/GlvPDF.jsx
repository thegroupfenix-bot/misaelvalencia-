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
  coverTitle:   { color: "#ffffff", fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  coverSub:     { color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 4 },
  badge:        { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, fontSize: 9, fontWeight: "bold", alignSelf: "flex-start", marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: "#1B2A4A", marginBottom: 8, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  grid:         { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  infoBox:      { width: "48%", backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10" },
  infoLabel:    { fontSize: 7, color: "#64748b", fontWeight: "bold", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 },
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
});

const PRICE_TABLE = {
  "UAE":                 { port: "Jebel Ali / Port Rashid, Dubai",   price: 5.70, transit: "25–28" },
  "Saudi Arabia (East)": { port: "Port of Dammam",                   price: 5.80, transit: "27–30" },
  "Saudi Arabia (West)": { port: "Port of Jeddah",                   price: 5.85, transit: "29–32" },
  "Türkiye (South)":     { port: "Port of Mersin",                   price: 5.95, transit: "20–24" },
  "Türkiye (Northwest)": { port: "Port of Derince / Istanbul",       price: 6.00, transit: "22–26" },
  "China":               { port: "Port of Shanghai / Tianjin",       price: 5.65, transit: "32–38" },
};

function isLivestock(product) {
  if (!product) return false;
  return ["ovino", "bovino", "animal", "vivo"].some(k => product.toLowerCase().includes(k));
}

function isGrain(product) {
  if (!product) return false;
  return ["soya", "maíz", "maiz", "grano"].some(k => product.toLowerCase().includes(k));
}

function DocPDF({ doc, agentProfile }) {
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

  // Product description
  let productDesc = "";
  if (doc.product === "Otro" || doc.custom_product_name) {
    productDesc = doc.custom_product_desc || doc.customProductDesc || "";
  } else if (isLivestock(productCategory)) {
    productDesc = `Animales vivos de la especie ${productCategory}, procedentes de establecimientos registrados y habilitados para exportación. Los animales cumplen con todos los requisitos sanitarios internacionales y son certificados por autoridades zoosanitarias competentes del país de origen.`;
  } else if (isGrain(productCategory)) {
    productDesc = `Producto agrícola a granel de alta calidad, con análisis de humedad, proteína y aflatoxinas dentro de los estándares internacionales de exportación. Embalaje y transporte según normativas fitosanitarias vigentes.`;
  } else {
    productDesc = `Producto alimenticio de exportación que cumple con los estándares de calidad internacional establecidos por GLV Global Food Services LLC. Inspección de calidad disponible previa al embarque.`;
  }

  const exporter = doc.exporter || "GLV Global Food Services LLC (Miami, FL)";
  const domain = doc.domain || "glvglobalfoodservices.com";

  // Certification content
  let certifications = "• Certificado de origen oficial\n• Certificado sanitario/fitosanitario de exportación\n• Inspección SGS (o equivalente acordado)\n• Documentación de trazabilidad del lote";
  if (isLivestock(productCategory)) {
    certifications = "• Certificado zoosanitario oficial del país exportador\n• Certificado Halal (autoridad reconocida internacionalmente)\n• Certificado SGS de peso vivo y cantidad\n• Declaración de salud del lote por médico veterinario oficial\n• Aprobación del período de cuarentena\n• Certificado de vacunación del lote";
  }

  // Operational timeline
  let timeline = "";
  if (isLivestock(productCategory)) {
    timeline = "Semana 1–2: Firma de contrato (SPA) y pago del anticipo\nSemana 3–6: Selección y concentración del lote en origen\nSemana 7–10: Período de cuarentena oficial (mínimo 21 días)\nSemana 11: Inspección SGS, certificación y activación de SBLC\nSemana 12: Embarque en buque ganadero especializado\nSemana 13–16: Tránsito marítimo hacia destino CFR\nSemana 16+: Entrega en puerto y liquidación final";
  } else {
    timeline = "Semana 1: Firma de contrato y pago del anticipo\nSemana 2–3: Preparación y consolidación del lote\nSemana 4: Inspección de calidad y certificaciones\nSemana 5: Carga y despacho en origen\nSemana 6+: Tránsito marítimo y entrega CFR en destino";
  }

  // Mandatory info
  let mandatoryInfo = null;
  if (isLivestock(productCategory)) {
    mandatoryInfo = "INFORMACIÓN MANDATORIA — ANIMALES VIVOS:\n• Todos los embarques cumplen con el Código Sanitario para los Animales Terrestres de la OIE\n• Los buques utilizados son especializados en transporte de ganado vivo con sistema de ventilación certificado\n• La composición sexual del lote será certificada por veterinario oficial\n• El comprador es responsable de gestionar los permisos de importación en el país destino\n• Los animales son certificados libres de enfermedades de declaración obligatoria";
  } else if (isGrain(productCategory)) {
    mandatoryInfo = "INFORMACIÓN MANDATORIA — GRANOS Y CEREALES:\n• Producto libre de organismos genéticamente modificados no autorizados en destino\n• Humedad máxima garantizada según contrato\n• Libre de plagas y contaminantes según normativa internacional Codex Alimentarius\n• Fumigación y tratamiento fitosanitario incluidos en el precio CFR\n• Muestreo y análisis disponibles previa solicitud";
  }

  const tcText = `TÉRMINOS Y CONDICIONES GENERALES:\n1. La presente oferta es emitida por ${exporter} en su calidad de exportador internacional certificado.\n2. Los precios son CFR (Cost and Freight) según Incoterms 2020, en el puerto de destino indicado.\n3. La aceptación formal de esta oferta activa el proceso de elaboración del SPA (Sales Purchase Agreement).\n4. Todos los precios están denominados en Dólares Americanos (USD).\n5. Cualquier controversia será resuelta mediante arbitraje internacional según las reglas de la CCI (París).\n6. La ley aplicable es la establecida en el contrato definitivo (SPA).\n7. GLV Global Food Services LLC se reserva el derecho de modificar precios por causas de fuerza mayor, fluctuaciones de mercado o cambios en normativas sanitarias internacionales.\n8. La entidad SBLC designada es: Active Value International General Trading L.L.C — Dubai, UAE.`;

  return (
    <Document>
      {/* PAGE 1 — COVER */}
      <Page size="A4" style={s.coverPage}>
        <View style={[s.coverBg, { backgroundColor: coverBg }]}>
          {/* Logo */}
          <View>
            <View style={s.coverLogo}>
              <Text style={s.coverLogoTxt}>G</Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, marginBottom: 32 }}>
              GLV Global Food Services LLC — {domain}
            </Text>

            {/* Status badge */}
            {(isSCO || isFCO) && (
              <View style={[s.badge, {
                backgroundColor: isSCO ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.2)",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.4)"
              }]}>
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "bold" }}>
                  {isSCO ? "INDICATIVA — NO VINCULANTE" : "OFERTA FIRME — VINCULANTE"}
                </Text>
              </View>
            )}

            <Text style={s.coverTitle}>{doc.id}</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "bold", marginBottom: 8 }}>
              {isSCO ? "Soft Corporate Offer" : isFCO ? "Full Corporate Offer" : "Sales Purchase Agreement"}
            </Text>
            <Text style={s.coverSub}>Cliente: {doc.client}</Text>
            <Text style={s.coverSub}>Producto: {doc.product}</Text>
            <Text style={s.coverSub}>Destino: {doc.destination}{portInfo ? ` — ${portInfo.port}` : ""}</Text>
            <Text style={s.coverSub}>Fecha de emisión: {doc.date}</Text>
            {totalValue && <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold", marginTop: 12 }}>{fmtCurrency(totalValue)} USD</Text>}
          </View>

          {/* Cover footer */}
          <View>
            {isSCO && (
              <View style={[s.indicativaBox, { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.3)" }]}>
                <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.8)" }}>
                  Esta oferta es de carácter indicativo. Los precios y condiciones están sujetos a confirmación mediante Full Corporate Offer (FCO).
                </Text>
              </View>
            )}
            {isFCO && (
              <View style={[s.firmeBox, { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.3)" }]}>
                <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.8)" }}>
                  Esta oferta es firme y vinculante durante {validityDays} días desde la fecha de emisión. La aceptación del comprador activa el proceso de SPA.
                </Text>
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

        {/* Section 2: Identification of Parties */}
        <Text style={s.sectionTitle}>1. IDENTIFICACIÓN DE PARTES</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          <View style={[s.infoBox, { width: "48%", backgroundColor: "#f0f4ff" }]}>
            <Text style={[s.infoLabel, { color: "#1e3a5f" }]}>VENDEDOR / EXPORTADOR</Text>
            <Text style={{ fontSize: 9, fontWeight: "bold", color: "#1B2A4A", marginBottom: 2 }}>{exporter}</Text>
            <Text style={{ fontSize: 8, color: "#374151" }}>19790 W Dixie Hwy, Unit 1115{"\n"}Miami, FL 33180, USA</Text>
            <Text style={{ fontSize: 8, color: "#374151", marginTop: 2 }}>{domain}</Text>
            {isChina && <Text style={{ fontSize: 8, color: "#d97706", fontWeight: "bold", marginTop: 3 }}>GACC No. YA11000PDY110K805</Text>}
          </View>
          <View style={[s.infoBox, { width: "48%", backgroundColor: "#f8fafc" }]}>
            <Text style={s.infoLabel}>COMPRADOR / CLIENTE</Text>
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

        {/* Section 3: Product Description */}
        <Text style={s.sectionTitle}>2. DESCRIPCIÓN DEL PRODUCTO</Text>
        <View style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10", marginBottom: 16, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
          <Text style={{ fontSize: 9, fontWeight: "bold", color: "#1B2A4A", marginBottom: 4 }}>
            {doc.custom_product_name || doc.customProductName || doc.product}
          </Text>
          <Text style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.5 }}>{productDesc}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Origen</Text>
              <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{doc.origin || "Brazil"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Puerto destino CFR</Text>
              <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{portInfo?.port || doc.destination}</Text>
            </View>
            {portInfo?.transit && (
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>Tránsito estimado</Text>
                <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{portInfo.transit} días</Text>
              </View>
            )}
          </View>
          {(doc.custom_unit || doc.customUnit) && (
            <View style={{ marginTop: 6 }}>
              <Text style={s.infoLabel}>Unidad de medida</Text>
              <Text style={{ fontSize: 9, color: "#0f172a", fontWeight: "bold" }}>{doc.custom_unit || doc.customUnit}</Text>
            </View>
          )}
        </View>

        {/* Section 4: Price, Volume & Value */}
        <Text style={s.sectionTitle}>3. PRECIO, VOLUMEN Y VALOR</Text>
        <View style={s.grid}>
          {isLivestock(productCategory) && doc.headcount && (
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Número de cabezas</Text>
              <Text style={s.infoValue}>{new Intl.NumberFormat().format(doc.headcount)}</Text>
            </View>
          )}
          {isLivestock(productCategory) && doc.avgWeight && (
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Peso promedio referencia</Text>
              <Text style={s.infoValue}>{doc.avgWeight} kg</Text>
            </View>
          )}
          {pricePerKg && (
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Precio CFR (USD/kg)</Text>
              <Text style={s.infoValue}>USD {Number(pricePerKg).toFixed(2)}/kg</Text>
            </View>
          )}
          {totalKg > 0 && (
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Peso total estimado</Text>
              <Text style={s.infoValue}>{new Intl.NumberFormat().format(totalKg)} kg</Text>
            </View>
          )}
          {totalValue && (
            <View style={[s.infoBox, { backgroundColor: "#f0fdf4" }]}>
              <Text style={[s.infoLabel, { color: "#065f46" }]}>Valor total referencial</Text>
              <Text style={[s.infoValue, s.highlight]}>{fmtCurrency(totalValue)}</Text>
            </View>
          )}
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Moneda</Text>
            <Text style={s.infoValue}>USD — Dólares Americanos</Text>
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Validez de la oferta</Text>
            <Text style={s.infoValue}>{validityDays} días desde la fecha de emisión</Text>
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>Entidad SBLC / Garantía</Text>
            <Text style={s.infoValue}>Active Value International General Trading L.L.C</Text>
          </View>
        </View>

        {/* Section 5: Certifications */}
        <Text style={s.sectionTitle}>4. CERTIFICACIONES Y CALIDAD</Text>
        <View style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10", marginBottom: 16, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
          <Text style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.6 }}>{certifications}</Text>
        </View>

        {/* Section 6: Payment Terms */}
        <Text style={s.sectionTitle}>5. TÉRMINOS DE PAGO</Text>
        <View style={s.paymentBox}>
          <Text style={s.paymentText}>{paymentText}</Text>
        </View>

        {/* Section 7: Operational Timeline */}
        <Text style={s.sectionTitle}>6. CICLO OPERATIVO — TIMELINE ESTIMADO</Text>
        <View style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10", marginBottom: 16, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
          <Text style={{ fontSize: 8.5, color: "#374151", lineHeight: 1.6 }}>{timeline}</Text>
        </View>

        {/* Section 8: Mandatory Info */}
        {mandatoryInfo && (
          <>
            <Text style={s.sectionTitle}>7. INFORMACIÓN MANDATORIA</Text>
            <View style={[s.chinaBox, { backgroundColor: "#fff7ed", borderColor: "#fed7aa" }]}>
              <Text style={{ fontSize: 8.5, color: "#7c2d12", lineHeight: 1.5 }}>{mandatoryInfo}</Text>
            </View>
          </>
        )}

        {/* China box */}
        {isChina && (
          <View style={s.chinaBox}>
            <Text style={s.chinaText}>FILTRO CHINA ACTIVADO — Entidad: GLV Services SAS (Colombia) | GACC No. YA11000PDY110K805</Text>
          </View>
        )}

        {/* SPA legal notice */}
        {isSPA && (
          <View style={s.spaBox}>
            <Text style={[s.sectionTitle, { color: "#166534" }]}>Estructura del Contrato — Modelo SPA2026-03-01</Text>
            <Text style={{ fontSize: 8, color: "#14532d" }}>
              43 cláusulas legales activas: Objeto, Entidades, Domicilios, Documentos constitutivos, Producto, Lote,
              Composición sexual, Volumen, Base de facturación, Precio CFR, Moneda, Destinos, Pago/SBLC (Cláusulas 13–15),
              Inspección SGS, Halal, Cuarentena, Transporte marítimo, Documentos de lote, Responsabilidades, Seguros,
              Fuerza mayor, Incumplimiento, Penalidades, Arbitraje (CCI Paris), Ley aplicable.
            </Text>
          </View>
        )}

        {/* Section 9: Observations */}
        {doc.observations && (
          <>
            <Text style={s.sectionTitle}>8. OBSERVACIONES ESPECIALES</Text>
            <View style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10", marginBottom: 16, borderWidth: 0.5, borderColor: "#e2e8f0" }}>
              <Text style={{ fontSize: 8.5, color: "#374151" }}>{doc.observations}</Text>
            </View>
          </>
        )}

        {/* Section 10: T&C */}
        <Text style={s.sectionTitle}>9. TÉRMINOS Y CONDICIONES GENERALES</Text>
        <View style={s.tcBox}>
          <Text style={s.tcText}>{tcText}</Text>
        </View>

        {/* Section 11: Agent signature */}
        <View style={s.sigBlock}>
          <Text style={[s.sectionTitle, { marginBottom: 12 }]}>10. FIRMA DEL AGENTE</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              {/* Signature image */}
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
            </View>
          </View>
        </View>

        {/* Section 12 — FCO only: Buyer signature space */}
        {isFCO && (
          <View style={{ marginTop: 20 }}>
            <Text style={[s.sectionTitle, { marginBottom: 12 }]}>11. ACEPTACIÓN DEL COMPRADOR</Text>
            <View style={s.buyerSigBlock}>
              <Text style={{ fontSize: 8, color: "#6b7280", marginBottom: 4 }}>
                Al firmar el presente documento, el comprador confirma haber leído, comprendido y aceptado todas las condiciones de la presente Full Corporate Offer.
              </Text>
              <View style={{ flexDirection: "row", gap: 24, marginTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ height: 40, borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 4 }} />
                  <Text style={{ fontSize: 8, color: "#6b7280" }}>Firma del comprador / representante</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ height: 40, borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 4 }} />
                  <Text style={{ fontSize: 8, color: "#6b7280" }}>Sello de la empresa / fecha</Text>
                </View>
              </View>
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 8, fontWeight: "bold", color: "#374151" }}>
                  Nombre y cargo: {doc.clientRepresentative || doc.client_representative || "_______________________________"}
                </Text>
              </View>
            </View>
            <View style={s.firmeBox}>
              <Text style={{ fontSize: 8, color: "#14532d" }}>
                Esta oferta es firme y vinculante durante {validityDays} días desde la fecha de emisión ({doc.date}). La aceptación del comprador activa el proceso de SPA.
              </Text>
            </View>
          </View>
        )}

        {isSCO && (
          <View style={s.indicativaBox}>
            <Text style={{ fontSize: 8, color: "#92400e" }}>
              NOTA: Esta oferta es de carácter indicativo. Los precios y condiciones están sujetos a confirmación mediante Full Corporate Offer (FCO). No constituye compromiso contractual.
            </Text>
          </View>
        )}

        {/* Page footer */}
        <View style={s.footer}>
          <Text>Agente: {doc.agent} | Copia automática: contabilidad@glvservicesexp.com • info@glvglobalfoodservices.com</Text>
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
