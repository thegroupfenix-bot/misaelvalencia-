import { useState, useEffect, useCallback } from "react";
import { api } from "../api.js";

const RL = {
  SUPER_ADMIN: 100, CORPORATE_ADMIN: 90, CFO: 80, DIRECTOR: 75, DIRECTIVO: 75,
  COMMERCIAL_MANAGER: 72, COMMERCIAL_DIRECTOR: 70, COMPLIANCE: 65,
  ACCOUNTING: 60, TREASURY: 60, AUDIT: 55, LOGISTICS: 45, COMMERCIAL_AGENT: 42,
  AGENTE: 40, MEDIA_MANAGER: 35, CLIENT: 20, SUPPLIER: 20,
};

const css = {
  wrap: { padding: "24px", fontFamily: "inherit" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)" },
  tabs: { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" },
  tab: (active) => ({
    padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14,
    background: active ? "var(--accent)" : "var(--surface-2)",
    color: active ? "#fff" : "var(--text-secondary)",
    border: "none", transition: "all .15s",
  }),
  card: { background: "var(--surface-1)", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid var(--border)" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 },
  label: { fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, fontWeight: 600 },
  val: { fontSize: 15, color: "var(--text-primary)" },
  badge: (c) => ({
    display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
    background: c === "green" ? "#d1fae5" : c === "red" ? "#fee2e2" : c === "yellow" ? "#fef9c3" : "#e0e7ff",
    color: c === "green" ? "#065f46" : c === "red" ? "#991b1b" : c === "yellow" ? "#713f12" : "#3730a3",
  }),
  btn: (variant = "primary") => ({
    padding: "9px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14, border: "none",
    background: variant === "primary" ? "var(--accent)" : variant === "danger" ? "#ef4444" : "var(--surface-2)",
    color: variant === "primary" || variant === "danger" ? "#fff" : "var(--text-primary)",
  }),
  input: {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)",
    background: "var(--surface-2)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box",
  },
  select: {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)",
    background: "var(--surface-2)", color: "var(--text-primary)", fontSize: 14,
  },
  errBox: { background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8, marginBottom: 12 },
  sucBox: { background: "#d1fae5", color: "#065f46", padding: 12, borderRadius: 8, marginBottom: 12 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 },
  kpi: { background: "var(--surface-1)", borderRadius: 10, padding: 16, border: "1px solid var(--border)", textAlign: "center" },
  kpiNum: { fontSize: 28, fontWeight: 800, color: "var(--accent)" },
  kpiLab: { fontSize: 12, color: "var(--text-secondary)", marginTop: 4 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: "2px solid var(--border)", color: "var(--text-secondary)", fontWeight: 700, fontSize: 12 },
  td: { padding: "10px 12px", borderBottom: "1px solid var(--border)", color: "var(--text-primary)" },
};

