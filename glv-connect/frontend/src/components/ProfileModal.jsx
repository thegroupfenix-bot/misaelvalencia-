import { useState, useRef } from "react";
import { api } from "../api.js";

const LANGUAGES_OPTIONS = ["Español", "Inglés", "Árabe", "Chino", "Portugués", "Francés"];
const LANG_CODES = ["es", "en", "ar", "zh", "pt", "fr"];
const LANG_LABELS = { es: "Español", en: "English", ar: "العربية", zh: "中文", pt: "Português", fr: "Français" };

export function ProfileModal({ user, onComplete, existingProfile = null, editMode = false }) {
  const [form, setForm] = useState({
    phone:         existingProfile?.phone         || "",
    country:       existingProfile?.country       || "",
    languages:     existingProfile?.languages     || [],
    signature_b64: existingProfile?.signature_b64 || null,
    photo_b64:     existingProfile?.photo_b64     || null,
    reg_number:    existingProfile?.reg_number    || "",
    email:         existingProfile?.email         || user?.email || "",
    preferred_lang: existingProfile?.preferred_lang || user?.preferred_lang || "es",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
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
    setSaved(false);
    if (!form.phone || !form.signature_b64) {
      setError("Teléfono y Firma digital son obligatorios para activar tu perfil.");
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("El formato del email no es válido.");
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({
        phone:         form.phone,
        country:       form.country,
        languages:     form.languages,
        signature_b64: form.signature_b64,
        photo_b64:     form.photo_b64,
        reg_number:    form.reg_number,
        email:         form.email,
        preferred_lang: form.preferred_lang,
      });
      setSaved(true);
      onComplete();
    } catch (e) {
      setError(e.message || "Error al guardar el perfil");
    } finally {
      setSaving(false);
    }
  };

  const isComplete = !!(form.phone && form.signature_b64);

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
            {editMode ? "Mi Perfil" : "Completa tu perfil de agente"}
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            {editMode
              ? "Actualiza tu información. Estos datos aparecen en todos los documentos que emitas."
              : "Completa tu perfil antes de continuar. Solo se solicita una vez."}
          </p>
        </div>

        {/* Profile completion status */}
        <div style={{
          background: isComplete ? "#f0fdf4" : "#fef3c7",
          border: `1px solid ${isComplete ? "#86efac" : "#fcd34d"}`,
          borderRadius: 8, padding: "8px 14px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 8
        }}>
          <span style={{ fontSize: 16 }}>{isComplete ? "✅" : "⚠️"}</span>
          <p style={{ fontSize: 12, color: isComplete ? "#166534" : "#92400e", margin: 0, fontWeight: 500 }}>
            {isComplete
              ? "Perfil completo — podrás emitir SCO/FCO sin interrupciones."
              : "Falta completar: teléfono y/o firma digital para activar emisión de documentos."}
          </p>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#991b1b", margin: 0 }}>{error}</p>
          </div>
        )}

        {/* READ-ONLY: Nombre completo */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
            Nombre completo <span style={{ fontSize: 11, color: "#9ca3af" }}>(administrado por SUPER ADMIN)</span>
          </label>
          <input value={user?.name || ""} readOnly
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, background: "#f9fafb", color: "#9ca3af", boxSizing: "border-box" }} />
        </div>

        {/* READ-ONLY: Cargo / Rol */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
            Cargo / Rol <span style={{ fontSize: 11, color: "#9ca3af" }}>(administrado por SUPER ADMIN)</span>
          </label>
          <input value={existingProfile?.cargo || user?.role || ""} readOnly
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, background: "#f9fafb", color: "#9ca3af", boxSizing: "border-box" }} />
        </div>

        {/* EDITABLE: Email */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Email de contacto</label>
          <input value={form.email} onChange={e => setField("email", e.target.value)}
            type="email" placeholder="correo@empresa.com"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        {/* EDITABLE: Teléfono * */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
            Teléfono / WhatsApp <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input value={form.phone} onChange={e => setField("phone", e.target.value)}
            placeholder="+1 000 000 0000"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${form.phone ? "#d1d5db" : "#fca5a5"}`, fontSize: 14, boxSizing: "border-box" }} />
        </div>

        {/* EDITABLE: País */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>País de operación</label>
          <input value={form.country} onChange={e => setField("country", e.target.value)}
            placeholder="País de residencia/operación"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        {/* EDITABLE: Idioma preferido */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 8 }}>Idioma preferido de documentos</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {LANG_CODES.map(code => (
              <button key={code} type="button" onClick={() => setField("preferred_lang", code)}
                style={{
                  padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                  border: form.preferred_lang === code ? "2px solid #1B2A4A" : "1px solid #d1d5db",
                  background: form.preferred_lang === code ? "#1B2A4A" : "#fff",
                  color: form.preferred_lang === code ? "#fff" : "#374151",
                  fontWeight: form.preferred_lang === code ? 600 : 400,
                }}>
                {LANG_LABELS[code]}
              </button>
            ))}
          </div>
        </div>

        {/* EDITABLE: Idiomas hablados */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 8 }}>Idiomas de trabajo</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {LANGUAGES_OPTIONS.map(lang => (
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

        {/* EDITABLE: Número de registro (opcional) */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Número de registro (opcional)</label>
          <input value={form.reg_number} onChange={e => setField("reg_number", e.target.value)}
            placeholder="Número de licencia o registro de agente"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        {/* EDITABLE: Firma digital * */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
            Firma digital <span style={{ color: "#dc2626" }}>*</span>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 400 }}> (PNG recomendada, fondo transparente)</span>
          </label>
          <input type="file" ref={sigRef} accept="image/*" onChange={e => handleFileChange(e, "signature_b64")}
            style={{ display: "none" }} />
          <button type="button" onClick={() => sigRef.current.click()}
            style={{ padding: "9px 16px", borderRadius: 8, border: `1px dashed ${form.signature_b64 ? "#86efac" : "#fca5a5"}`, background: form.signature_b64 ? "#f0fdf4" : "#fff7f7", cursor: "pointer", fontSize: 13, color: form.signature_b64 ? "#166534" : "#dc2626", width: "100%" }}>
            {form.signature_b64 ? "✓ Firma cargada — click para cambiar" : "Click para subir imagen de firma"}
          </button>
          {form.signature_b64 && (
            <div style={{ marginTop: 8, padding: 8, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", textAlign: "center" }}>
              <img src={form.signature_b64} alt="Firma" style={{ maxHeight: 80, maxWidth: "100%", objectFit: "contain" }} />
            </div>
          )}
        </div>

        {/* EDITABLE: Foto de perfil (opcional) */}
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

        {saved && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: "#166534", margin: 0, fontWeight: 500 }}>✓ Perfil guardado. Ya puedes emitir documentos sin interrupciones.</p>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {editMode && (
            <button type="button" onClick={onComplete}
              style={{ flex: 1, padding: "11px", background: "none", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>
              Cerrar
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: "12px", background: saving ? "#6b7280" : "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Guardando..." : editMode ? "Guardar cambios" : "Guardar perfil y continuar"}
          </button>
        </div>

        <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", margin: "12px 0 0" }}>
          Solo teléfono y firma son requeridos. Cargo y nombre son gestionados por SUPER ADMIN.
        </p>
      </div>
    </div>
  );
}
