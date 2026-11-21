import { useEffect, useState } from "react";
import { api } from "../api.js";

const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 16 };
const input = { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, boxSizing: "border-box", marginTop: 5 };

export default function ClientPortal({ user, logout }) {
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [contact, setContact] = useState({});
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [nameChange, setNameChange] = useState({ requested_name: "", reason: "", evidence_document_id: "" });
  const [file, setFile] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [p, r] = await Promise.all([api.getClientPortalProfile(), api.getClientNameRequests()]);
    setProfile(p);
    setContact({ email: p.email || "", phone: p.phone || "", whatsapp: p.whatsapp || "", address: p.address || "" });
    setRequests(r);
  };
  useEffect(() => { load().catch(e => setError(e.message)); }, []);

  const run = async (fn, message) => {
    setError(""); setNotice(""); setSaving(true);
    try { await fn(); setNotice(message); await load(); } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  if (!profile) return <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: 30, color: "#374151" }}>Cargando portal de clientes...</div>;

  const label = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 12 };
  return <main style={{ minHeight: "100vh", background: "#f3f4f6", padding: "24px", fontFamily: "Arial, sans-serif", boxSizing: "border-box" }}>
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div><h1 style={{ margin: 0, color: "#1B2A4A", fontSize: 24 }}>Portal de Clientes GLV</h1><p style={{ margin: "5px 0 0", color: "#6b7280", fontSize: 13 }}>Usuario: <b>{profile.username}</b> · Código GLV: <b>{profile.glv_code}</b></p></div>
        <button onClick={logout} style={{ border: "1px solid #1B2A4A", color: "#1B2A4A", background: "#fff", borderRadius: 7, padding: "9px 12px", cursor: "pointer" }}>Cerrar sesión</button>
      </header>
      {notice && <p style={{ background: "#dcfce7", color: "#166534", padding: 12, borderRadius: 8 }}>{notice}</p>}
      {error && <p style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8 }}>{error}</p>}

      <section style={card}>
        <h2 style={{ marginTop: 0, color: "#1B2A4A", fontSize: 18 }}>Cuenta de cliente</h2>
        <p style={{ margin: "4px 0", color: "#374151" }}><b>Razón social:</b> {profile.company}</p>
        <p style={{ margin: "4px 0", color: "#374151" }}><b>Estado:</b> {profile.kyc_status}</p>
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "#6b7280" }}>La razón social no se edita directamente. Use la solicitud con certificado vigente para revisión.</p>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0, color: "#1B2A4A", fontSize: 18 }}>Datos de contacto</h2>
        <label style={label}>Correo electrónico<input type="email" value={contact.email} onChange={e=>setContact({...contact,email:e.target.value})} style={input} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          <label style={label}>Teléfono<input value={contact.phone} onChange={e=>setContact({...contact,phone:e.target.value})} style={input} /></label>
          <label style={label}>WhatsApp<input value={contact.whatsapp} onChange={e=>setContact({...contact,whatsapp:e.target.value})} style={input} /></label>
        </div>
        <label style={label}>Dirección<input value={contact.address} onChange={e=>setContact({...contact,address:e.target.value})} style={input} /></label>
        <button disabled={saving} onClick={()=>run(()=>api.updateClientContact(contact),"Datos de contacto actualizados.")} style={{ marginTop: 16, background:"#1B2A4A", color:"#fff", border:0, borderRadius:7, padding:"10px 14px", cursor:"pointer" }}>Guardar datos</button>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0, color: "#1B2A4A", fontSize: 18 }}>Cambiar contraseña</h2>
        <label style={label}>Contraseña actual<input type="password" value={password.currentPassword} onChange={e=>setPassword({...password,currentPassword:e.target.value})} style={input} /></label>
        <label style={label}>Nueva contraseña, mínimo 12 caracteres<input type="password" value={password.newPassword} onChange={e=>setPassword({...password,newPassword:e.target.value})} style={input} /></label>
        <label style={label}>Confirmar nueva contraseña<input type="password" value={password.confirm} onChange={e=>setPassword({...password,confirm:e.target.value})} style={input} /></label>
        <button disabled={saving} onClick={()=> {
          if(password.newPassword !== password.confirm) { setError("Las contraseñas no coinciden."); return; }
          run(()=>api.changePassword({currentPassword:password.currentPassword,newPassword:password.newPassword}),"Contraseña actualizada.");
        }} style={{ marginTop: 16, background:"#1B2A4A", color:"#fff", border:0, borderRadius:7, padding:"10px 14px", cursor:"pointer" }}>Actualizar contraseña</button>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0, color: "#1B2A4A", fontSize: 18 }}>Solicitud de cambio de razón social</h2>
        <p style={{ fontSize: 13, color: "#6b7280" }}>Adjunte primero el certificado de Cámara de Comercio o certificado comercial vigente. GLV revisará la solicitud antes de cambiar el nombre.</p>
        <label style={label}>Certificado<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>setFile(e.target.files?.[0]||null)} style={input} /></label>
        <label style={label}>Nueva razón social<input value={nameChange.requested_name} onChange={e=>setNameChange({...nameChange,requested_name:e.target.value})} style={input} /></label>
        <label style={label}>Motivo<textarea value={nameChange.reason} onChange={e=>setNameChange({...nameChange,reason:e.target.value})} style={{...input,minHeight:70}} /></label>
        <button disabled={saving} onClick={()=>run(async()=>{
          if (!file) throw new Error("Adjunte el certificado comercial.");
          const fd=new FormData(); fd.append("file",file); fd.append("document_type","COMMERCIAL_CERTIFICATE"); fd.append("notes","Soporte para cambio de razón social");
          const doc=await api.uploadClientDocument(profile.client_id,fd);
          await api.createClientNameRequest({...nameChange,evidence_document_id:doc.id});
          setFile(null); setNameChange({requested_name:"",reason:"",evidence_document_id:""});
        },"Solicitud enviada para revisión de GLV.")} style={{ marginTop: 16, background:"#1B2A4A", color:"#fff", border:0, borderRadius:7, padding:"10px 14px", cursor:"pointer" }}>Enviar solicitud</button>
        {requests.length > 0 && <div style={{ marginTop: 18, fontSize: 13 }}>{requests.map(r=><p key={r.id} style={{ borderTop:"1px solid #e5e7eb", paddingTop:9 }}><b>{r.requested_name}</b> · {r.status} · {r.created_at}</p>)}</div>}
      </section>
    </div>
  </main>;
}