import { useState, useEffect, useCallback } from "react";
import { api } from "../api.js";

// ─── Status config ────────────────────────────────────────────────────────────
const KYC_STATUS_CONFIG = {
  PRE_REGISTRATION:    { label: "Pre-Registro",       bg: "#fef3c7", text: "#92400e", border: "#fbbf24" },
  UNDER_REVIEW:        { label: "En Revisión",        bg: "#dbeafe", text: "#1e40af", border: "#60a5fa" },
  COMPLIANCE_APPROVED: { label: "Aprobado Complian.", bg: "#cffafe", text: "#155e75", border: "#22d3ee" },
  COMMERCIAL_APPROVED: { label: "Aprobado Comerc.",   bg: "#d1fae5", text: "#065f46", border: "#34d399" },
  ACTIVE_CLIENT:       { label: "Cliente Activo",     bg: "#dcfce7", text: "#14532d", border: "#22c55e" },
  REJECTED:            { label: "Rechazado",          bg: "#fee2e2", text: "#991b1b", border: "#f87171" },
};

const LEAD_STATUS_CONFIG = {
  UNASSIGNED: { label: "Sin Asignar", bg: "#f3f4f6", text: "#6b7280" },
  ASSIGNED:   { label: "Asignado",    bg: "#ede9fe", text: "#5b21b6" },
  CONTACTED:  { label: "Contactado",  bg: "#fef3c7", text: "#92400e" },
  QUALIFIED:  { label: "Calificado",  bg: "#dcfce7", text: "#14532d" },
  ARCHIVED:   { label: "Archivado",   bg: "#f3f4f6", text: "#374151", border: "#9ca3af" },
};

const LIFECYCLE_CONFIG = {
  ACTIVE:    { label: "Activo",     bg: "#dcfce7", text: "#14532d", border: "#22c55e" },
  ARCHIVED:  { label: "Archivado",  bg: "#f3f4f6", text: "#374151", border: "#9ca3af" },
  ON_HOLD:   { label: "Suspendido", bg: "#fef3c7", text: "#92400e", border: "#fbbf24" },
  DUPLICATE: { label: "Duplicado",  bg: "#fee2e2", text: "#991b1b", border: "#f87171" },
};

const KYC_FLOW = [
  "PRE_REGISTRATION",
  "UNDER_REVIEW",
  "COMPLIANCE_APPROVED",
  "COMMERCIAL_APPROVED",
  "ACTIVE_CLIENT",
];

// Roles that can permanently delete (SUPER_ADMIN=100 only)
const SUPER_ADMIN_ONLY = new Set(["SUPER_ADMIN"]);
// Roles that can do lifecycle transitions (DIRECTOR+=75)
const DIRECTOR_ROLES = new Set(["SUPER_ADMIN", "CORPORATE_ADMIN", "DIRECTOR", "DIRECTIVO", "CFO", "COMMERCIAL_DIRECTOR"]);