function Field({ label, children }) {
  return (
    <div>
      <div style={css.label}>{label}</div>
      <div style={css.val}>{children ?? "—"}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { FIXED: "green", SIGNED: "green", COMPLETED: "green", CANCELLED: "red",
    INQUIRY: "yellow", PRE_FIXTURE: "yellow", EXPIRED: "red", LADEN: "blue",
    LOADING: "blue", DISCHARGING: "blue", AT_LOAD_PORT: "blue", AT_DISCHARGE_PORT: "blue",
    ACTIVE: "green", INACTIVE: "red" };
  return <span style={css.badge(map[status] || "blue")}>{status}</span>;
}

// ── Dashboard Panel ────────────────────────────────────────────────────────────

function Panel({ user }) {
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [err, setErr] = useState("");
  const lvl = RL[user?.role] || 0;

  useEffect(() => {
    if (lvl < 40) return;
    api.getCharterDashboard().then(setData).catch(() => setErr("Error cargando dashboard"));
    api.getCharterAlerts({ acknowledged: "false" }).then(setAlerts).catch(() => {});
  }, [lvl]);

  const ack = useCallback(async (id) => {
    await api.acknowledgeAlert(id);
    setAlerts(a => a.filter(x => x.id !== id));
  }, []);

  if (lvl < 40) return <div style={css.card}>Acceso denegado.</div>;
  if (err) return <div style={css.errBox}>{err}</div>;
  if (!data) return <div>Cargando...</div>;

  return (
    <div>
      <div style={css.kpiGrid}>
        {[
          { label: "Viajes Activos",      val: data.active_voyages },
          { label: "En Puerto Carga",     val: data.at_load_port },
          { label: "En Tránsito",         val: data.laden_in_transit },
          { label: "En Puerto Descarga",  val: data.at_discharge_port },
          { label: "ETA Vencida",         val: data.eta_overdue },
          { label: "Fixtures Activos",    val: data.active_fixtures },
          { label: "Alertas Abiertas",    val: data.open_alerts },
          { label: "Demurrage Acum. USD", val: data.total_demurrage_usd != null ? `$${Number(data.total_demurrage_usd).toLocaleString()}` : "—" },
        ].map(k => (
          <div key={k.label} style={css.kpi}>
            <div style={css.kpiNum}>{k.val ?? 0}</div>
            <div style={css.kpiLab}>{k.label}</div>
          </div>
        ))}
      </div>

      {data.upcoming_laycan?.length > 0 && (
        <div style={css.card}>
          <h3 style={{ marginTop: 0 }}>Próximos Laycan (14 días)</h3>
          <table style={css.table}>
            <thead><tr>
              <th style={css.th}>Fixture</th>
              <th style={css.th}>Puerto Carga</th>
              <th style={css.th}>Laycan Inicio</th>
              <th style={css.th}>Laycan Fin</th>
            </tr></thead>
            <tbody>{data.upcoming_laycan.map(f => (
              <tr key={f.fixture_number}>
                <td style={css.td}>{f.fixture_number}</td>
                <td style={css.td}>{f.loading_port}</td>
                <td style={css.td}>{f.laycan_start}</td>
                <td style={css.td}>{f.laycan_end}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {alerts.length > 0 && (
        <div style={css.card}>
          <h3 style={{ marginTop: 0 }}>Alertas Activas</h3>
          {alerts.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={css.badge(a.severity === "HIGH" ? "red" : a.severity === "MEDIUM" ? "yellow" : "blue")}>{a.severity}</span>
              <span style={{ flex: 1 }}>{a.message}</span>
              <button style={css.btn("secondary")} onClick={() => ack(a.id)}>✓ Acusar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fixtures List ─────────────────────────────────────────────────────────────

function FixturesList({ user, onSelect, onNew }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const lvl = RL[user?.role] || 0;

  const load = useCallback(() => {
    const p = {};
    if (status) p.status = status;
    api.getFixtures(p).then(setRows).catch(() => {});
  }, [status]);

  useEffect(() => { if (lvl >= 40) load(); }, [load, lvl]);

  if (lvl < 40) return <div style={css.card}>Acceso denegado.</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <select style={{ ...css.select, width: 200 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {["INQUIRY","PRE_FIXTURE","FIXED","SIGNED","COMPLETED","CANCELLED"].map(s =>
            <option key={s} value={s}>{s}</option>)}
        </select>
        <button style={css.btn()} onClick={load}>Buscar</button>
        {lvl >= 70 && <button style={css.btn("secondary")} onClick={onNew}>+ Nueva Fixture</button>}
      </div>
      <table style={css.table}>
        <thead><tr>
          <th style={css.th}>Número</th>
          <th style={css.th}>Buque</th>
          <th style={css.th}>Carga</th>
          <th style={css.th}>Puerto Carga</th>
          <th style={css.th}>Puerto Descarga</th>
          <th style={css.th}>Laycan</th>
          <th style={css.th}>Estado</th>
        </tr></thead>
        <tbody>{rows.map(f => (
          <tr key={f.id} style={{ cursor: "pointer" }} onClick={() => onSelect(f)}>
            <td style={css.td}><strong>{f.fixture_number}</strong></td>
            <td style={css.td}>{f.vessel_name || "—"}</td>
            <td style={css.td}>{f.cargo_description || "—"} {f.cargo_quantity ? `${f.cargo_quantity} ${f.cargo_unit || ""}` : ""}</td>
            <td style={css.td}>{f.loading_port || "—"}</td>
            <td style={css.td}>{f.discharge_port || "—"}</td>
            <td style={css.td}>{f.laycan_start || "—"} → {f.laycan_end || "—"}</td>
            <td style={css.td}><StatusBadge status={f.status} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── New Fixture Form ──────────────────────────────────────────────────────────

function NewFixtureForm({ user, onCreated }) {
  const [vessels, setVessels] = useState([]);
  const [parties, setParties] = useState([]);
  const [form, setForm] = useState({
    freight_type: "WORLDSCALE", laytime_type: "SHINC", despatch_on: "ALL_TIME_SAVED",
    freight_currency: "USD",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.getVessels({ status: "ACTIVE" }).then(setVessels).catch(() => {});
    api.getCharterParties().then(setParties).catch(() => {});
  }, []);

  const lvl = RL[user?.role] || 0;
  if (lvl < 70) return <div style={css.card}>Acceso denegado (nivel mínimo COMMERCIAL_DIRECTOR).</div>;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setErr("");
    try {
      const r = await api.createFixture(form);
      onCreated(r);
    } catch (e) {
      setErr(e.message || "Error creando fixture");
    } finally { setSaving(false); }
  };

  const owners   = parties.filter(p => p.type === "SHIPOWNER");
  const brokers  = parties.filter(p => p.type === "BROKER");
  const operators = parties.filter(p => p.type === "OPERATOR");

  return (
    <div style={css.card}>
      <h3 style={{ marginTop: 0 }}>Nueva Charter Fixture</h3>
      {err && <div style={css.errBox}>{err}</div>}
      <div style={css.grid2}>
        <div>
          <div style={css.label}>Buque</div>
          <select style={css.select} value={form.vessel_id || ""} onChange={e => set("vessel_id", e.target.value)}>
            <option value="">Seleccionar buque...</option>
            {vessels.map(v => <option key={v.id} value={v.id}>{v.vessel_name} ({v.imo_number})</option>)}
          </select>
        </div>
        <div>
          <div style={css.label}>Armador</div>
          <select style={css.select} value={form.shipowner_id || ""} onChange={e => set("shipowner_id", e.target.value)}>
            <option value="">Seleccionar...</option>
            {owners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <div style={css.label}>Broker</div>
          <select style={css.select} value={form.broker_id || ""} onChange={e => set("broker_id", e.target.value)}>
            <option value="">Seleccionar...</option>
            {brokers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <div style={css.label}>Operador</div>
          <select style={css.select} value={form.operator_id || ""} onChange={e => set("operator_id", e.target.value)}>
            <option value="">Seleccionar...</option>
            {operators.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <div style={css.label}>Descripción de Carga</div>
          <input style={css.input} value={form.cargo_description || ""} onChange={e => set("cargo_description", e.target.value)} placeholder="Ej. Maíz granel" />
        </div>
        <div>
          <div style={css.label}>Cantidad (MT)</div>
          <input style={css.input} type="number" value={form.cargo_quantity || ""} onChange={e => set("cargo_quantity", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Tipo de Flete</div>
          <select style={css.select} value={form.freight_type || ""} onChange={e => set("freight_type", e.target.value)}>
            {["WORLDSCALE","FLAT_RATE","LUMPSUM","COA"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <div style={css.label}>Tarifa de Flete</div>
          <input style={css.input} type="number" value={form.freight_rate || ""} onChange={e => set("freight_rate", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Puerto de Carga</div>
          <input style={css.input} value={form.loading_port || ""} onChange={e => set("loading_port", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Puerto de Descarga</div>
          <input style={css.input} value={form.discharge_port || ""} onChange={e => set("discharge_port", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Laycan Inicio</div>
          <input style={css.input} type="date" value={form.laycan_start || ""} onChange={e => set("laycan_start", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Laycan Fin / Cancelling</div>
          <input style={css.input} type="date" value={form.laycan_end || ""} onChange={e => set("laycan_end", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Tasa de Carga (MT/día)</div>
          <input style={css.input} type="number" value={form.loading_rate_mt_day || ""} onChange={e => set("loading_rate_mt_day", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Tasa de Descarga (MT/día)</div>
          <input style={css.input} type="number" value={form.discharging_rate_mt_day || ""} onChange={e => set("discharging_rate_mt_day", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Tipo de Plancha</div>
          <select style={css.select} value={form.laytime_type || ""} onChange={e => set("laytime_type", e.target.value)}>
            {["SHINC","SHEX","SHEX_EIU","FHEX","FHINC","PWWD","WWD"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <div style={css.label}>Demurrage (USD/día)</div>
          <input style={css.input} type="number" value={form.demurrage_rate_usd_day || ""} onChange={e => set("demurrage_rate_usd_day", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Despatch (USD/día)</div>
          <input style={css.input} type="number" value={form.despatch_rate_usd_day || ""} onChange={e => set("despatch_rate_usd_day", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Despatch sobre</div>
          <select style={css.select} value={form.despatch_on || ""} onChange={e => set("despatch_on", e.target.value)}>
            <option value="ALL_TIME_SAVED">ALL TIME SAVED</option>
            <option value="WORKING_TIME_SAVED">WORKING TIME SAVED</option>
          </select>
        </div>
        <div>
          <div style={css.label}>Comisión (%)</div>
          <input style={css.input} type="number" value={form.commission_pct || ""} onChange={e => set("commission_pct", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Address Commission (%)</div>
          <input style={css.input} type="number" value={form.address_commission_pct || ""} onChange={e => set("address_commission_pct", e.target.value)} />
        </div>
      </div>
      <div>
        <div style={css.label}>Recap / Nota de Fletamento</div>
        <textarea style={{ ...css.input, height: 90 }} value={form.recap_text || ""} onChange={e => set("recap_text", e.target.value)} />
      </div>
      <div style={{ marginTop: 16 }}>
        <button style={css.btn()} onClick={submit} disabled={saving}>
          {saving ? "Guardando..." : "Crear Fixture"}
        </button>
      </div>
    </div>
  );
}

// ── Fixture Detail ─────────────────────────────────────────────────────────────

function FixtureDetail({ user, fixture, onBack }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("resumen");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [suc, setSuc] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [recapText, setRecapText] = useState("");
  const lvl = RL[user?.role] || 0;
  const isCFO = lvl >= 60;

  const load = useCallback(() => {
    api.getFixture(fixture.id).then(setData).catch(() => {});
  }, [fixture.id]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div>Cargando...</div>;

  const saveStatus = async () => {
    if (!newStatus) return;
    setSaving(true); setErr(""); setSuc("");
    try {
      await api.updateFixture(data.id, { status: newStatus });
      setSuc("Estado actualizado"); setNewStatus(""); load();
    } catch(e) { setErr(e.message || "Error"); } finally { setSaving(false); }
  };

  const saveVersion = async () => {
    if (!recapText && !versionNote) return;
    setSaving(true); setErr(""); setSuc("");
    try {
      await api.saveFixtureVersion(data.id, { recap_text: recapText, change_note: versionNote });
      setSuc("Versión guardada"); setRecapText(""); setVersionNote(""); load();
    } catch(e) { setErr(e.message || "Error"); } finally { setSaving(false); }
  };

  return (
    <div>
      <button style={{ ...css.btn("secondary"), marginBottom: 16 }} onClick={onBack}>← Volver</button>
      <div style={{ ...css.card, marginBottom: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{data.fixture_number}</span>
            <span style={{ marginLeft: 12 }}><StatusBadge status={data.status} /></span>
          </div>
        </div>
        <div style={css.tabs}>
          {["resumen","laytime","cp-versiones", ...(isCFO ? ["financieros"] : [])].map(t => (
            <button key={t} style={css.tab(tab === t)} onClick={() => setTab(t)}>
              {t === "resumen" ? "Resumen" : t === "laytime" ? "Plancha/Laytime" : t === "cp-versiones" ? "CP Versiones" : "Financieros"}
            </button>
          ))}
        </div>
        {err && <div style={css.errBox}>{err}</div>}
        {suc && <div style={css.sucBox}>{suc}</div>}

        {tab === "resumen" && (
          <div>
            <div style={css.grid3}>
              <Field label="Buque">{data.vessel_name} <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>IMO: {data.imo_number}</span></Field>
              <Field label="Puerto Carga">{data.loading_port}</Field>
              <Field label="Puerto Descarga">{data.discharge_port}</Field>
              <Field label="Carga">{data.cargo_description} — {data.cargo_quantity} {data.cargo_unit}</Field>
              <Field label="Tipo Flete">{data.freight_type}</Field>
              <Field label="Tarifa">{data.freight_rate} {data.freight_currency}</Field>
              <Field label="Laycan">{data.laycan_start} → {data.laycan_end}</Field>
              <Field label="Plancha">{data.laytime_type}</Field>
              <Field label="Tasa Carga">{data.loading_rate_mt_day} MT/día</Field>
              <Field label="Tasa Descarga">{data.discharging_rate_mt_day} MT/día</Field>
              <Field label="Demurrage">${data.demurrage_rate_usd_day}/día</Field>
              <Field label="Despatch">${data.despatch_rate_usd_day}/día ({data.despatch_on})</Field>
              <Field label="Comisión">{data.commission_pct}%</Field>
              <Field label="Addr. Commission">{data.address_commission_pct}%</Field>
              {isCFO && <Field label="Costo Viaje">${Number(data.voyage_cost_usd || 0).toLocaleString()}</Field>}
              {isCFO && <Field label="Margen Esperado">${Number(data.expected_margin_usd || 0).toLocaleString()}</Field>}
              {isCFO && <Field label="Margen Real">${Number(data.actual_margin_usd || 0).toLocaleString()}</Field>}
            </div>
            {data.recap_text && (
              <div style={{ marginTop: 12 }}>
                <div style={css.label}>Recap</div>
                <pre style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, fontSize: 13, whiteSpace: "pre-wrap", margin: 0 }}>
                  {data.recap_text}
                </pre>
              </div>
            )}
            {lvl >= 60 && (
              <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
                <select style={{ ...css.select, width: 200 }} value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  <option value="">Cambiar estado...</option>
                  {["INQUIRY","PRE_FIXTURE","FIXED","SIGNED","COMPLETED","CANCELLED"].map(s =>
                    <option key={s} value={s}>{s}</option>)}
                </select>
                <button style={css.btn()} onClick={saveStatus} disabled={saving || !newStatus}>Actualizar</button>
              </div>
            )}
          </div>
        )}

        {tab === "laytime" && (
          <LaytimePanel user={user} fixtureId={data.id} />
        )}

        {tab === "cp-versiones" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={css.label}>Nuevo Recap / Versión CP</div>
              <textarea style={{ ...css.input, height: 80, marginBottom: 8 }} placeholder="Texto del recap actualizado..."
                value={recapText} onChange={e => setRecapText(e.target.value)} />
              <input style={{ ...css.input, marginBottom: 8 }} placeholder="Nota de cambio..." value={versionNote} onChange={e => setVersionNote(e.target.value)} />
              <button style={css.btn()} onClick={saveVersion} disabled={saving}>Guardar Versión</button>
            </div>
            <table style={css.table}>
              <thead><tr>
                <th style={css.th}>Versión</th>
                <th style={css.th}>Guardado por</th>
                <th style={css.th}>Nota</th>
                <th style={css.th}>Fecha</th>
              </tr></thead>
              <tbody>{(data.versions || []).map(v => (
                <tr key={v.id}>
                  <td style={css.td}>v{v.version}</td>
                  <td style={css.td}>{v.changed_by}</td>
                  <td style={css.td}>{v.change_note || "—"}</td>
                  <td style={css.td}>{v.created_at}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === "financieros" && isCFO && (
          <FinancialsPanel user={user} fixtureId={data.id} />
        )}
      </div>
    </div>
  );
}

// ── Laytime Panel ─────────────────────────────────────────────────────────────

function LaytimePanel({ user, fixtureId }) {
  const [voyages, setVoyages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [calcs, setCalcs] = useState([]);
  const [events, setEvents] = useState([]);
  const [calculating, setCalculating] = useState(false);
  const [suc, setSuc] = useState("");

  useEffect(() => {
    api.getVesselVoyages({ fixture_id: fixtureId }).then(setVoyages).catch(() => {});
  }, [fixtureId]);

  const selectVoyage = useCallback(async (voy) => {
    setSelected(voy);
    const [c, e] = await Promise.all([
      api.getVesselVoyage(voy.id).then(d => d.laytime_calculations || []).catch(() => []),
      api.getLaytimeEvents(voy.id).catch(() => []),
    ]);
    setCalcs(c); setEvents(e);
  }, []);

  const calculate = useCallback(async () => {
    if (!selected) return;
    setCalculating(true); setSuc("");
    const res = await api.calculateLaytime(selected.id).catch(() => []);
    setCalcs(res);
    setSuc("Cálculo completado");
    setCalculating(false);
  }, [selected]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={css.label}>Seleccionar Viaje</div>
        <select style={{ ...css.select, width: 300 }} onChange={e => {
          const v = voyages.find(x => String(x.id) === e.target.value);
          if (v) selectVoyage(v);
        }}>
          <option value="">— Seleccionar —</option>
          {voyages.map(v => <option key={v.id} value={v.id}>{v.vessel_name} — {v.pol_port} → {v.pod_port} ({v.status})</option>)}
        </select>
      </div>

      {selected && (
        <div>
          {suc && <div style={css.sucBox}>{suc}</div>}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
            <button style={css.btn()} onClick={calculate} disabled={calculating}>
              {calculating ? "Calculando..." : "Calcular Laytime"}
            </button>
          </div>

          {calcs.length > 0 && (
            <table style={css.table}>
              <thead><tr>
                <th style={css.th}>Puerto</th>
                <th style={css.th}>Plancha Permitida (h)</th>
                <th style={css.th}>Horas Usadas</th>
                <th style={css.th}>Excluidas</th>
                <th style={css.th}>Netas</th>
                <th style={css.th}>Balance</th>
                <th style={css.th}>Demurrage USD</th>
                <th style={css.th}>Despatch USD</th>
              </tr></thead>
              <tbody>{calcs.map(c => (
                <tr key={c.port_type}>
                  <td style={css.td}>{c.port_type}</td>
                  <td style={css.td}>{c.allowed_hours?.toFixed(2)}</td>
                  <td style={css.td}>{c.used_hours?.toFixed(2)}</td>
                  <td style={css.td}>{c.excluded_hours?.toFixed(2)}</td>
                  <td style={css.td}>{c.net_hours?.toFixed(2)}</td>
                  <td style={css.td}>
                    <span style={css.badge(c.balance_hours < 0 ? "red" : "green")}>
                      {c.balance_hours?.toFixed(2)}
                    </span>
                  </td>
                  <td style={css.td}>{c.demurrage_amount > 0 ? `$${c.demurrage_amount?.toFixed(2)}` : "—"}</td>
                  <td style={css.td}>{c.despatch_amount > 0 ? `$${c.despatch_amount?.toFixed(2)}` : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          )}

          {events.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={css.label}>Eventos de Plancha</div>
              <table style={css.table}>
                <thead><tr>
                  <th style={css.th}>Puerto</th>
                  <th style={css.th}>Evento</th>
                  <th style={css.th}>Hora</th>
                  <th style={css.th}>Duración (h)</th>
                  <th style={css.th}>Excluido</th>
                  <th style={css.th}>Razón</th>
                </tr></thead>
                <tbody>{events.map(e => (
                  <tr key={e.id}>
                    <td style={css.td}>{e.port_type}</td>
                    <td style={css.td}>{e.event_type}</td>
                    <td style={css.td}>{e.event_time}</td>
                    <td style={css.td}>{e.duration_hours ?? "—"}</td>
                    <td style={css.td}>{e.is_excluded ? "Sí" : "No"}</td>
                    <td style={css.td}>{e.exclusion_reason || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Financials Panel (CFO+) ───────────────────────────────────────────────────

function FinancialsPanel({ user, fixtureId }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ direction: "EXPENSE", currency: "USD", status: "PENDING" });
  const [saving, setSaving] = useState(false);
  const lvl = RL[user?.role] || 0;
  if (lvl < 60) return null;

  const load = useCallback(() => {
    api.getFixtureFinancials(fixtureId).then(setRows).catch(() => {});
  }, [fixtureId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setSaving(true);
    try { await api.addFixtureFinancial(fixtureId, form); load(); setForm({ direction: "EXPENSE", currency: "USD", status: "PENDING" }); }
    catch(e) { console.error(e); } finally { setSaving(false); }
  };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div style={css.grid3}>
        <div>
          <div style={css.label}>Tipo</div>
          <input style={css.input} value={form.item_type || ""} onChange={e => set("item_type", e.target.value)} placeholder="FREIGHT, DEMURRAGE..." />
        </div>
        <div>
          <div style={css.label}>Descripción</div>
          <input style={css.input} value={form.description || ""} onChange={e => set("description", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Monto</div>
          <input style={css.input} type="number" value={form.amount || ""} onChange={e => set("amount", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Dirección</div>
          <select style={css.select} value={form.direction} onChange={e => set("direction", e.target.value)}>
            <option value="INCOME">INCOME</option>
            <option value="EXPENSE">EXPENSE</option>
          </select>
        </div>
        <div>
          <div style={css.label}>Moneda</div>
          <select style={css.select} value={form.currency} onChange={e => set("currency", e.target.value)}>
            {["USD","EUR","GBP"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div style={css.label}>Fecha Vencimiento</div>
          <input style={css.input} type="date" value={form.due_date || ""} onChange={e => set("due_date", e.target.value)} />
        </div>
      </div>
      <button style={{ ...css.btn(), marginBottom: 16 }} onClick={submit} disabled={saving}>
        {saving ? "Guardando..." : "+ Agregar Financiero"}
      </button>
      <table style={css.table}>
        <thead><tr>
          <th style={css.th}>Tipo</th>
          <th style={css.th}>Descripción</th>
          <th style={css.th}>Monto</th>
          <th style={css.th}>Dirección</th>
          <th style={css.th}>Estado</th>
        </tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.id}>
            <td style={css.td}>{r.item_type}</td>
            <td style={css.td}>{r.description || "—"}</td>
            <td style={css.td}>{r.currency} {Number(r.amount || 0).toLocaleString()}</td>
            <td style={css.td}><span style={css.badge(r.direction === "INCOME" ? "green" : "red")}>{r.direction}</span></td>
            <td style={css.td}><StatusBadge status={r.status} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── Vessels List ──────────────────────────────────────────────────────────────

function VesselsList({ user, onSelect, onNew }) {
  const [rows, setRows] = useState([]);
  const lvl = RL[user?.role] || 0;

  useEffect(() => {
    api.getVessels().then(setRows).catch(() => {});
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", gap: 12 }}>
        {lvl >= 45 && <button style={css.btn()} onClick={onNew}>+ Nuevo Buque</button>}
      </div>
      <table style={css.table}>
        <thead><tr>
          <th style={css.th}>Nombre</th>
          <th style={css.th}>IMO</th>
          <th style={css.th}>Tipo</th>
          <th style={css.th}>Bandera</th>
          <th style={css.th}>DWT</th>
          <th style={css.th}>Clasificadora</th>
          <th style={css.th}>Estado</th>
        </tr></thead>
        <tbody>{rows.map(v => (
          <tr key={v.id} style={{ cursor: "pointer" }} onClick={() => onSelect(v)}>
            <td style={css.td}><strong>{v.vessel_name}</strong></td>
            <td style={css.td}>{v.imo_number}</td>
            <td style={css.td}>{v.vessel_type}</td>
            <td style={css.td}>{v.flag || "—"}</td>
            <td style={css.td}>{v.dwt ? Number(v.dwt).toLocaleString() : "—"}</td>
            <td style={css.td}>{v.classification_society || "—"}</td>
            <td style={css.td}><StatusBadge status={v.status} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── New Vessel Form ───────────────────────────────────────────────────────────

function NewVesselForm({ user, onCreated }) {
  const [form, setForm] = useState({ vessel_type: "BULK_CARRIER", status: "ACTIVE" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const lvl = RL[user?.role] || 0;
  if (lvl < 45) return <div style={css.card}>Acceso denegado.</div>;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setErr("");
    try {
      const r = await api.createVessel(form);
      onCreated(r);
    } catch(e) { setErr(e.message || "Error creando buque"); } finally { setSaving(false); }
  };

  return (
    <div style={css.card}>
      <h3 style={{ marginTop: 0 }}>Nuevo Buque</h3>
      {err && <div style={css.errBox}>{err}</div>}
      <div style={css.grid2}>
        <div>
          <div style={css.label}>Número IMO *</div>
          <input style={css.input} value={form.imo_number || ""} onChange={e => set("imo_number", e.target.value)} placeholder="IMO1234567" />
        </div>
        <div>
          <div style={css.label}>Nombre del Buque *</div>
          <input style={css.input} value={form.vessel_name || ""} onChange={e => set("vessel_name", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Tipo de Buque *</div>
          <select style={css.select} value={form.vessel_type} onChange={e => set("vessel_type", e.target.value)}>
            {["BULK_CARRIER","TANKER","CONTAINER","GENERAL_CARGO","REEFER","LNG","LPG","RORO","OFFSHORE","OTHER"].map(t =>
              <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
          </select>
        </div>
        <div>
          <div style={css.label}>Bandera</div>
          <input style={css.input} value={form.flag || ""} onChange={e => set("flag", e.target.value)} placeholder="PA, LR, BS..." />
        </div>
        <div>
          <div style={css.label}>Año de Construcción</div>
          <input style={css.input} type="number" value={form.year_built || ""} onChange={e => set("year_built", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>DWT</div>
          <input style={css.input} type="number" value={form.dwt || ""} onChange={e => set("dwt", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>GRT</div>
          <input style={css.input} type="number" value={form.grt || ""} onChange={e => set("grt", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Clasificadora</div>
          <input style={css.input} value={form.classification_society || ""} onChange={e => set("classification_society", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Vencimiento Clase</div>
          <input style={css.input} type="date" value={form.class_expiry || ""} onChange={e => set("class_expiry", e.target.value)} />
        </div>
        <div>
          <div style={css.label}>Club P&I</div>
          <input style={css.input} value={form.p_and_i_club || ""} onChange={e => set("p_and_i_club", e.target.value)} />
        </div>
      </div>
      <button style={css.btn()} onClick={submit} disabled={saving}>{saving ? "Guardando..." : "Crear Buque"}</button>
    </div>
  );
}

// ── Vessel Detail ─────────────────────────────────────────────────────────────

function VesselDetail({ vessel, onBack }) {
  return (
    <div>
      <button style={{ ...css.btn("secondary"), marginBottom: 16 }} onClick={onBack}>← Volver</button>
      <div style={css.card}>
        <h2 style={{ marginTop: 0 }}>{vessel.vessel_name}</h2>
        <div style={css.grid3}>
          <Field label="IMO">{vessel.imo_number}</Field>
          <Field label="Tipo">{vessel.vessel_type}</Field>
          <Field label="Bandera">{vessel.flag}</Field>
          <Field label="Año">{vessel.year_built}</Field>
          <Field label="DWT">{vessel.dwt ? Number(vessel.dwt).toLocaleString() : "—"}</Field>
          <Field label="GRT">{vessel.grt ? Number(vessel.grt).toLocaleString() : "—"}</Field>
          <Field label="Clasificadora">{vessel.classification_society}</Field>
          <Field label="Venc. Clase">{vessel.class_expiry}</Field>
          <Field label="Club P&I">{vessel.p_and_i_club}</Field>
          <Field label="P&I Venc.">{vessel.p_and_i_expiry}</Field>
          <Field label="Estado"><StatusBadge status={vessel.status} /></Field>
        </div>
      </div>
    </div>
  );
}

// ── Charter Parties ───────────────────────────────────────────────────────────

function PartiesList({ user }) {
  const [rows, setRows] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [form, setForm] = useState({ type: "SHIPOWNER" });
  const [saving, setSaving] = useState(false);
  const lvl = RL[user?.role] || 0;

  const load = useCallback(() => {
    const p = typeFilter ? { type: typeFilter } : {};
    api.getCharterParties(p).then(setRows).catch(() => {});
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async () => {
    setSaving(true);
    try { await api.createCharterParty(form); load(); setForm({ type: "SHIPOWNER" }); }
    catch(e) { console.error(e); } finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <select style={{ ...css.select, width: 200 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Todos los tipos</option>
          {["SHIPOWNER","OPERATOR","BROKER","P_AND_I","INSPECTOR","OTHER"].map(t =>
            <option key={t} value={t}>{t}</option>)}
        </select>
        <button style={css.btn("secondary")} onClick={load}>Filtrar</button>
      </div>

      {lvl >= 45 && (
        <div style={{ ...css.card, marginBottom: 16 }}>
          <h4 style={{ marginTop: 0 }}>Nueva Contraparte</h4>
          <div style={css.grid3}>
            <div>
              <div style={css.label}>Nombre</div>
              <input style={css.input} value={form.name || ""} onChange={e => set("name", e.target.value)} />
            </div>
            <div>
              <div style={css.label}>Tipo</div>
              <select style={css.select} value={form.type} onChange={e => set("type", e.target.value)}>
                {["SHIPOWNER","OPERATOR","BROKER","P_AND_I","INSPECTOR","OTHER"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={css.label}>País</div>
              <input style={css.input} value={form.country || ""} onChange={e => set("country", e.target.value)} />
            </div>
            <div>
              <div style={css.label}>Email</div>
              <input style={css.input} value={form.contact_email || ""} onChange={e => set("contact_email", e.target.value)} />
            </div>
          </div>
          <button style={css.btn()} onClick={submit} disabled={saving}>{saving ? "Guardando..." : "Crear"}</button>
        </div>
      )}

      <table style={css.table}>
        <thead><tr>
          <th style={css.th}>Nombre</th>
          <th style={css.th}>Tipo</th>
          <th style={css.th}>País</th>
          <th style={css.th}>Email</th>
          <th style={css.th}>Estado</th>
        </tr></thead>
        <tbody>{rows.map(p => (
          <tr key={p.id}>
            <td style={css.td}><strong>{p.name}</strong></td>
            <td style={css.td}>{p.type}</td>
            <td style={css.td}>{p.country || "—"}</td>
            <td style={css.td}>{p.contact_email || "—"}</td>
            <td style={css.td}><StatusBadge status={p.status} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── Voyages List ──────────────────────────────────────────────────────────────

function VoyagesList({ user, onSelect }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const lvl = RL[user?.role] || 0;

  const load = useCallback(() => {
    const p = {};
    if (status) p.status = status;
    api.getVesselVoyages(p).then(setRows).catch(() => {});
  }, [status]);

  useEffect(() => { if (lvl >= 40) load(); }, [load, lvl]);

  if (lvl < 40) return <div style={css.card}>Acceso denegado.</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <select style={{ ...css.select, width: 200 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {["PENDING","AT_LOAD_PORT","LOADING","LADEN","AT_DISCHARGE_PORT","DISCHARGING","COMPLETED","CANCELLED"].map(s =>
            <option key={s} value={s}>{s}</option>)}
        </select>
        <button style={css.btn()} onClick={load}>Buscar</button>
      </div>
      <table style={css.table}>
        <thead><tr>
          <th style={css.th}>Buque</th>
          <th style={css.th}>Fixture</th>
          <th style={css.th}>Puerto Carga</th>
          <th style={css.th}>Puerto Descarga</th>
          <th style={css.th}>ETD</th>
          <th style={css.th}>ETA</th>
          <th style={css.th}>Estado</th>
        </tr></thead>
        <tbody>{rows.map(v => (
          <tr key={v.id} style={{ cursor: "pointer" }} onClick={() => onSelect(v)}>
            <td style={css.td}><strong>{v.vessel_name}</strong></td>
            <td style={css.td}>{v.fixture_number}</td>
            <td style={css.td}>{v.pol_port || v.loading_port || "—"}</td>
            <td style={css.td}>{v.pod_port || v.discharge_port || "—"}</td>
            <td style={css.td}>{v.pol_etd || "—"}</td>
            <td style={css.td}>{v.pod_eta || "—"}</td>
            <td style={css.td}><StatusBadge status={v.status} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── Voyage Detail ──────────────────────────────────────────────────────────────

function VoyageDetail({ voyage, onBack }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getVesselVoyage(voyage.id).then(setData).catch(() => {});
  }, [voyage.id]);

  if (!data) return <div>Cargando...</div>;

  const events = [
    { k: "nor_tendered_at",           l: "NOR Presentado" },
    { k: "nor_accepted_at",           l: "NOR Aceptado" },
    { k: "berthed_at",                l: "Atraque (Carga)" },
    { k: "commenced_loading_at",      l: "Inicio Carga" },
    { k: "completed_loading_at",      l: "Fin Carga" },
    { k: "sailed_at",                 l: "Zarpe" },
    { k: "nor_discharge_tendered_at", l: "NOR Descarga" },
    { k: "berthed_discharge_at",      l: "Atraque (Descarga)" },
    { k: "commenced_discharge_at",    l: "Inicio Descarga" },
    { k: "completed_discharge_at",    l: "Fin Descarga" },
  ];

  return (
    <div>
      <button style={{ ...css.btn("secondary"), marginBottom: 16 }} onClick={onBack}>← Volver</button>
      <div style={css.card}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{data.vessel_name} — {data.fixture_number}</h2>
          <StatusBadge status={data.status} />
        </div>
        <div style={css.grid2}>
          <Field label="Puerto Carga">{data.pol_port}</Field>
          <Field label="Puerto Descarga">{data.pod_port}</Field>
          <Field label="ETD">{data.pol_etd}</Field>
          <Field label="ETA">{data.pod_eta}</Field>
          <Field label="Capitán">{data.master_name}</Field>
          <Field label="BL Cantidad">{data.bl_quantity}</Field>
        </div>
        <h4>Cronología</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 20px" }}>
          {events.map(ev => (
            <div key={ev.k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{ev.l}</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{data[ev.k] || "—"}</span>
            </div>
          ))}
        </div>

        {data.laytime_calculations?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4>Laytime / Plancha</h4>
            {data.laytime_calculations.map(c => (
              <div key={c.port_type} style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <strong>{c.port_type}:</strong>
                <span>Permitido: {c.allowed_hours?.toFixed(1)}h</span>
                <span>Neto: {c.net_hours?.toFixed(1)}h</span>
                <span style={css.badge(c.balance_hours < 0 ? "red" : "green")}>
                  Balance: {c.balance_hours?.toFixed(1)}h
                </span>
                {c.demurrage_amount > 0 && <span style={css.badge("red")}>Demurrage: ${c.demurrage_amount?.toFixed(2)}</span>}
                {c.despatch_amount > 0 && <span style={css.badge("green")}>Despatch: ${c.despatch_amount?.toFixed(2)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function VesselCharter({ user }) {
  const [subview, setSubview] = useState("panel");
  const [selectedFixture, setSelectedFixture] = useState(null);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [selectedVoyage, setSelectedVoyage] = useState(null);
  const lvl = RL[user?.role] || 0;

  const TABS = [
    { id: "panel",    label: "Panel",    minLvl: 40 },
    { id: "fixtures", label: "Fixtures", minLvl: 40 },
    { id: "vessels",  label: "Buques",   minLvl: 20 },
    { id: "voyages",  label: "Viajes",   minLvl: 40 },
    { id: "parties",  label: "Contrapartes", minLvl: 40 },
  ];

  const go = (view) => { setSubview(view); setSelectedFixture(null); setSelectedVessel(null); setSelectedVoyage(null); };

  return (
    <div style={css.wrap}>
      <div style={css.header}>
        <i className="ti ti-anchor" style={{ fontSize: 28, color: "var(--accent)" }} />
        <span style={css.title}>Buques & Chartering</span>
      </div>

      <div style={css.tabs}>
        {TABS.filter(t => lvl >= t.minLvl).map(t => (
          <button key={t.id} style={css.tab(subview === t.id || subview.startsWith(t.id + "-"))} onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      {subview === "panel" && <Panel user={user} />}

      {/* Fixtures */}
      {subview === "fixtures" && (
        <FixturesList user={user}
          onSelect={f => { setSelectedFixture(f); setSubview("fixture-detail"); }}
          onNew={() => setSubview("new-fixture")} />
      )}
      {subview === "new-fixture" && (
        <NewFixtureForm user={user} onCreated={() => go("fixtures")} />
      )}
      {subview === "fixture-detail" && selectedFixture && (
        <FixtureDetail user={user} fixture={selectedFixture} onBack={() => go("fixtures")} />
      )}

      {/* Vessels */}
      {subview === "vessels" && (
        <VesselsList user={user}
          onSelect={v => { setSelectedVessel(v); setSubview("vessel-detail"); }}
          onNew={() => setSubview("new-vessel")} />
      )}
      {subview === "new-vessel" && (
        <NewVesselForm user={user} onCreated={() => go("vessels")} />
      )}
      {subview === "vessel-detail" && selectedVessel && (
        <VesselDetail vessel={selectedVessel} onBack={() => go("vessels")} />
      )}

      {/* Voyages */}
      {subview === "voyages" && (
        <VoyagesList user={user}
          onSelect={v => { setSelectedVoyage(v); setSubview("voyage-detail"); }} />
      )}
      {subview === "voyage-detail" && selectedVoyage && (
        <VoyageDetail voyage={selectedVoyage} onBack={() => go("voyages")} />
      )}

      {/* Parties */}
      {subview === "parties" && <PartiesList user={user} />}
    </div>
  );
}
