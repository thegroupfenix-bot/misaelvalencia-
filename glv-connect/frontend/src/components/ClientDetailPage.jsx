import { useState, useEffect, useRef } from "react";
import { api } from "../api.js";

const KYC_LABELS = {
  PRE_REGISTRATION: "Pre-registro",
  UNDER_REVIEW: "En revisión",
  COMPLIANCE_APPROVED: "Compliance OK",
  COMMERCIAL_APPROVED: "Comercial OK",
  ACTIVE_CLIENT: "Cliente Activo",
  REJECTED: "Rechazado",
};
const KYC_COLORS = {
  PRE_REGISTRATION: { bg: "#f3f4f6", text: "#374151" },
  UNDER_REVIEW:     { bg: "#fef3c7", text: "#92400e" },
  COMPLIANCE_APPROVED: { bg: "#dbeafe", text: "#1e40af" },
  COMMERCIAL_APPROVED: { bg: "#ede9fe", text: "#4c1d95" },
  ACTIVE_CLIENT:    { bg: "#dcfce7", text: "#166534" },
  REJECTED:         { bg: "#fee2e2", text: "#991b1b" },
};
const LC_COLORS = {
  ACTIVE:   { bg: "#dcfce7", text: "#166534" },
  ARCHIVED: { bg: "#f3f4f6", text: "#6b7280" },
  ON_HOLD:  { bg: "#fef3c7", text: "#92400e" },
  DUPLICATE: { bg: "#fee2e2", text: "#991b1b" },
};

const TABS = ["Resumen", "Empresa", "Comercial", "Compliance", "Documentos", "Operaciones", "Auditoría"];

const DOC_TYPE_LABELS = {
  COMMERCIAL_REGISTRATION: "Registro Comercial",
  TAX_ID: "Tax ID / RUC",
  BANK_CERTIFICATE: "Certificado Bancario",
  PASSPORT: "Pasaporte",
  POWER_OF_ATTORNEY: "Poder Notarial",
  FINANCIAL_STATEMENTS: "Estados Financieros",
  HALAL_CERTIFICATE: "Certificado Halal",
  HEALTH_CERTIFICATE: "Certificado Sanitario",
  KYC_FORM: "Formulario KYC",
  SIGNED_CONTRACT: "Contrato Firmado",
  SCO: "SCO",
  FCO: "FCO",
  SPA: "SPA",
  OTHER: "Otro",
};

function Badge({ label, bg, text }) {
  return (
    <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: bg, color: text, fontWeight: 600, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 2, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{value || <span style={{ color: "var(--color-text-secondary)" }}>—</span>}</div>
    </div>
  );
}

function Grid2({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>{children}</div>;
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

function TabResumen({ client }) {
  const kyc = KYC_COLORS[client.kyc_status] || { bg: "#f3f4f6", text: "#374151" };
  const lc  = LC_COLORS[client.lifecycle_status] || { bg: "#f3f4f6", text: "#374151" };
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <Badge label={client.glv_code || `ID ${client.id}`} bg="#1B2A4A" text="#fff" />
        <Badge label={client.type || "CLIENT"} bg="#dbeafe" text="#1e40af" />
        <Badge label={KYC_LABELS[client.kyc_status] || client.kyc_status || "—"} bg={kyc.bg} text={kyc.text} />
        <Badge label={client.lifecycle_status || "ACTIVE"} bg={lc.bg} text={lc.text} />
        {client.compliance_flag === 1 && <Badge label="⚠ Flag Compliance" bg="#fee2e2" text="#991b1b" />}
      </div>
      <Grid2>
        <Field label="Razón Social" value={client.company} />
        <Field label="Nombre Comercial" value={client.name} />
        <Field label="País" value={client.country} />
        <Field label="Idioma preferido" value={client.preferred_lang} />
        <Field label="Registrado" value={client.created_at ? new Date(client.created_at).toLocaleDateString("es") : null} />
        <Field label="Fuente" value={client.registration_source || "MANUAL"} />
        <Field label="Operaciones" value={client.operations_count ?? "—"} />
        <Field label="Documentos" value={client.documents_count ?? "—"} />
      </Grid2>
      {client.onboarding_notes && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4, fontWeight: 500 }}>Notas onboarding</div>
          <div style={{ fontSize: 13, background: "var(--color-background-secondary)", padding: "10px 14px", borderRadius: 8, color: "var(--color-text-primary)" }}>{client.onboarding_notes}</div>
        </div>
      )}
    </div>
  );
}

