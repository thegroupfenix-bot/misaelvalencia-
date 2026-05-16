import { useState, useEffect } from "react";
import { api } from "../api.js";
import { ALL_ROLES } from "../config/productCategories.js";
import { LANGUAGES } from "../i18n.js";

const ROLE_COLORS = {
  SUPER_ADMIN: "#dc2626", CORPORATE_ADMIN: "#7c3aed", CFO: "#0369a1",
  DIRECTOR: "#1B2A4A", COMMERCIAL_DIRECTOR: "#0891b2", COMPLIANCE: "#7c3aed",
  ACCOUNTING: "#059669", TREASURY: "#059669", AUDIT: "#d97706",
  TAX_REVIEWER: "#d97706", COUNTRY_ACCOUNTANT: "#d97706", LOGISTICS: "#6b7280",
  AGENTE: "#2563eb", CLIENT: "#374151", SUPPLIER: "#374151",
};

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || "#6b7280";
  const label = ALL_ROLES.find(r => r.id === role)?.label?.es || role;
  return (
    <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 600,
      background: color + "18", color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    username: "", name: "", email: "", role: "AGENTE",
    department: "", position: "", country: "", preferred_lang: "es",
    temporary_password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    if (!form.username || !form.name || !form.email || !form.temporary_password) {
      setError("Usuario, nombre, email y contraseña temporal son obligatorios."); return;
    }
    if (form.temporary_password.length < 6) {
      setError("La contraseña temporal debe tener al menos 6 caracteres."); return;
    }
    setError(""); setSaving(true);
    try {
      const created = await api.adminCreateUser(form);
      onCreated(created);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", padding: "2rem", boxShadow: "0 8px 48px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1B2A4A", margin: 0 }}>Crear Nuevo Usuario</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#6b7280" }}>×</button>
        </div>

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <F label="Nombre completo *"><I value={form.name} onChange={v => set("name", v)} placeholder="Nombre Apellido" /></F>
          <F label="Usuario *"><I value={form.username} onChange={v => set("username", v.toLowerCase())} placeholder="nombre.apellido" /></F>
          <F label="Email corporativo *"><I value={form.email} onChange={v => set("email", v)} placeholder="correo@empresa.com" /></F>
          <F label="Rol *">
            <select value={form.role} onChange={e => set("role", e.target.value)} style={inputSt}>
              {ALL_ROLES.map(r => <option key={r.id} value={r.id}>{r.label?.es} ({r.id})</option>)}
            </select>
          </F>
          <F label="Departamento"><I value={form.department} onChange={v => set("department", v)} placeholder="Comercial, Finanzas..." /></F>
          <F label="Cargo / Posición"><I value={form.position} onChange={v => set("position", v)} placeholder="Agente Sr., Analista..." /></F>
          <F label="País de operación"><I value={form.country} onChange={v => set("country", v)} placeholder="Colombia, Brasil..." /></F>
          <F label="Idioma preferido">
            <select value={form.preferred_lang} onChange={e => set("preferred_lang", e.target.value)} style={inputSt}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </F>
          <div style={{ gridColumn: "1 / -1" }}>
            <F label="Contraseña temporal * (el usuario deberá cambiarla en el primer inicio de sesión)">
              <I value={form.temporary_password} onChange={v => set("temporary_password", v)} placeholder="Mín. 6 caracteres" type="password" />
            </F>
          </div>
        </div>

        <div style={{ background: "#f0f9ff", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#0369a1", marginTop: 12, marginBottom: 20 }}>
          El usuario recibirá estas credenciales y <strong>deberá cambiar su contraseña</strong> y completar su perfil en el primer inicio de sesión.
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #d1d5db", background: "none", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            style={{ padding: "9px 24px", background: saving ? "#6b7280" : "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Creando..." : "Crear Usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPwdModal({ user, onClose, showNotif }) {
  const [pwd, setPwd] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReset = async () => {
    if (!pwd || pwd.length < 6) { showNotif("Mínimo 6 caracteres", "error"); return; }
    setSaving(true);
    try {
      await api.adminResetPwd(user.id, pwd);
      showNotif(`Contraseña de ${user.username} restablecida`);
      onClose();
    } catch (e) {
      showNotif(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3100 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: "2rem", maxWidth: 420, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1B2A4A", margin: "0 0 8px" }}>Restablecer contraseña</h3>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>Asignar nueva contraseña temporal para <strong>{user.name}</strong> ({user.username})</p>
        <F label="Nueva contraseña temporal">
          <I value={pwd} onChange={setPwd} placeholder="Mín. 6 caracteres" type="password" />
        </F>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "none", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={handleReset} disabled={saving}
            style={{ padding: "8px 20px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {saving ? "..." : "Restablecer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminUsers({ showNotif }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [filter, setFilter] = useState("");

  const load = () => {
    setLoading(true);
    api.adminGetUsers().then(setUsers).catch(e => showNotif(e.message, "error")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleActive = async (user) => {
    try {
      await api.adminUpdateUser(user.id, { active: !user.active });
      showNotif(`Usuario ${user.active ? "desactivado" : "activado"}`);
      load();
    } catch (e) { showNotif(e.message, "error"); }
  };

  const filtered = users.filter(u =>
    !filter || u.name.toLowerCase().includes(filter.toLowerCase()) || u.username.includes(filter.toLowerCase()) || u.role.includes(filter.toUpperCase())
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 4px" }}>Gestión de Usuarios Corporativos</h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>{users.length} usuarios en el sistema</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          <i className="ti ti-user-plus" style={{ fontSize: 16 }} />Crear Usuario
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar por nombre, usuario o rol..."
          style={{ padding: "9px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, width: 320, boxSizing: "border-box", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
      </div>

      {loading ? <LoadingSpinner /> : (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["Usuario", "Nombre", "Rol", "Depto / Cargo", "Idioma", "Estado", "Perfil", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderTop: "0.5px solid var(--color-border-tertiary)", opacity: u.active ? 1 : 0.5 }}>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-primary)" }}>{u.username}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--color-text-primary)" }}>{u.name}</td>
                  <td style={{ padding: "10px 14px" }}><RoleBadge role={u.role} /></td>
                  <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontSize: 12 }}>
                    <span>{u.department || "—"}</span>
                    {u.position && <span style={{ display: "block", fontSize: 11, color: "var(--color-text-secondary)" }}>{u.position}</span>}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13 }}>
                    {LANGUAGES.find(l => l.code === u.preferred_lang)?.flag || "🌐"} {u.preferred_lang?.toUpperCase()}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: u.active ? "#dcfce7" : "#fee2e2", color: u.active ? "#166534" : "#991b1b" }}>
                      {u.active ? "Activo" : "Inactivo"}
                    </span>
                    {u.first_login ? <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20, background: "#fef3c7", color: "#92400e", marginLeft: 4 }}>1er login</span> : null}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, color: u.profile_completed ? "#059669" : "#d97706" }}>
                      {u.profile_completed ? "✓ Completo" : "⚠ Pendiente"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setResetUser(u)} title="Restablecer contraseña"
                        style={{ padding: "4px 9px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "none", cursor: "pointer", fontSize: 11, color: "#d97706" }}>
                        <i className="ti ti-key" style={{ fontSize: 13 }} />
                      </button>
                      <button onClick={() => toggleActive(u)} title={u.active ? "Desactivar" : "Activar"}
                        style={{ padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11,
                          background: u.active ? "#fee2e2" : "#dcfce7", color: u.active ? "#991b1b" : "#166534" }}>
                        <i className={`ti ${u.active ? "ti-user-off" : "ti-user-check"}`} style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { showNotif("Usuario creado"); load(); }} />}
      {resetUser && <ResetPwdModal user={resetUser} onClose={() => setResetUser(null)} showNotif={showNotif} />}
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────
const inputSt = { width: "100%", padding: "8px 11px", borderRadius: 7, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" };
function F({ label, children }) {
  return <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 5 }}>{label}</label>{children}</div>;
}
function I({ value, onChange, placeholder, type = "text" }) {
  return <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputSt} />;
}
function LoadingSpinner() {
  return <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)" }}><i className="ti ti-loader-2" style={{ fontSize: 32, display: "block", marginBottom: 10, opacity: 0.5 }} /><p>Cargando...</p></div>;
}
