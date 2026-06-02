import { useState, useEffect } from "react";
import { api } from "../api.js";

const PRIORITY_COLORS = {
  low:      { bg: "#f3f4f6", text: "#374151", label: "Baja" },
  medium:   { bg: "#fef3c7", text: "#92400e", label: "Media" },
  high:     { bg: "#fee2e2", text: "#991b1b", label: "Alta" },
  critical: { bg: "#fce7f3", text: "#9d174d", label: "Crítica" },
};

const STATUS_COLORS = {
  pending:     { bg: "#fef3c7", text: "#92400e",  label: "Pendiente" },
  in_progress: { bg: "#dbeafe", text: "#1e40af",  label: "En curso" },
  review:      { bg: "#ede9fe", text: "#4c1d95",  label: "En revisión" },
  approved:    { bg: "#dcfce7", text: "#166534",  label: "Aprobada" },
  rejected:    { bg: "#fee2e2", text: "#991b1b",  label: "Rechazada" },
  cancelled:   { bg: "#f3f4f6", text: "#374151",  label: "Cancelada" },
};

export function TasksView({ user, showNotif }) {
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  const load = () => {
    setLoading(true);
    const params = {};
    if (filterStatus)   params.status   = filterStatus;
    if (filterPriority) params.priority = filterPriority;
    api.getTasks(params).then(setTasks).catch(e => showNotif(e.message, "error")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterStatus, filterPriority]);

  const handleStatusChange = async (task, newStatus) => {
    try {
      await api.updateTask(task.id, { status: newStatus });
      showNotif(`Tarea actualizada a: ${STATUS_COLORS[newStatus]?.label || newStatus}`);
      load();
    } catch (e) { showNotif(e.message, "error"); }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")) return;
    try {
      await api.deleteTask(taskId);
      showNotif("Tarea eliminada");
      load();
    } catch (e) { showNotif(e.message, "error"); }
  };

  const pending    = tasks.filter(t => t.status === "pending").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const review     = tasks.filter(t => t.status === "review").length;
  const approved   = tasks.filter(t => t.status === "approved").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
            Tareas & Calidad ISO
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>
            {tasks.length} tareas — {pending} pendientes · {inProgress} en curso · {review} en revisión · {approved} aprobadas
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          <i className="ti ti-plus" style={{ fontSize: 16 }} />Nueva Tarea
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "7px 11px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 7, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          style={{ padding: "7px 11px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 7, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">Todas las prioridades</option>
          {Object.entries(PRIORITY_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-text-secondary)" }}>
          <i className="ti ti-loader-2" style={{ fontSize: 36, display: "block", marginBottom: 12, opacity: 0.5 }} />
          <p>Cargando tareas...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-text-secondary)" }}>
          <i className="ti ti-checklist" style={{ fontSize: 48, display: "block", marginBottom: 12, opacity: 0.4 }} />
          <p>No hay tareas registradas.</p>
          <button onClick={() => setShowCreate(true)}
            style={{ marginTop: 12, padding: "9px 20px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>
            Crear primera tarea
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tasks.map(task => <TaskCard key={task.id} task={task} user={user} onStatusChange={handleStatusChange} onDelete={handleDelete} />)}
        </div>
      )}

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onCreated={() => { showNotif("Tarea creada"); load(); }} />}
    </div>
  );
}

