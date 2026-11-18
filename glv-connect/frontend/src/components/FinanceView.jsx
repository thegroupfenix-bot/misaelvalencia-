import { useState, useEffect } from "react";
import { api } from "../api.js";

const safeCurrency = (currency) => {
  const code = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  if (!code) return "USD";
  try {
    new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(0);
    return code;
  } catch {
    return "USD";
  }
};

const fmt = (n, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: safeCurrency(currency), maximumFractionDigits: 0 }).format(Number(n) || 0);

const formatDate = (value) => value ? String(value).replace(" ", "T").slice(0, 10) : "—";

const formatTotals = (totals = {}) => {
  const entries = Object.entries(totals).filter(([, value]) => Number(value) !== 0);
  return entries.length ? entries.map(([currency, value]) => fmt(value, currency)).join(" · ") : "—";
};

export function FinanceView({ showNotif }) {
  const [summary, setSummary]     = useState(null);
  const [invoices, setInvoices]   = useState([]);
  const [byCountry, setByCountry] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [tab, setTab]             = useState("overview");

  const loadFinance = async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      api.getFinanceSummary(),
      api.getFinanceInvoices(),
      api.getFinanceByCountry(),
    ]);
    const [summaryResult, invoicesResult, countryResult] = results;
    if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
    if (invoicesResult.status === "fulfilled") setInvoices(invoicesResult.value);
    if (countryResult.status === "fulfilled") setByCountry(countryResult.value);
    if (results.some(result => result.status === "rejected")) {
      const message = "No se pudieron cargar todos los datos financieros. Reintenta en unos minutos.";
      setError(message);
      showNotif?.(message, "error");
    }
    setLoading(false);
  };

  useEffect(() => { loadFinance(); }, []);

  const TABS = [
    { id: "overview", label: "Resumen General" },
    { id: "invoices", label: "Operaciones" },
    { id: "country",  label: "Por País" },
  ];

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
          Módulo Financiero
        </h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>
          Resumen consolidado de valor comercial y operaciones
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "0.5px solid var(--color-border-tertiary)", paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "8px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? "#1B2A4A" : "var(--color-text-secondary)",
              borderBottom: tab === t.id ? "2px solid #1B2A4A" : "2px solid transparent",
              marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-text-secondary)" }}>
          <i className="ti ti-loader-2" style={{ fontSize: 36, display: "block", marginBottom: 12, opacity: 0.5 }} />
          <p>Cargando datos financieros...</p>
        </div>
      ) : (
        <>
          {error && <LoadError onRetry={loadFinance} />}
          {tab === "overview" && (summary ? <OverviewTab summary={summary} /> : <UnavailableState onRetry={loadFinance} />)}
          {tab === "invoices" && <InvoicesTab invoices={invoices} />}
          {tab === "country"  && <CountryTab byCountry={byCountry} />}
        </>
      )}
    </div>
  );
}

function LoadError({ onRetry }) {
  return (
    <div role="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20, padding: "12px 14px", border: "1px solid #fca5a5", borderRadius: 10, background: "#fef2f2", color: "#991b1b" }}>
      <span>No se pudieron cargar todos los datos financieros. Los datos disponibles siguen visibles.</span>
      <button type="button" onClick={onRetry} style={{ flexShrink: 0, padding: "7px 12px", border: "1px solid #b91c1c", borderRadius: 7, background: "white", color: "#991b1b", cursor: "pointer", fontWeight: 600 }}>Reintentar</button>
    </div>
  );
}

function UnavailableState({ onRetry }) {
  return (
    <div role="status" style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, background: "var(--color-background-primary)" }}>
      <i className="ti ti-chart-bar-off" style={{ fontSize: 32, display: "block", marginBottom: 12 }} />
      <p style={{ margin: "0 0 14px" }}>El resumen financiero no está disponible por ahora.</p>
      <button type="button" onClick={onRetry} style={{ padding: "8px 14px", border: "none", borderRadius: 7, background: "#1B2A4A", color: "white", cursor: "pointer", fontWeight: 600 }}>Reintentar carga</button>
    </div>
  );
}

function StatCard({ label, value, sub, icon, color }) {
  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 500 }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: color + "1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className={`ti ${icon}`} style={{ fontSize: 17, color }} />
        </div>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", margin: "0 0 4px" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>{sub}</p>}
    </div>
  );
}

