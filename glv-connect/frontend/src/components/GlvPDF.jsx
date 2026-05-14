import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Font, pdf,
} from "@react-pdf/renderer";

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

const s = StyleSheet.create({
  page:        { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#1a202c" },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: "#1B2A4A" },
  logo:        { width: 50, height: 50, backgroundColor: "#1B2A4A", borderRadius: 8, justifyContent: "center", alignItems: "center" },
  logoText:    { color: "#ffffff", fontSize: 26, fontWeight: "bold" },
  companyName: { fontSize: 14, fontWeight: "bold", color: "#1B2A4A", marginBottom: 2 },
  companyAddr: { fontSize: 8, color: "#6b7280" },
  badge:       { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, fontSize: 9, fontWeight: "bold", alignSelf: "flex-start", marginBottom: 6 },
  docId:       { fontSize: 18, fontWeight: "bold", color: "#1B2A4A", marginBottom: 2 },
  grid:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  infoBox:     { width: "48%", backgroundColor: "#f8fafc", borderRadius: 6, padding: "8 10" },
  infoLabel:   { fontSize: 7, color: "#64748b", fontWeight: "bold", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 },
  infoValue:   { fontSize: 9, color: "#0f172a", fontWeight: "bold" },
  sectionTitle:{ fontSize: 10, fontWeight: "bold", color: "#1B2A4A", marginBottom: 8, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  highlight:   { color: "#059669" },
  chinaBox:    { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#f59e0b", borderRadius: 6, padding: "8 12", marginBottom: 12 },
  chinaText:   { fontSize: 9, color: "#92400e", fontWeight: "bold" },
  footer:      { marginTop: 24, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: "#e2e8f0", flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#94a3b8" },
  spaBox:      { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#86efac", borderRadius: 6, padding: "10 12", marginBottom: 12 },
});

function DocPDF({ doc }) {
  const isChina = doc.destination === "China";
  const typeBg = doc.type === "SPA" ? "#dcfce7" : doc.type === "FCO" ? "#ede9fe" : "#dbeafe";
  const typeColor = doc.type === "SPA" ? "#166534" : doc.type === "FCO" ? "#4c1d95" : "#1e40af";

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.companyName}>{doc.exporter || "GLV Global Food Services LLC"}</Text>
            <Text style={s.companyAddr}>19790 W Dixie Hwy, Unit 1115, Miami, FL 33180</Text>
            <Text style={s.companyAddr}>{doc.domain || "glvglobalfoodservices.com"}</Text>
            {isChina && <Text style={[s.companyAddr, { color: "#d97706", fontWeight: "bold", marginTop: 3 }]}>GACC No. YA11000PDY110K805</Text>}
          </View>
          <View style={s.logo}>
            <Text style={s.logoText}>G</Text>
          </View>
        </View>

        {/* Document ID & type */}
        <View style={{ marginBottom: 16 }}>
          <View style={[s.badge, { backgroundColor: typeBg }]}>
            <Text style={{ color: typeColor }}>{doc.type}</Text>
          </View>
          <Text style={s.docId}>{doc.id}</Text>
          <Text style={{ fontSize: 8, color: "#64748b" }}>Emitido: {doc.date} | Estado: {doc.status}</Text>
        </View>

        {/* China Alert */}
        {isChina && (
          <View style={s.chinaBox}>
            <Text style={s.chinaText}>FILTRO CHINA ACTIVADO — Entidad: GLV Services SAS (Colombia) | GACC No. YA11000PDY110K805</Text>
          </View>
        )}

        {/* Info grid */}
        <Text style={s.sectionTitle}>Datos del Documento</Text>
        <View style={s.grid}>
          <View style={s.infoBox}><Text style={s.infoLabel}>Cliente / Comprador</Text><Text style={s.infoValue}>{doc.client}</Text></View>
          <View style={s.infoBox}><Text style={s.infoLabel}>Producto</Text><Text style={s.infoValue}>{doc.product}</Text></View>
          <View style={s.infoBox}><Text style={s.infoLabel}>Destino</Text><Text style={s.infoValue}>{doc.destination}</Text></View>
          <View style={s.infoBox}><Text style={s.infoLabel}>Origen</Text><Text style={s.infoValue}>{doc.origin || "—"}</Text></View>
          <View style={s.infoBox}><Text style={s.infoLabel}>Método de pago</Text><Text style={s.infoValue}>{doc.paymentMethod || "SBLC"}</Text></View>
          {doc.headcount && <View style={s.infoBox}><Text style={s.infoLabel}>Número de cabezas</Text><Text style={s.infoValue}>{new Intl.NumberFormat().format(doc.headcount)}</Text></View>}
          {doc.avgWeight && <View style={s.infoBox}><Text style={s.infoLabel}>Peso promedio ref.</Text><Text style={s.infoValue}>{doc.avgWeight} kg</Text></View>}
          {doc.pricePerKg && <View style={s.infoBox}><Text style={s.infoLabel}>Precio CFR</Text><Text style={s.infoValue}>USD {Number(doc.pricePerKg).toFixed(2)}/kg</Text></View>}
          {doc.totalValue && (
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Valor total referencial</Text>
              <Text style={[s.infoValue, s.highlight]}>{fmtCurrency(doc.totalValue)}</Text>
            </View>
          )}
          <View style={s.infoBox}><Text style={s.infoLabel}>Entidad financiera (SBLC)</Text><Text style={s.infoValue}>Active Value International General Trading L.L.C</Text></View>
        </View>

        {/* SPA legal notice */}
        {doc.type === "SPA" && (
          <View style={s.spaBox}>
            <Text style={s.sectionTitle}>Estructura del Contrato — Modelo SPA2026-03-01</Text>
            <Text style={{ fontSize: 8, color: "#14532d" }}>
              43 cláusulas legales activas: Objeto, Entidades, Domicilios, Documentos constitutivos, Producto, Lote,
              Composición sexual, Volumen, Base de facturación, Precio CFR, Moneda, Destinos, Pago/SBLC (Cláusulas 13–15),
              Inspección SGS, Halal, Cuarentena, Transporte marítimo, Documentos de lote, Responsabilidades, Seguros,
              Fuerza mayor, Incumplimiento, Penalidades, Arbitraje (CCI Paris), Ley aplicable.
            </Text>
          </View>
        )}

        {/* Observations */}
        {doc.observations && (
          <View style={{ marginBottom: 12 }}>
            <Text style={s.sectionTitle}>Observaciones</Text>
            <Text style={{ fontSize: 9, color: "#374151" }}>{doc.observations}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text>Agente: {doc.agent} | Copia automática: contabilidad@glvservicesexp.com • info@glvglobalfoodservices.com</Text>
          <Text>GLV Holding Group © 2026</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadPDF(doc) {
  const blob = await pdf(<DocPDF doc={doc} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default DocPDF;
