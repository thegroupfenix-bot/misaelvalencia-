import { useState, useEffect, useCallback } from "react";
import { api } from "../api.js";
import { WORLD_COUNTRIES } from "../config/worldCountries.js";

const ROLE_LEVEL = {
  SUPER_ADMIN: 100, CORPORATE_ADMIN: 90, CFO: 80, DIRECTOR: 75, DIRECTIVO: 75,
  COMMERCIAL_MANAGER: 72, COMMERCIAL_DIRECTOR: 70, COMPLIANCE: 65, ACCOUNTING: 60,
  TREASURY: 60, AUDIT: 55, TAX_REVIEWER: 50, COUNTRY_ACCOUNTANT: 50, LOGISTICS: 45,
  AGENTE: 40, COMMERCIAL_AGENT: 42, MEDIA_MANAGER: 35, CLIENT: 20, SUPPLIER: 20,
};

function roleLevel(role) { return ROLE_LEVEL[role] || 0; }

const STATUS_COLORS = {
  DRAFT: "#6b7280",
  PENDING_APPROVAL: "#d97706",
  APPROVED: "#059669",
  REJECTED: "#dc2626",
};
const STATUS_LABELS = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

const INCOTERMS = ["EXW","FCA","CPT","CIP","DAP","DPU","DDP","FAS","FOB","CFR","CIF"];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtCurrency = (n, cur = "USD") => n != null
  ? new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: 2 }).format(n)
  : "—";

// ─── Helper components ────────────────────────────────────────────────────────

function QuoteStatusBadge({ status }) {
  const color = STATUS_COLORS[status] || "#6b7280";
  const label = STATUS_LABELS[status] || status;
  return (
    <span style={{ background: color + "20", color, border: `1px solid ${color}40`, borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
      {label}
    </span>
  );
}

function SectionCard({ title, children, action }) {
  return (
    <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "1rem" }}>
      {(title || action) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          {title && <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function EmptyState({ icon = "ti-inbox", text }) {
  return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-text-secondary)" }}>
      <i className={`ti ${icon}`} style={{ fontSize: 40, opacity: 0.35, display: "block", marginBottom: 12 }} />
      <p style={{ margin: 0, fontSize: 14 }}>{text}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-text-secondary)" }}>
      <i className="ti ti-loader-2" style={{ fontSize: 28, display: "block", marginBottom: 8, opacity: 0.5 }} />
      <p style={{ margin: 0, fontSize: 13 }}>Cargando...</p>
    </div>
  );
}

function ConfirmModal({ title, body, onConfirm, onCancel, confirmLabel = "Confirmar", confirmColor = "#059669", requireReason = false }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) { setErr("Este campo es obligatorio."); return; }
    onConfirm(reason.trim());
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 14, padding: "1.75rem", width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: 17, fontWeight: 700, color: "var(--color-text-primary)" }}>{title}</h3>
        {body && <p style={{ margin: "0 0 1rem", fontSize: 13, color: "var(--color-text-secondary)" }}>{body}</p>}
        <textarea
          placeholder={requireReason ? "Motivo (obligatorio)" : "Comentario (opcional)"}
          value={reason} onChange={e => { setReason(e.target.value); setErr(""); }}
          rows={3}
          style={{ width: "100%", resize: "vertical", padding: "8px 10px", borderRadius: 8, border: `1px solid ${err ? "#dc2626" : "var(--color-border-tertiary)"}`, fontSize: 13, fontFamily: "var(--font-sans)", boxSizing: "border-box", background: "var(--color-background-secondary)", color: "var(--color-text-primary)" }}
        />
        {err && <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0" }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: "1rem", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--color-border-tertiary)", background: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-primary)" }}>Cancelar</button>
          <button onClick={handleConfirm} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: confirmColor, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color = "#2563eb" }) {
  return (
    <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 22, color }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)" }}>{value}</p>
        <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-border-tertiary)", marginBottom: "1.5rem" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          style={{ padding: "10px 16px", fontSize: 13, fontWeight: active === t.id ? 700 : 500, color: active === t.id ? "#2563eb" : "var(--color-text-secondary)", background: "none", border: "none", borderBottom: active === t.id ? "2px solid #2563eb" : "2px solid transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <i className={`ti ${t.icon}`} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Screen 1: Centro Comercial ───────────────────────────────────────────────

