import { useState, useEffect } from "react";
import { api } from "../api.js";

const ROLE_LEVEL = {
  SUPER_ADMIN:100,CORPORATE_ADMIN:90,CFO:80,DIRECTOR:75,DIRECTIVO:75,
  COMMERCIAL_MANAGER:72,COMMERCIAL_DIRECTOR:70,COMPLIANCE:65,ACCOUNTING:60,
  TREASURY:60,AUDIT:55,TAX_REVIEWER:50,COUNTRY_ACCOUNTANT:50,LOGISTICS:45,
  COMMERCIAL_AGENT:42,AGENTE:40,MEDIA_MANAGER:35,CLIENT:20,SUPPLIER:20
};
const rl = (role) => ROLE_LEVEL[role] || 0;

const EVIDENCE_COLORS = {
  PENDING:"#d97706",REVIEWED:"#2563eb",APPROVED:"#059669",REJECTED:"#dc2626",ARCHIVED:"#6b7280"
};
const COUNT_COLORS = {
  PENDING:"#d97706",REVIEWED:"#2563eb",CLOSED:"#059669",DISPUTED:"#dc2626"
};

const badge = (color, label) => (
  <span style={{
    background: color + "18", color, border: `1px solid ${color}40`,
    borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap"
  }}>{label}</span>
);

const card = (children, extra = {}) => (
  <div style={{
    background: "var(--color-background-secondary)",
    border: "1px solid var(--color-border-tertiary)",
    borderRadius: 10, padding: 16, marginBottom: 12, ...extra
  }}>{children}</div>
);