function TabEmpresa({ client, onSave, showNotif }) {
  const [form, setForm] = useState({ company: client.company || "", name: client.name || "", country: client.country || "", representative: client.representative || "", tax_id: client.tax_id || "", address: client.address || "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = { width: "100%", padding: "8px 11px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateClient(client.id, form);
      showNotif("Guardado");
      onSave();
    } catch (e) { showNotif(e.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Grid2>
        <div><label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500 }}>Razón Social</label><input style={inp} value={form.company} onChange={e => set("company", e.target.value)} /></div>
        <div><label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500 }}>Nombre Comercial</label><input style={inp} value={form.name} onChange={e => set("name", e.target.value)} /></div>
        <div style={{ marginTop: 12 }}><label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500 }}>País</label><input style={inp} value={form.country} onChange={e => set("country", e.target.value)} /></div>
        <div style={{ marginTop: 12 }}><label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500 }}>Tax ID / RUC</label><input style={inp} value={form.tax_id} onChange={e => set("tax_id", e.target.value)} /></div>
        <div style={{ marginTop: 12 }}><label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500 }}>Representante</label><input style={inp} value={form.representative} onChange={e => set("representative", e.target.value)} /></div>
        <div style={{ marginTop: 12 }}><label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500 }}>Dirección</label><input style={inp} value={form.address} onChange={e => set("address", e.target.value)} /></div>
      </Grid2>
      <div style={{ marginTop: 20 }}>
        <button onClick={save} disabled={saving} style={{ padding: "8px 20px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

function TabComercial({ client, onSave, showNotif }) {
  const [form, setForm] = useState({ email: client.email || "", phone: client.phone || "", whatsapp: client.whatsapp || "", preferred_lang: client.preferred_lang || "en" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = { width: "100%", padding: "8px 11px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateClient(client.id, form);
      showNotif("Guardado");
      onSave();
    } catch (e) { showNotif(e.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Grid2>
        <div><label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500 }}>Email</label><input style={inp} value={form.email} onChange={e => set("email", e.target.value)} /></div>
        <div><label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500 }}>Teléfono</label><input style={inp} value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
        <div style={{ marginTop: 12 }}><label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500 }}>WhatsApp</label><input style={inp} value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} /></div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 500 }}>Idioma preferido</label>
          <select style={inp} value={form.preferred_lang} onChange={e => set("preferred_lang", e.target.value)}>
            <option value="es">Español</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
            <option value="fr">Français</option>
          </select>
        </div>
      </Grid2>
      <div style={{ marginTop: 20 }}>
        <button onClick={save} disabled={saving} style={{ padding: "8px 20px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

function TabCompliance({ client }) {
  const kyc = KYC_COLORS[client.kyc_status] || { bg: "#f3f4f6", text: "#374151" };
  return (
    <div>
      <Grid2>
        <Field label="Estado KYC" value={<Badge label={KYC_LABELS[client.kyc_status] || client.kyc_status || "—"} bg={kyc.bg} text={kyc.text} />} />
        <Field label="Estado Comercial / Lifecycle" value={<Badge label={client.lifecycle_status || "ACTIVE"} bg={(LC_COLORS[client.lifecycle_status] || LC_COLORS.ACTIVE).bg} text={(LC_COLORS[client.lifecycle_status] || LC_COLORS.ACTIVE).text} />} />
        <Field label="Score Comercial" value={client.commercial_score != null ? String(client.commercial_score) : null} />
        <Field label="Flag Compliance" value={client.compliance_flag === 1 ? "⚠ Activo" : "Sin flag"} />
        <Field label="Revisado por" value={client.kyc_reviewed_by || null} />
        <Field label="Fecha revisión" value={client.kyc_reviewed_at ? new Date(client.kyc_reviewed_at).toLocaleDateString("es") : null} />
      </Grid2>
      {client.lifecycle_reason && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4, fontWeight: 500 }}>Motivo lifecycle</div>
          <div style={{ fontSize: 13, background: "var(--color-background-secondary)", padding: "10px 14px", borderRadius: 8 }}>{client.lifecycle_reason}</div>
        </div>
      )}
    </div>
  );
}

