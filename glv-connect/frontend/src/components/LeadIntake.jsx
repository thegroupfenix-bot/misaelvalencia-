import { useState, useEffect, useCallback } from "react";
import { api } from "../api.js";

const ROLE_LEVEL = {
  SUPER_ADMIN:100, CORPORATE_ADMIN:90, CFO:80, DIRECTOR:75, DIRECTIVO:75,
  COMMERCIAL_MANAGER:72, COMMERCIAL_DIRECTOR:70, COMPLIANCE:65, ACCOUNTING:60, TREASURY:60,
  AUDIT:55, TAX_REVIEWER:50, COUNTRY_ACCOUNTANT:50, LOGISTICS:45,
  COMMERCIAL_AGENT:42, AGENTE:40, MEDIA_MANAGER:35, CLIENT:20, SUPPLIER:20,
};

const STATUS_COLORS = {
  PENDING_ASSIGNMENT:      "#dc2626",
  ASSIGNED:                "#d97706",
  FIRST_CONTACT_PENDING:   "#d97706",
  FIRST_CONTACT_DONE:      "#2563eb",
  AWAITING_RESPONSE:       "#0891b2",
  CLIENT_RESPONDED:        "#059669",
  SECOND_CONTACT_REQUIRED: "#d97706",
  FOLLOW_UP_SCHEDULED:     "#2563eb",
  ESCALATED:               "#7c3aed",
  CLOSED:                  "#6b7280",
};

const STATUS_ES = {
  PENDING_ASSIGNMENT:      "Pendiente de asignación",
  ASSIGNED:                "Asignado",
  FIRST_CONTACT_PENDING:   "Primer contacto pendiente",
  FIRST_CONTACT_DONE:      "Primer contacto realizado",
  AWAITING_RESPONSE:       "Esperando respuesta",
  CLIENT_RESPONDED:        "Cliente respondió",
  SECOND_CONTACT_REQUIRED: "Segundo contacto requerido",
  FOLLOW_UP_SCHEDULED:     "Seguimiento programado",
  ESCALATED:               "Escalado",
  CLOSED:                  "Cerrado",
};

const CHANNEL_ES = {
  WEB:"Web", SOCIAL:"Redes Sociales", WHATSAPP:"WhatsApp",
  REFERRAL:"Referido", CAMPAIGN:"Campaña", OTHER:"Otro",
};

const RESULT_ES = {
  CONTACTED:"Contactado", REPLIED:"Respondió", NO_REPLY:"No respondió",
  MEETING_SCHEDULED:"Cita programada", NOT_INTERESTED:"No interesado",
  INFO_PENDING:"Información pendiente", OTHER:"Otro",
};

function Badge({ label, color, bg }) {
  return (
    <span style={{
      display:"inline-block", background: bg || color || "#1B2A4A", color:"#fff",
      borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:600,
      fontFamily:"var(--font-sans)",
    }}>
      {label}
    </span>
  );
}

function Spinner() {
  return <div style={{ padding:32, color:"var(--color-text-secondary)", fontFamily:"var(--font-sans)" }}>Cargando…</div>;
}

function isOverdue(isoStr) {
  if (!isoStr) return false;
  return new Date(isoStr) < new Date();
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es", { dateStyle:"short", timeStyle:"short" });
}

