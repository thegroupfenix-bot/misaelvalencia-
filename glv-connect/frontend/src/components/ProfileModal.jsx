import { useState, useRef } from "react";
import { api } from "../api.js";

const LANGUAGES = ["Español", "Inglés", "Árabe", "Chino", "Portugués", "Francés"];

export function ProfileModal({ user, onComplete }) {
  const [form, setForm] = useState({
    cargo: "",
    phone: "",
    country: "",
    languages: [],
    signature_b64: null,
    photo_b64: null,
    reg_number: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sigRef = useRef();
  const photoRef = useRef();

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleLang = (lang) => {
    setForm(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang],
    }));
  };

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFileChange = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await toBase64(file);
    setField(field, b64);
  };

  const handleSave = async () => {
    setError("");
    if (!form.cargo || !form.phone || !form.country || !form.signature_b64) {
      setError("Los campos Cargo, Teléfono, País y Firma digital son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile(form);
      onComplete();
    } catch (e) {
      setError(e.message || "Error al guardar el perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: "1rem"
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 580,
        maxHeight: "90vh", overflowY: "auto", padding: "2rem",
        boxShadow: "0 8px 48px rgba(0,0,0,0.28)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 50, background: "#1B2A4A",
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12
          }}>
            <i className="ti ti-user-check" style={{ fontSize: 26, color: "#fff" }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1B2A4A", margin: "0 0 4px" }}>
            Completa tu perfil de agente
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Es necesario completar tu perfil antes de continuar. Este perfil aparecerá en todos los documentos que emitas.
          </p>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#991b1b", margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Nombre (readonly) */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Nombre completo</label>
          <input value={user.name} readOnly
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, background: "#f3f4f6", color: "#6b7280", boxSizing: "border-box" }} />
        </div>

        {/* Email (readonly) */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Email</label>
          <input value={user.email} readOnly
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, background: "#f3f4f6", color: "#6b7280", boxSizing: "border-box" }} />
        </div>

        {/* Cargo * */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Cargo *</label>
          <input value={form.cargo} onChange={e => setField("cargo", e.target.value)}
            placeholder="Ej: Agente Comercial Internacional"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        {/* Teléfono * */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Teléfono / WhatsApp *</label>
          <input value={form.phone} onChange={e => setField("phone", e.target.value)}
            placeholder="+1 000 000 0000"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        {/* País * */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>País *</label>
          <input value={form.country} onChange={e => setField("country", e.target.value)}
            placeholder="País de residencia/operación"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        {/* Idiomas */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 8 }}>Idiomas</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {LANGUAGES.map(lang => (
              <button key={lang} type="button" onClick={() => toggleLang(lang)}
                style={{
                  padding: "6px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                  border: form.languages.includes(lang) ? "2px solid #1B2A4A" : "1px solid #d1d5db",
                  background: form.languages.includes(lang) ? "#1B2A4A" : "#fff",
                  color: form.languages.includes(lang) ? "#fff" : "#374151",
                  fontWeight: form.languages.includes(lang) ? 600 : 400,
                }}>
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Número de registro (opcional) */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Número de registro (opcional)</label>
          <input value={form.reg_number} onChange={e => setField("reg_number", e.target.value)}
            placeholder="Número de licencia o registro de agente"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        {/* Firma digital * */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
            Firma digital * <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 400 }}>(imagen PNG recomendada)</span>
          </label>
          <input type="file" ref={sigRef} accept="image/*" onChange={e => handleFileChange(e, "signature_b64")}
            style={{ display: "none" }} />
          <button type="button" onClick={() => sigRef.current.click()}
            style={{ padding: "9px 16px", borderRadius: 8, border: "1px dashed #d1d5db", background: form.signature_b64 ? "#f0fdf4" : "#f9fafb", cursor: "pointer", fontSize: 13, color: form.signature_b64 ? "#166534" : "#6b7280", width: "100%" }}>
            {form.signature_b64 ? "✓ Firma cargada — click para cambiar" : "Click para subir imagen de firma"}
          </button>
          {form.signature_b64 && (
            <div style={{ marginTop: 8, padding: 8, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", textAlign: "center" }}>
              <img src={form.signature_b64} alt="Firma" style={{ maxHeight: 80, maxWidth: "100%", objectFit: "contain" }} />
            </div>
          )}
        </div>

        {/* Foto de perfil (opcional) */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
            Foto de perfil <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 400 }}>(opcional)</span>
          </label>
          <input type="file" ref={photoRef} accept="image/*" onChange={e => handleFileChange(e, "photo_b64")}
            style={{ display: "none" }} />
          <button type="button" onClick={() => photoRef.current.click()}
            style={{ padding: "9px 16px", borderRadius: 8, border: "1px dashed #d1d5db", background: form.photo_b64 ? "#f0fdf4" : "#f9fafb", cursor: "pointer", fontSize: 13, color: form.photo_b64 ? "#166534" : "#6b7280", width: "100%" }}>
            {form.photo_b64 ? "✓ Foto cargada — click para cambiar" : "Click para subir foto de perfil"}
          </button>
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ width: "100%", padding: "12px", background: saving ? "#6b7280" : "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Guardando..." : "Guardar perfil y continuar"}
        </button>
      </div>
    </div>
  );
}