function TabDocumentos({ clientId, showNotif }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("OTHER");
  const [notes, setNotes]     = useState("");
  const fileRef = useRef();

  const load = () => {
    setLoading(true);
    api.getClientDocuments(clientId).then(setDocs).catch(e => showNotif(e.message, "error")).finally(() => setLoading(false));
  };
  useEffect(load, [clientId]);

  const upload = async () => {
    if (!fileRef.current?.files?.[0]) return;
    const fd = new FormData();
    fd.append("file", fileRef.current.files[0]);
    fd.append("document_type", docType);
    fd.append("notes", notes);
    setUploading(true);
    try {
      await api.uploadClientDocument(clientId, fd);
      showNotif("Documento subido");
      fileRef.current.value = "";
      setNotes("");
      load();
    } catch (e) { showNotif(e.message, "error"); }
    finally { setUploading(false); }
  };

  const download = async (docId) => {
    try {
      const { url } = await api.getClientDocumentUrl(clientId, docId);
      window.open(url, "_blank");
    } catch (e) { showNotif(e.message, "error"); }
  };

  const del = async (docId) => {
    if (!window.confirm("¿Eliminar este documento?")) return;
    try {
      await api.deleteClientDocument(clientId, docId);
      showNotif("Documento eliminado");
      load();
    } catch (e) { showNotif(e.message, "error"); }
  };

  const selSt = { padding: "7px 10px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 12, background: "var(--color-background-primary)", color: "var(--color-text-primary)" };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select style={selSt} value={docType} onChange={e => setDocType(e.target.value)}>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" style={{ fontSize: 12 }} />
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas (opcional)" style={{ ...selSt, width: 180 }} />
        <button onClick={upload} disabled={uploading} style={{ padding: "7px 16px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, cursor: "pointer" }}>
          {uploading ? "Subiendo…" : "Subir"}
        </button>
      </div>

      {loading ? <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Cargando…</p> : docs.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Sin documentos cargados.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "var(--color-background-secondary)" }}>
            {["Tipo", "Archivo", "Tamaño", "Subido por", "Fecha", ""].map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {docs.map(d => (
              <tr key={d.id} style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                <td style={{ padding: "8px 12px" }}>{DOC_TYPE_LABELS[d.document_type] || d.document_type}</td>
                <td style={{ padding: "8px 12px" }}>{d.file_name}</td>
                <td style={{ padding: "8px 12px" }}>{d.file_size ? `${(d.file_size / 1024).toFixed(0)} KB` : "—"}</td>
                <td style={{ padding: "8px 12px" }}>{d.uploaded_by_name || "—"}</td>
                <td style={{ padding: "8px 12px" }}>{d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString("es") : "—"}</td>
                <td style={{ padding: "8px 12px", display: "flex", gap: 6 }}>
                  <button onClick={() => download(d.id)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "none", cursor: "pointer", color: "var(--color-text-primary)" }}>⬇ Descargar</button>
                  <button onClick={() => del(d.id)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "0.5px solid #fca5a5", background: "none", cursor: "pointer", color: "#dc2626" }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TabOperaciones({ clientId, setView, showNotif }) {
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getOperations({ client_id: clientId })
      .then(setOps)
      .catch(e => showNotif(e.message, "error"))
      .finally(() => setLoading(false));
  }, [clientId]);

  const STATUS_COLORS = { active: { bg: "#dcfce7", text: "#166534" }, closed: { bg: "#f3f4f6", text: "#6b7280" }, cancelled: { bg: "#fee2e2", text: "#991b1b" } };

  return (
    <div>
      {loading ? <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Cargando…</p> : ops.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Sin operaciones vinculadas.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "var(--color-background-secondary)" }}>
            {["ID", "Tipo", "Producto", "Estado", "Valor", "Fecha"].map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {ops.map(op => {
              const sc = STATUS_COLORS[op.status] || { bg: "#f3f4f6", text: "#374151" };
              return (
                <tr key={op.id} onClick={() => setView("op-detail:" + op.id)}
                  style={{ borderTop: "0.5px solid var(--color-border-tertiary)", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11 }}>{op.id}</td>
                  <td style={{ padding: "8px 12px" }}>{op.type}</td>
                  <td style={{ padding: "8px 12px" }}>{op.product_detail || op.product_category}</td>
                  <td style={{ padding: "8px 12px" }}><Badge label={op.status} bg={sc.bg} text={sc.text} /></td>
                  <td style={{ padding: "8px 12px" }}>{op.shipment_value ? `${op.currency} ${Number(op.shipment_value).toLocaleString()}` : "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{op.created_at ? new Date(op.created_at).toLocaleDateString("es") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TabAuditoria({ clientId, showNotif }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLifecycleHistory(clientId)
      .then(setEvents)
      .catch(e => showNotif(e.message, "error"))
      .finally(() => setLoading(false));
  }, [clientId]);

  return (
    <div>
      {loading ? <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Cargando…</p> : events.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Sin eventos de auditoría.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "var(--color-background-secondary)" }}>
            {["Acción", "Usuario", "Fecha", "IP"].map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {events.map(e => (
              <tr key={e.id} style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11 }}>{e.action}</td>
                <td style={{ padding: "8px 12px" }}>{e.username}</td>
                <td style={{ padding: "8px 12px" }}>{e.created_at ? new Date(e.created_at).toLocaleDateString("es") : "—"}</td>
                <td style={{ padding: "8px 12px", color: "var(--color-text-secondary)" }}>{e.ip || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function ClientDetailPage({ clientId, setView, user, showNotif }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Resumen");
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    api.getClient(clientId).then(setClient).catch(e => showNotif(e.message, "error")).finally(() => setLoading(false));
  };
  useEffect(load, [clientId]);

  const handleDelete = async () => {
    if (user?.role !== "SUPER_ADMIN") return;
    const expectedCode = client.glv_code || String(client.id);
    const input = window.prompt(
      `Para confirmar la eliminación permanente de "${client.company || client.name}", escriba exactamente:\nDELETE ${expectedCode}`
    );
    if (input === null) return;
    if (input.trim() !== `DELETE ${expectedCode}`) {
      showNotif("Código incorrecto. Eliminación cancelada.", "error");
      return;
    }
    setDeleting(true);
    try {
      await api.deleteLead(client.id);
      showNotif(`Cliente ${expectedCode} eliminado permanentemente`);
      setView("clients");
    } catch (e) {
      showNotif(e.message, "error");
      setDeleting(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>Cargando cliente…</div>;
  if (!client) return <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>Cliente no encontrado.</div>;

  const tabBtn = (t) => (
    <button key={t} onClick={() => setTab(t)} style={{
      padding: "8px 16px", fontSize: 13, fontWeight: tab === t ? 600 : 400,
      color: tab === t ? "#1B2A4A" : "var(--color-text-secondary)",
      background: "none", border: "none", borderBottom: tab === t ? "2px solid #1B2A4A" : "2px solid transparent",
      cursor: "pointer", whiteSpace: "nowrap",
    }}>{t}</button>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => setView("clients")} style={{ background: "none", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-arrow-left" /> Volver
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
            {client.company || client.name}
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>{client.glv_code} · {client.country}</p>
        </div>
        {user?.role === "SUPER_ADMIN" && (
          <button onClick={handleDelete} disabled={deleting}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "transparent", color: "#dc2626", border: "0.5px solid #fca5a5", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
            <i className="ti ti-trash-x" style={{ fontSize: 14 }} />
            {deleting ? "Eliminando…" : "ELIMINAR CLIENTE"}
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: 24, overflowX: "auto" }}>
        {TABS.map(tabBtn)}
      </div>

      {/* Tab content */}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 24 }}>
        {tab === "Resumen"     && <TabResumen client={client} />}
        {tab === "Empresa"     && <TabEmpresa client={client} onSave={load} showNotif={showNotif} />}
        {tab === "Comercial"   && <TabComercial client={client} onSave={load} showNotif={showNotif} />}
        {tab === "Compliance"  && <TabCompliance client={client} />}
        {tab === "Documentos"  && <TabDocumentos clientId={client.id} showNotif={showNotif} />}
        {tab === "Operaciones" && <TabOperaciones clientId={client.id} setView={setView} showNotif={showNotif} />}
        {tab === "Auditoría"   && <TabAuditoria clientId={client.id} showNotif={showNotif} />}
      </div>
    </div>
  );
}
