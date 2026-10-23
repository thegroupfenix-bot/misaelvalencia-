import { useState, useEffect, useCallback } from "react";
import { api } from "../api.js";

// ── Role level map ────────────────────────────────────────────────────────────
const RL = {
  SUPER_ADMIN:100, CORPORATE_ADMIN:90, CFO:80, DIRECTOR:75, DIRECTIVO:75,
  COMMERCIAL_MANAGER:72, COMMERCIAL_DIRECTOR:70, COMPLIANCE:65, ACCOUNTING:60,
  TREASURY:60, AUDIT:55, TAX_REVIEWER:50, COUNTRY_ACCOUNTANT:50, LOGISTICS:45,
  COMMERCIAL_AGENT:42, AGENTE:40, MEDIA_MANAGER:35, CLIENT:20, SUPPLIER:20,
};
const rl = (role) => RL[role] || 0;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  PREPARACION:    { color:"#6b7280", label:"Preparación" },
  DOCUMENTOS:     { color:"#7c3aed", label:"Documentos" },
  BOOKING:        { color:"#2563eb", label:"Booking" },
  CARGA:          { color:"#0891b2", label:"Carga" },
  EN_TRANSITO:    { color:"#059669", label:"En Tránsito" },
  ARRIBO:         { color:"#d97706", label:"Arribo" },
  NACIONALIZACION:{ color:"#f59e0b", label:"Nacionalización" },
  ENTREGA:        { color:"#10b981", label:"Entrega" },
  CERRADA:        { color:"#374151", label:"Cerrada" },
  CANCELADA:      { color:"#dc2626", label:"Cancelada" },
};

const INCOTERMS = ["EXW","FCA","CPT","CIP","DAP","DPU","DDP","FAS","FOB","CFR","CIF"];
const UNITS     = ["kg","TM","litros","unidades","sacos"];
const STATUS_LIST = Object.keys(STATUS_CFG);

