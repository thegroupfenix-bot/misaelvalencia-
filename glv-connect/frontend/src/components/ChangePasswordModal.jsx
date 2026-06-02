import { useState } from "react";
import { api } from "../api.js";

export function ChangePasswordModal({ isFirstLogin, onComplete }) {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (newPwd.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (newPwd !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setError(""); setSaving(true);
    try {
      await api.changePassword({ currentPassword: currentPwd, newPassword: newPwd });
      onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2500, padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, padding: "2rem", boxShadow: "0 8px 48px rgba(0,0,0,0.28)" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ width: 52, height: 52, borderRadius: 50, background: "#dc2626", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <i className="ti ti-lock-exclamation" style={{ fontSize: 24, color: "#fff" }} />
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1B2A4A", margin: "0 0 6px" }}>
            {isFirstLogin ? "Cambio de Contraseña Obligatorio" : "Cambiar Contraseña"}
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            {isFirstLogin
              ? "Por seguridad debe cambiar su contraseña temporal antes de acceder al portal."
              : "Ingrese su contraseña actual y elija una nueva."}
          </p>
        </div>

        {!isFirstLogin && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Contraseña actual</label>
            <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)}
              placeholder="Contraseña actual"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Nueva contraseña *</label>
          <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Confirmar nueva contraseña *</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Repetir contraseña"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
            onKeyDown={e => e.key === "Enter" && handleSave()} />
        </div>

        {error && <p style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", padding: "8px 12px", borderRadius: 8, marginBottom: 16 }}>{error}</p>}

        <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#14532d", marginBottom: 20 }}>
          Requisitos: mínimo 8 caracteres. Se recomienda usar letras, números y símbolos.
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ width: "100%", padding: "11px", background: saving ? "#6b7280" : "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Guardando..." : "Actualizar contraseña y continuar"}
        </button>
      </div>
    </div>
  );
}