export default function VisualEvidence({ user, setView, showNotif }) {
  const level = rl(user.role);
  const isClient = user.role === "CLIENT" || user.role === "SUPPLIER";
  const [subview, setSubview] = useState(isClient ? "mis-evidencias" : "panel");
  const [dashboard, setDashboard] = useState(null);
  const [evidenceList, setEvidenceList] = useState([]);
  const [countEvents, setCountEvents] = useState([]);
  const [zones, setZones] = useState([]);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  // forms
  const [newEvidence, setNewEvidence] = useState({ description: "", visibility: "INTERNAL", source: "MANUAL" });
  const [newCount, setNewCount] = useState({ expected_count: "", actual_count: "", notes: "", count_type: "MANUAL" });
  const [newZone, setNewZone] = useState({ name: "", zone_type: "GENERAL", location: "" });
  const [reviewNote, setReviewNote] = useState("");
  const [reviewStatus, setReviewStatus] = useState("REVIEWED");
  const [explanation, setExplanation] = useState("");
  const [resolveText, setResolveText] = useState("");

  useEffect(() => {
    if (subview === "panel") loadDashboard();
    if (subview === "evidence" || subview === "mis-evidencias") loadEvidence();
    if (subview === "count-events") loadCountEvents();
    if (subview === "zones") loadZones();
    if (subview === "discrepancies") loadDiscrepancies();
  }, [subview]);

  async function loadDashboard() {
    try { const d = await api.getEvidenceDashboard(); setDashboard(d); } catch (_) {}
  }
  async function loadEvidence() {
    try { const d = await api.getEvidenceList(); setEvidenceList(d.evidence || []); } catch (_) {}
  }
  async function loadCountEvents() {
    try { const d = await api.getCountEvents(); setCountEvents(d.count_events || []); } catch (_) {}
  }
  async function loadZones() {
    try { const d = await api.getObservationZones(); setZones(d.zones || []); } catch (_) {}
  }
  async function loadDiscrepancies() {
    try { const d = await api.getDiscrepancies(); setDiscrepancies(d.discrepancies || []); } catch (_) {}
  }

  async function handleCreateEvidence(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createEvidence(newEvidence);
      showNotif("Evidencia creada", "success");
      setSubview("evidence");
      setNewEvidence({ description: "", visibility: "INTERNAL", source: "MANUAL" });
    } catch (err) {
      showNotif(err.message || "Error al crear evidencia", "error");
    } finally { setLoading(false); }
  }

  async function handleCreateCount(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createCountEvent({
        ...newCount,
        expected_count: newCount.expected_count !== "" ? Number(newCount.expected_count) : null,
        actual_count: Number(newCount.actual_count),
      });
      showNotif("Evento de conteo creado", "success");
      setSubview("count-events");
      setNewCount({ expected_count: "", actual_count: "", notes: "", count_type: "MANUAL" });
    } catch (err) {
      showNotif(err.message || "Error al crear conteo", "error");
    } finally { setLoading(false); }
  }

  async function handleCreateZone(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createObservationZone(newZone);
      showNotif("Zona creada", "success");
      loadZones();
      setNewZone({ name: "", zone_type: "GENERAL", location: "" });
    } catch (err) {
      showNotif(err.message || "Error al crear zona", "error");
    } finally { setLoading(false); }
  }

  async function handleReviewEvidence() {
    if (!selected) return;
    setLoading(true);
    try {
      await api.reviewEvidence(selected.id, { status: reviewStatus, review_notes: reviewNote });
      showNotif("Revisión guardada", "success");
      setSubview("evidence");
      setSelected(null);
    } catch (err) {
      showNotif(err.message || "Error", "error");
    } finally { setLoading(false); }
  }

  async function handleReviewCount(approve) {
    if (!selected) return;
    if (!explanation.trim()) { showNotif("Se requiere explicación", "error"); return; }
    setLoading(true);
    try {
      await api.reviewCountEvent(selected.id, { explanation, approved: approve });
      showNotif(approve ? "Conteo aprobado" : "Conteo revisado", "success");
      setSubview("count-events");
      setSelected(null);
    } catch (err) {
      showNotif(err.message || "Error", "error");
    } finally { setLoading(false); }
  }

  async function handleResolveDisc(id) {
    if (!resolveText.trim()) { showNotif("Se requiere resolución", "error"); return; }
    setLoading(true);
    try {
      await api.resolveDiscrepancy(id, { resolution: resolveText });
      showNotif("Discrepancia resuelta", "success");
      setResolveText("");
      loadDiscrepancies();
    } catch (err) {
      showNotif(err.message || "Error", "error");
    } finally { setLoading(false); }
  }

  async function openCountDetail(id) {
    setLoading(true);
    try {
      const d = await api.getCountEvent(id);
      setSelected(d);
      setSubview("count-detail");
    } catch (_) {}
    finally { setLoading(false); }
  }

  async function openEvidenceDetail(id) {
    setLoading(true);
    try {
      const d = await api.getEvidence(id);
      setSelected(d.evidence);
      setSubview("evidence-detail");
    } catch (_) {}
    finally { setLoading(false); }
  }

  const navItems = [
    { id: "panel",          label: "Panel",          icon: "ti-layout-dashboard", minLevel: 40 },
    { id: "evidence",       label: "Evidencias",      icon: "ti-camera",           minLevel: 40 },
    { id: "count-events",   label: "Conteos",         icon: "ti-list-numbers",     minLevel: 40 },
    { id: "discrepancies",  label: "Discrepancias",   icon: "ti-alert-triangle",   minLevel: 40 },
    { id: "zones",          label: "Zonas",           icon: "ti-map-pin",          minLevel: 40 },
    { id: "mis-evidencias", label: "Mis Evidencias",  icon: "ti-eye",              minLevel: 0, clientOnly: true },
  ].filter(n => isClient ? n.clientOnly : !n.clientOnly);

  const inputStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--color-border-tertiary)",
    background: "var(--color-background-primary)", color: "var(--color-text-primary)",
    fontFamily: "var(--font-sans)", fontSize: 13, boxSizing: "border-box"
  };
  const btnPrimary = {
    background: "#2563eb", color: "#fff", border: "none", borderRadius: 6,
    padding: "8px 18px", fontFamily: "var(--font-sans)", fontSize: 13, cursor: "pointer"
  };
  const btnSecondary = {
    background: "transparent", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-tertiary)",
    borderRadius: 6, padding: "8px 14px", fontFamily: "var(--font-sans)", fontSize: 13, cursor: "pointer"
  };

  return (
    <div style={{ display: "flex", gap: 0, minHeight: "calc(100vh - 60px)" }}>
      {/* Sidebar */}
      <div style={{
        width: 190, minWidth: 190, borderRight: "1px solid var(--color-border-tertiary)",
        padding: "12px 8px", display: "flex", flexDirection: "column", gap: 4
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)", padding: "4px 8px 8px", textTransform: "uppercase", letterSpacing: 1 }}>
          Evidencia Visual
        </div>
        {navItems.map(n => (
          <button key={n.id} onClick={() => { setSelected(null); setSubview(n.id); }} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
            borderRadius: 7, border: "none", cursor: "pointer", textAlign: "left",
            background: subview === n.id ? "#2563eb18" : "transparent",
            color: subview === n.id ? "#2563eb" : "var(--color-text-secondary)",
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: subview === n.id ? 600 : 400
          }}>
            <i className={n.icon} style={{ fontSize: 15 }} />
            {n.label}
          </button>
        ))}
        {!isClient && level >= 40 && (
          <>
            <div style={{ borderTop: "1px solid var(--color-border-tertiary)", margin: "8px 0" }} />
            <button onClick={() => setSubview("new-evidence")} style={{ ...btnSecondary, textAlign: "left", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <i className="ti-plus" /> Nueva evidencia
            </button>
            <button onClick={() => setSubview("new-count")} style={{ ...btnSecondary, textAlign: "left", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <i className="ti-plus" /> Nuevo conteo
            </button>
          </>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>

        {/* ── Panel ── */}
        {subview === "panel" && (
          <div>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Panel de Evidencia Visual</h2>
            {dashboard ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Zonas activas", value: dashboard.active_zones, color: "#2563eb", icon: "ti-map-pin" },
                  { label: "Discrepancias abiertas", value: dashboard.open_discrepancies, color: dashboard.open_discrepancies > 0 ? "#dc2626" : "#059669", icon: "ti-alert-triangle" },
                ].map((s, i) => (
                  <div key={i} style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <i className={s.icon} style={{ color: s.color, fontSize: 18 }} />
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            ) : <div style={{ color: "var(--color-text-secondary)" }}>Cargando…</div>}
            {dashboard?.evidence_by_status?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>Evidencias por estado</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {dashboard.evidence_by_status.map(s => (
                    <div key={s.status} style={{ ...{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 8, padding: "8px 14px" } }}>
                      {badge(EVIDENCE_COLORS[s.status] || "#6b7280", s.status)} <span style={{ marginLeft: 6, fontWeight: 700 }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Evidence list ── */}
        {(subview === "evidence" || subview === "mis-evidencias") && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {isClient ? "Mis Evidencias" : "Evidencias Visuales"}
              </h2>
              {!isClient && level >= 40 && (
                <button onClick={() => setSubview("new-evidence")} style={btnPrimary}>
                  <i className="ti-plus" style={{ marginRight: 6 }} />Nueva
                </button>
              )}
            </div>
            {evidenceList.length === 0
              ? <div style={{ color: "var(--color-text-secondary)" }}>Sin evidencias registradas.</div>
              : evidenceList.map(ev => (
                card(
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{ev.evidence_number}</span>
                        {badge(EVIDENCE_COLORS[ev.status] || "#6b7280", ev.status)}
                        {ev.visibility === "CLIENT_VISIBLE" && badge("#059669", "Cliente")}
                        {ev.source === "AI_DETECTOR" && badge("#7c3aed", "IA — Pendiente revisión humana")}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                        {ev.description || "Sin descripción"} · {ev.submitted_by} · {ev.created_at?.slice(0,10)}
                      </div>
                    </div>
                    {!isClient && level >= 55 && ev.status === "PENDING" && (
                      <button onClick={() => { setSelected(ev); setSubview("evidence-detail"); }} style={btnSecondary}>
                        <i className="ti-eye" style={{ marginRight: 4 }} />Revisar
                      </button>
                    )}
                  </div>, {}
                )
              ))
            }
          </div>
        )}

        {/* ── New Evidence form ── */}
        {subview === "new-evidence" && !isClient && (
          <div style={{ maxWidth: 520 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Nueva Evidencia Visual</h2>
            <form onSubmit={handleCreateEvidence}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Descripción</label>
                <textarea value={newEvidence.description} onChange={e => setNewEvidence(p => ({ ...p, description: e.target.value }))}
                  style={{ ...inputStyle, height: 80, resize: "vertical" }} placeholder="Descripción de la evidencia…" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Fuente</label>
                <select value={newEvidence.source} onChange={e => setNewEvidence(p => ({ ...p, source: e.target.value }))} style={inputStyle}>
                  <option value="MANUAL">Manual</option>
                  <option value="CAMERA">Cámara</option>
                  <option value="AI_DETECTOR">Detector IA</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Visibilidad</label>
                <select value={newEvidence.visibility} onChange={e => setNewEvidence(p => ({ ...p, visibility: e.target.value }))} style={inputStyle}>
                  <option value="INTERNAL">Interna</option>
                  <option value="CLIENT_VISIBLE">Visible al cliente</option>
                </select>
              </div>
              {newEvidence.source === "AI_DETECTOR" && (
                <div style={{ background: "#7c3aed18", border: "1px solid #7c3aed40", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#7c3aed" }}>
                  <i className="ti-alert-triangle" style={{ marginRight: 6 }} />
                  Evidencia de IA requiere revisión humana. No puede ser aprobada automáticamente.
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" style={btnPrimary} disabled={loading}>Crear</button>
                <button type="button" onClick={() => setSubview("evidence")} style={btnSecondary}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* ── Evidence detail / review ── */}
        {subview === "evidence-detail" && selected && (
          <div style={{ maxWidth: 560 }}>
            <button onClick={() => { setSelected(null); setSubview("evidence"); }} style={{ ...btnSecondary, marginBottom: 16 }}>
              <i className="ti-arrow-left" style={{ marginRight: 6 }} />Volver
            </button>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>{selected.evidence_number}</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {badge(EVIDENCE_COLORS[selected.status] || "#6b7280", selected.status)}
              {selected.source === "AI_DETECTOR" && badge("#7c3aed", "IA — Pendiente revisión humana")}
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>
              <div><b>Descripción:</b> {selected.description || "—"}</div>
              <div><b>Fuente:</b> {selected.source}</div>
              <div><b>Visibilidad:</b> {selected.visibility}</div>
              <div><b>Creado por:</b> {selected.submitted_by} el {selected.created_at?.slice(0,10)}</div>
              {selected.reviewed_by && <div><b>Revisado por:</b> {selected.reviewed_by} el {selected.reviewed_at?.slice(0,10)}</div>}
              {selected.review_notes && <div><b>Notas:</b> {selected.review_notes}</div>}
            </div>
            {level >= 55 && selected.status === "PENDING" && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Acción de revisión</div>
                <select value={reviewStatus} onChange={e => setReviewStatus(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
                  <option value="REVIEWED">Revisado</option>
                  {level >= 65 && <option value="APPROVED">Aprobado como Inspector/Veterinario</option>}
                  <option value="REJECTED">Rechazado</option>
                </select>
                <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Notas de revisión…"
                  style={{ ...inputStyle, height: 72, resize: "vertical", marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={handleReviewEvidence} style={btnPrimary} disabled={loading}>Guardar revisión</button>
                  <button onClick={() => { setSelected(null); setSubview("evidence"); }} style={btnSecondary}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Count Events list ── */}
        {subview === "count-events" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Eventos de Conteo</h2>
              {!isClient && level >= 40 && (
                <button onClick={() => setSubview("new-count")} style={btnPrimary}>
                  <i className="ti-plus" style={{ marginRight: 6 }} />Nuevo
                </button>
              )}
            </div>
            {countEvents.length === 0
              ? <div style={{ color: "var(--color-text-secondary)" }}>Sin eventos de conteo.</div>
              : countEvents.map(ev => (
                card(
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{ev.event_number}</span>
                        {badge(COUNT_COLORS[ev.status] || "#6b7280", ev.status)}
                        {ev.requires_review === 1 && badge("#dc2626", "Requiere revisión")}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                        Esperado: {ev.expected_count ?? "—"} · Real: {ev.actual_count} · Dif: {ev.difference ?? 0}
                        {" · "}{ev.created_by} · {ev.created_at?.slice(0,10)}
                      </div>
                    </div>
                    <button onClick={() => openCountDetail(ev.id)} style={btnSecondary}>
                      <i className="ti-eye" style={{ marginRight: 4 }} />Ver
                    </button>
                  </div>, {}
                )
              ))
            }
          </div>
        )}

        {/* ── New Count form ── */}
        {subview === "new-count" && !isClient && (
          <div style={{ maxWidth: 520 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Nuevo Evento de Conteo</h2>
            <form onSubmit={handleCreateCount}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Cantidad esperada</label>
                  <input type="number" value={newCount.expected_count} onChange={e => setNewCount(p => ({ ...p, expected_count: e.target.value }))} style={inputStyle} placeholder="Opcional" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Cantidad real *</label>
                  <input type="number" required value={newCount.actual_count} onChange={e => setNewCount(p => ({ ...p, actual_count: e.target.value }))} style={inputStyle} placeholder="Conteo real" />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Tipo de conteo</label>
                <select value={newCount.count_type} onChange={e => setNewCount(p => ({ ...p, count_type: e.target.value }))} style={inputStyle}>
                  <option value="MANUAL">Manual</option>
                  <option value="CAMERA_ASSISTED">Con apoyo de cámara</option>
                  <option value="AI_ASSISTED">Asistido por IA</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Notas</label>
                <textarea value={newCount.notes} onChange={e => setNewCount(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, height: 64, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" style={btnPrimary} disabled={loading}>Crear</button>
                <button type="button" onClick={() => setSubview("count-events")} style={btnSecondary}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* ── Count detail ── */}
        {subview === "count-detail" && selected && (
          <div style={{ maxWidth: 600 }}>
            <button onClick={() => { setSelected(null); setSubview("count-events"); }} style={{ ...btnSecondary, marginBottom: 16 }}>
              <i className="ti-arrow-left" style={{ marginRight: 6 }} />Volver
            </button>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>{selected.count_event?.event_number}</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {badge(COUNT_COLORS[selected.count_event?.status] || "#6b7280", selected.count_event?.status)}
              {selected.count_event?.requires_review === 1 && badge("#dc2626", "Requiere revisión")}
            </div>

            {/* Discrepancy banner */}
            {selected.discrepancies?.length > 0 && (
              <div style={{ background: "#dc262618", border: "2px solid #dc2626", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <i className="ti-alert-triangle" />Discrepancia detectada
                </div>
                {selected.discrepancies.map(d => (
                  <div key={d.id} style={{ fontSize: 13, marginBottom: 4 }}>
                    Diferencia: <b>{d.difference}</b> · Severidad: {badge(d.severity === "HIGH" ? "#dc2626" : d.severity === "MEDIUM" ? "#d97706" : "#6b7280", d.severity)} · {d.status}
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>
              <div><b>Esperado:</b> {selected.count_event?.expected_count ?? "—"}</div>
              <div><b>Real:</b> {selected.count_event?.actual_count}</div>
              <div><b>Diferencia:</b> {selected.count_event?.difference ?? 0}</div>
              <div><b>Tipo:</b> {selected.count_event?.count_type}</div>
              <div><b>Creado por:</b> {selected.count_event?.created_by} el {selected.count_event?.created_at?.slice(0,10)}</div>
              {selected.count_event?.notes && <div><b>Notas:</b> {selected.count_event.notes}</div>}
            </div>

            {selected.linked_evidence?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Evidencias vinculadas</div>
                {selected.linked_evidence.map(l => (
                  <div key={l.id} style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
                    <i className="ti-camera" style={{ color: "#2563eb" }} />
                    {l.evidence_number} {badge(EVIDENCE_COLORS[l.ev_status] || "#6b7280", l.ev_status)}
                    <span style={{ color: "var(--color-text-secondary)" }}>{l.source}</span>
                  </div>
                ))}
              </div>
            )}

            {level >= 55 && selected.count_event?.status === "PENDING" && !isClient && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Revisión del conteo</div>
                <textarea value={explanation} onChange={e => setExplanation(e.target.value)}
                  placeholder="Explicación obligatoria…"
                  style={{ ...inputStyle, height: 72, resize: "vertical", marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => handleReviewCount(false)} style={btnSecondary} disabled={loading}>
                    <i className="ti-check" style={{ marginRight: 4 }} />Marcar revisado
                  </button>
                  {level >= 65 && (
                    <button onClick={() => handleReviewCount(true)} style={btnPrimary} disabled={loading}>
                      <i className="ti-check" style={{ marginRight: 4 }} />Aprobar como Inspector/Veterinario
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Zones ── */}
        {subview === "zones" && (
          <div>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Zonas de Observación</h2>
            {level >= 40 && !isClient && (
              <form onSubmit={handleCreateZone} style={{ maxWidth: 520, marginBottom: 24 }}>
                {card(
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>Nueva Zona</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <input required placeholder="Nombre *" value={newZone.name} onChange={e => setNewZone(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
                      <input placeholder="Ubicación" value={newZone.location} onChange={e => setNewZone(p => ({ ...p, location: e.target.value }))} style={inputStyle} />
                    </div>
                    <select value={newZone.zone_type} onChange={e => setNewZone(p => ({ ...p, zone_type: e.target.value }))} style={{ ...inputStyle, marginBottom: 10 }}>
                      {["GENERAL","LOADING","UNLOADING","STORAGE","INSPECTION","QUARANTINE"].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button type="submit" style={btnPrimary} disabled={loading}>Crear zona</button>
                  </div>
                )}
              </form>
            )}
            {zones.length === 0
              ? <div style={{ color: "var(--color-text-secondary)" }}>Sin zonas registradas.</div>
              : zones.map(z => (
                card(
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{z.name}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                        {z.zone_type} {z.location ? `· ${z.location}` : ""} · {z.status}
                      </div>
                    </div>
                    {badge(z.status === "ACTIVE" ? "#059669" : "#6b7280", z.status)}
                  </div>, {}
                )
              ))
            }
          </div>
        )}

        {/* ── Discrepancies ── */}
        {subview === "discrepancies" && (
          <div>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Discrepancias de Conteo</h2>
            {discrepancies.length === 0
              ? <div style={{ color: "var(--color-text-secondary)" }}>Sin discrepancias.</div>
              : discrepancies.map(d => (
                card(
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{d.event_number}</span>
                      {badge(d.severity === "HIGH" ? "#dc2626" : d.severity === "MEDIUM" ? "#d97706" : "#6b7280", d.severity)}
                      {badge(d.status === "OPEN" ? "#dc2626" : d.status === "RESOLVED" ? "#059669" : "#2563eb", d.status)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>
                      Diferencia: <b>{d.difference}</b> · Creado: {d.created_at?.slice(0,10)}
                      {d.resolution && <span> · Resolución: {d.resolution}</span>}
                    </div>
                    {level >= 55 && d.status === "OPEN" && !isClient && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input value={resolveText} onChange={e => setResolveText(e.target.value)} placeholder="Resolución…" style={{ ...inputStyle, width: 280 }} />
                        <button onClick={() => handleResolveDisc(d.id)} style={btnPrimary} disabled={loading}>Resolver</button>
                      </div>
                    )}
                  </div>, {}
                )
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