function StatusBadge({ status, map }) {
  const cfg = map[status] || { label: status, bg: "#f3f4f6", text: "#6b7280" };
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: cfg.bg, color: cfg.text,
      border: `1px solid ${cfg.border || cfg.bg}`,
      whiteSpace: "nowrap",
    }}>{cfg.label}</span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function GosLeadsPanel({ user, showNotif }) {
  const [leads, setLeads]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [kycFilter, setKycFilter]       = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [agentFilter, setAgentFilter]   = useState("");
  const [agents, setAgents]             = useState([]);
  const [selected, setSelected]         = useState(null);
  const [kycDetail, setKycDetail]       = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [editMode, setEditMode]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [statusChanging, setStatusChanging]       = useState(false);
  const [lifecycleChanging, setLifecycleChanging] = useState(false);
  const [lifecycleHistory, setLifecycleHistory]   = useState(null);
  const [activeTab, setActiveTab]                 = useState("empresa");

  // ── Load leads ──────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (kycFilter)   params.kyc_status = kycFilter;
    if (agentFilter) params.assigned_agent = agentFilter;
    api.getLeads(params)
      .then(setLeads)
      .catch(e => showNotif(e.message, "error"))
      .finally(() => setLoading(false));
  }, [kycFilter, agentFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load agent list ─────────────────────────────────────────────────────────
  useEffect(() => {
    api.adminGetUsers()
      .then(users => setAgents(users.filter(u =>
        ["AGENTE","COMMERCIAL_DIRECTOR","DIRECTOR","DIRECTIVO"].includes(u.role) && u.active
      )))
      .catch(() => {});
  }, []);

  // ── Open modal ──────────────────────────────────────────────────────────────
  const openLead = (lead) => {
    setSelected(lead);
    setKycDetail(null);
    setEditMode(false);
    setActiveTab("empresa");
    setLifecycleHistory(null);
    setModalLoading(true);
    api.getClientKycData(lead.id)
      .then(setKycDetail)
      .catch(e => showNotif(e.message, "error"))
      .finally(() => setModalLoading(false));
  };

  const closeModal = () => { setSelected(null); setKycDetail(null); setEditMode(false); setLifecycleHistory(null); };

  // ── Update KYC status ───────────────────────────────────────────────────────
  const changeStatus = async (kyc_status, lead_status) => {
    if (!selected) return;
    setStatusChanging(true);
    try {
      const updated = await api.updateKycStatus(selected.id, {
        kyc_status,
        ...(lead_status ? { lead_status } : {}),
      });
      showNotif(`Estado actualizado: ${KYC_STATUS_CONFIG[kyc_status]?.label || kyc_status}`);
      setSelected(prev => ({ ...prev, kyc_status: updated.kyc_status, lead_status: updated.lead_status }));
      setLeads(prev => prev.map(l => l.id === updated.id
        ? { ...l, kyc_status: updated.kyc_status, lead_status: updated.lead_status }
        : l
      ));
      if (kyc_status === "ACTIVE_CLIENT") { closeModal(); load(); }
    } catch (e) {
      showNotif(e.message, "error");
    } finally {
      setStatusChanging(false);
    }
  };

  // ── Assign agent ────────────────────────────────────────────────────────────
  const assignAgent = async (agentId) => {
    if (!selected) return;
    try {
      const updated = await api.updateKycStatus(selected.id, {
        assigned_agent: agentId || null,
        ...(selected.kyc_status === "PRE_REGISTRATION" ? { kyc_status: "UNDER_REVIEW" } : {}),
      });
      showNotif("Agente asignado");
      setSelected(prev => ({ ...prev, assigned_agent: updated.assigned_agent, kyc_status: updated.kyc_status }));
      load();
    } catch (e) {
      showNotif(e.message, "error");
    }
  };

  // ── Save notes ──────────────────────────────────────────────────────────────
  const saveNotes = async (notes) => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.updateKycStatus(selected.id, { onboarding_notes: notes });
      showNotif("Notas guardadas");
      setEditMode(false);
      setKycDetail(prev => prev ? { ...prev, client: { ...prev.client, onboarding_notes: notes } } : prev);
    } catch (e) {
      showNotif(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Lifecycle transitions ───────────────────────────────────────────────────
  const updateLifecycle = async (action, extraData = {}) => {
    if (!selected) return;
    const ACTION_LABELS = { ARCHIVE: "Archivar", ON_HOLD: "Suspender", DUPLICATE: "Marcar Duplicado", REACTIVATE: "Reactivar" };
    const confirm_msg = {
      ARCHIVE:    `¿Archivar el ciclo de vida de ${selected.glv_code}? El registro no se eliminará pero quedará inactivo.`,
      ON_HOLD:    `¿Suspender (ON HOLD) a ${selected.glv_code}? Se marcará en espera.`,
      DUPLICATE:  `¿Marcar ${selected.glv_code} como duplicado del registro ID ${extraData.duplicate_of}?`,
      REACTIVATE: `¿Reactivar ${selected.glv_code}? El ciclo de vida volverá a ACTIVO.`,
    };
    if (!window.confirm(confirm_msg[action])) return;

    let reason = null;
    if (action === "ON_HOLD" || action === "ARCHIVE") {
      reason = window.prompt("Motivo (opcional):") || null;
    }

    setLifecycleChanging(true);
    try {
      const updated = await api.updateLifecycle(selected.id, { action, reason, ...extraData });
      showNotif(`${ACTION_LABELS[action]}: ciclo de vida actualizado`);
      setSelected(prev => ({ ...prev, lifecycle_status: updated.lifecycle_status, lifecycle_reason: updated.lifecycle_reason }));
      setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, lifecycle_status: updated.lifecycle_status } : l));
      setLifecycleHistory(null);
    } catch (e) {
      showNotif(e.message, "error");
    } finally {
      setLifecycleChanging(false);
    }
  };

  const markDuplicate = async () => {
    if (!selected) return;
    const raw = window.prompt(`Ingrese el ID numérico del registro canónico (del cual ${selected.glv_code} es duplicado):`);
    if (!raw) return;
    const dup_id = parseInt(raw, 10);
    if (!dup_id || isNaN(dup_id)) { showNotif("ID inválido", "error"); return; }
    await updateLifecycle("DUPLICATE", { duplicate_of: dup_id });
  };

  const loadLifecycleHistory = async () => {
    if (!selected) return;
    try {
      const data = await api.getLifecycleHistory(selected.id);
      setLifecycleHistory(data);
    } catch (e) {
      showNotif(e.message, "error");
    }
  };

  // ── Permanent delete (SUPER_ADMIN only) ────────────────────────────────────
  const permanentDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`⚠ ELIMINACIÓN PERMANENTE\n\nEsta acción NO se puede deshacer.\nSe eliminará el lead ${selected.glv_code} y todos sus submissions.\n\n¿Confirmar eliminación permanente?`)) return;
    const confirm2 = window.prompt(`Para confirmar, escriba el GLV code exacto: ${selected.glv_code}`);
    if (confirm2 !== selected.glv_code) { showNotif("Confirmación incorrecta. Eliminación cancelada.", "error"); return; }
    try {
      await api.deleteLead(selected.id);
      showNotif(`Lead ${selected.glv_code} eliminado permanentemente`);
      closeModal();
      load();
    } catch (e) {
      showNotif(e.message, "error");
    }
  };

  // ── Archive client ──────────────────────────────────────────────────────────
  const archiveClient = async () => {
    if (!selected) return;
    if (!window.confirm(`¿Archivar cliente ${selected.glv_code}? Se marcará como inactivo pero no se eliminará.`)) return;
    try {
      await api.archiveClient(selected.id);
      showNotif("Cliente archivado");
      closeModal();
      load();
    } catch (e) {
      showNotif(e.message, "error");
    }
  };

  // ── Delete lead ─────────────────────────────────────────────────────────────
  const deleteLead = async () => {
    if (!selected) return;
    if (selected.kyc_status === "ACTIVE_CLIENT") {
      showNotif("No se puede eliminar un cliente activo. Use la función de archivar.", "error");
      return;
    }
    if (!window.confirm(`¿ELIMINAR PERMANENTEMENTE el lead ${selected.glv_code}?\n\nEsta acción no se puede deshacer. El registro y sus submissions serán eliminados del sistema.`)) return;
    try {
      await api.deleteLead(selected.id);
      showNotif(`Lead ${selected.glv_code} eliminado`);
      closeModal();
      load();
    } catch (e) {
      showNotif(e.message, "error");
    }
  };

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = leads.filter(l => {
    if (countryFilter && !l.country?.toLowerCase().includes(countryFilter.toLowerCase())) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.company        || "").toLowerCase().includes(q)
        || (l.name           || "").toLowerCase().includes(q)
        || (l.representative || "").toLowerCase().includes(q)
        || (l.glv_code       || "").toLowerCase().includes(q)
        || (l.email          || "").toLowerCase().includes(q)
        || (l.country        || "").toLowerCase().includes(q);
  });

  const countByStatus = (s) => leads.filter(l => l.kyc_status === s).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>GOS Leads — KYC Pipeline</h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>
            {leads.length} leads registrados · {countByStatus("PRE_REGISTRATION")} pendientes · {countByStatus("ACTIVE_CLIENT")} activados
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, cursor: "pointer", color: "var(--color-text-primary)" }}>
          <i className={`ti ti-refresh${loading ? " ti-spin" : ""}`} style={{ fontSize: 15 }} />Actualizar
        </button>
      </div>

      {/* Status pills summary */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {Object.entries(KYC_STATUS_CONFIG).map(([k, v]) => (
          <button key={k} onClick={() => setKycFilter(kycFilter === k ? "" : k)}
            style={{ padding: "4px 12px", borderRadius: 20,
              border: `1px solid ${kycFilter === k ? v.border || v.bg : "var(--color-border-secondary)"}`,
              background: kycFilter === k ? v.bg : "var(--color-background-primary)",
              color: kycFilter === k ? v.text : "var(--color-text-secondary)",
              fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
            {v.label} ({countByStatus(k)})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar empresa, representante, GLV code, email..."
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, width: 310, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }} />
        <input value={countryFilter} onChange={e => setCountryFilter(e.target.value)} placeholder="Filtrar por país..."
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, width: 180, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }} />
        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: "pointer" }}>
          <option value="">Todos los agentes</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {(kycFilter || countryFilter || agentFilter || search) && (
          <button onClick={() => { setKycFilter(""); setCountryFilter(""); setAgentFilter(""); setSearch(""); }}
            style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-secondary)", cursor: "pointer" }}>
            <i className="ti ti-x" style={{ fontSize: 13 }} /> Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)" }}>
          <i className="ti ti-loader ti-spin" style={{ fontSize: 28, display: "block", marginBottom: 8 }} />Cargando leads...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-text-secondary)" }}>
          <i className="ti ti-users-group" style={{ fontSize: 48, display: "block", marginBottom: 12, opacity: 0.3 }} />
          <p style={{ margin: 0 }}>No se encontraron leads con los filtros seleccionados.</p>
        </div>
      ) : (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["GLV Code","Empresa","Representante","País","Lead Status","KYC Status","Ciclo Vida","Agente","Fecha",""].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, i) => (
                <tr key={lead.id} style={{ borderTop: i > 0 ? "0.5px solid var(--color-border-tertiary)" : "none" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                    <code style={{ fontSize: 11, background: "#f3f4f6", padding: "2px 6px", borderRadius: 4, color: "#374151" }}>{lead.glv_code || "—"}</code>
                  </td>
                  {/* Empresa: clients.company (razón social), fallback to clients.name (commercial) */}
                  <td style={{ padding: "10px 12px" }}>
                    <p style={{ margin: 0, fontWeight: 500, color: "var(--color-text-primary)" }}>{lead.company || lead.name}</p>
                    {lead.company && lead.name && lead.company !== lead.name && (
                      <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)" }}>{lead.name}</p>
                    )}
                  </td>
                  {/* Representante: clients.representative */}
                  <td style={{ padding: "10px 12px", color: "var(--color-text-secondary)" }}>{lead.representative || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "var(--color-text-secondary)" }}>{lead.country || "—"}</td>
                  <td style={{ padding: "10px 12px" }}><StatusBadge status={lead.lead_status} map={LEAD_STATUS_CONFIG} /></td>
                  <td style={{ padding: "10px 12px" }}><StatusBadge status={lead.kyc_status} map={KYC_STATUS_CONFIG} /></td>
                  <td style={{ padding: "10px 12px" }}><StatusBadge status={lead.lifecycle_status || "ACTIVE"} map={LIFECYCLE_CONFIG} /></td>
                  <td style={{ padding: "10px 12px", color: "var(--color-text-secondary)", fontSize: 12 }}>{lead.assigned_agent_name || <span style={{ opacity: 0.4 }}>Sin asignar</span>}</td>
                  <td style={{ padding: "10px 12px", color: "var(--color-text-secondary)", fontSize: 11, whiteSpace: "nowrap" }}>
                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString("es") : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button onClick={() => openLead(lead)}
                      style={{ padding: "5px 12px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                      Revisar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* KYC Detail Modal */}
      {selected && (
        <KycModal
          lead={selected}
          detail={kycDetail}
          loading={modalLoading}
          agents={agents}
          editMode={editMode}
          saving={saving}
          statusChanging={statusChanging}
          lifecycleChanging={lifecycleChanging}
          lifecycleHistory={lifecycleHistory}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onClose={closeModal}
          onChangeStatus={changeStatus}
          onAssignAgent={assignAgent}
          onSaveNotes={saveNotes}
          onArchive={archiveClient}
          onDelete={deleteLead}
          onUpdateLifecycle={updateLifecycle}
          onMarkDuplicate={markDuplicate}
          onPermanentDelete={permanentDelete}
          onLoadLifecycleHistory={loadLifecycleHistory}
          onToggleEdit={() => setEditMode(e => !e)}
          user={user}
        />
      )}
    </div>
  );
}

// ─── KYC Modal ────────────────────────────────────────────────────────────────
function KycModal({ lead, detail, loading, agents, editMode, saving, statusChanging, lifecycleChanging, lifecycleHistory, activeTab, setActiveTab, onClose, onChangeStatus, onAssignAgent, onSaveNotes, onArchive, onDelete, onUpdateLifecycle, onMarkDuplicate, onPermanentDelete, onLoadLifecycleHistory, onToggleEdit, user }) {
  const client  = detail?.client  || {};
  const kd      = client.kyc_data || {};
  const [notes, setNotes]               = useState("");
  const [selectedAgent, setSelectedAgent] = useState(lead.assigned_agent || "");

  useEffect(() => { setNotes(client.onboarding_notes || ""); }, [client.onboarding_notes]);
  useEffect(() => { setSelectedAgent(lead.assigned_agent || ""); }, [lead.assigned_agent]);

  const currentStatus = lead.kyc_status;
  const currentIdx    = KYC_FLOW.indexOf(currentStatus);

  const isSuperAdmin = SUPER_ADMIN_ONLY.has(user?.role);
  const isDirector   = DIRECTOR_ROLES.has(user?.role);
  const lcStatus     = lead.lifecycle_status || "ACTIVE";

  const tabs = [
    { id: "empresa",     label: "Empresa",          icon: "ti-building" },
    { id: "rep",         label: "Representante",    icon: "ti-user" },
    { id: "comercial",   label: "Perfil Comercial",  icon: "ti-briefcase" },
    { id: "refs",        label: "Referencias",       icon: "ti-award" },
    { id: "compliance",  label: "Compliance",        icon: "ti-shield-check" },
    { id: "ciclo-vida",  label: "Ciclo de Vida",     icon: "ti-refresh" },
    { id: "auditoria",   label: "Auditoría",         icon: "ti-history" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem 1rem", overflowY: "auto" }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 16, width: "100%", maxWidth: 800, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>

        {/* Modal header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <code style={{ fontSize: 12, background: "#f3f4f6", padding: "2px 8px", borderRadius: 6, color: "#374151", fontWeight: 600 }}>{lead.glv_code || "—"}</code>
              <StatusBadge status={lead.kyc_status} map={KYC_STATUS_CONFIG} />
              <StatusBadge status={lead.lead_status} map={LEAD_STATUS_CONFIG} />
              {lcStatus !== "ACTIVE" && <StatusBadge status={lcStatus} map={LIFECYCLE_CONFIG} />}
            </div>
            {/* Empresa: company (razón social) > name (comercial) */}
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 2px" }}>
              {client.company || lead.company || lead.name}
            </h2>
            {(client.company || lead.company) && (client.name || lead.name) &&
             (client.company || lead.company) !== (client.name || lead.name) && (
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>
                {client.name || lead.name}
              </p>
            )}
            {/* Representante: always from clients.representative */}
            {(client.representative || lead.representative) && (
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 5 }}>
                <i className="ti ti-user" style={{ fontSize: 12 }} />
                {client.representative || lead.representative}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 20, padding: 4 }}>
            <i className="ti ti-x" />
          </button>
        </div>

        {/* KYC Flow progress bar */}
        <div style={{ padding: "12px 1.5rem", background: "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
          {KYC_FLOW.map((s, i) => {
            const cfg  = KYC_STATUS_CONFIG[s];
            const done   = currentIdx > i;
            const active = currentIdx === i;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", flex: i < KYC_FLOW.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
                    background: active ? cfg.bg : done ? "#dcfce7" : "var(--color-background-primary)",
                    color: active ? cfg.text : done ? "#14532d" : "var(--color-text-secondary)",
                    border: `2px solid ${active ? cfg.border || cfg.bg : done ? "#22c55e" : "var(--color-border-secondary)"}`,
                  }}>
                    {done ? <i className="ti ti-check" style={{ fontSize: 12 }} /> : i + 1}
                  </div>
                  <span style={{ fontSize: 9, color: active ? cfg.text : "var(--color-text-secondary)", fontWeight: active ? 600 : 400, textAlign: "center", maxWidth: 70, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cfg.label}</span>
                </div>
                {i < KYC_FLOW.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: done ? "#22c55e" : "var(--color-border-secondary)", margin: "0 4px", marginTop: -16 }} />
                )}
              </div>
            );
          })}
          {currentStatus === "REJECTED" && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fee2e2", border: "2px solid #f87171" }}>
                <i className="ti ti-x" style={{ fontSize: 12, color: "#991b1b" }} />
              </div>
              <span style={{ fontSize: 9, color: "#991b1b", fontWeight: 600 }}>Rechazado</span>
            </div>
          )}
        </div>

        {/* Assign Agent + workflow action buttons */}
        <div style={{ padding: "12px 1.5rem", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <i className="ti ti-user-check" style={{ fontSize: 16, color: "var(--color-text-secondary)" }} />
            <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
              style={{ padding: "6px 10px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 7, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: "pointer" }}>
              <option value="">Sin agente asignado</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
            </select>
            <button onClick={() => onAssignAgent(selectedAgent ? parseInt(selectedAgent) : null)} disabled={statusChanging}
              style={{ padding: "6px 14px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
              Asignar
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {currentStatus === "PRE_REGISTRATION" && (
              <ActionBtn onClick={() => onChangeStatus("UNDER_REVIEW")} disabled={statusChanging} color="#2563eb" icon="ti-eye">En Revisión</ActionBtn>
            )}
            {currentStatus === "UNDER_REVIEW" && (
              <ActionBtn onClick={() => onChangeStatus("COMPLIANCE_APPROVED")} disabled={statusChanging} color="#0891b2" icon="ti-shield-check">Aprobar Compliance</ActionBtn>
            )}
            {currentStatus === "COMPLIANCE_APPROVED" && (
              <ActionBtn onClick={() => onChangeStatus("COMMERCIAL_APPROVED")} disabled={statusChanging} color="#059669" icon="ti-check">Aprobar Comercial</ActionBtn>
            )}
            {currentStatus === "COMMERCIAL_APPROVED" && (
              <ActionBtn onClick={() => onChangeStatus("ACTIVE_CLIENT", "QUALIFIED")} disabled={statusChanging} color="#16a34a" icon="ti-user-plus">Activar Cliente</ActionBtn>
            )}
            {currentStatus !== "REJECTED" && currentStatus !== "ACTIVE_CLIENT" && (
              <ActionBtn onClick={() => onChangeStatus("REJECTED")} disabled={statusChanging} color="#dc2626" icon="ti-ban">Rechazar</ActionBtn>
            )}
            {currentStatus === "REJECTED" && (
              <ActionBtn onClick={() => onChangeStatus("PRE_REGISTRATION")} disabled={statusChanging} color="#d97706" icon="ti-refresh">Reabrir</ActionBtn>
            )}
          </div>
        </div>

        {/* Lifecycle actions (DIRECTOR 75+) */}
        {isDirector && (
          <div style={{ padding: "10px 1.5rem", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#fafafa" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginRight: 4 }}>
              <i className="ti ti-refresh" style={{ fontSize: 12 }} /> Ciclo de Vida
            </span>
            {lcStatus === "ACTIVE" && (
              <>
                <ActionBtn onClick={() => onUpdateLifecycle("ARCHIVE")} disabled={lifecycleChanging} color="#6b7280" icon="ti-archive">Archivar</ActionBtn>
                <ActionBtn onClick={() => onUpdateLifecycle("ON_HOLD")} disabled={lifecycleChanging} color="#d97706" icon="ti-pause">Suspender</ActionBtn>
                <ActionBtn onClick={onMarkDuplicate}                   disabled={lifecycleChanging} color="#7c3aed" icon="ti-copy">Duplicado</ActionBtn>
              </>
            )}
            {lcStatus !== "ACTIVE" && (
              <ActionBtn onClick={() => onUpdateLifecycle("REACTIVATE")} disabled={lifecycleChanging} color="#16a34a" icon="ti-player-play">Reactivar</ActionBtn>
            )}
            {lcStatus !== "ACTIVE" && lead.lifecycle_reason && (
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: 4 }}>
                Motivo: <em>{lead.lifecycle_reason}</em>
              </span>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-tertiary)", overflowX: "auto" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", border: "none",
                borderBottom: `2px solid ${activeTab === t.id ? "#1B2A4A" : "transparent"}`,
                background: "transparent",
                color: activeTab === t.id ? "#1B2A4A" : "var(--color-text-secondary)",
                fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>
              <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} />{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: "1.5rem", maxHeight: "50vh", overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)" }}>
              <i className="ti ti-loader ti-spin" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />Cargando expediente...
            </div>
          ) : (
            <>
              {activeTab === "empresa" && (
                <KycSection fields={[
                  { label: "Razón Social / Empresa",  value: client.company || kd.empresa },
                  { label: "Nombre Comercial",         value: client.name    || kd.comercial },
                  { label: "NIT / Tax ID",             value: client.tax_id  || kd.nit },
                  { label: "País de Constitución",     value: client.country || kd.pais },
                  { label: "Ciudad / Estado",          value: kd.ciudad },
                  { label: "Año de Fundación",         value: kd.fundacion },
                  { label: "Dirección",                value: kd.direccion },
                  { label: "Sitio Web",                value: kd.web, isLink: true },
                  { label: "Actividad / Giro Comercial", value: kd.actividad, multiline: true },
                ]} />
              )}
              {activeTab === "rep" && (
                <KycSection fields={[
                  { label: "Representante Legal",     value: client.representative || kd.rep },
                  { label: "Cargo / Posición",        value: kd.cargo },
                  { label: "Email",                   value: client.email || kd.email },
                  { label: "Teléfono / WhatsApp",     value: client.phone || kd.tel },
                  { label: "Tipo de Documento",       value: kd.doc_tipo },
                  { label: "Número de Documento",     value: kd.doc_num },
                ]} />
              )}
              {activeTab === "comercial" && (
                <KycSection fields={[
                  { label: "Tipo de Comprador",       value: kd.tipo_comprador },
                  { label: "Volumen Estimado",         value: kd.volumen },
                  { label: "Mercados Atendidos",       value: kd.mercados },
                  { label: "Proveedores Actuales",     value: kd.proveedores },
                  { label: "Actividad / Giro",         value: kd.actividad },
                  { label: "Productos de Interés",     value: kd.productos, multiline: true },
                ]} />
              )}
              {activeTab === "refs" && (
                <KycSection fields={[
                  { label: "Banco Principal", value: kd.banco },
                  { label: "Referencia 1",    value: kd.ref1 },
                  { label: "Referencia 2",    value: kd.ref2 },
                ]} />
              )}
              {activeTab === "compliance" && (
                <div>
                  <CheckRow label="Anti-lavado de activos (AML) y sanciones OFAC / ONU / FATF" checked />
                  <CheckRow label="Términos & Condiciones GLV Services" checked />
                  <CheckRow label="Política de Privacidad y Protección de Datos" checked />
                  <div style={{ marginTop: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8 }}>Notas de Onboarding / Compliance</p>
                    {editMode ? (
                      <div>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
                          style={{ width: "100%", padding: "10px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button onClick={() => onSaveNotes(notes)} disabled={saving}
                            style={{ padding: "7px 16px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                            {saving ? "Guardando..." : "Guardar Notas"}
                          </button>
                          <button onClick={onToggleEdit}
                            style={{ padding: "7px 14px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 7, fontSize: 13, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-secondary)" }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, padding: "10px 12px", background: "var(--color-background-secondary)", borderRadius: 8, fontSize: 13, color: "var(--color-text-secondary)", minHeight: 60 }}>
                          {notes || <span style={{ opacity: 0.5 }}>Sin notas de compliance.</span>}
                        </div>
                        <button onClick={onToggleEdit}
                          style={{ padding: "7px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 7, fontSize: 13, cursor: "pointer", background: "var(--color-background-primary)", color: "var(--color-text-secondary)" }}>
                          <i className="ti ti-edit" style={{ fontSize: 13 }} /> Editar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === "ciclo-vida" && (
                <LifecycleTab
                  lead={lead}
                  history={lifecycleHistory}
                  onLoad={onLoadLifecycleHistory}
                  lcStatus={lcStatus}
                />
              )}
              {activeTab === "auditoria" && (
                <AuditTab detail={detail} lead={lead} />
              )}
            </>
          )}
        </div>

        {/* Footer: metadata + archive/delete actions */}
        <div style={{ padding: "12px 1.5rem", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <MetaItem label="GLV Code"       value={lead.glv_code} mono />
          <MetaItem label="Fuente"         value={client.registration_source || lead.registration_source} />
          <MetaItem label="Fecha registro" value={lead.created_at ? new Date(lead.created_at).toLocaleString("es") : "—"} />
          {detail?.submissions?.[0] && (
            <MetaItem label="Última submission" value={new Date(detail.submissions[0].submitted_at).toLocaleString("es")} />
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {isDirector && (
              <button onClick={onArchive}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "transparent", color: "#6b7280", border: "0.5px solid #d1d5db", borderRadius: 7, fontSize: 12, cursor: "pointer" }}>
                <i className="ti ti-archive" style={{ fontSize: 13 }} /> Archivar (KYC)
              </button>
            )}
            {isSuperAdmin && currentStatus !== "ACTIVE_CLIENT" && (
              <button onClick={onPermanentDelete}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "transparent", color: "#dc2626", border: "0.5px solid #fca5a5", borderRadius: 7, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                <i className="ti ti-trash-x" style={{ fontSize: 13 }} /> ELIMINAR PERMANENTE
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ActionBtn({ children, onClick, disabled, color, icon }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: disabled ? "#9ca3af" : color, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 500, whiteSpace: "nowrap" }}>
      <i className={`ti ${icon}`} style={{ fontSize: 13 }} />{children}
    </button>
  );
}

function KycSection({ fields }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {fields.map(f => (
        <div key={f.label} style={f.multiline ? { gridColumn: "1 / -1" } : {}}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{f.label}</p>
          {f.isLink && f.value ? (
            <a href={f.value.startsWith("http") ? f.value : `https://${f.value}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 14, color: "#2563eb", textDecoration: "none" }}>{f.value}</a>
          ) : (
            <p style={{ fontSize: 14, color: f.value ? "var(--color-text-primary)" : "var(--color-text-secondary)", margin: 0, fontWeight: f.value ? 400 : 300, opacity: f.value ? 1 : 0.5, whiteSpace: f.multiline ? "pre-wrap" : "normal" }}>
              {f.value || "—"}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function CheckRow({ label, checked }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: checked ? "#dcfce7" : "#f3f4f6", border: `1px solid ${checked ? "#22c55e" : "#d1d5db"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {checked && <i className="ti ti-check" style={{ fontSize: 11, color: "#16a34a" }} />}
      </div>
      <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{label}</span>
      <span style={{ marginLeft: "auto", fontSize: 11, color: checked ? "#16a34a" : "#9ca3af", fontWeight: 500, whiteSpace: "nowrap" }}>
        {checked ? "✓ Declarado" : "No declarado"}
      </span>
    </div>
  );
}

function AuditTab({ detail, lead }) {
  const events = detail?.audit_trail || [];
  const tasks  = detail?.tasks       || [];
  const subs   = detail?.submissions || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {events.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Eventos de Auditoría</p>
          {events.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", fontSize: 12 }}>
              <span style={{ color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{e.ts}</span>
              <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4, fontSize: 11, color: "#374151" }}>{e.action}</code>
              <span style={{ color: "var(--color-text-secondary)" }}>{e.username}</span>
            </div>
          ))}
        </div>
      )}
      {tasks.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tareas Generadas</p>
          {tasks.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", fontSize: 12 }}>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: t.status === "pending" ? "#fef3c7" : "#dcfce7", color: t.status === "pending" ? "#92400e" : "#065f46", fontWeight: 600 }}>{t.status}</span>
              <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{t.title}</span>
              {t.assigned_name && <span style={{ color: "var(--color-text-secondary)", marginLeft: "auto" }}>{t.assigned_name}</span>}
            </div>
          ))}
        </div>
      )}
      {subs.length > 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Submissions del Portal Web</p>
          {subs.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", fontSize: 12 }}>
              <span style={{ color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{new Date(s.submitted_at).toLocaleString("es")}</span>
              <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4, fontSize: 11, color: "#374151" }}>{s.status}</code>
              <span style={{ color: "var(--color-text-secondary)" }}>{s.ip_address}</span>
            </div>
          ))}
        </div>
      )}
      {events.length === 0 && tasks.length === 0 && subs.length === 0 && (
        <p style={{ color: "var(--color-text-secondary)", fontSize: 13, textAlign: "center", padding: "2rem 0" }}>Sin eventos de auditoría registrados aún.</p>
      )}
    </div>
  );
}

function LifecycleTab({ lead, history, onLoad, lcStatus }) {
  const lcCfg = LIFECYCLE_CONFIG[lcStatus] || LIFECYCLE_CONFIG.ACTIVE;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Estado Ciclo de Vida</p>
          <StatusBadge status={lcStatus} map={LIFECYCLE_CONFIG} />
        </div>
        {lead.lifecycle_reason && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Motivo</p>
            <p style={{ fontSize: 13, color: "var(--color-text-primary)", margin: 0 }}>{lead.lifecycle_reason}</p>
          </div>
        )}
        {lead.duplicate_of && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Duplicado de (ID)</p>
            <code style={{ fontSize: 13, background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>{lead.duplicate_of}</code>
          </div>
        )}
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Historial de Transiciones</p>
          <button onClick={onLoad} style={{ padding: "4px 10px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 6, fontSize: 12, background: "var(--color-background-primary)", color: "var(--color-text-secondary)", cursor: "pointer" }}>
            <i className="ti ti-refresh" style={{ fontSize: 12 }} /> Cargar
          </button>
        </div>
        {!history ? (
          <p style={{ color: "var(--color-text-secondary)", fontSize: 13, opacity: 0.6 }}>Haga clic en "Cargar" para ver el historial de ciclo de vida.</p>
        ) : history.history?.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)", fontSize: 13, textAlign: "center", padding: "1.5rem 0" }}>Sin transiciones de ciclo de vida registradas.</p>
        ) : (
          history.history?.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", fontSize: 12 }}>
              <span style={{ color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{e.ts}</span>
              <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4, fontSize: 11, color: "#374151" }}>{e.action}</code>
              <span style={{ color: "var(--color-text-secondary)" }}>{e.actor_name || e.username}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MetaItem({ label, value, mono }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</p>
      <p style={{ fontSize: 12, color: "var(--color-text-primary)", margin: 0, fontFamily: mono ? "monospace" : "inherit" }}>{value || "—"}</p>
    </div>
  );
}