function OverviewTab({ summary }) {
  const docTotals = summary.docTotalsByCurrency || {};
  const opTotals  = summary.opTotalsByCurrency || {};
  const byType    = summary.byType  || {};
  const byStatus  = summary.byStatus || {};
  const recent    = summary.recent  || [];

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <StatCard label="Valor Total Documentos"   value={formatTotals(docTotals)} sub="Valores separados por moneda" icon="ti-file-dollar" color="#2563eb" />
        <StatCard label="Valor Total Operaciones"  value={formatTotals(opTotals)} sub="Valores separados por moneda" icon="ti-briefcase" color="#7c3aed" />
        <StatCard label="SCO emitidos"             value={byType.SCO?.count || 0} sub={formatTotals(byType.SCO?.byCurrency)} icon="ti-file-description" color="#059669" />
        <StatCard label="FCO / SPA emitidos"       value={(byType.FCO?.count || 0) + (byType.SPA?.count || 0)} sub="documentos"         icon="ti-file-certificate" color="#d97706" />
      </div>

      {/* Por tipo de documento */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 14px" }}>Valor por tipo de documento</h3>
          {Object.entries(byType).map(([type, data]) => (
            <div key={type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                  background: type === "SCO" ? "#dbeafe" : type === "FCO" ? "#ede9fe" : "#dcfce7",
                  color:      type === "SCO" ? "#1e40af" : type === "FCO" ? "#4c1d95" : "#166534" }}>{type}</span>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{data.count} docs</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{formatTotals(data.byCurrency)}</span>
            </div>
          ))}
        </div>

        {/* Documentos recientes */}
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 14px" }}>Documentos recientes</h3>
          {recent.slice(0, 6).map(doc => (
            <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#1B2A4A", fontFamily: "monospace" }}>{doc.id}</span>
                <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: 8 }}>{doc.client}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>
                {doc.total_value ? fmt(doc.total_value, doc.currency) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InvoicesTab({ invoices }) {
  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--color-background-secondary)" }}>
            {["Operación", "Cliente", "Agente", "Destino", "Valor Contrato", "Moneda", "Estado", "Fecha"].map(h => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr><td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)" }}>Sin operaciones registradas</td></tr>
          ) : invoices.map((inv, i) => (
            <tr key={i} style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}>
              <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: "#1B2A4A", fontWeight: 600 }}>{inv.operation_id}</td>
              <td style={{ padding: "10px 14px", color: "var(--color-text-primary)" }}>{inv.client_name || "—"}</td>
              <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontSize: 12 }}>{inv.agent_name || "—"}</td>
              <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{inv.destination_country || "—"}</td>
              <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--color-text-primary)" }}>{fmt(inv.contract_value, inv.currency || "USD")}</td>
              <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontSize: 12 }}>{inv.currency || "USD"}</td>
              <td style={{ padding: "10px 14px" }}>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#dbeafe", color: "#1e40af" }}>{inv.status}</span>
              </td>
              <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontSize: 12 }}>{formatDate(inv.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountryTab({ byCountry }) {
  const totalsByCurrency = byCountry.reduce((totals, row) => {
    const currency = safeCurrency(row.currency);
    totals[currency] = (totals[currency] || 0) + (Number(row.total_value) || 0);
    return totals;
  }, {});
  return (
    <div>
      {byCountry.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)" }}>Sin datos por país aún.</div>
      ) : (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["País destino", "Operaciones", "Valor total", "Moneda", "% en su moneda"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byCountry.map((row, i) => {
                const currency = safeCurrency(row.currency);
                const totalInCurrency = totalsByCurrency[currency] || 0;
                const pct = totalInCurrency > 0 ? (((Number(row.total_value) || 0) / totalInCurrency) * 100).toFixed(1) : "0";
                return (
                  <tr key={i} style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--color-text-primary)" }}>{row.country || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{row.operations}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--color-text-primary)" }}>{fmt(row.total_value, currency)}</td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{currency}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ height: 6, width: `${Math.min(100, parseFloat(pct))}%`, minWidth: 4, background: "#1B2A4A", borderRadius: 3, maxWidth: 80 }} />
                        <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