// ── Panel (dashboard) ─────────────────────────────────────────────────────────
function PanelView({ user, setView }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.getLeads({ limit: 500 }).then(data => {
      if (!Array.isArray(data)) return;
      const pending = data.filter(l => l.status === "PENDING_ASSIGNMENT").length;
      const assignedToday = data.filter(l => l.status === "ASSIGNED" && l.assigned_at?.startsWith(new Date().toISOString().slice(0,10))).length;
      const contactOverdue = data.filter(l => l.status === "ASSIGNED" && isOverdue(l.first_contact_deadline)).length;
      setStats({ total: data.length, pending, assignedToday, contactOverdue });
    }).catch(() => {});
  }, []);

  return (
    <div style={{ padding:"24px 32px", fontFamily:"var(--font-sans)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <i className="ti ti-user-plus" style={{ fontSize:28, color:"#2563eb" }} />
        <h2 style={{ margin:0, color:"var(--color-text-primary)", fontSize:22 }}>GOS — Leads Entrantes</h2>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:16, marginBottom:28 }}>
        {[
          { label:"Total leads", val: stats?.total ?? "—", icon:"ti-users", color:"#2563eb" },
          { label:"Sin asignar", val: stats?.pending ?? "—", icon:"ti-clock", color:"#dc2626" },
          { label:"Asignados hoy", val: stats?.assignedToday ?? "—", icon:"ti-calendar", color:"#059669" },
          { label:"Contacto vencido", val: stats?.contactOverdue ?? "—", icon:"ti-alert-triangle", color:"#d97706" },
        ].map(s => (
          <div key={s.label} style={{
            background:"var(--color-background-secondary)", border:"1px solid var(--color-border-tertiary)",
            borderRadius:10, padding:"20px 22px",
          }}>
            <i className={`ti ${s.icon}`} style={{ fontSize:22, color:s.color }} />
            <div style={{ fontSize:28, fontWeight:700, color:"var(--color-text-primary)", marginTop:8 }}>{s.val}</div>
            <div style={{ fontSize:13, color:"var(--color-text-secondary)" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <button onClick={() => setView("leads-list")} style={{
          background:"#2563eb", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px",
          cursor:"pointer", fontFamily:"var(--font-sans)", fontWeight:600,
        }}>
          <i className="ti ti-list" style={{ marginRight:6 }} />Ver todos los leads
        </button>
        <button onClick={() => setView("leads-new")} style={{
          background:"#059669", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px",
          cursor:"pointer", fontFamily:"var(--font-sans)", fontWeight:600,
        }}>
          <i className="ti ti-plus" style={{ marginRight:6 }} />Nuevo lead
        </button>
        {(ROLE_LEVEL[user.role] || 0) >= 75 && (
          <button onClick={() => setView("leads-rules")} style={{
            background:"#7c3aed", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px",
            cursor:"pointer", fontFamily:"var(--font-sans)", fontWeight:600,
          }}>
            <i className="ti ti-settings" style={{ marginRight:6 }} />Matriz de asignación
          </button>
        )}
      </div>
    </div>
  );
}

// ── Lead List ─────────────────────────────────────────────────────────────────
function LeadListView({ user, setView, showNotif }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api.getLeads(filterStatus ? { status: filterStatus } : {})
      .then(d => { setLeads(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filterStatus]);

  useEffect(load, [load]);

  return (
    <div style={{ padding:"24px 32px", fontFamily:"var(--font-sans)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={() => setView("leads")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"var(--color-text-secondary)" }}>←</button>
        <h2 style={{ margin:0, color:"var(--color-text-primary)" }}>Leads</h2>
        <button onClick={() => setView("leads-new")} style={{
          marginLeft:"auto", background:"#059669", color:"#fff", border:"none", borderRadius:6,
          padding:"8px 16px", cursor:"pointer", fontWeight:600,
        }}>+ Nuevo</button>
      </div>
      <div style={{ marginBottom:16 }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
          border:"1px solid var(--color-border-tertiary)", borderRadius:6, padding:"6px 10px",
          background:"var(--color-background-secondary)", color:"var(--color-text-primary)", fontFamily:"var(--font-sans)",
        }}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_ES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {loading ? <Spinner /> : (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:"2px solid var(--color-border-tertiary)", color:"var(--color-text-secondary)" }}>
                {["Código","Empresa","Contacto","Canal","Estado","Agente","Ingreso","Vence 1er contacto"].map(h => (
                  <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr><td colSpan={8} style={{ padding:24, color:"var(--color-text-secondary)", textAlign:"center" }}>Sin leads.</td></tr>
              )}
              {leads.map(l => {
                const overdue = l.status === "ASSIGNED" && isOverdue(l.first_contact_deadline);
                return (
                  <tr key={l.id} onClick={() => setView(`leads-detail:${l.id}`)}
                    style={{ borderBottom:"1px solid var(--color-border-tertiary)", cursor:"pointer" }}>
                    <td style={{ padding:"8px 10px", color:"#2563eb", fontWeight:600 }}>{l.glv_code}</td>
                    <td style={{ padding:"8px 10px" }}>{l.company_name || "—"}</td>
                    <td style={{ padding:"8px 10px" }}>{l.contact_name}</td>
                    <td style={{ padding:"8px 10px" }}><Badge label={CHANNEL_ES[l.origin_channel] || l.origin_channel} /></td>
                    <td style={{ padding:"8px 10px" }}><Badge label={STATUS_ES[l.status] || l.status} color={STATUS_COLORS[l.status]} /></td>
                    <td style={{ padding:"8px 10px" }}>{l.assigned_agent || <span style={{color:"#dc2626"}}>Sin asignar</span>}</td>
                    <td style={{ padding:"8px 10px" }}>{fmtDate(l.created_at)}</td>
                    <td style={{ padding:"8px 10px", color: overdue ? "#dc2626" : "inherit", fontWeight: overdue ? 700 : 400 }}>
                      {l.first_contact_deadline ? fmtDate(l.first_contact_deadline) : "—"}
                      {overdue && " ⚠"}
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

// ── New Lead Form ─────────────────────────────────────────────────────────────
function NewLeadView({ user, setView, showNotif }) {
  const [form, setForm] = useState({
    contact_name:"", company_name:"", phone_raw:"", email:"",
    origin_channel:"WEB", country_code:"", zone:"", city:"", language:"ES",
    product_type:"", quantity:"", quantity_unit:"", destination:"", port:"",
    campaign:"", notes:"",
  });
  const [dupes, setDupes] = useState([]);
  const [saving, setSaving] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.contact_name) return showNotif && showNotif("contact_name requerido", "error");
    setSaving(true);
    try {
      const r = await api.createLead(form);
      if (r.possible_duplicates?.length > 0) {
        setDupes(r.possible_duplicates);
        showNotif && showNotif(`Lead creado con advertencia: ${r.possible_duplicates.length} posible(s) duplicado(s)`, "warn");
      } else {
        showNotif && showNotif("Lead creado correctamente", "success");
      }
      setView(`leads-detail:${r.id}`);
    } catch (e) {
      showNotif && showNotif("Error creando lead", "error");
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    width:"100%", border:"1px solid var(--color-border-tertiary)", borderRadius:6,
    padding:"8px 10px", background:"var(--color-background-secondary)",
    color:"var(--color-text-primary)", fontFamily:"var(--font-sans)", boxSizing:"border-box",
  };
  const label = (txt) => <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:4, marginTop:12 }}>{txt}</div>;

  return (
    <div style={{ padding:"24px 32px", fontFamily:"var(--font-sans)", maxWidth:680 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={() => setView("leads")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"var(--color-text-secondary)" }}>←</button>
        <h2 style={{ margin:0, color:"var(--color-text-primary)" }}>Nuevo lead</h2>
      </div>

      {dupes.length > 0 && (
        <div style={{ background:"#fef3c7", border:"1px solid #fbbf24", borderRadius:8, padding:14, marginBottom:16, fontSize:13 }}>
          <i className="ti ti-alert-triangle" style={{ marginRight:6, color:"#d97706" }} />
          <strong>Posible duplicado:</strong> Lead(s) con datos similares ya existen (IDs: {dupes.join(", ")}).
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div>
          {label("Nombre de contacto *")}
          <input value={form.contact_name} onChange={set("contact_name")} style={fieldStyle} placeholder="Nombre completo" />
        </div>
        <div>
          {label("Empresa")}
          <input value={form.company_name} onChange={set("company_name")} style={fieldStyle} placeholder="Razón social" />
        </div>
        <div>
          {label("Teléfono / WhatsApp")}
          <input value={form.phone_raw} onChange={set("phone_raw")} style={fieldStyle} placeholder="+54 9 11 xxxx" />
        </div>
        <div>
          {label("Correo electrónico")}
          <input value={form.email} onChange={set("email")} style={fieldStyle} placeholder="contacto@empresa.com" />
        </div>
        <div>
          {label("Canal de origen")}
          <select value={form.origin_channel} onChange={set("origin_channel")} style={fieldStyle}>
            {Object.entries(CHANNEL_ES).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          {label("Idioma")}
          <select value={form.language} onChange={set("language")} style={fieldStyle}>
            <option value="ES">Español</option>
            <option value="EN">English</option>
            <option value="PT">Português</option>
          </select>
        </div>
        <div>
          {label("País (código ISO)")}
          <input value={form.country_code} onChange={set("country_code")} style={fieldStyle} placeholder="AR, BR, CO…" maxLength={2} />
        </div>
        <div>
          {label("Zona")}
          <input value={form.zone} onChange={set("zone")} style={fieldStyle} placeholder="LATAM_NORTH, LATAM_SOUTH…" />
        </div>
        <div>
          {label("Ciudad")}
          <input value={form.city} onChange={set("city")} style={fieldStyle} />
        </div>
        <div>
          {label("Campaña")}
          <input value={form.campaign} onChange={set("campaign")} style={fieldStyle} />
        </div>
        <div>
          {label("Producto / Servicio")}
          <input value={form.product_type} onChange={set("product_type")} style={fieldStyle} placeholder="BEEF_FROZEN, SOYBEAN…" />
        </div>
        <div>
          {label("Cantidad")}
          <div style={{ display:"flex", gap:8 }}>
            <input value={form.quantity} onChange={set("quantity")} style={{ ...fieldStyle, width:80 }} type="number" placeholder="0" />
            <input value={form.quantity_unit} onChange={set("quantity_unit")} style={{ ...fieldStyle, flex:1 }} placeholder="MT, kg…" />
          </div>
        </div>
        <div>
          {label("Destino")}
          <input value={form.destination} onChange={set("destination")} style={fieldStyle} placeholder="País de destino" />
        </div>
        <div>
          {label("Puerto")}
          <input value={form.port} onChange={set("port")} style={fieldStyle} placeholder="Puerto principal" />
        </div>
      </div>
      <div>
        {label("Notas")}
        <textarea value={form.notes} onChange={set("notes")} style={{ ...fieldStyle, height:72, resize:"vertical" }} />
      </div>
      <button onClick={submit} disabled={saving} style={{
        marginTop:20, background: saving ? "#93c5fd" : "#2563eb", color:"#fff",
        border:"none", borderRadius:8, padding:"10px 24px", cursor: saving ? "default" : "pointer",
        fontFamily:"var(--font-sans)", fontWeight:600, fontSize:14,
      }}>
        {saving ? "Creando…" : "Crear lead"}
      </button>
    </div>
  );
}

// ── Lead Detail ───────────────────────────────────────────────────────────────
function LeadDetailView({ leadId, user, setView, showNotif }) {
  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [activeTab, setActiveTab] = useState("info");
  const [loading, setLoading] = useState(true);
  const [assignForm, setAssignForm] = useState({ agent_username:"", reason:"" });
  const [fcForm, setFcForm] = useState({ contact_channel:"WHATSAPP", contact_at: new Date().toISOString().slice(0,16), contacted_person:"", result:"CONTACTED", summary:"", next_action:"", next_action_at:"" });
  const userLevel = ROLE_LEVEL[user.role] || 0;

  const load = useCallback(() => {
    Promise.all([api.getLead(leadId), api.getLeadTimeline(leadId)])
      .then(([l, tl]) => { setLead(l); setTimeline(Array.isArray(tl) ? tl : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [leadId]);

  useEffect(load, [load]);

  if (loading) return <Spinner />;
  if (!lead) return <div style={{ padding:32, color:"#dc2626" }}>Lead no encontrado.</div>;

  const waDigits = lead.phone_norm ? lead.phone_norm.replace("+", "") : null;
  const isOverdueContact = lead.status === "ASSIGNED" && isOverdue(lead.first_contact_deadline);

  const tabs = [
    { id:"info", label:"Información" },
    { id:"assignment", label:"Asignación" },
    { id:"first-contact", label:"Primer contacto" },
    { id:"timeline", label:"Línea de tiempo" },
  ];

  const tabStyle = (id) => ({
    padding:"8px 16px", cursor:"pointer", fontFamily:"var(--font-sans)", fontSize:13,
    color: activeTab === id ? "#2563eb" : "var(--color-text-secondary)",
    background:"none", border:"none", borderBottom: activeTab === id ? "2px solid #2563eb" : "2px solid transparent",
  });

  const doAssign = async () => {
    if (!assignForm.agent_username) return;
    try {
      await api.assignLead(leadId, assignForm);
      showNotif && showNotif("Lead reasignado", "success");
      load();
    } catch { showNotif && showNotif("Error reasignando", "error"); }
  };

  const doFirstContact = async () => {
    try {
      await api.recordFirstContact(leadId, { ...fcForm, contact_at: new Date(fcForm.contact_at).toISOString() });
      showNotif && showNotif("Primer contacto registrado", "success");
      load();
    } catch { showNotif && showNotif("Error registrando contacto", "error"); }
  };

  return (
    <div style={{ padding:"24px 32px", fontFamily:"var(--font-sans)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
        <button onClick={() => setView("leads-list")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"var(--color-text-secondary)" }}>←</button>
        <h2 style={{ margin:0, color:"var(--color-text-primary)" }}>{lead.glv_code}</h2>
        <Badge label={STATUS_ES[lead.status] || lead.status} color={STATUS_COLORS[lead.status]} />
        {isOverdueContact && <span style={{ background:"#fef2f2", color:"#dc2626", borderRadius:4, padding:"2px 8px", fontSize:12 }}>⚠ Contacto vencido</span>}
        {waDigits && (
          <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" style={{
            marginLeft:"auto", background:"#25d366", color:"#fff", borderRadius:6, padding:"6px 14px",
            textDecoration:"none", fontWeight:600, fontSize:13,
          }}>
            <i className="ti ti-brand-whatsapp" style={{ marginRight:4 }} />WhatsApp
          </a>
        )}
      </div>

      <div style={{ borderBottom:"1px solid var(--color-border-tertiary)", marginBottom:16, display:"flex", gap:0 }}>
        {tabs.map(t => <button key={t.id} style={tabStyle(t.id)} onClick={() => setActiveTab(t.id)}>{t.label}</button>)}
      </div>

      {activeTab === "info" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, maxWidth:640 }}>
          {[
            ["Empresa", lead.company_name],
            ["Contacto", lead.contact_name],
            ["Teléfono", lead.phone_norm || lead.phone_raw],
            ["Canal", CHANNEL_ES[lead.origin_channel]],
            ["País", lead.country_code],
            ["Zona", lead.zone],
            ["Idioma", lead.language],
            ["Producto", lead.product_type],
            ["Cantidad", lead.quantity ? `${lead.quantity} ${lead.quantity_unit || ""}` : null],
            ["Destino", lead.destination],
            ["Puerto", lead.port],
            ["Campaña", lead.campaign],
            ["Ingreso", fmtDate(lead.created_at)],
          ].map(([k, v]) => v ? (
            <div key={k}>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>{k}</div>
              <div style={{ color:"var(--color-text-primary)", marginTop:2 }}>{v}</div>
            </div>
          ) : null)}
        </div>
      )}

      {activeTab === "assignment" && (
        <div style={{ maxWidth:500 }}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", textTransform:"uppercase" }}>Agente asignado</div>
            <div style={{ color:"var(--color-text-primary)", fontSize:16, fontWeight:600, marginTop:4 }}>
              {lead.assigned_agent || <span style={{ color:"#dc2626" }}>Sin asignar</span>}
            </div>
          </div>
          {lead.first_contact_deadline && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", textTransform:"uppercase" }}>Límite primer contacto</div>
              <div style={{ color: isOverdueContact ? "#dc2626" : "var(--color-text-primary)", fontWeight: isOverdueContact ? 700 : 400, marginTop:4 }}>
                {fmtDate(lead.first_contact_deadline)}
              </div>
            </div>
          )}
          {userLevel >= 72 && (
            <div style={{ borderTop:"1px solid var(--color-border-tertiary)", paddingTop:16, marginTop:16 }}>
              <div style={{ fontWeight:600, marginBottom:12 }}>Reasignar lead</div>
              <input placeholder="Username del agente" value={assignForm.agent_username}
                onChange={e => setAssignForm(f => ({ ...f, agent_username: e.target.value }))}
                style={{ width:"100%", border:"1px solid var(--color-border-tertiary)", borderRadius:6, padding:"8px 10px",
                  background:"var(--color-background-secondary)", color:"var(--color-text-primary)", fontFamily:"var(--font-sans)", boxSizing:"border-box" }} />
              <input placeholder="Motivo" value={assignForm.reason}
                onChange={e => setAssignForm(f => ({ ...f, reason: e.target.value }))}
                style={{ width:"100%", border:"1px solid var(--color-border-tertiary)", borderRadius:6, padding:"8px 10px", marginTop:8,
                  background:"var(--color-background-secondary)", color:"var(--color-text-primary)", fontFamily:"var(--font-sans)", boxSizing:"border-box" }} />
              <button onClick={doAssign} style={{ marginTop:10, background:"#7c3aed", color:"#fff", border:"none", borderRadius:6, padding:"8px 18px", cursor:"pointer", fontWeight:600 }}>
                Reasignar
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "first-contact" && (
        <div style={{ maxWidth:560 }}>
          <div style={{ fontWeight:600, marginBottom:14 }}>Registrar primer contacto</div>
          {[
            ["Canal", <select value={fcForm.contact_channel} onChange={e => setFcForm(f => ({...f,contact_channel:e.target.value}))} style={{ border:"1px solid var(--color-border-tertiary)", borderRadius:6, padding:"6px 10px", background:"var(--color-background-secondary)", color:"var(--color-text-primary)" }}>
              {["WHATSAPP","EMAIL","CALL","MEETING","OTHER"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>],
            ["Fecha y hora", <input type="datetime-local" value={fcForm.contact_at} onChange={e => setFcForm(f => ({...f,contact_at:e.target.value}))} style={{ border:"1px solid var(--color-border-tertiary)", borderRadius:6, padding:"6px 10px", background:"var(--color-background-secondary)", color:"var(--color-text-primary)" }} />],
            ["Persona contactada", <input value={fcForm.contacted_person} onChange={e => setFcForm(f => ({...f,contacted_person:e.target.value}))} style={{ width:"100%", border:"1px solid var(--color-border-tertiary)", borderRadius:6, padding:"6px 10px", background:"var(--color-background-secondary)", color:"var(--color-text-primary)", boxSizing:"border-box" }} />],
            ["Resultado", <select value={fcForm.result} onChange={e => setFcForm(f => ({...f,result:e.target.value}))} style={{ border:"1px solid var(--color-border-tertiary)", borderRadius:6, padding:"6px 10px", background:"var(--color-background-secondary)", color:"var(--color-text-primary)" }}>
              {Object.entries(RESULT_ES).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>],
            ["Resumen", <textarea value={fcForm.summary} onChange={e => setFcForm(f => ({...f,summary:e.target.value}))} style={{ width:"100%", border:"1px solid var(--color-border-tertiary)", borderRadius:6, padding:"6px 10px", background:"var(--color-background-secondary)", color:"var(--color-text-primary)", height:64, resize:"vertical", boxSizing:"border-box" }} />],
            ["Próxima acción", <input value={fcForm.next_action} onChange={e => setFcForm(f => ({...f,next_action:e.target.value}))} style={{ width:"100%", border:"1px solid var(--color-border-tertiary)", borderRadius:6, padding:"6px 10px", background:"var(--color-background-secondary)", color:"var(--color-text-primary)", boxSizing:"border-box" }} />],
          ].map(([k,v]) => (
            <div key={k} style={{ marginBottom:10 }}>
              <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:4 }}>{k}</div>
              {v}
            </div>
          ))}
          <button onClick={doFirstContact} style={{ marginTop:8, background:"#2563eb", color:"#fff", border:"none", borderRadius:6, padding:"8px 18px", cursor:"pointer", fontWeight:600 }}>
            Confirmar primer contacto
          </button>
        </div>
      )}

      {activeTab === "timeline" && (
        <div>
          <div style={{ fontWeight:600, marginBottom:14, color:"var(--color-text-primary)" }}>Línea de tiempo</div>
          {timeline.length === 0 && <div style={{ color:"var(--color-text-secondary)" }}>Sin eventos registrados.</div>}
          {timeline.map(ev => (
            <div key={ev.id} style={{ display:"flex", gap:12, marginBottom:14 }}>
              <div style={{ width:2, background:"#e5e7eb", flexShrink:0, position:"relative" }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:"#2563eb", position:"absolute", left:-4, top:4 }} />
              </div>
              <div>
                <div style={{ fontWeight:600, fontSize:13, color:"var(--color-text-primary)" }}>{ev.event_type}</div>
                <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{fmtDate(ev.created_at)} — {ev.actor}</div>
                {ev.description && <div style={{ fontSize:13, marginTop:4, color:"var(--color-text-primary)" }}>{ev.description}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rules Matrix ──────────────────────────────────────────────────────────────
function RulesView({ user, setView, showNotif }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ agent_username:"", country_code:"", zone:"", product_type:"", origin_channel:"", language:"", priority:50 });

  const load = () => {
    api.getLeadRules().then(d => { setRules(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const createRule = async () => {
    if (!form.agent_username) return;
    try {
      await api.createLeadRule(form);
      showNotif && showNotif("Regla creada", "success");
      load();
      setForm({ agent_username:"", country_code:"", zone:"", product_type:"", origin_channel:"", language:"", priority:50 });
    } catch { showNotif && showNotif("Error creando regla", "error"); }
  };

  const deactivate = async (id) => {
    try { await api.deleteLeadRule(id); load(); } catch {}
  };

  const fs = { border:"1px solid var(--color-border-tertiary)", borderRadius:6, padding:"6px 10px",
    background:"var(--color-background-secondary)", color:"var(--color-text-primary)", fontFamily:"var(--font-sans)" };

  return (
    <div style={{ padding:"24px 32px", fontFamily:"var(--font-sans)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={() => setView("leads")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"var(--color-text-secondary)" }}>←</button>
        <h2 style={{ margin:0, color:"var(--color-text-primary)" }}>Matriz de asignación</h2>
      </div>

      <div style={{ background:"var(--color-background-secondary)", border:"1px solid var(--color-border-tertiary)", borderRadius:10, padding:20, marginBottom:24 }}>
        <div style={{ fontWeight:600, marginBottom:12 }}>Nueva regla</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
          {[["agent_username","Agente *"],["country_code","País (ISO)"],["zone","Zona"],["product_type","Producto"],["origin_channel","Canal"],["language","Idioma"]].map(([k,lbl]) => (
            <div key={k}>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>{lbl}</div>
              <input value={form[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))} style={fs} />
            </div>
          ))}
          <div>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>Prioridad</div>
            <input type="number" value={form.priority} onChange={e => setForm(f => ({...f,priority:Number(e.target.value)}))} style={fs} />
          </div>
        </div>
        <button onClick={createRule} style={{ marginTop:14, background:"#059669", color:"#fff", border:"none", borderRadius:6, padding:"8px 18px", cursor:"pointer", fontWeight:600 }}>
          Agregar regla
        </button>
      </div>

      {loading ? <Spinner /> : (
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:"2px solid var(--color-border-tertiary)", color:"var(--color-text-secondary)" }}>
              {["Agente","País","Zona","Producto","Canal","Idioma","Prioridad","Estado",""].map(h => (
                <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontWeight:600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map(r => (
              <tr key={r.id} style={{ borderBottom:"1px solid var(--color-border-tertiary)" }}>
                <td style={{ padding:"8px 10px", fontWeight:600 }}>{r.agent_username}</td>
                <td style={{ padding:"8px 10px" }}>{r.country_code || "*"}</td>
                <td style={{ padding:"8px 10px" }}>{r.zone || "*"}</td>
                <td style={{ padding:"8px 10px" }}>{r.product_type || "*"}</td>
                <td style={{ padding:"8px 10px" }}>{r.origin_channel || "*"}</td>
                <td style={{ padding:"8px 10px" }}>{r.language || "*"}</td>
                <td style={{ padding:"8px 10px" }}>{r.priority}</td>
                <td style={{ padding:"8px 10px" }}>
                  <Badge label={r.is_active ? "Activa" : "Inactiva"} color={r.is_active ? "#059669" : "#6b7280"} />
                </td>
                <td style={{ padding:"8px 10px" }}>
                  {r.is_active && (
                    <button onClick={() => deactivate(r.id)} style={{ background:"none", border:"1px solid #dc2626", color:"#dc2626", borderRadius:4, padding:"2px 8px", cursor:"pointer", fontSize:12 }}>
                      Desactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main LeadIntake component ─────────────────────────────────────────────────
export default function LeadIntake({ user, setView: parentSetView, showNotif }) {
  const [view, setView] = useState("leads");

  const userLevel = ROLE_LEVEL[user?.role] || 0;
  if (userLevel < 42) {
    return <div style={{ padding:32, color:"#dc2626", fontFamily:"var(--font-sans)" }}>Sin acceso.</div>;
  }

  const leadId = view.startsWith("leads-detail:") ? view.split(":")[1] : null;

  return (
    <div>
      {view === "leads"         && <PanelView      user={user} setView={setView} showNotif={showNotif} />}
      {view === "leads-list"    && <LeadListView   user={user} setView={setView} showNotif={showNotif} />}
      {view === "leads-new"     && <NewLeadView    user={user} setView={setView} showNotif={showNotif} />}
      {leadId                   && <LeadDetailView leadId={leadId} user={user} setView={setView} showNotif={showNotif} />}
      {view === "leads-rules" && userLevel >= 75 && <RulesView user={user} setView={setView} showNotif={showNotif} />}
    </div>
  );
}