function CommercialCentro({ user, onNavigate }) {
  const [quotes, setQuotes] = useState(null);
  const [loading, setLoading] = useState(true);
  const level = roleLevel(user?.role);
  const canApprove = level >= 70;
  const canCreate = level >= 40 && user?.role !== "CLIENT" && user?.role !== "SUPPLIER";

  useEffect(() => {
    api.getCommercialQuotes()
      .then(d => setQuotes(Array.isArray(d) ? d : (d?.quotes || [])))
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  const total = quotes.length;
  const pending = quotes.filter(q => q.status === "PENDING_APPROVAL").length;
  const approved = quotes.filter(q => q.status === "APPROVED").length;
  const totalApprovedValue = quotes.filter(q => q.status === "APPROVED").reduce((s, q) => s + (q.total_value || 0), 0);
  const recent = [...quotes].slice(0, 5);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentRejected = quotes.filter(q => q.status === "REJECTED" && q.updated_at && new Date(q.updated_at) > sevenDaysAgo).length;

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)" }}>Centro Comercial</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>Resumen de actividad comercial</p>
      </div>

      {/* Alert banners */}
      {canApprove && pending > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 16px", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 12 }}>
          <i className="ti ti-alert-triangle" style={{ color: "#d97706", fontSize: 18 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 13, color: "#92400e" }}>{pending} cotización{pending > 1 ? "es" : ""} esperan aprobación</strong>
          </div>
          <button onClick={() => onNavigate("approvals")} style={{ background: "#d97706", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Ver cola
          </button>
        </div>
      )}
      {recentRejected > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 12 }}>
          <i className="ti ti-x-circle" style={{ color: "#dc2626", fontSize: 18 }} />
          <span style={{ fontSize: 13, color: "#7f1d1d" }}>{recentRejected} cotización{recentRejected > 1 ? "es" : ""} rechazada{recentRejected > 1 ? "s" : ""} en los últimos 7 días</span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <StatCard icon="ti-file-text" label="Total cotizaciones" value={total} color="#2563eb" />
        <StatCard icon="ti-clock" label="Pendientes de aprobación" value={pending} color="#d97706" />
        <StatCard icon="ti-check" label="Aprobadas" value={approved} color="#059669" />
        <StatCard icon="ti-currency-dollar" label="Valor aprobado" value={fmtCurrency(totalApprovedValue)} color="#7c3aed" />
      </div>

      {/* Quick actions */}
      {(canCreate || canApprove) && (
        <SectionCard title="Acciones rápidas">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canCreate && (
              <button onClick={() => onNavigate("new-quote")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <i className="ti ti-plus" /> Nueva cotización
              </button>
            )}
            {canApprove && (
              <button onClick={() => onNavigate("approvals")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#d97706", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <i className="ti ti-list-check" /> Cola de aprobaciones
              </button>
            )}
            {canApprove && (
              <button onClick={() => onNavigate("matrix")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <i className="ti ti-table" /> Ver matriz de precios
              </button>
            )}
          </div>
        </SectionCard>
      )}

      {/* Recent quotes */}
      <SectionCard title="Cotizaciones recientes">
        {recent.length === 0 ? <EmptyState icon="ti-file-off" text="No hay cotizaciones" /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
                  {["Código","Producto","Ruta","Valor","Estado"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map(q => (
                  <tr key={q.id} onClick={() => onNavigate("quote-detail", q.id)} style={{ cursor: "pointer", borderBottom: "1px solid var(--color-border-tertiary)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px" }}><span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 12 }}>{q.quote_number}</span></td>
                    <td style={{ padding: "10px", color: "var(--color-text-primary)" }}>{q.product_code || q.product_name_es || "—"}</td>
                    <td style={{ padding: "10px", color: "var(--color-text-secondary)" }}>{q.origin_country}→{q.destination_country}</td>
                    <td style={{ padding: "10px" }}>{fmtCurrency(q.total_value, q.currency)}</td>
                    <td style={{ padding: "10px" }}><QuoteStatusBadge status={q.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Screen 2: Listado de cotizaciones ───────────────────────────────────────

function CommercialQuoteList({ user, onNavigate }) {
  const [quotes, setQuotes] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterIncoterm, setFilterIncoterm] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterIncoterm) params.incoterm = filterIncoterm;
    api.getCommercialQuotes(params)
      .then(d => setQuotes(Array.isArray(d) ? d : (d?.quotes || [])))
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  }, [filterStatus, filterIncoterm]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const filtered = (quotes || []).filter(q => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (q.quote_number || "").toLowerCase().includes(s)
      || (q.product_code || "").toLowerCase().includes(s)
      || (q.product_name_es || "").toLowerCase().includes(s);
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)" }}>Cotizaciones</h2>
        {roleLevel(user?.role) >= 40 && user?.role !== "CLIENT" && user?.role !== "SUPPLIER" && (
          <button onClick={() => onNavigate("new-quote")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <i className="ti ti-plus" /> Nueva cotización
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: "1rem" }}>
        <input placeholder="Buscar por código o producto..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: "1 1 220px", padding: "8px 12px", border: "1px solid var(--color-border-tertiary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid var(--color-border-tertiary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">Todos los estados</option>
          <option value="DRAFT">Borrador</option>
          <option value="PENDING_APPROVAL">Pendiente</option>
          <option value="APPROVED">Aprobada</option>
          <option value="REJECTED">Rechazada</option>
        </select>
        <select value={filterIncoterm} onChange={e => setFilterIncoterm(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid var(--color-border-tertiary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">Todos los Incoterms</option>
          {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      <SectionCard>
        {loading ? <LoadingState /> : filtered.length === 0 ? (
          <EmptyState icon="ti-file-off" text="No se encontraron cotizaciones" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
                  {["Código","Responsable","Producto","Ruta","Qty","Moneda","Valor","Vigencia","Estado",""].map((h, i) => (
                    <th key={i} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px" }}><span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 12 }}>{q.quote_number}</span></td>
                    <td style={{ padding: "10px", color: "var(--color-text-secondary)", fontSize: 12 }}>{q.created_by || "—"}</td>
                    <td style={{ padding: "10px" }}>{q.product_code || q.product_name_es || "—"}</td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>{q.origin_country}→{q.destination_country}</td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>{q.quantity} {q.unit}</td>
                    <td style={{ padding: "10px" }}>{q.currency || "—"}</td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>{fmtCurrency(q.total_value, q.currency)}</td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(q.valid_until)}</td>
                    <td style={{ padding: "10px" }}><QuoteStatusBadge status={q.status} /></td>
                    <td style={{ padding: "10px" }}>
                      <button onClick={() => onNavigate("quote-detail", q.id)}
                        style={{ padding: "5px 12px", border: "1px solid var(--color-border-tertiary)", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 12, color: "var(--color-text-primary)" }}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Screen 3: Nueva cotización ───────────────────────────────────────────────

function CommercialNewQuote({ user, onNavigate, showNotif }) {
  const [form, setForm] = useState({
    origin_country: "", destination_country: "", incoterm: "CIF",
    currency: "USD", quantity: "", unit: "kg",
    payment_conditions: "", validity_days: 30, client_id: "",
  });
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.getClients("buyer").then(d => setClients(Array.isArray(d) ? d : (d?.clients || []))).catch(() => {});
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.origin_country) e.origin_country = "Requerido";
    if (!form.destination_country) e.destination_country = "Requerido";
    if (!form.incoterm) e.incoterm = "Requerido";
    if (!form.currency) e.currency = "Requerido";
    if (!form.quantity || Number(form.quantity) <= 0) e.quantity = "Debe ser mayor que 0";
    if (!form.unit) e.unit = "Requerido";
    return e;
  };

  const handleCreate = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const body = {
        origin_country: form.origin_country,
        destination_country: form.destination_country,
        incoterm: form.incoterm,
        currency: form.currency,
        quantity: Number(form.quantity),
        unit: form.unit,
      };
      if (form.payment_conditions.trim()) body.payment_conditions = form.payment_conditions.trim();
      if (form.validity_days) body.validity_days = Number(form.validity_days);
      if (form.client_id) body.client_id = Number(form.client_id);

      const result = await api.createCommercialQuote(body);
      showNotif("Cotización creada correctamente");
      onNavigate("quote-detail", result.id);
    } catch (err) {
      showNotif(err.message || "Error al crear cotización", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = (key) => ({
    width: "100%", padding: "9px 12px", border: `1px solid ${errors[key] ? "#dc2626" : "var(--color-border-tertiary)"}`,
    borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box",
  });

  const Label = ({ children, required }) => (
    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>
      {children}{required && <span style={{ color: "#dc2626" }}> *</span>}
    </label>
  );

  const Field = ({ k, label, required, children }) => (
    <div style={{ marginBottom: "1rem" }}>
      <Label required={required}>{label}</Label>
      {children}
      {errors[k] && <p style={{ color: "#dc2626", fontSize: 11, margin: "3px 0 0" }}>{errors[k]}</p>}
    </div>
  );

  const countryOptions = WORLD_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>);

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
        <button onClick={() => onNavigate("quotes")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 20, padding: 0, lineHeight: 1 }}>
          <i className="ti ti-arrow-left" />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)" }}>Nueva cotización</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>El precio es calculado exclusivamente por el servidor.</p>
        </div>
      </div>

      <SectionCard title="Información de la cotización">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1.5rem" }}>
          <Field k="origin_country" label="País de origen" required>
            <select value={form.origin_country} onChange={e => set("origin_country", e.target.value)} style={inputStyle("origin_country")}>
              <option value="">Seleccione...</option>{countryOptions}
            </select>
          </Field>
          <Field k="destination_country" label="País de destino" required>
            <select value={form.destination_country} onChange={e => set("destination_country", e.target.value)} style={inputStyle("destination_country")}>
              <option value="">Seleccione...</option>{countryOptions}
            </select>
          </Field>
          <Field k="incoterm" label="Incoterm" required>
            <select value={form.incoterm} onChange={e => set("incoterm", e.target.value)} style={inputStyle("incoterm")}>
              {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
          <Field k="currency" label="Moneda" required>
            <select value={form.currency} onChange={e => set("currency", e.target.value)} style={inputStyle("currency")}>
              <option value="USD">USD — Dólar estadounidense</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </Field>
          <Field k="quantity" label="Cantidad" required>
            <input type="number" min="0.01" step="any" value={form.quantity} onChange={e => set("quantity", e.target.value)} style={inputStyle("quantity")} placeholder="ej. 5000" />
          </Field>
          <Field k="unit" label="Unidad" required>
            <select value={form.unit} onChange={e => set("unit", e.target.value)} style={inputStyle("unit")}>
              {["kg","TM","litros","unidades","cajas"].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field k="payment_conditions" label="Condiciones de pago">
            <input value={form.payment_conditions} onChange={e => set("payment_conditions", e.target.value)} style={inputStyle("payment_conditions")} placeholder="ej. 30/60/90 días" />
          </Field>
          <Field k="validity_days" label="Vigencia (días)">
            <input type="number" min="1" value={form.validity_days} onChange={e => set("validity_days", e.target.value)} style={inputStyle("validity_days")} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Cliente (opcional)">
        <p style={{ margin: "0 0 1rem", fontSize: 12, color: "var(--color-text-secondary)" }}>Si no selecciona cliente, la cotización queda como borrador interno.</p>
        <Field k="client_id" label="Cliente aprobado">
          <select value={form.client_id} onChange={e => set("client_id", e.target.value)} style={inputStyle("client_id")}>
            <option value="">Sin cliente asignado</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.country})</option>)}
          </select>
        </Field>
      </SectionCard>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={() => onNavigate("quotes")} style={{ padding: "10px 20px", border: "1px solid var(--color-border-tertiary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-primary)" }}>
          Cancelar
        </button>
        <button onClick={handleCreate} disabled={saving}
          style={{ padding: "10px 22px", border: "none", borderRadius: 8, background: saving ? "#6b7280" : "#2563eb", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
          {saving ? "Creando..." : "Crear borrador"}
        </button>
      </div>
    </div>
  );
}

// ─── Screen 4: Detalle de cotización ─────────────────────────────────────────

function CommercialQuoteDetail({ quoteId, user, onNavigate, showNotif }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [modal, setModal] = useState(null); // { type: "approve"|"reject" }
  const [docIdInput, setDocIdInput] = useState("");

  const level = roleLevel(user?.role);
  const isClient = user?.role === "CLIENT" || user?.role === "SUPPLIER";
  const canCalculate = level >= 40 && !isClient;
  const canSubmit = level >= 40 && !isClient;
  const canApprove = level >= 70;
  const canLink = level >= 40 && !isClient;

  const load = useCallback(() => {
    if (!quoteId) return;
    setLoading(true);
    api.getCommercialQuote(quoteId)
      .then(setQuote)
      .catch(() => setQuote(null))
      .finally(() => setLoading(false));
  }, [quoteId]);

  useEffect(() => { load(); }, [load]);

  const doCalculate = async () => {
    setActionLoading(true);
    try {
      await api.calculateCommercialQuote(quoteId);
      showNotif("Precio calculado correctamente");
      load();
    } catch (e) {
      showNotif(e.message || "Error al calcular", "error");
    } finally { setActionLoading(false); }
  };

  const doSubmit = async () => {
    setActionLoading(true);
    try {
      await api.submitCommercialQuote(quoteId);
      showNotif("Cotización enviada para aprobación");
      load();
    } catch (e) {
      showNotif(e.message || "Error al enviar", "error");
    } finally { setActionLoading(false); }
  };

  const doApprove = async (comment) => {
    setActionLoading(true);
    setModal(null);
    try {
      await api.approveCommercialQuote(quoteId, comment ? { comment } : {});
      showNotif("Cotización aprobada");
      load();
    } catch (e) {
      showNotif(e.message || "Error al aprobar", "error");
    } finally { setActionLoading(false); }
  };

  const doReject = async (reason) => {
    setActionLoading(true);
    setModal(null);
    try {
      await api.rejectCommercialQuote(quoteId, { reason });
      showNotif("Cotización rechazada");
      load();
    } catch (e) {
      showNotif(e.message || "Error al rechazar", "error");
    } finally { setActionLoading(false); }
  };

  const doLinkDoc = async () => {
    if (!docIdInput.trim()) return;
    setActionLoading(true);
    try {
      await api.linkCommercialDocument(quoteId, { doc_id: docIdInput.trim() });
      showNotif("Documento vinculado");
      setDocIdInput("");
      load();
    } catch (e) {
      showNotif(e.message || "Error al vincular", "error");
    } finally { setActionLoading(false); }
  };

  if (loading) return <LoadingState />;
  if (!quote) return (
    <div>
      <button onClick={() => onNavigate("quotes")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 13, padding: 0, marginBottom: 16 }}>
        ← Volver
      </button>
      <EmptyState icon="ti-file-x" text="Cotización no encontrada o sin acceso." />
    </div>
  );

  const hasPriceCalculated = quote.price_per_unit != null;

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
        <button onClick={() => onNavigate("quotes")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 22, padding: 0, lineHeight: 1 }}>
          <i className="ti ti-arrow-left" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", fontFamily: "monospace" }}>{quote.quote_number}</h2>
            <QuoteStatusBadge status={quote.status} />
            {quote.price_locked ? <span style={{ background: "#e0f2fe", color: "#0369a1", borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>Precio bloqueado</span> : null}
          </div>
        </div>
        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {quote.status === "DRAFT" && canCalculate && !hasPriceCalculated && (
            <button onClick={doCalculate} disabled={actionLoading} style={{ padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <i className="ti ti-calculator" /> Calcular precio
            </button>
          )}
          {quote.status === "DRAFT" && canSubmit && hasPriceCalculated && (
            <button onClick={doSubmit} disabled={actionLoading} style={{ padding: "8px 14px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <i className="ti ti-send" /> Solicitar aprobación
            </button>
          )}
          {quote.status === "PENDING_APPROVAL" && canApprove && (
            <>
              <button onClick={() => setModal({ type: "approve" })} disabled={actionLoading} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <i className="ti ti-check" /> Aprobar
              </button>
              <button onClick={() => setModal({ type: "reject" })} disabled={actionLoading} style={{ padding: "8px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <i className="ti ti-x" /> Rechazar
              </button>
            </>
          )}
          {["DRAFT","PENDING_APPROVAL"].includes(quote.status) && canApprove && quote.status !== "PENDING_APPROVAL" && (
            <button onClick={() => setModal({ type: "reject" })} disabled={actionLoading} style={{ padding: "8px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <i className="ti ti-ban" /> Anular
            </button>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <SectionCard title="Datos comerciales">
          {[
            ["Código de producto", quote.product_code || quote.product_name_es || "—"],
            ["Origen → Destino", `${quote.origin_country} → ${quote.destination_country}`],
            ["Incoterm", quote.incoterm],
            ["Cantidad", `${quote.quantity} ${quote.unit}`],
            ["Moneda", quote.currency],
            ["Condiciones de pago", quote.payment_conditions || "—"],
            ["Vigencia", `${quote.validity_days || "—"} días`],
            ["Válida hasta", fmtDate(quote.valid_until)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--color-border-tertiary)", fontSize: 13 }}>
              <span style={{ color: "var(--color-text-secondary)" }}>{k}</span>
              <span style={{ fontWeight: 600, color: "var(--color-text-primary)", textAlign: "right", maxWidth: "55%" }}>{v}</span>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="Estado y responsables">
          {[
            ["Creado por", quote.created_by || "—"],
            ["Calculado por", quote.calculated_by || "—"],
            ["Enviado por", quote.submitted_by || "—"],
            ["Aprobado por", quote.approved_by || "—"],
            ...((quote.rejected_by) ? [
              ["Rechazado por", quote.rejected_by],
              ["Motivo", quote.rejection_reason || "—"],
            ] : []),
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--color-border-tertiary)", fontSize: 13 }}>
              <span style={{ color: "var(--color-text-secondary)" }}>{k}</span>
              <span style={{ fontWeight: 600, color: "var(--color-text-primary)", textAlign: "right", maxWidth: "55%", wordBreak: "break-word" }}>{v}</span>
            </div>
          ))}
        </SectionCard>
      </div>

      {/* Price section */}
      {hasPriceCalculated && (
        <SectionCard title="Precio calculado">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem 1.25rem" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 600 }}>PRECIO POR UNIDAD</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#059669" }}>{fmtCurrency(quote.price_per_unit, quote.currency)}</p>
            </div>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem 1.25rem" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 600 }}>VALOR TOTAL</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#2563eb" }}>{fmtCurrency(quote.total_value, quote.currency)}</p>
            </div>
            {!isClient && quote.min_authorized_price != null && (
              <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "1rem 1.25rem" }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 600 }}>PRECIO MÍNIMO AUTORIZADO</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#d97706" }}>{fmtCurrency(quote.min_authorized_price, quote.currency)}</p>
              </div>
            )}
          </div>
          {!isClient && (quote.matrix_id || quote.rule_id) && (
            <div style={{ marginTop: "0.75rem", display: "flex", gap: 10, flexWrap: "wrap" }}>
              {quote.matrix_id && <span style={{ fontSize: 11, background: "#e0f2fe", color: "#0369a1", borderRadius: 8, padding: "3px 10px" }}>Matriz #{quote.matrix_id}</span>}
              {quote.rule_id && <span style={{ fontSize: 11, background: "#f0fdf4", color: "#15803d", borderRadius: 8, padding: "3px 10px" }}>Regla #{quote.rule_id}</span>}
            </div>
          )}
        </SectionCard>
      )}

      {/* Linked document */}
      <SectionCard title="Documento vinculado">
        {quote.doc_id ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="ti ti-file-check" style={{ color: "#059669", fontSize: 18 }} />
            <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 13 }}>{quote.doc_id}</span>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>Sin documento vinculado.</p>
        )}
        {canLink && quote.status === "APPROVED" && !quote.doc_id && (
          <div style={{ display: "flex", gap: 8, marginTop: "1rem" }}>
            <input value={docIdInput} onChange={e => setDocIdInput(e.target.value)} placeholder="ID del documento (ej. SCO-2026-001)"
              style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--color-border-tertiary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
            <button onClick={doLinkDoc} disabled={actionLoading || !docIdInput.trim()} style={{ padding: "8px 16px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Vincular
            </button>
          </div>
        )}
      </SectionCard>

      {/* Audit timeline — internal roles only */}
      {!isClient && quote.audit && quote.audit.length > 0 && (
        <SectionCard title="Línea de tiempo / Auditoría">
          <div style={{ position: "relative", paddingLeft: 24 }}>
            <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, width: 2, background: "var(--color-border-tertiary)" }} />
            {quote.audit.map((ev, i) => (
              <div key={i} style={{ position: "relative", marginBottom: 16 }}>
                <div style={{ position: "absolute", left: -20, top: 2, width: 10, height: 10, borderRadius: "50%", background: "#2563eb", border: "2px solid var(--color-background-primary)" }} />
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 2 }}>{fmtDate(ev.created_at)} — <strong style={{ color: "var(--color-text-primary)" }}>{ev.actor}</strong></div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{ev.action}</div>
                {ev.detail && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{typeof ev.detail === "object" ? JSON.stringify(ev.detail) : ev.detail}</div>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Modals */}
      {modal?.type === "approve" && (
        <ConfirmModal title="Aprobar cotización" body={`¿Aprobar ${quote.quote_number}?`} onConfirm={doApprove} onCancel={() => setModal(null)} confirmLabel="Aprobar" confirmColor="#059669" requireReason={false} />
      )}
      {modal?.type === "reject" && (
        <ConfirmModal title="Rechazar cotización" body={`¿Rechazar ${quote.quote_number}?`} onConfirm={doReject} onCancel={() => setModal(null)} confirmLabel="Rechazar" confirmColor="#dc2626" requireReason={true} />
      )}
    </div>
  );
}

// ─── Screen 5: Matriz de precios ──────────────────────────────────────────────

function CommercialMatrix({ user, showNotif }) {
  const [tab, setTab] = useState("matrices");
  const [matrices, setMatrices] = useState(null);
  const [rules, setRules] = useState(null);
  const [loadingM, setLoadingM] = useState(true);
  const [loadingR, setLoadingR] = useState(true);
  const [showNewMatrix, setShowNewMatrix] = useState(false);
  const [showNewRule, setShowNewRule] = useState(false);
  const level = roleLevel(user?.role);
  const canEdit = level >= 70;

  const loadMatrices = useCallback(() => {
    setLoadingM(true);
    api.getCommercialMatrix().then(d => setMatrices(Array.isArray(d) ? d : (d?.matrices || []))).catch(() => setMatrices([])).finally(() => setLoadingM(false));
  }, []);
  const loadRules = useCallback(() => {
    setLoadingR(true);
    api.getCommercialRules().then(d => setRules(Array.isArray(d) ? d : (d?.rules || []))).catch(() => setRules([])).finally(() => setLoadingR(false));
  }, []);

  useEffect(() => { loadMatrices(); loadRules(); }, [loadMatrices, loadRules]);

  const toggleMatrixStatus = async (m) => {
    try {
      await api.updateCommercialMatrix(m.id, { status: m.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      showNotif("Estado actualizado");
      loadMatrices();
    } catch (e) { showNotif(e.message || "Error", "error"); }
  };

  const toggleRuleStatus = async (r) => {
    try {
      await api.updateCommercialRule(r.id, { status: r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      showNotif("Estado actualizado");
      loadRules();
    } catch (e) { showNotif(e.message || "Error", "error"); }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 1.5rem", fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)" }}>Matriz de Precios</h2>
      <TabBar tabs={[{ id: "matrices", icon: "ti-table", label: "Matrices" }, { id: "rules", icon: "ti-rules", label: "Reglas" }]} active={tab} onSelect={setTab} />

      {tab === "matrices" && (
        <div>
          {canEdit && (
            <div style={{ marginBottom: "1rem" }}>
              <button onClick={() => setShowNewMatrix(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <i className={`ti ${showNewMatrix ? "ti-x" : "ti-plus"}`} /> {showNewMatrix ? "Cancelar" : "Nueva matriz"}
              </button>
            </div>
          )}
          {showNewMatrix && canEdit && <NewMatrixForm onCreated={() => { setShowNewMatrix(false); loadMatrices(); }} showNotif={showNotif} />}
          <SectionCard>
            {loadingM ? <LoadingState /> : (matrices || []).length === 0 ? <EmptyState icon="ti-table-off" text="No hay matrices configuradas" /> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
                      {["Origen","Destino","Incoterm","Precio venta","Precio mín.","Vigencia desde","Vigencia hasta","Estado",""].map((h, i) => (
                        <th key={i} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(matrices || []).map(m => (
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "8px 10px" }}>{m.origin_country || "*"}</td>
                        <td style={{ padding: "8px 10px" }}>{m.destination_country || "*"}</td>
                        <td style={{ padding: "8px 10px" }}>{m.incoterm || "*"}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>{fmtCurrency(m.sale_price)}</td>
                        <td style={{ padding: "8px 10px" }}>{fmtCurrency(m.min_authorized_price)}</td>
                        <td style={{ padding: "8px 10px" }}>{fmtDate(m.valid_from)}</td>
                        <td style={{ padding: "8px 10px" }}>{fmtDate(m.valid_until)}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ background: m.status === "ACTIVE" ? "#f0fdf4" : "#fef2f2", color: m.status === "ACTIVE" ? "#059669" : "#dc2626", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                            {m.status === "ACTIVE" ? "Activa" : "Inactiva"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {canEdit && (
                            <button onClick={() => toggleMatrixStatus(m)} style={{ padding: "4px 10px", border: "1px solid var(--color-border-tertiary)", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 11, color: "var(--color-text-secondary)" }}>
                              {m.status === "ACTIVE" ? "Desactivar" : "Activar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {tab === "rules" && (
        <div>
          {canEdit && (
            <div style={{ marginBottom: "1rem" }}>
              <button onClick={() => setShowNewRule(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <i className={`ti ${showNewRule ? "ti-x" : "ti-plus"}`} /> {showNewRule ? "Cancelar" : "Nueva regla"}
              </button>
            </div>
          )}
          {showNewRule && canEdit && <NewRuleForm onCreated={() => { setShowNewRule(false); loadRules(); }} showNotif={showNotif} />}
          <SectionCard>
            {loadingR ? <LoadingState /> : (rules || []).length === 0 ? <EmptyState icon="ti-file-off" text="No hay reglas configuradas" /> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
                      {["Producto","Origen","Destino","Incoterm","Vol. mín.","Piso precio","Desc. máx.","Vigencia","Estado",""].map((h, i) => (
                        <th key={i} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(rules || []).map(r => (
                      <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "8px 10px" }}>{r.product_id || "*"}</td>
                        <td style={{ padding: "8px 10px" }}>{r.origin_country || "*"}</td>
                        <td style={{ padding: "8px 10px" }}>{r.destination_country || "*"}</td>
                        <td style={{ padding: "8px 10px" }}>{r.incoterm || "*"}</td>
                        <td style={{ padding: "8px 10px" }}>{r.min_volume != null ? `${r.min_volume} ${r.min_volume_unit || ""}` : "—"}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>{fmtCurrency(r.min_price_floor)}</td>
                        <td style={{ padding: "8px 10px" }}>{r.max_discount_pct != null ? `${(r.max_discount_pct * 100).toFixed(1)}%` : "—"}</td>
                        <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{fmtDate(r.valid_from)} – {fmtDate(r.valid_until)}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ background: r.status === "ACTIVE" ? "#f0fdf4" : "#fef2f2", color: r.status === "ACTIVE" ? "#059669" : "#dc2626", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                            {r.status === "ACTIVE" ? "Activa" : "Inactiva"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {canEdit && (
                            <button onClick={() => toggleRuleStatus(r)} style={{ padding: "4px 10px", border: "1px solid var(--color-border-tertiary)", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 11, color: "var(--color-text-secondary)" }}>
                              {r.status === "ACTIVE" ? "Desactivar" : "Activar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function NewMatrixForm({ onCreated, showNotif }) {
  const [f, setF] = useState({ origin_country: "", destination_country: "", incoterm: "CIF", base_cost: "", freight_cost: "", insurance_cost: "", operational_cost: "", target_margin: "", valid_from: "", valid_until: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...f };
      ["base_cost","freight_cost","insurance_cost","operational_cost","target_margin"].forEach(k => { if (body[k]) body[k] = Number(body[k]); else delete body[k]; });
      if (!body.valid_until) delete body.valid_until;
      await api.createCommercialMatrix(body);
      showNotif("Matriz creada");
      onCreated();
    } catch (e) { showNotif(e.message || "Error", "error"); } finally { setSaving(false); }
  };

  const inp = { padding: "7px 10px", border: "1px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 12, background: "var(--color-background-primary)", color: "var(--color-text-primary)", width: "100%", boxSizing: "border-box" };
  const countryOptions = WORLD_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>);

  return (
    <div style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1rem" }}>
      <h4 style={{ margin: "0 0 1rem", fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>Nueva entrada de matriz</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem" }}>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Origen *</label><select value={f.origin_country} onChange={e => set("origin_country", e.target.value)} style={inp}><option value="">Seleccione</option>{countryOptions}</select></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Destino *</label><select value={f.destination_country} onChange={e => set("destination_country", e.target.value)} style={inp}><option value="">Seleccione</option>{countryOptions}</select></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Incoterm *</label><select value={f.incoterm} onChange={e => set("incoterm", e.target.value)} style={inp}>{INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}</select></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Costo base *</label><input type="number" step="0.01" value={f.base_cost} onChange={e => set("base_cost", e.target.value)} style={inp} /></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Flete</label><input type="number" step="0.01" value={f.freight_cost} onChange={e => set("freight_cost", e.target.value)} style={inp} /></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Seguro</label><input type="number" step="0.01" value={f.insurance_cost} onChange={e => set("insurance_cost", e.target.value)} style={inp} /></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Operativo</label><input type="number" step="0.01" value={f.operational_cost} onChange={e => set("operational_cost", e.target.value)} style={inp} /></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Margen objetivo *</label><input type="number" step="0.01" placeholder="ej. 0.20" value={f.target_margin} onChange={e => set("target_margin", e.target.value)} style={inp} /></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Vigencia desde *</label><input type="date" value={f.valid_from} onChange={e => set("valid_from", e.target.value)} style={inp} /></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Vigencia hasta</label><input type="date" value={f.valid_until} onChange={e => set("valid_until", e.target.value)} style={inp} /></div>
      </div>
      <button onClick={handleSave} disabled={saving} style={{ marginTop: "1rem", padding: "8px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

function NewRuleForm({ onCreated, showNotif }) {
  const [f, setF] = useState({ origin_country: "", destination_country: "", incoterm: "", min_price_floor: "", max_discount_pct: "", valid_from: "", valid_until: "", min_volume: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { ...f };
      ["min_price_floor","max_discount_pct","min_volume"].forEach(k => { if (body[k]) body[k] = Number(body[k]); else delete body[k]; });
      if (!body.valid_until) delete body.valid_until;
      if (!body.origin_country) delete body.origin_country;
      if (!body.destination_country) delete body.destination_country;
      if (!body.incoterm) delete body.incoterm;
      if (!body.notes) delete body.notes;
      await api.createCommercialRule(body);
      showNotif("Regla creada");
      onCreated();
    } catch (e) { showNotif(e.message || "Error", "error"); } finally { setSaving(false); }
  };

  const inp = { padding: "7px 10px", border: "1px solid var(--color-border-tertiary)", borderRadius: 7, fontSize: 12, background: "var(--color-background-primary)", color: "var(--color-text-primary)", width: "100%", boxSizing: "border-box" };
  const countryOptions = WORLD_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>);

  return (
    <div style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1rem" }}>
      <h4 style={{ margin: "0 0 1rem", fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>Nueva regla comercial</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem" }}>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Origen</label><select value={f.origin_country} onChange={e => set("origin_country", e.target.value)} style={inp}><option value="">Cualquiera</option>{countryOptions}</select></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Destino</label><select value={f.destination_country} onChange={e => set("destination_country", e.target.value)} style={inp}><option value="">Cualquiera</option>{countryOptions}</select></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Incoterm</label><select value={f.incoterm} onChange={e => set("incoterm", e.target.value)} style={inp}><option value="">Cualquiera</option>{INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}</select></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Piso precio *</label><input type="number" step="0.01" value={f.min_price_floor} onChange={e => set("min_price_floor", e.target.value)} style={inp} /></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Descuento máx. *</label><input type="number" step="0.01" placeholder="0.10 = 10%" value={f.max_discount_pct} onChange={e => set("max_discount_pct", e.target.value)} style={inp} /></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Volumen mínimo</label><input type="number" step="any" value={f.min_volume} onChange={e => set("min_volume", e.target.value)} style={inp} /></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Vigencia desde *</label><input type="date" value={f.valid_from} onChange={e => set("valid_from", e.target.value)} style={inp} /></div>
        <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Vigencia hasta</label><input type="date" value={f.valid_until} onChange={e => set("valid_until", e.target.value)} style={inp} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Notas</label><input value={f.notes} onChange={e => set("notes", e.target.value)} style={inp} placeholder="Notas internas opcionales" /></div>
      </div>
      <button onClick={handleSave} disabled={saving} style={{ marginTop: "1rem", padding: "8px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

// ─── Screen 6: Cola de aprobaciones ──────────────────────────────────────────

function CommercialApprovals({ user, onNavigate, showNotif }) {
  const [quotes, setQuotes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { type, quoteId, quoteNumber }
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getCommercialQuotes({ status: "PENDING_APPROVAL" })
      .then(d => setQuotes(Array.isArray(d) ? d : (d?.quotes || [])))
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const doApprove = async (comment) => {
    setActionLoading(true);
    setModal(null);
    try {
      await api.approveCommercialQuote(modal.quoteId, comment ? { comment } : {});
      showNotif("Cotización aprobada");
      load();
    } catch (e) { showNotif(e.message || "Error", "error"); } finally { setActionLoading(false); }
  };

  const doReject = async (reason) => {
    setActionLoading(true);
    setModal(null);
    try {
      await api.rejectCommercialQuote(modal.quoteId, { reason });
      showNotif("Cotización rechazada");
      load();
    } catch (e) { showNotif(e.message || "Error", "error"); } finally { setActionLoading(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)" }}>
          Cola de aprobaciones {quotes && <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-secondary)" }}>— {quotes.length} pendiente{quotes.length !== 1 ? "s" : ""}</span>}
        </h2>
      </div>
      <SectionCard>
        {loading ? <LoadingState /> : (quotes || []).length === 0 ? (
          <EmptyState icon="ti-check-circle" text="Sin cotizaciones pendientes de aprobación" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
                  {["Código","Producto","Ruta","Qty","Precio calculado","Precio mínimo","Responsable","Fecha","Acciones"].map((h, i) => (
                    <th key={i} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(quotes || []).map(q => (
                  <tr key={q.id} style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px" }}>
                      <button onClick={() => onNavigate("quote-detail", q.id)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "monospace", fontSize: 12, color: "#2563eb", padding: 0 }}>
                        {q.quote_number}
                      </button>
                    </td>
                    <td style={{ padding: "10px" }}>{q.product_code || q.product_name_es || "—"}</td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>{q.origin_country}→{q.destination_country}</td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>{q.quantity} {q.unit}</td>
                    <td style={{ padding: "10px", fontWeight: 600 }}>{fmtCurrency(q.price_per_unit, q.currency)}</td>
                    <td style={{ padding: "10px" }}>{fmtCurrency(q.min_authorized_price, q.currency)}</td>
                    <td style={{ padding: "10px", fontSize: 12, color: "var(--color-text-secondary)" }}>{q.submitted_by || q.created_by || "—"}</td>
                    <td style={{ padding: "10px", fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(q.updated_at || q.created_at)}</td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setModal({ type: "approve", quoteId: q.id, quoteNumber: q.quote_number })} disabled={actionLoading}
                          style={{ padding: "5px 12px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          <i className="ti ti-check" /> Aprobar
                        </button>
                        <button onClick={() => setModal({ type: "reject", quoteId: q.id, quoteNumber: q.quote_number })} disabled={actionLoading}
                          style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          <i className="ti ti-x" /> Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {modal?.type === "approve" && (
        <ConfirmModal title="Aprobar cotización" body={`¿Aprobar ${modal.quoteNumber}?`} onConfirm={doApprove} onCancel={() => setModal(null)} confirmLabel="Aprobar" confirmColor="#059669" requireReason={false} />
      )}
      {modal?.type === "reject" && (
        <ConfirmModal title="Rechazar cotización" body={`¿Rechazar ${modal.quoteNumber}?`} onConfirm={doReject} onCancel={() => setModal(null)} confirmLabel="Rechazar" confirmColor="#dc2626" requireReason={true} />
      )}
    </div>
  );
}

// ─── CLIENT view: Mis cotizaciones ────────────────────────────────────────────

function ClientQuoteList({ user, onNavigate }) {
  const [quotes, setQuotes] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCommercialQuotes({ status: "APPROVED" })
      .then(d => setQuotes(Array.isArray(d) ? d : (d?.quotes || [])))
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={{ margin: "0 0 1.5rem", fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)" }}>Mis cotizaciones aprobadas</h2>
      <SectionCard>
        {loading ? <LoadingState /> : (quotes || []).length === 0 ? (
          <EmptyState icon="ti-file-off" text="No tiene cotizaciones aprobadas en este momento." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
                  {["Código","Producto","Ruta","Cantidad","Precio unitario","Total","Vigencia","Estado","Doc.",""].map((h, i) => (
                    <th key={i} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(quotes || []).map(q => (
                  <tr key={q.id} style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px" }}><span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 12 }}>{q.quote_number}</span></td>
                    <td style={{ padding: "10px" }}>{q.product_code || q.product_name_es || "—"}</td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>{q.origin_country}→{q.destination_country}</td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>{q.quantity} {q.unit}</td>
                    <td style={{ padding: "10px", fontWeight: 600 }}>{fmtCurrency(q.price_per_unit, q.currency)}</td>
                    <td style={{ padding: "10px", fontWeight: 600 }}>{fmtCurrency(q.total_value, q.currency)}</td>
                    <td style={{ padding: "10px", fontSize: 12 }}>{fmtDate(q.valid_until)}</td>
                    <td style={{ padding: "10px" }}><QuoteStatusBadge status={q.status} /></td>
                    <td style={{ padding: "10px", fontSize: 12, fontFamily: "monospace" }}>{q.doc_id || "—"}</td>
                    <td style={{ padding: "10px" }}>
                      <button onClick={() => onNavigate("quote-detail", q.id)} style={{ padding: "5px 12px", border: "1px solid var(--color-border-tertiary)", borderRadius: 6, background: "none", cursor: "pointer", fontSize: 12 }}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Main CommercialWorkspace component ───────────────────────────────────────

export default function CommercialWorkspace({ user, setView, showNotif, initialQuoteId }) {
  const level = roleLevel(user?.role);
  const isClient = user?.role === "CLIENT" || user?.role === "SUPPLIER";
  const canCreate = level >= 40 && !isClient;
  const canApprove = level >= 70;
  const canMatrix = level >= 40;

  const [subview, setSubview] = useState(initialQuoteId ? "quote-detail" : (isClient ? "mis-cotizaciones" : "centro"));
  const [activeQuoteId, setActiveQuoteId] = useState(initialQuoteId || null);

  const navigate = (sv, id) => {
    if (id) setActiveQuoteId(id);
    setSubview(sv);
  };

  const tabs = [
    ...(isClient ? [{ id: "mis-cotizaciones", icon: "ti-file-text", label: "Mis cotizaciones" }] : [
      { id: "centro", icon: "ti-dashboard", label: "Centro Comercial" },
      { id: "quotes", icon: "ti-list", label: "Cotizaciones" },
      ...(canCreate ? [{ id: "new-quote", icon: "ti-plus", label: "Nueva cotización" }] : []),
      ...(canApprove ? [{ id: "approvals", icon: "ti-checks", label: "Aprobaciones" }] : []),
      ...(canMatrix ? [{ id: "matrix", icon: "ti-table", label: "Matriz de precios" }] : []),
    ]),
  ];

  const visibleTabs = subview === "quote-detail" ? [] : tabs;

  return (
    <div>
      {visibleTabs.length > 0 && (
        <TabBar tabs={visibleTabs} active={subview} onSelect={sv => { setActiveQuoteId(null); setSubview(sv); }} />
      )}
      {subview === "quote-detail" && (
        <CommercialQuoteDetail quoteId={activeQuoteId} user={user} onNavigate={navigate} showNotif={showNotif} />
      )}
      {subview === "centro" && !isClient && (
        <CommercialCentro user={user} onNavigate={navigate} />
      )}
      {subview === "quotes" && !isClient && (
        <CommercialQuoteList user={user} onNavigate={navigate} />
      )}
      {subview === "new-quote" && canCreate && (
        <CommercialNewQuote user={user} onNavigate={navigate} showNotif={showNotif} />
      )}
      {subview === "approvals" && canApprove && (
        <CommercialApprovals user={user} onNavigate={navigate} showNotif={showNotif} />
      )}
      {subview === "matrix" && canMatrix && (
        <CommercialMatrix user={user} showNotif={showNotif} />
      )}
      {subview === "mis-cotizaciones" && isClient && (
        <ClientQuoteList user={user} onNavigate={navigate} />
      )}
    </div>
  );
}