// ── Shared styles ─────────────────────────────────────────────────────────────
const s = {
  page:       { padding:"24px", fontFamily:"var(--font-sans)", color:"var(--color-text-primary)", minHeight:"100vh" },
  header:     { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px" },
  title:      { fontSize:"22px", fontWeight:700, color:"#1B2A4A", margin:0 },
  tabs:       { display:"flex", gap:"4px", borderBottom:"2px solid var(--color-border-tertiary)", marginBottom:"20px" },
  tab:        (active) => ({
    padding:"8px 16px", border:"none", background:"none", cursor:"pointer",
    fontFamily:"var(--font-sans)", fontSize:"14px", fontWeight: active?700:400,
    color: active?"#1B2A4A":"var(--color-text-secondary)",
    borderBottom: active?"2px solid #1B2A4A":"2px solid transparent",
    marginBottom:"-2px",
  }),
  btn:        (color="#1B2A4A") => ({
    display:"inline-flex", alignItems:"center", gap:"6px", padding:"8px 16px",
    background:color, color:"#fff", border:"none", borderRadius:"6px",
    cursor:"pointer", fontFamily:"var(--font-sans)", fontSize:"13px", fontWeight:600,
  }),
  btnSm:      (color="#1B2A4A") => ({
    padding:"4px 10px", background:color, color:"#fff", border:"none",
    borderRadius:"4px", cursor:"pointer", fontFamily:"var(--font-sans)", fontSize:"12px",
  }),
  btnOutline: { padding:"8px 16px", background:"transparent", border:"1px solid var(--color-border-secondary)", borderRadius:"6px", cursor:"pointer", fontFamily:"var(--font-sans)", fontSize:"13px" },
  card:       { background:"var(--color-background-secondary)", border:"1px solid var(--color-border-tertiary)", borderRadius:"10px", padding:"16px", marginBottom:"12px" },
  kpiGrid:    { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:"12px", marginBottom:"20px" },
  kpiCard:    (accent="#1B2A4A") => ({
    background:"var(--color-background-secondary)", border:`1px solid ${accent}22`,
    borderRadius:"10px", padding:"16px", textAlign:"center",
  }),
  kpiNum:     (accent="#1B2A4A") => ({ fontSize:"28px", fontWeight:800, color:accent }),
  kpiLabel:   { fontSize:"11px", color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginTop:"4px" },
  table:      { width:"100%", borderCollapse:"collapse", fontSize:"13px" },
  th:         { textAlign:"left", padding:"8px 10px", borderBottom:"2px solid var(--color-border-tertiary)", color:"var(--color-text-secondary)", fontWeight:600, fontSize:"11px", textTransform:"uppercase" },
  td:         { padding:"8px 10px", borderBottom:"1px solid var(--color-border-tertiary)", verticalAlign:"middle" },
  badge:      (color) => ({ display:"inline-block", padding:"2px 8px", borderRadius:"9999px", background:color+"22", color:color, fontSize:"11px", fontWeight:600 }),
  input:      { padding:"8px 12px", border:"1px solid var(--color-border-secondary)", borderRadius:"6px", width:"100%", fontFamily:"var(--font-sans)", fontSize:"13px", boxSizing:"border-box", background:"var(--color-background-primary)", color:"var(--color-text-primary)" },
  select:     { padding:"8px 12px", border:"1px solid var(--color-border-secondary)", borderRadius:"6px", width:"100%", fontFamily:"var(--font-sans)", fontSize:"13px", background:"var(--color-background-primary)", color:"var(--color-text-primary)" },
  label:      { display:"block", fontSize:"12px", fontWeight:600, color:"var(--color-text-secondary)", marginBottom:"4px" },
  grid2:      { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" },
  grid3:      { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" },
  empty:      { textAlign:"center", padding:"60px 20px", color:"var(--color-text-secondary)" },
  emptyIcon:  { fontSize:"40px", marginBottom:"12px" },
  back:       { display:"inline-flex", alignItems:"center", gap:"6px", background:"none", border:"none", cursor:"pointer", color:"var(--color-text-secondary)", fontFamily:"var(--font-sans)", fontSize:"13px", marginBottom:"12px" },
  modal:      { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 },
  modalBox:   { background:"var(--color-background-primary)", borderRadius:"12px", padding:"24px", width:"440px", maxWidth:"90vw" },
  section:    { marginBottom:"20px" },
  sectionTitle:{ fontSize:"13px", fontWeight:700, color:"#1B2A4A", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"10px" },
  detailGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" },
  detailItem: { padding:"8px 0", borderBottom:"1px solid var(--color-border-tertiary)" },
  detailKey:  { fontSize:"11px", color:"var(--color-text-secondary)", textTransform:"uppercase" },
  detailVal:  { fontSize:"13px", fontWeight:500, marginTop:"2px" },
  filterBar:  { display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap" },
  filterInput:{ padding:"7px 12px", border:"1px solid var(--color-border-secondary)", borderRadius:"6px", fontFamily:"var(--font-sans)", fontSize:"13px", background:"var(--color-background-primary)", color:"var(--color-text-primary)", minWidth:"160px" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { color:"#6b7280", label:status };
  return <span style={s.badge(cfg.color)}>{cfg.label}</span>;
}

function EmptyState({ icon, text }) {
  return (
    <div style={s.empty}>
      <div style={s.emptyIcon}><i className={`ti ti-${icon}`}></i></div>
      <div>{text}</div>
    </div>
  );
}

function Loading() {
  return <div style={s.empty}><i className="ti ti-loader" style={{ animation:"spin 1s linear infinite" }}></i> Cargando...</div>;
}

function ConfirmModal({ title, body, onConfirm, onCancel, confirmLabel, confirmColor="#dc2626", requireReason }) {
  const [reason, setReason] = useState("");
  return (
    <div style={s.modal} onClick={onCancel}>
      <div style={s.modalBox} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin:"0 0 12px", color:"#1B2A4A" }}>{title}</h3>
        {body && <p style={{ margin:"0 0 12px", color:"var(--color-text-secondary)", fontSize:"13px" }}>{body}</p>}
        {requireReason && (
          <div style={{ marginBottom:"12px" }}>
            <label style={s.label}>Motivo *</label>
            <textarea value={reason} onChange={e=>setReason(e.target.value)}
              style={{ ...s.input, height:"80px", resize:"vertical" }}
              placeholder="Describe el motivo..."/>
          </div>
        )}
        <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
          <button style={s.btnOutline} onClick={onCancel}>Cancelar</button>
          <button style={s.btn(confirmColor)}
            onClick={() => { if (requireReason && !reason.trim()) return alert("El motivo es obligatorio"); onConfirm(reason); }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Panel Operativo ───────────────────────────────────────────────────────────

function PanelOperativo({ user, setSubview }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLogisticsDashboard().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data) return <EmptyState icon="alert-circle" text="Error al cargar el panel" />;

  return (
    <div>
      <div style={s.kpiGrid}>
        <div style={s.kpiCard("#1B2A4A")}>
          <div style={s.kpiNum("#1B2A4A")}>{data.active_operations}</div>
          <div style={s.kpiLabel}>Operaciones activas</div>
        </div>
        <div style={s.kpiCard("#dc2626")}>
          <div style={s.kpiNum("#dc2626")}>{data.delayed_shipments}</div>
          <div style={s.kpiLabel}>Embarques atrasados</div>
        </div>
        <div style={s.kpiCard("#0891b2")}>
          <div style={s.kpiNum("#0891b2")}>{data.active_containers}</div>
          <div style={s.kpiLabel}>Contenedores activos</div>
        </div>
        <div style={s.kpiCard("#d97706")}>
          <div style={s.kpiNum("#d97706")}>{data.overdue_tasks}</div>
          <div style={s.kpiLabel}>Tareas vencidas</div>
        </div>
        <div style={s.kpiCard("#dc2626")}>
          <div style={s.kpiNum("#dc2626")}>{data.open_critical_incidents}</div>
          <div style={s.kpiLabel}>Incidencias críticas</div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
        <div style={s.card}>
          <div style={s.sectionTitle}>Próximos ETD <i className="ti ti-ship"/></div>
          {data.upcoming_etd?.length ? (
            <table style={s.table}>
              <thead><tr><th style={s.th}>Operación</th><th style={s.th}>Buque</th><th style={s.th}>ETD</th></tr></thead>
              <tbody>
                {data.upcoming_etd.map((r,i) => (
                  <tr key={i}>
                    <td style={s.td}>{r.operation_number}</td>
                    <td style={s.td}>{r.vessel_name||"—"}</td>
                    <td style={s.td}>{r.etd?.slice(0,10)||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState icon="calendar-off" text="Sin ETD próximos"/>}
        </div>
        <div style={s.card}>
          <div style={s.sectionTitle}>Próximos ETA <i className="ti ti-anchor"/></div>
          {data.upcoming_eta?.length ? (
            <table style={s.table}>
              <thead><tr><th style={s.th}>Operación</th><th style={s.th}>Buque</th><th style={s.th}>ETA</th></tr></thead>
              <tbody>
                {data.upcoming_eta.map((r,i) => (
                  <tr key={i}>
                    <td style={s.td}>{r.operation_number}</td>
                    <td style={s.td}>{r.vessel_name||"—"}</td>
                    <td style={s.td}>{r.eta?.slice(0,10)||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState icon="calendar-off" text="Sin ETA próximos"/>}
        </div>
      </div>
    </div>
  );
}

// ── Operaciones List ──────────────────────────────────────────────────────────

function OperacionesList({ user, setSubview, setSelectedOpId }) {
  const [ops, setOps]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const level = rl(user?.role);

  const load = useCallback(() => {
    const p = {};
    if (filterStatus) p.status = filterStatus;
    api.getLogisticsOps(p).then(d => { setOps(d); setLoading(false); }).catch(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const filtered = ops.filter(o =>
    !search || o.operation_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
        <div style={s.filterBar}>
          <input style={s.filterInput} placeholder="Buscar operación..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <select style={s.filterInput} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            {STATUS_LIST.map(st => <option key={st} value={st}>{STATUS_CFG[st].label}</option>)}
          </select>
        </div>
        {level >= 40 && user?.role !== "CLIENT" && (
          <button style={s.btn()} onClick={() => setSubview("new-op")}>
            <i className="ti ti-plus"/> Nueva Operación
          </button>
        )}
      </div>
      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState icon="ship" text="Sin operaciones"/>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Código</th>
              <th style={s.th}>Cliente</th>
              <th style={s.th}>Producto</th>
              <th style={s.th}>Ruta</th>
              <th style={s.th}>Incoterm</th>
              <th style={s.th}>Estado</th>
              <th style={s.th}>Responsable</th>
              <th style={s.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(op => (
              <tr key={op.id}>
                <td style={s.td}><strong>{op.operation_number}</strong></td>
                <td style={s.td}>{op.client_name||"—"}</td>
                <td style={s.td}>{op.product_name||"—"}</td>
                <td style={s.td}>{op.origin_country}→{op.destination_country}</td>
                <td style={s.td}>{op.incoterm||"—"}</td>
                <td style={s.td}><StatusBadge status={op.status}/></td>
                <td style={s.td}>{op.responsible_username||"—"}</td>
                <td style={s.td}>
                  <button style={s.btnSm()} onClick={() => { setSelectedOpId(op.id); setSubview("op-detail"); }}>
                    Ver <i className="ti ti-chevron-right"/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Nueva Operación ───────────────────────────────────────────────────────────

function NuevaOperacion({ user, setSubview, setSelectedOpId, showNotif }) {
  const [form, setForm] = useState({
    source_type:"MANUAL", origin_country:"AR", destination_country:"SA",
    incoterm:"CIF", currency:"USD", quantity:"", unit:"TM",
    product_name:"", product_code:"", responsible_username:user?.username||"",
    estimated_start_date:"", estimated_delivery_date:"",
  });
  const [saving, setSaving] = useState(false);
  const f = (k,v) => setForm(p => ({ ...p, [k]:v }));

  const submit = async () => {
    if (!form.origin_country || !form.destination_country || !form.source_type) {
      return showNotif("Origen, destino y tipo de fuente son obligatorios","error");
    }
    setSaving(true);
    try {
      const r = await api.createLogisticsOp(form);
      showNotif(`Operación ${r.operation_number} creada`,"success");
      setSelectedOpId(r.id);
      setSubview("op-detail");
    } catch(e) {
      showNotif(e.message,"error");
    }
    setSaving(false);
  };

  return (
    <div>
      <button style={s.back} onClick={() => setSubview("operaciones")}>
        <i className="ti ti-arrow-left"/> Volver
      </button>
      <div style={s.card}>
        <div style={s.sectionTitle}>Nueva Operación Logística</div>
        <div style={s.grid2}>
          <div>
            <label style={s.label}>Tipo de fuente *</label>
            <select style={s.select} value={form.source_type} onChange={e=>f("source_type",e.target.value)}>
              {["MANUAL","QUOTE","SCO","FCO","SPA"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Incoterm</label>
            <select style={s.select} value={form.incoterm} onChange={e=>f("incoterm",e.target.value)}>
              {INCOTERMS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>País origen *</label>
            <input style={s.input} value={form.origin_country} onChange={e=>f("origin_country",e.target.value)} placeholder="AR"/>
          </div>
          <div>
            <label style={s.label}>País destino *</label>
            <input style={s.input} value={form.destination_country} onChange={e=>f("destination_country",e.target.value)} placeholder="SA"/>
          </div>
          <div>
            <label style={s.label}>Producto</label>
            <input style={s.input} value={form.product_name} onChange={e=>f("product_name",e.target.value)}/>
          </div>
          <div>
            <label style={s.label}>Código producto</label>
            <input style={s.input} value={form.product_code} onChange={e=>f("product_code",e.target.value)}/>
          </div>
          <div>
            <label style={s.label}>Cantidad</label>
            <input style={s.input} type="number" value={form.quantity} onChange={e=>f("quantity",e.target.value)}/>
          </div>
          <div>
            <label style={s.label}>Unidad</label>
            <select style={s.select} value={form.unit} onChange={e=>f("unit",e.target.value)}>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Moneda</label>
            <select style={s.select} value={form.currency} onChange={e=>f("currency",e.target.value)}>
              <option>USD</option><option>EUR</option>
            </select>
          </div>
          <div>
            <label style={s.label}>Responsable</label>
            <input style={s.input} value={form.responsible_username} onChange={e=>f("responsible_username",e.target.value)}/>
          </div>
          <div>
            <label style={s.label}>Fecha inicio estimada</label>
            <input style={s.input} type="date" value={form.estimated_start_date} onChange={e=>f("estimated_start_date",e.target.value)}/>
          </div>
          <div>
            <label style={s.label}>Fecha entrega estimada</label>
            <input style={s.input} type="date" value={form.estimated_delivery_date} onChange={e=>f("estimated_delivery_date",e.target.value)}/>
          </div>
        </div>
        <div style={{ marginTop:"16px", display:"flex", gap:"8px" }}>
          <button style={s.btn()} onClick={submit} disabled={saving}>
            {saving ? "Creando..." : <><i className="ti ti-plus"/> Crear Operación</>}
          </button>
          <button style={s.btnOutline} onClick={() => setSubview("operaciones")}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Detalle Operación ─────────────────────────────────────────────────────────

function DetalleOperacion({ user, opId, setSubview, showNotif }) {
  const [op, setOp]           = useState(null);
  const [tab, setTab]         = useState("info");
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [voyageForm, setVoyageForm] = useState(null);
  const [containerForm, setContainerForm] = useState(null);
  const [milestoneForm, setMilestoneForm] = useState(null);
  const [incidentForm, setIncidentForm]   = useState(null);
  const level = rl(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    api.getLogisticsOp(opId).then(d => { setOp(d); setLoading(false); }).catch(() => setLoading(false));
  }, [opId]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (status, reason) => {
    try {
      await api.changeLogisticsOpStatus(opId, { status, reason });
      showNotif(`Estado → ${STATUS_CFG[status]?.label||status}`, "success");
      setModal(null); load();
    } catch(e) { showNotif(e.message,"error"); }
  };

  const saveVoyage = async () => {
    try {
      await api.upsertLogisticsVoyage(opId, voyageForm);
      showNotif("Viaje actualizado","success"); setVoyageForm(null); load();
    } catch(e) { showNotif(e.message,"error"); }
  };

  const addContainer = async () => {
    try {
      await api.addLogisticsContainer(opId, containerForm);
      showNotif("Contenedor añadido","success"); setContainerForm(null); load();
    } catch(e) { showNotif(e.message,"error"); }
  };

  const addMilestone = async () => {
    try {
      await api.addLogisticsMilestone(opId, milestoneForm);
      showNotif("Hito registrado","success"); setMilestoneForm(null); load();
    } catch(e) { showNotif(e.message,"error"); }
  };

  const addIncident = async () => {
    try {
      await api.reportLogisticsIncident(opId, incidentForm);
      showNotif("Incidencia reportada","success"); setIncidentForm(null); load();
    } catch(e) { showNotif(e.message,"error"); }
  };

  if (loading) return <Loading />;
  if (!op) return <EmptyState icon="alert-circle" text="Operación no encontrada"/>;

  const canEdit = level >= 42 && user?.role !== "CLIENT";
  const canManage = level >= 45;

  const detailTabs = [
    { id:"info",       label:"Info" },
    ...(level >= 40 ? [{ id:"viaje", label:"Viaje/Booking" }] : []),
    ...(level >= 40 ? [{ id:"contenedores", label:"Contenedores" }] : []),
    { id:"hitos",      label:"Hitos" },
    { id:"incidencias",label:"Incidencias" },
    ...(level >= 40 ? [{ id:"tareas", label:"Tareas" }] : []),
    ...(level >= 45 ? [{ id:"auditoria", label:"Auditoría" }] : []),
  ];

  return (
    <div>
      <button style={s.back} onClick={() => setSubview("operaciones")}>
        <i className="ti ti-arrow-left"/> Volver a Operaciones
      </button>

      {/* Header */}
      <div style={{ ...s.card, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:"18px", fontWeight:700, color:"#1B2A4A" }}>{op.operation_number}</div>
          <div style={{ display:"flex", gap:"8px", marginTop:"6px", alignItems:"center" }}>
            <StatusBadge status={op.status}/>
            <span style={{ fontSize:"12px", color:"var(--color-text-secondary)" }}>
              {op.origin_country} → {op.destination_country}
            </span>
            {op.incoterm && <span style={{ fontSize:"12px", background:"#1B2A4A11", padding:"2px 8px", borderRadius:"4px" }}>{op.incoterm}</span>}
          </div>
        </div>
        {canEdit && (
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
            {op.status !== "CERRADA" && op.status !== "CANCELADA" && STATUS_LIST.map(st => {
              if (st === op.status) return null;
              const cfg = STATUS_CFG[st];
              return (
                <button key={st} style={s.btnSm(cfg.color)}
                  onClick={() => {
                    if (st === "CANCELADA") setModal({ type:"cancel" });
                    else changeStatus(st);
                  }}>
                  → {cfg.label}
                </button>
              );
            }).filter(Boolean).slice(0,3)}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {detailTabs.map(t => (
          <button key={t.id} style={s.tab(tab===t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Info tab */}
      {tab === "info" && (
        <div style={s.grid2}>
          <div style={s.card}>
            <div style={s.sectionTitle}>Datos comerciales</div>
            {[
              ["Producto", op.product_name||"—"],
              ["Código", op.product_code||"—"],
              ["Cantidad", op.quantity ? `${op.quantity} ${op.unit||""}` : "—"],
              ["Incoterm", op.incoterm||"—"],
              ["Moneda", op.currency||"—"],
              ["Origen", op.origin_country||"—"],
              ["Destino", op.destination_country||"—"],
              ["Cliente", op.client_name||"—"],
            ].map(([k,v]) => (
              <div key={k} style={s.detailItem}>
                <div style={s.detailKey}>{k}</div>
                <div style={s.detailVal}>{v}</div>
              </div>
            ))}
          </div>
          <div style={s.card}>
            <div style={s.sectionTitle}>Fechas y responsable</div>
            {[
              ["Responsable", op.responsible_username||"—"],
              ["Inicio estimado", op.estimated_start_date||"—"],
              ["Inicio real", op.actual_start_date||"—"],
              ["Entrega estimada", op.estimated_delivery_date||"—"],
              ["Entrega real", op.actual_delivery_date||"—"],
              ["Cerrada el", op.closed_at?.slice(0,10)||"—"],
              ["Cancelada el", op.cancelled_at?.slice(0,10)||"—"],
              ["Creada por", op.created_by||"—"],
            ].map(([k,v]) => (
              <div key={k} style={s.detailItem}>
                <div style={s.detailKey}>{k}</div>
                <div style={s.detailVal}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Viaje tab */}
      {tab === "viaje" && level >= 40 && (
        <div>
          <div style={s.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
              <div style={s.sectionTitle}>Datos del viaje</div>
              {canEdit && <button style={s.btn()} onClick={() => setVoyageForm(op.voyage||{})}>
                <i className="ti ti-pencil"/> {op.voyage ? "Editar" : "Registrar viaje"}
              </button>}
            </div>
            {op.voyage ? (
              <div style={s.grid2}>
                {[
                  ["Naviera", op.voyage.naviera_id||"—"],
                  ["Buque", op.voyage.vessel_name||"—"],
                  ["IMO", op.voyage.imo_number||"—"],
                  ["Viaje #", op.voyage.voyage_number||"—"],
                  ["Booking #", op.voyage.booking_number||"—"],
                  ["Fecha booking", op.voyage.booking_date||"—"],
                  ["Puerto carga", op.voyage.pol_name||"—"],
                  ["Puerto descarga", op.voyage.pod_name||"—"],
                  ["ETD", op.voyage.etd?.slice(0,10)||"—"],
                  ["ATD", op.voyage.atd?.slice(0,10)||"—"],
                  ["ETA", op.voyage.eta?.slice(0,10)||"—"],
                  ["ATA", op.voyage.ata?.slice(0,10)||"—"],
                  ["BL #", op.voyage.bl_number||"—"],
                  ["Tipo BL", op.voyage.bl_type||"—"],
                  ["Fecha BL", op.voyage.bl_date||"—"],
                ].map(([k,v]) => (
                  <div key={k} style={s.detailItem}>
                    <div style={s.detailKey}>{k}</div>
                    <div style={s.detailVal}>{v}</div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon="ship" text="Sin datos de viaje registrados"/>}
          </div>
          {voyageForm && (
            <div style={s.modal} onClick={() => setVoyageForm(null)}>
              <div style={{ ...s.modalBox, width:"600px" }} onClick={e=>e.stopPropagation()}>
                <h3 style={{ margin:"0 0 16px", color:"#1B2A4A" }}>Datos del viaje</h3>
                <div style={s.grid2}>
                  {[
                    ["vessel_name","Buque","text"],["imo_number","IMO","text"],
                    ["voyage_number","Viaje #","text"],["booking_number","Booking #","text"],
                    ["booking_date","Fecha booking","date"],
                    ["etd","ETD","date"],["eta","ETA","date"],
                    ["bl_number","BL #","text"],["bl_date","Fecha BL","date"],
                  ].map(([k,label,type]) => (
                    <div key={k}>
                      <label style={s.label}>{label}</label>
                      <input style={s.input} type={type} value={voyageForm[k]||""}
                        onChange={e=>setVoyageForm(p=>({...p,[k]:e.target.value}))}/>
                    </div>
                  ))}
                  <div>
                    <label style={s.label}>Tipo BL</label>
                    <select style={s.select} value={voyageForm.bl_type||""}
                      onChange={e=>setVoyageForm(p=>({...p,bl_type:e.target.value}))}>
                      <option value="">—</option>
                      {["ORIGINAL","TELEX_RELEASE","SEA_WAYBILL"].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"8px", marginTop:"16px" }}>
                  <button style={s.btn()} onClick={saveVoyage}>Guardar</button>
                  <button style={s.btnOutline} onClick={() => setVoyageForm(null)}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contenedores tab */}
      {tab === "contenedores" && level >= 40 && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"12px" }}>
            {canEdit && <button style={s.btn()} onClick={() => setContainerForm({ container_number:"", container_type:"40GP" })}>
              <i className="ti ti-plus"/> Añadir contenedor
            </button>}
          </div>
          {op.containers?.length ? (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Contenedor</th><th style={s.th}>Tipo</th>
                  <th style={s.th}>Sello</th><th style={s.th}>Peso bruto (kg)</th>
                  <th style={s.th}>VGM (kg)</th><th style={s.th}>Inspección</th>
                </tr>
              </thead>
              <tbody>
                {op.containers.map(c => (
                  <tr key={c.id}>
                    <td style={s.td}><strong>{c.container_number}</strong></td>
                    <td style={s.td}>{c.container_type||"—"}</td>
                    <td style={s.td}>{c.seal_number||"—"}</td>
                    <td style={s.td}>{c.gross_weight_kg?.toLocaleString()||"—"}</td>
                    <td style={s.td}>{c.vgm_kg?.toLocaleString()||"—"}</td>
                    <td style={s.td}>{c.inspection_required ? (c.inspection_result||"Pendiente") : "No requerida"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState icon="box" text="Sin contenedores registrados"/>}
          {containerForm && (
            <div style={s.modal} onClick={() => setContainerForm(null)}>
              <div style={s.modalBox} onClick={e=>e.stopPropagation()}>
                <h3 style={{ margin:"0 0 16px", color:"#1B2A4A" }}>Añadir contenedor</h3>
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Número contenedor *</label>
                    <input style={s.input} value={containerForm.container_number||""}
                      onChange={e=>setContainerForm(p=>({...p,container_number:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={s.label}>Tipo</label>
                    <select style={s.select} value={containerForm.container_type||"40GP"}
                      onChange={e=>setContainerForm(p=>({...p,container_type:e.target.value}))}>
                      {["20GP","40GP","40HC","45HC","RORO","BULK"].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Sello</label>
                    <input style={s.input} value={containerForm.seal_number||""}
                      onChange={e=>setContainerForm(p=>({...p,seal_number:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={s.label}>Peso bruto (kg)</label>
                    <input style={s.input} type="number" value={containerForm.gross_weight_kg||""}
                      onChange={e=>setContainerForm(p=>({...p,gross_weight_kg:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={s.label}>VGM (kg)</label>
                    <input style={s.input} type="number" value={containerForm.vgm_kg||""}
                      onChange={e=>setContainerForm(p=>({...p,vgm_kg:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={s.label}>Fecha VGM</label>
                    <input style={s.input} type="date" value={containerForm.vgm_date||""}
                      onChange={e=>setContainerForm(p=>({...p,vgm_date:e.target.value}))}/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"8px", marginTop:"16px" }}>
                  <button style={s.btn()} onClick={addContainer}>Añadir</button>
                  <button style={s.btnOutline} onClick={() => setContainerForm(null)}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hitos tab */}
      {tab === "hitos" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"12px" }}>
            {canEdit && <button style={s.btn()} onClick={() => setMilestoneForm({ milestone_key:"", milestone_label:"", planned_date:"" })}>
              <i className="ti ti-plus"/> Añadir hito
            </button>}
          </div>
          {op.milestones?.length ? (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Hito</th><th style={s.th}>Planificado</th>
                  <th style={s.th}>Real</th><th style={s.th}>Responsable</th>
                  <th style={s.th}>Estado</th><th style={s.th}>Retraso</th>
                </tr>
              </thead>
              <tbody>
                {op.milestones.map(m => (
                  <tr key={m.id}>
                    <td style={s.td}>{m.milestone_label}</td>
                    <td style={s.td}>{m.planned_date||"—"}</td>
                    <td style={s.td}>{m.actual_date||"—"}</td>
                    <td style={s.td}>{m.responsible_username||"—"}</td>
                    <td style={s.td}>
                      <span style={s.badge(m.status==="COMPLETED"?"#059669":m.status==="OVERDUE"?"#dc2626":"#6b7280")}>{m.status}</span>
                    </td>
                    <td style={s.td}>{m.delay_days != null ? `${m.delay_days}d` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState icon="timeline" text="Sin hitos registrados"/>}
          {milestoneForm && (
            <div style={s.modal} onClick={() => setMilestoneForm(null)}>
              <div style={s.modalBox} onClick={e=>e.stopPropagation()}>
                <h3 style={{ margin:"0 0 16px", color:"#1B2A4A" }}>Añadir hito</h3>
                <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                  <div>
                    <label style={s.label}>Clave del hito *</label>
                    <input style={s.input} value={milestoneForm.milestone_key||""}
                      onChange={e=>setMilestoneForm(p=>({...p,milestone_key:e.target.value}))} placeholder="BOOKING_CONFIRMED"/>
                  </div>
                  <div>
                    <label style={s.label}>Etiqueta *</label>
                    <input style={s.input} value={milestoneForm.milestone_label||""}
                      onChange={e=>setMilestoneForm(p=>({...p,milestone_label:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={s.label}>Fecha planificada</label>
                    <input style={s.input} type="date" value={milestoneForm.planned_date||""}
                      onChange={e=>setMilestoneForm(p=>({...p,planned_date:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={s.label}>Fecha real</label>
                    <input style={s.input} type="date" value={milestoneForm.actual_date||""}
                      onChange={e=>setMilestoneForm(p=>({...p,actual_date:e.target.value}))}/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"8px", marginTop:"16px" }}>
                  <button style={s.btn()} onClick={addMilestone}>Guardar</button>
                  <button style={s.btnOutline} onClick={() => setMilestoneForm(null)}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Incidencias tab */}
      {tab === "incidencias" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"12px" }}>
            {canEdit && <button style={s.btn("#d97706")} onClick={() => setIncidentForm({ type:"DELAY", severity:"MEDIUM", description:"" })}>
              <i className="ti ti-alert-triangle"/> Reportar incidencia
            </button>}
          </div>
          {op.incidents?.length ? (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Tipo</th><th style={s.th}>Severidad</th>
                  <th style={s.th}>Descripción</th><th style={s.th}>Estado</th>
                  <th style={s.th}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {op.incidents.map(i => (
                  <tr key={i.id}>
                    <td style={s.td}>{i.type}</td>
                    <td style={s.td}>
                      <span style={s.badge(i.severity==="CRITICAL"?"#dc2626":i.severity==="HIGH"?"#d97706":i.severity==="MEDIUM"?"#0891b2":"#6b7280")}>
                        {i.severity}
                      </span>
                    </td>
                    <td style={s.td}>{i.description}</td>
                    <td style={s.td}><span style={s.badge(i.status==="RESOLVED"||i.status==="CLOSED"?"#059669":i.status==="IN_PROGRESS"?"#2563eb":"#6b7280")}>{i.status}</span></td>
                    <td style={s.td}>{i.reported_at?.slice(0,10)||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState icon="alert-circle" text="Sin incidencias"/>}
          {incidentForm && (
            <div style={s.modal} onClick={() => setIncidentForm(null)}>
              <div style={s.modalBox} onClick={e=>e.stopPropagation()}>
                <h3 style={{ margin:"0 0 16px", color:"#1B2A4A" }}>Reportar incidencia</h3>
                <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                  <div>
                    <label style={s.label}>Tipo</label>
                    <select style={s.select} value={incidentForm.type} onChange={e=>setIncidentForm(p=>({...p,type:e.target.value}))}>
                      {["DELAY","DAMAGE","DOCUMENTATION","CUSTOMS","OTHER"].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Severidad</label>
                    <select style={s.select} value={incidentForm.severity} onChange={e=>setIncidentForm(p=>({...p,severity:e.target.value}))}>
                      {["LOW","MEDIUM","HIGH","CRITICAL"].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Descripción *</label>
                    <textarea style={{ ...s.input, height:"80px" }} value={incidentForm.description}
                      onChange={e=>setIncidentForm(p=>({...p,description:e.target.value}))}/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"8px", marginTop:"16px" }}>
                  <button style={s.btn("#d97706")} onClick={addIncident}>Reportar</button>
                  <button style={s.btnOutline} onClick={() => setIncidentForm(null)}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tareas tab */}
      {tab === "tareas" && level >= 40 && (
        <div>
          {op.tasks?.length ? (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Título</th><th style={s.th}>Estado</th>
                  <th style={s.th}>Prioridad</th><th style={s.th}>Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {op.tasks.map(t => (
                  <tr key={t.id}>
                    <td style={s.td}>{t.title}</td>
                    <td style={s.td}><span style={s.badge(t.status==="completed"?"#059669":"#6b7280")}>{t.status}</span></td>
                    <td style={s.td}>{t.priority}</td>
                    <td style={s.td}>{t.deadline||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState icon="checklist" text="Sin tareas generadas"/>}
        </div>
      )}

      {/* Auditoría tab */}
      {tab === "auditoria" && level >= 45 && (
        <div>
          {op.audit?.length ? (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Acción</th><th style={s.th}>Actor</th>
                  <th style={s.th}>Rol</th><th style={s.th}>Detalle</th>
                  <th style={s.th}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {op.audit.map(a => (
                  <tr key={a.id}>
                    <td style={s.td}><strong>{a.action}</strong></td>
                    <td style={s.td}>{a.actor}</td>
                    <td style={s.td}>{a.role}</td>
                    <td style={{ ...s.td, maxWidth:"200px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.detail||"—"}</td>
                    <td style={s.td}>{a.created_at?.slice(0,16)||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState icon="file-text" text="Sin auditoría"/>}
        </div>
      )}

      {/* Cancel modal */}
      {modal?.type === "cancel" && (
        <ConfirmModal
          title="Cancelar operación"
          body={`¿Cancelar la operación ${op.operation_number}?`}
          confirmLabel="Cancelar operación"
          confirmColor="#dc2626"
          requireReason
          onConfirm={reason => changeStatus("CANCELADA", reason)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── Proveedores Logísticos ────────────────────────────────────────────────────

function ProveedoresLogisticos({ user, showNotif }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState(null);
  const level = rl(user?.role);

  const load = () => api.getLogisticsProviders().then(d => { setProviders(d); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.createLogisticsProvider(form);
      showNotif("Proveedor creado","success"); setForm(null); load();
    } catch(e) { showNotif(e.message,"error"); }
  };

  const TYPES = ["NAVIERA","FREIGHT_OPERATOR","PORT_AGENT","LOGISTICS_PROVIDER"];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"16px" }}>
        <div style={s.sectionTitle}>Proveedores y Operadores Logísticos</div>
        {level >= 45 && (
          <button style={s.btn()} onClick={() => setForm({ name:"", type:"NAVIERA", country:"" })}>
            <i className="ti ti-plus"/> Nuevo proveedor
          </button>
        )}
      </div>
      {loading ? <Loading /> : providers.length === 0 ? (
        <EmptyState icon="building" text="Sin proveedores registrados"/>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Nombre</th><th style={s.th}>Tipo</th><th style={s.th}>País</th>
              <th style={s.th}>Contacto</th><th style={s.th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {providers.map(p => (
              <tr key={p.id}>
                <td style={s.td}><strong>{p.name}</strong>{p.scac_code&&<span style={{ marginLeft:"6px", fontSize:"11px", color:"var(--color-text-secondary)" }}>[{p.scac_code}]</span>}</td>
                <td style={s.td}><span style={s.badge("#2563eb")}>{p.type}</span></td>
                <td style={s.td}>{p.country||"—"}</td>
                <td style={s.td}>{p.contact_name||"—"}{p.contact_email&&<span style={{ display:"block", fontSize:"11px", color:"var(--color-text-secondary)" }}>{p.contact_email}</span>}</td>
                <td style={s.td}><span style={s.badge(p.status==="ACTIVE"?"#059669":"#6b7280")}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {form && (
        <div style={s.modal} onClick={() => setForm(null)}>
          <div style={s.modalBox} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:"0 0 16px", color:"#1B2A4A" }}>Nuevo proveedor logístico</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <div>
                <label style={s.label}>Nombre *</label>
                <input style={s.input} value={form.name||""} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
              </div>
              <div>
                <label style={s.label}>Tipo *</label>
                <select style={s.select} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                  {TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>País</label>
                <input style={s.input} value={form.country||""} onChange={e=>setForm(p=>({...p,country:e.target.value}))} placeholder="AR"/>
              </div>
              <div>
                <label style={s.label}>Contacto</label>
                <input style={s.input} value={form.contact_name||""} onChange={e=>setForm(p=>({...p,contact_name:e.target.value}))}/>
              </div>
              <div>
                <label style={s.label}>Email</label>
                <input style={s.input} type="email" value={form.contact_email||""} onChange={e=>setForm(p=>({...p,contact_email:e.target.value}))}/>
              </div>
              <div>
                <label style={s.label}>SCAC Code (navieras)</label>
                <input style={s.input} value={form.scac_code||""} onChange={e=>setForm(p=>({...p,scac_code:e.target.value}))}/>
              </div>
            </div>
            <div style={{ display:"flex", gap:"8px", marginTop:"16px" }}>
              <button style={s.btn()} onClick={save}>Guardar</button>
              <button style={s.btnOutline} onClick={() => setForm(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Puertos ───────────────────────────────────────────────────────────────────

function PuertosView() {
  const [ports, setPorts]   = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getOpPorts().then(d => { setPorts(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  return (
    <div>
      {loading ? <Loading /> : ports.length === 0 ? (
        <EmptyState icon="anchor" text="Sin puertos registrados"/>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Puerto</th><th style={s.th}>País</th>
              <th style={s.th}>Locode</th><th style={s.th}>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {ports.map(p => (
              <tr key={p.id}>
                <td style={s.td}><strong>{p.name}</strong></td>
                <td style={s.td}>{p.country}</td>
                <td style={s.td}><code style={{ fontSize:"12px" }}>{p.locode||"—"}</code></td>
                <td style={s.td}>{p.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Vista CLIENT simplificada ─────────────────────────────────────────────────

function MisOperaciones({ user, setSubview, setSelectedOpId }) {
  const [ops, setOps]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLogisticsOps().then(d => { setOps(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom:"16px", fontSize:"13px", color:"var(--color-text-secondary)" }}>
        <i className="ti ti-info-circle"/> Visualiza el estado de tus exportaciones activas.
      </div>
      {loading ? <Loading /> : ops.length === 0 ? (
        <EmptyState icon="ship" text="Sin operaciones activas"/>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Código</th><th style={s.th}>Producto</th>
              <th style={s.th}>Ruta</th><th style={s.th}>Estado</th>
              <th style={s.th}>Entrega est.</th><th style={s.th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {ops.map(op => (
              <tr key={op.id}>
                <td style={s.td}><strong>{op.operation_number}</strong></td>
                <td style={s.td}>{op.product_name||"—"}</td>
                <td style={s.td}>{op.origin_country}→{op.destination_country}</td>
                <td style={s.td}><StatusBadge status={op.status}/></td>
                <td style={s.td}>{op.estimated_delivery_date||"—"}</td>
                <td style={s.td}>
                  <button style={s.btnSm()} onClick={() => { setSelectedOpId(op.id); setSubview("op-detail"); }}>
                    Ver <i className="ti ti-chevron-right"/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OperationsLogistics({ user, setView, showNotif }) {
  const level = rl(user?.role);
  const isClient = user?.role === "CLIENT";

  const defaultSubview = isClient ? "mis-operaciones" : "panel";
  const [subview, setSubview]         = useState(defaultSubview);
  const [selectedOpId, setSelectedOpId] = useState(null);

  const tabs = isClient ? [
    { id:"mis-operaciones", icon:"ti-ship",   label:"Mis Operaciones" },
  ] : [
    { id:"panel",           icon:"ti-dashboard", label:"Panel" },
    { id:"operaciones",     icon:"ti-ship",      label:"Operaciones" },
    ...(level >= 45 ? [{ id:"proveedores", icon:"ti-building", label:"Proveedores" }] : []),
    { id:"puertos",         icon:"ti-anchor",    label:"Puertos" },
  ];

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}><i className="ti ti-container" style={{ marginRight:"8px" }}/>Operaciones y Logística</h1>
      </div>

      {subview !== "op-detail" && (
        <div style={s.tabs}>
          {tabs.map(t => (
            <button key={t.id} style={s.tab(subview===t.id)}
              onClick={() => { setSubview(t.id); setSelectedOpId(null); }}>
              <i className={`ti ${t.icon}`} style={{ marginRight:"4px" }}/>{t.label}
            </button>
          ))}
        </div>
      )}

      {subview === "panel"           && <PanelOperativo     user={user} setSubview={setSubview} />}
      {subview === "operaciones"     && <OperacionesList    user={user} setSubview={setSubview} setSelectedOpId={setSelectedOpId} />}
      {subview === "new-op"          && <NuevaOperacion     user={user} setSubview={setSubview} setSelectedOpId={setSelectedOpId} showNotif={showNotif} />}
      {subview === "op-detail"       && selectedOpId && <DetalleOperacion user={user} opId={selectedOpId} setSubview={setSubview} showNotif={showNotif} />}
      {subview === "proveedores"     && <ProveedoresLogisticos user={user} showNotif={showNotif} />}
      {subview === "puertos"         && <PuertosView />}
      {subview === "mis-operaciones" && <MisOperaciones user={user} setSubview={setSubview} setSelectedOpId={setSelectedOpId} />}
    </div>
  );
}