function TaskCard({ task, user, onStatusChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [evidenceText, setEvidenceText] = useState(task.evidence || "");
  const [savingEvidence, setSavingEvidence] = useState(false);

  const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const sc = STATUS_COLORS[task.status]     || STATUS_COLORS.pending;
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "approved";

  const saveEvidence = async () => {
    setSavingEvidence(true);
    try {
      await api.updateTask(task.id, { evidence: evidenceText });
    } finally { setSavingEvidence(false); }
  };

  return (
    <div style={{ background: "var(--color-background-primary)", border: `0.5px solid ${isOverdue ? "#fca5a5" : "var(--color-border-tertiary)"}`, borderRadius: 10, padding: "1rem 1.25rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: pc.bg, color: pc.text }}>{pc.label}</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.text }}>{sc.label}</span>
            {isOverdue && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#fee2e2", color: "#991b1b", fontWeight: 600 }}>⚠ Vencida</span>}
            {task.operation_id && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#f3f4f6", color: "#374151", fontFamily: "monospace" }}>{task.operation_id}</span>}
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>{task.title}</p>
          {task.description && <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.4 }}>{task.description}</p>}
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "var(--color-text-secondary)" }}>
            {task.assigned_name && <span><i className="ti ti-user" style={{ fontSize: 12, marginRight: 4, verticalAlign: -1 }} />{task.assigned_name}</span>}
            {task.deadline && <span><i className="ti ti-calendar" style={{ fontSize: 12, marginRight: 4, verticalAlign: -1 }} />{task.deadline}</span>}
            <span><i className="ti ti-clock" style={{ fontSize: 12, marginRight: 4, verticalAlign: -1 }} />{task.created_at?.split("T")[0]}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <select value={task.status} onChange={e => onStatusChange(task, e.target.value)}
            style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: "pointer" }}>
            {Object.entries(STATUS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setExpanded(p => !p)} title="Ver detalles"
              style={{ padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "none", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)" }}>
              <i className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"}`} style={{ fontSize: 13 }} />
            </button>
            <button onClick={() => onDelete(task.id)} title="Eliminar"
              style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "#fee2e2", cursor: "pointer", fontSize: 12, color: "#991b1b" }}>
              <i className="ti ti-trash" style={{ fontSize: 13 }} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "0.5px solid var(--color-border-tertiary)" }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
            Evidencia / Comentarios de resolución
          </label>
          <textarea value={evidenceText} onChange={e => setEvidenceText(e.target.value)} rows={3}
            placeholder="Registre evidencias, pasos tomados, documentos adjuntos..."
            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", resize: "vertical", boxSizing: "border-box" }} />
          <button onClick={saveEvidence} disabled={savingEvidence}
            style={{ marginTop: 8, padding: "6px 16px", background: savingEvidence ? "#6b7280" : "#1B2A4A", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
            {savingEvidence ? "Guardando..." : "Guardar evidencia"}
          </button>
        </div>
      )}
    </div>
  );
}

function CreateTaskModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", deadline: "", assigned_to: "", operation_id: "" });
  const [users, setUsers]   = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => {
    api.adminGetUsers().then(setUsers).catch(() => {});
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inputSt = { width: "100%", padding: "8px 11px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" };

  const handleCreate = async () => {
    if (!form.title) { setError("El título es obligatorio."); return; }
    setError(""); setSaving(true);
    try {
      await api.createTask({ ...form, assigned_to: form.assigned_to || null, operation_id: form.operation_id || null });
      onCreated();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "1rem" }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: "2rem", boxShadow: "0 8px 48px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>Nueva Tarea / Acción Correctiva</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--color-text-secondary)" }}>×</button>
        </div>

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#991b1b" }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Título *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Descripción breve de la tarea" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Descripción</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
              placeholder="Instrucciones detalladas, contexto..."
              style={{ ...inputSt, resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Prioridad</label>
              <select value={form.priority} onChange={e => set("priority", e.target.value)} style={inputSt}>
                {Object.entries(PRIORITY_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Fecha límite</label>
              <input type="date" value={form.deadline} onChange={e => set("deadline", e.target.value)} style={inputSt} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Asignar a</label>
            <select value={form.assigned_to} onChange={e => set("assigned_to", e.target.value)} style={inputSt}>
              <option value="">Sin asignar</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>ID Operación vinculada (opcional)</label>
            <input value={form.operation_id} onChange={e => set("operation_id", e.target.value)} placeholder="BR-SOY-2026-001" style={inputSt} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-primary)" }}>Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            style={{ padding: "9px 24px", background: saving ? "#6b7280" : "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Creando..." : "Crear Tarea"}
          </button>
        </div>
      </div>
    </div>
  );
}
