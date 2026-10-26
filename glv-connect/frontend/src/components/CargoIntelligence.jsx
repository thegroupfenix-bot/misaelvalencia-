import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

const ROLE_LEVEL = {
  SUPER_ADMIN:100,CORPORATE_ADMIN:90,CFO:80,DIRECTOR:75,DIRECTIVO:75,
  COMMERCIAL_MANAGER:72,COMMERCIAL_DIRECTOR:70,COMPLIANCE:65,ACCOUNTING:60,
  TREASURY:60,AUDIT:55,TAX_REVIEWER:50,COUNTRY_ACCOUNTANT:50,LOGISTICS:45,
  AGENTE:40,COMMERCIAL_AGENT:42,MEDIA_MANAGER:35,CLIENT:20,SUPPLIER:20,
};
function roleLevel(role) { return ROLE_LEVEL[role] || 0; }

const STATUS_COLORS = { DRAFT:"#2563eb", CONFIRMED:"#059669", SUPERSEDED:"#6b7280" };

// ── Isometric Canvas Visualization ───────────────────────────────────────────
function IsometricView({ placements }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !placements || !placements.length) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const SCALE = 22;
    const ISO_X = 0.866;
    const ISO_Y = 0.5;
    const OX = W / 2, OY = H * 0.15;

    function toIso(x, y, z) {
      return {
        sx: OX + (x - y) * ISO_X * SCALE,
        sy: OY + (x + y) * ISO_Y * SCALE - z * SCALE,
      };
    }

    const COLORS_TOP   = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4"];
    const COLORS_LEFT  = ["#1d4ed8","#047857","#b45309","#6d28d9","#b91c1c","#0e7490"];
    const COLORS_RIGHT = ["#2563eb","#059669","#d97706","#7c3aed","#dc2626","#0891b2"];

    const groups = {};
    placements.forEach(p => {
      const k = `${p.equip_code || "EQ"}-${p.equipment_index}`;
      if (!groups[k]) groups[k] = { profile: p, pieces: [] };
      groups[k].pieces.push(p);
    });

    let gi = 0;
    Object.values(groups).forEach(({ profile, pieces }) => {
      const L = profile.int_length_m || 12;
      const W2 = profile.int_width_m  || 2.35;
      const H2 = profile.int_height_m || 2.69;
      const bx = gi * (L + 1);

      // Container outline
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      const corners = [
        toIso(bx, 0, 0), toIso(bx+L, 0, 0), toIso(bx+L, W2, 0), toIso(bx, W2, 0),
        toIso(bx, 0, H2), toIso(bx+L, 0, H2), toIso(bx+L, W2, H2), toIso(bx, W2, H2),
      ];
      ctx.beginPath();
      [0,1,2,3,0].forEach((i,idx) => idx===0 ? ctx.moveTo(corners[i].sx,corners[i].sy) : ctx.lineTo(corners[i].sx,corners[i].sy));
      ctx.stroke();
      ctx.beginPath();
      [4,5,6,7,4].forEach((i,idx) => idx===0 ? ctx.moveTo(corners[i].sx,corners[i].sy) : ctx.lineTo(corners[i].sx,corners[i].sy));
      ctx.stroke();
      for (let k=0;k<4;k++) {
        ctx.beginPath(); ctx.moveTo(corners[k].sx,corners[k].sy); ctx.lineTo(corners[k+4].sx,corners[k+4].sy); ctx.stroke();
      }

      // Pieces
      pieces.forEach((p, pi) => {
        const ci = pi % COLORS_TOP.length;
        const px = bx + p.x_m, py = p.y_m, pz = p.z_m;
        const pl = p.cargo_l || 1, pw = p.cargo_w || 1, ph = p.cargo_h || 1;

        // Top face
        const t0=toIso(px,py,pz+ph), t1=toIso(px+pl,py,pz+ph);
        const t2=toIso(px+pl,py+pw,pz+ph), t3=toIso(px,py+pw,pz+ph);
        ctx.fillStyle = COLORS_TOP[ci];
        ctx.beginPath(); ctx.moveTo(t0.sx,t0.sy); ctx.lineTo(t1.sx,t1.sy); ctx.lineTo(t2.sx,t2.sy); ctx.lineTo(t3.sx,t3.sy); ctx.closePath(); ctx.fill();

        // Left face
        const l0=toIso(px,py,pz), l1=toIso(px+pl,py,pz);
        ctx.fillStyle = COLORS_LEFT[ci];
        ctx.beginPath(); ctx.moveTo(l0.sx,l0.sy); ctx.lineTo(l1.sx,l1.sy); ctx.lineTo(t1.sx,t1.sy); ctx.lineTo(t0.sx,t0.sy); ctx.closePath(); ctx.fill();

        // Right face
        const r0=toIso(px+pl,py,pz), r1=toIso(px+pl,py+pw,pz);
        ctx.fillStyle = COLORS_RIGHT[ci];
        ctx.beginPath(); ctx.moveTo(r0.sx,r0.sy); ctx.lineTo(r1.sx,r1.sy); ctx.lineTo(t2.sx,t2.sy); ctx.lineTo(t1.sx,t1.sy); ctx.closePath(); ctx.fill();

        // Label
        ctx.fillStyle = "#fff";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`L${p.piece_index||pi+1}`, (t0.sx+t2.sx)/2, (t0.sy+t2.sy)/2+3);
      });

      // Container label
      ctx.fillStyle = "#475569";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      const labelPos = toIso(bx+L/2, W2/2, -0.3);
      ctx.fillText(profile.equip_code || `Container ${gi+1}`, labelPos.sx, labelPos.sy);

      gi++;
    });
  }, [placements]);

  return (
    <canvas
      ref={canvasRef}
      width={820}
      height={400}
      style={{ width:"100%", borderRadius:8, background:"var(--color-background-secondary,#f8fafc)" }}
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CargoIntelligence({ user }) {
  const lvl = roleLevel(user?.role);
  const [view, setView]           = useState("list");
  const [calculations, setCalcs]  = useState([]);
  const [equipProfiles, setEquip] = useState([]);
  const [cargoTypes, setTypes]    = useState([]);
  const [selected, setSelected]   = useState(null);
  const [placements, setPlacements] = useState([]);
  const [form, setForm]           = useState({ reference:"", mode:"container", notes:"", lines:[] });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    load();
    api.getCargoEquipmentProfiles().then(setEquip).catch(()=>{});
    api.getCargoTypes().then(setTypes).catch(()=>{});
  }, []);

  async function load() {
    setLoading(true);
    try { setCalcs(await api.getCargoCalculations()); }
    catch { setError("Error cargando cálculos"); }
    finally { setLoading(false); }
  }

  async function openCalc(calc) {
    setLoading(true);
    try {
      const detail = await api.getCargoCalculation(calc.id);
      setSelected(detail);
      const places = await api.getCargoCalculationPlacements(calc.id).catch(()=>[]);
      setPlacements(places);
      setView("detail");
    } catch { setError("Error abriendo cálculo"); }
    finally { setLoading(false); }
  }

  function startNew() {
    setForm({ reference:"", mode:"container", notes:"", lines:[{
      cargo_type_id: cargoTypes[0]?.id || 1, description:"", quantity:1, length_m:1, width_m:1, height_m:1, weight_kg:100, stackable:false,
    }] });
    setView("new");
  }

  function addLine() {
    setForm(f => ({ ...f, lines: [...f.lines, {
      cargo_type_id: cargoTypes[0]?.id || 1, description:"", quantity:1, length_m:1, width_m:1, height_m:1, weight_kg:100, stackable:false,
    }] }));
  }

  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_,idx)=>idx!==i) }));
  }

  function updateLine(i, field, value) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [field]: value };
      return { ...f, lines };
    });
  }

  async function saveCalc() {
    if (!form.reference) return setError("La referencia es obligatoria");
    setLoading(true); setError("");
    try {
      const res = await api.createCargoCalculation({ ...form, lines: form.lines.map(l=>({...l,quantity:+l.quantity,length_m:+l.length_m,width_m:+l.width_m,height_m:+l.height_m,weight_kg:+l.weight_kg})) });
      await load();
      const detail = await api.getCargoCalculation(res.id);
      setSelected(detail);
      setPlacements([]);
      setView("detail");
    } catch(e) { setError(e.message || "Error creando cálculo"); }
    finally { setLoading(false); }
  }

  async function compute() {
    if (!selected) return;
    setLoading(true); setError("");
    try {
      await api.computeCargoCalculation(selected.id);
      const detail = await api.getCargoCalculation(selected.id);
      const places = await api.getCargoCalculationPlacements(selected.id).catch(()=>[]);
      setSelected(detail);
      setPlacements(places);
    } catch(e) { setError(e.message || "Error calculando"); }
    finally { setLoading(false); }
  }

  async function confirm() {
    if (!selected) return;
    setLoading(true); setError("");
    try {
      await api.confirmCargoCalculation(selected.id);
      const detail = await api.getCargoCalculation(selected.id);
      setSelected(detail);
      await load();
    } catch(e) { setError(e.message || "Error confirmando"); }
    finally { setLoading(false); }
  }

  async function newVersion() {
    if (!selected) return;
    setLoading(true); setError("");
    try {
      const res = await api.newCargoVersion(selected.id);
      const detail = await api.getCargoCalculation(res.id);
      setSelected(detail);
      setPlacements([]);
      await load();
    } catch(e) { setError(e.message || "Error creando versión"); }
    finally { setLoading(false); }
  }

  const s = { borderRadius:8, background:"var(--color-background-secondary,#fff)", padding:16, marginBottom:12 };

  // ── List ──────────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div style={{ fontFamily:"var(--font-sans,sans-serif)", color:"var(--color-text-primary,#1e293b)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <h2 style={{ margin:0, display:"flex", alignItems:"center", gap:8 }}>
          <i className="ti ti-package" style={{ fontSize:24, color:"#0891b2" }} />
          Cargo Intelligence
        </h2>
        {lvl >= 40 && (
          <button onClick={startNew} style={{ background:"#0891b2", color:"#fff", border:"none", borderRadius:6, padding:"8px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            <i className="ti ti-plus" /> Nuevo Cálculo
          </button>
        )}
      </div>
      {error && <div style={{ ...s, background:"#fef2f2", color:"#dc2626", borderLeft:"4px solid #dc2626" }}>{error}</div>}
      {loading && <div style={{ textAlign:"center", padding:40, color:"#64748b" }}><i className="ti ti-loader-2" style={{ fontSize:24 }} /></div>}
      {!loading && !calculations.length && (
        <div style={{ ...s, textAlign:"center", color:"#94a3b8", padding:40 }}>
          <i className="ti ti-package-off" style={{ fontSize:40, display:"block", marginBottom:8 }} />
          No hay cálculos de carga registrados
        </div>
      )}
      {!loading && calculations.map(c => (
        <div key={c.id} onClick={() => openCalc(c)} style={{ ...s, cursor:"pointer", borderLeft:`4px solid ${STATUS_COLORS[c.status]||"#94a3b8"}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:600, marginBottom:4 }}>{c.reference}</div>
            <div style={{ fontSize:12, color:"#64748b" }}>
              Modo: {c.mode === "container" ? "Contenedor" : "Granel"} · v{c.version} · {c.creator_name || "-"}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {c.total_cbm != null && <span style={{ fontSize:12, color:"#0891b2" }}>{c.total_cbm} m³</span>}
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:12, background:STATUS_COLORS[c.status]+"20", color:STATUS_COLORS[c.status], fontWeight:600 }}>{c.status}</span>
            <i className="ti ti-chevron-right" style={{ color:"#94a3b8" }} />
          </div>
        </div>
      ))}
    </div>
  );

  // ── New Form ──────────────────────────────────────────────────────────────
  if (view === "new") return (
    <div style={{ fontFamily:"var(--font-sans,sans-serif)", color:"var(--color-text-primary,#1e293b)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={()=>setView("list")} style={{ background:"none", border:"none", cursor:"pointer", color:"#64748b", fontSize:20 }}>
          <i className="ti ti-arrow-left" />
        </button>
        <h2 style={{ margin:0 }}>Nuevo Cálculo de Carga</h2>
      </div>
      {error && <div style={{ ...s, background:"#fef2f2", color:"#dc2626", borderLeft:"4px solid #dc2626" }}>{error}</div>}
      <div style={s}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:600, display:"block", marginBottom:4 }}>Referencia *</label>
            <input value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))}
              style={{ width:"100%", padding:8, borderRadius:6, border:"1px solid var(--color-border-tertiary,#e2e8f0)", boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, display:"block", marginBottom:4 }}>Modo</label>
            <select value={form.mode} onChange={e=>setForm(f=>({...f,mode:e.target.value}))}
              style={{ width:"100%", padding:8, borderRadius:6, border:"1px solid var(--color-border-tertiary,#e2e8f0)" }}>
              <option value="container">Contenedor</option>
              <option value="bulk">Granel / Buque</option>
            </select>
          </div>
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:600, display:"block", marginBottom:4 }}>Notas</label>
          <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
            rows={2} style={{ width:"100%", padding:8, borderRadius:6, border:"1px solid var(--color-border-tertiary,#e2e8f0)", resize:"vertical", boxSizing:"border-box" }} />
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <h3 style={{ margin:0, fontSize:15 }}>Líneas de Carga</h3>
        <button onClick={addLine} style={{ background:"#0891b2", color:"#fff", border:"none", borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:12 }}>
          <i className="ti ti-plus" /> Agregar
        </button>
      </div>

      {form.lines.map((line, i) => (
        <div key={i} style={{ ...s, position:"relative" }}>
          <button onClick={()=>removeLine(i)} style={{ position:"absolute", top:8, right:8, background:"none", border:"none", cursor:"pointer", color:"#dc2626" }}>
            <i className="ti ti-x" />
          </button>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:8 }}>
            <div>
              <label style={{ fontSize:11, display:"block", marginBottom:3 }}>Tipo de Carga</label>
              <select value={line.cargo_type_id} onChange={e=>updateLine(i,"cargo_type_id",+e.target.value)}
                style={{ width:"100%", padding:6, borderRadius:5, border:"1px solid var(--color-border-tertiary,#e2e8f0)", fontSize:12 }}>
                {cargoTypes.filter(t => form.mode === "bulk" ? t.category === "bulk" : t.category === "packaged").map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, display:"block", marginBottom:3 }}>Descripción</label>
              <input value={line.description} onChange={e=>updateLine(i,"description",e.target.value)}
                style={{ width:"100%", padding:6, borderRadius:5, border:"1px solid var(--color-border-tertiary,#e2e8f0)", fontSize:12, boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ fontSize:11, display:"block", marginBottom:3 }}>Cantidad</label>
              <input type="number" min={1} value={line.quantity} onChange={e=>updateLine(i,"quantity",e.target.value)}
                style={{ width:"100%", padding:6, borderRadius:5, border:"1px solid var(--color-border-tertiary,#e2e8f0)", fontSize:12, boxSizing:"border-box" }} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:8 }}>
            {["length_m","width_m","height_m"].map(f => (
              <div key={f}>
                <label style={{ fontSize:11, display:"block", marginBottom:3 }}>{f==="length_m"?"Largo (m)":f==="width_m"?"Ancho (m)":"Alto (m)"}</label>
                <input type="number" step="0.01" value={line[f]} onChange={e=>updateLine(i,f,e.target.value)}
                  style={{ width:"100%", padding:6, borderRadius:5, border:"1px solid var(--color-border-tertiary,#e2e8f0)", fontSize:12, boxSizing:"border-box" }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize:11, display:"block", marginBottom:3 }}>Peso/pieza (kg)</label>
              <input type="number" step="0.1" value={line.weight_kg} onChange={e=>updateLine(i,"weight_kg",e.target.value)}
                style={{ width:"100%", padding:6, borderRadius:5, border:"1px solid var(--color-border-tertiary,#e2e8f0)", fontSize:12, boxSizing:"border-box" }} />
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, paddingTop:16 }}>
              <input type="checkbox" checked={!!line.stackable} onChange={e=>updateLine(i,"stackable",e.target.checked)} id={`stack-${i}`} />
              <label htmlFor={`stack-${i}`} style={{ fontSize:11 }}>Apilable</label>
            </div>
          </div>
        </div>
      ))}

      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:12 }}>
        <button onClick={()=>setView("list")} style={{ padding:"8px 16px", borderRadius:6, border:"1px solid var(--color-border-tertiary,#e2e8f0)", background:"none", cursor:"pointer" }}>
          Cancelar
        </button>
        <button onClick={saveCalc} disabled={loading} style={{ background:"#0891b2", color:"#fff", border:"none", borderRadius:6, padding:"8px 20px", cursor:"pointer" }}>
          {loading ? "Guardando..." : "Guardar Cálculo"}
        </button>
      </div>
    </div>
  );

  // ── Detail ────────────────────────────────────────────────────────────────
  if (view === "detail" && selected) {
    const statusColor = STATUS_COLORS[selected.status] || "#94a3b8";
    const hasPlacements = placements && placements.length > 0;
    const canCompute = selected.status === "DRAFT" && (selected.lines || []).length > 0 && lvl >= 40;
    const canConfirm = selected.status === "DRAFT" && selected.total_cbm && lvl >= 45;
    const canVersion = selected.status === "CONFIRMED" && lvl >= 40;

    return (
      <div style={{ fontFamily:"var(--font-sans,sans-serif)", color:"var(--color-text-primary,#1e293b)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <button onClick={()=>{ setView("list"); load(); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#64748b", fontSize:20 }}>
            <i className="ti ti-arrow-left" />
          </button>
          <div style={{ flex:1 }}>
            <h2 style={{ margin:0 }}>{selected.reference}</h2>
            <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>
              {selected.mode === "container" ? "Contenedor" : "Granel"} · v{selected.version} · {selected.creator_name}
            </div>
          </div>
          <span style={{ padding:"4px 12px", borderRadius:16, background:statusColor+"20", color:statusColor, fontWeight:700, fontSize:12 }}>
            {selected.status}
          </span>
        </div>
        {error && <div style={{ ...s, background:"#fef2f2", color:"#dc2626", borderLeft:"4px solid #dc2626" }}>{error}</div>}

        {/* Summary cards */}
        {selected.total_cbm != null && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
            {[
              { label:"Volumen Total", value:`${selected.total_cbm} m³`, icon:"ti-box", color:"#0891b2" },
              { label:"Peso Total", value:`${(selected.total_weight_kg/1000).toFixed(2)} t`, icon:"ti-weight", color:"#7c3aed" },
              { label:"Equipos", value:selected.equipment_count, icon:"ti-container", color:"#059669" },
              { label:"Factor de Estiba", value:selected.stowage_factor ? `${selected.stowage_factor} m³/t` : "N/A", icon:"ti-chart-bar", color:"#d97706" },
            ].map(card => (
              <div key={card.label} style={{ ...s, textAlign:"center" }}>
                <i className={`ti ${card.icon}`} style={{ fontSize:24, color:card.color, display:"block", marginBottom:4 }} />
                <div style={{ fontSize:18, fontWeight:700, color:card.color }}>{card.value}</div>
                <div style={{ fontSize:11, color:"#64748b" }}>{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 3D Visualization */}
        {hasPlacements && (
          <div style={{ ...s, marginBottom:16 }}>
            <h3 style={{ margin:"0 0 12px 0", fontSize:14, display:"flex", alignItems:"center", gap:6 }}>
              <i className="ti ti-3d-cube-sphere" style={{ color:"#0891b2" }} /> Visualización Isométrica
            </h3>
            <IsometricView placements={placements} />
          </div>
        )}

        {/* Cargo lines */}
        <div style={{ ...s, marginBottom:16 }}>
          <h3 style={{ margin:"0 0 12px 0", fontSize:14 }}>Líneas de Carga ({(selected.lines||[]).length})</h3>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"var(--color-background-tertiary,#f1f5f9)" }}>
                {["Tipo","Descripción","Cant","L×A×H (m)","Peso/pza (kg)","CBM total","Apilable"].map(h=>(
                  <th key={h} style={{ padding:"6px 10px", textAlign:"left", fontWeight:600, fontSize:11, color:"#64748b" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(selected.lines||[]).map((l,i) => {
                const cbm = (l.length_m * l.width_m * l.height_m * l.quantity).toFixed(3);
                return (
                  <tr key={i} style={{ borderTop:"1px solid var(--color-border-tertiary,#e2e8f0)" }}>
                    <td style={{ padding:"6px 10px" }}><span style={{ fontSize:10, background:"#e0f2fe", color:"#0369a1", padding:"2px 6px", borderRadius:4 }}>{l.cargo_type_code || l.cargo_type_name}</span></td>
                    <td style={{ padding:"6px 10px" }}>{l.description || "—"}</td>
                    <td style={{ padding:"6px 10px" }}>{l.quantity}</td>
                    <td style={{ padding:"6px 10px" }}>{l.length_m}×{l.width_m}×{l.height_m}</td>
                    <td style={{ padding:"6px 10px" }}>{l.weight_kg}</td>
                    <td style={{ padding:"6px 10px" }}>{cbm}</td>
                    <td style={{ padding:"6px 10px" }}>{l.stackable ? "✓" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {canCompute && (
            <button onClick={compute} disabled={loading} style={{ background:"#2563eb", color:"#fff", border:"none", borderRadius:6, padding:"8px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              <i className="ti ti-calculator" /> {loading?"Calculando...":"Calcular"}
            </button>
          )}
          {canConfirm && (
            <button onClick={confirm} disabled={loading} style={{ background:"#059669", color:"#fff", border:"none", borderRadius:6, padding:"8px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              <i className="ti ti-check" /> Confirmar
            </button>
          )}
          {canVersion && (
            <button onClick={newVersion} disabled={loading} style={{ background:"#7c3aed", color:"#fff", border:"none", borderRadius:6, padding:"8px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              <i className="ti ti-git-branch" /> Nueva Versión
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
