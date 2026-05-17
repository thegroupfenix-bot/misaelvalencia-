import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api.js";

const PALETTE = {
  navy: "#1B2A4A", gold: "#C8A84B", green: "#16a34a", yellow: "#d97706",
  red: "#dc2626", blue: "#2563eb", purple: "#7c3aed", gray: "#6b7280",
  light: "#f8fafc", border: "#e2e8f0", white: "#ffffff",
};

const CATEGORY_ICONS = {
  "products/fruits": "🍎", "products/live-animals": "🐑", "products/meat": "🥩",
  "products/grains": "🌾", "products/oils": "🫒", "products/frozen": "❄️",
  "operations": "⚙️", "certificates": "📜", "branding": "🏢", "corporate": "💼",
  "general": "📁",
};

const STATUS_COLOR = { active: PALETTE.green, pending: PALETTE.yellow, deleted: PALETTE.red };

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function TagChip({ tag, onRemove }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"#e0e7ff",
      color:"#3730a3", borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:500 }}>
      {tag}
      {onRemove && <button onClick={() => onRemove(tag)} style={{ background:"none", border:"none",
        cursor:"pointer", color:"#3730a3", padding:0, fontSize:14, lineHeight:1 }}>×</button>}
    </span>
  );
}

function UploadZone({ onFiles, uploading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith("image/") || f.type === "application/pdf");
    if (files.length) onFiles(files);
  }, [onFiles]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? PALETTE.gold : PALETTE.border}`,
        borderRadius: 12, padding: "32px 24px", textAlign: "center", cursor: "pointer",
        background: dragging ? "#fefce8" : "#f8fafc",
        transition: "all 0.2s", marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 8 }}>📤</div>
      <div style={{ fontWeight: 600, color: PALETTE.navy, marginBottom: 4 }}>
        {uploading ? "Subiendo archivos..." : "Arrastra archivos aquí o haz clic para seleccionar"}
      </div>
      <div style={{ fontSize: 13, color: PALETTE.gray }}>
        JPG, PNG, WebP, PDF — máx. 20MB por archivo — hasta 20 archivos
      </div>
      <input ref={inputRef} type="file" multiple accept="image/*,application/pdf"
        style={{ display:"none" }} onChange={e => onFiles(Array.from(e.target.files))} />
    </div>
  );
}

function UploadModal({ onClose, onUploaded, user }) {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState("products/fruits");
  const [subcategory, setSub] = useState("");
  const [country, setCountry] = useState("");
  const [productRelation, setProductRel] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  const CATS = [
    "products/fruits/colombia","products/fruits/brazil","products/fruits/peru","products/fruits/chile",
    "products/live-animals","products/meat","products/grains","products/oils","products/frozen",
    "operations/inspection","operations/loading","operations/certificates","operations/audit",
    "certificates/halal","certificates/sgs","certificates/health","certificates/origin",
    "branding/logos","branding/templates","corporate","general",
  ];

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) { setTags(prev => [...prev, t]); setTagInput(""); }
  };

  const doUpload = async () => {
    if (!files.length) return;
    setProgress(0);
    const fd = new FormData();
    files.forEach(f => fd.append("files", f));
    fd.append("category", category);
    if (subcategory) fd.append("subcategory", subcategory);
    if (country) fd.append("country_origin", country);
    if (productRelation) fd.append("product_relation", productRelation);
    fd.append("tags", JSON.stringify(tags));
    setProgress(50);
    const res = await api.uploadMedia(fd);
    setProgress(100);
    setResult(res);
    onUploaded?.();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:PALETTE.white, borderRadius:16, width:"min(600px,95vw)",
        maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${PALETTE.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontWeight:700, fontSize:18, color:PALETTE.navy }}>📤 Subir Archivos</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20,
            cursor:"pointer", color:PALETTE.gray }}>×</button>
        </div>
        <div style={{ padding:24 }}>
          {!result ? (
            <>
              <UploadZone onFiles={setFiles} uploading={progress !== null && progress < 100} />
              {files.length > 0 && (
                <div style={{ marginBottom:16, background:"#f0fdf4", borderRadius:8,
                  padding:"8px 12px", fontSize:13 }}>
                  {files.length} archivo(s): {files.map(f=>f.name).join(", ")}
                </div>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:PALETTE.navy }}>Categoría *</label>
                  <select value={category} onChange={e=>setCategory(e.target.value)}
                    style={{ width:"100%", marginTop:4, padding:"8px 10px", borderRadius:8,
                      border:`1px solid ${PALETTE.border}`, fontSize:13 }}>
                    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:PALETTE.navy }}>País de origen</label>
                  <input value={country} onChange={e=>setCountry(e.target.value)}
                    placeholder="Colombia, Brazil..." style={{ width:"100%", marginTop:4,
                      padding:"8px 10px", borderRadius:8, border:`1px solid ${PALETTE.border}`,
                      fontSize:13, boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:PALETTE.navy }}>Subcategoría</label>
                  <input value={subcategory} onChange={e=>setSub(e.target.value)}
                    placeholder="Dorper, Halal, Fresh..." style={{ width:"100%", marginTop:4,
                      padding:"8px 10px", borderRadius:8, border:`1px solid ${PALETTE.border}`,
                      fontSize:13, boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:PALETTE.navy }}>Producto relacionado</label>
                  <input value={productRelation} onChange={e=>setProductRel(e.target.value)}
                    placeholder="DORPER, AVOCADO_HASS..." style={{ width:"100%", marginTop:4,
                      padding:"8px 10px", borderRadius:8, border:`1px solid ${PALETTE.border}`,
                      fontSize:13, boxSizing:"border-box" }} />
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:13, fontWeight:600, color:PALETTE.navy }}>Tags</label>
                <div style={{ display:"flex", gap:8, marginTop:4 }}>
                  <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter" && addTag()}
                    placeholder="Escribe un tag y presiona Enter"
                    style={{ flex:1, padding:"8px 10px", borderRadius:8,
                      border:`1px solid ${PALETTE.border}`, fontSize:13 }} />
                  <button onClick={addTag} style={{ padding:"8px 16px", background:PALETTE.navy,
                    color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>+</button>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                  {tags.map(t => <TagChip key={t} tag={t} onRemove={tag=>setTags(prev=>prev.filter(x=>x!==tag))} />)}
                </div>
              </div>
              {progress !== null && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ height:6, background:"#e2e8f0", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${progress}%`, background:PALETTE.gold,
                      transition:"width 0.3s" }} />
                  </div>
                  <div style={{ fontSize:12, color:PALETTE.gray, marginTop:4 }}>Subiendo... {progress}%</div>
                </div>
              )}
              <button onClick={doUpload} disabled={!files.length || progress !== null}
                style={{ width:"100%", padding:"12px", background: files.length ? PALETTE.navy : "#9ca3af",
                  color:"white", border:"none", borderRadius:10, cursor: files.length ? "pointer":"not-allowed",
                  fontWeight:700, fontSize:15 }}>
                Subir {files.length} archivo(s)
              </button>
            </>
          ) : (
            <div>
              <div style={{ fontSize:40, textAlign:"center", marginBottom:12 }}>✅</div>
              <div style={{ fontWeight:700, textAlign:"center", color:PALETTE.green, marginBottom:16 }}>
                {result.uploaded?.filter(u=>!u.error)?.length} archivo(s) subidos exitosamente
              </div>
              {result.uploaded?.filter(u=>u.duplicate)?.length > 0 && (
                <div style={{ background:"#fef3c7", borderRadius:8, padding:"8px 12px", marginBottom:12, fontSize:13 }}>
                  ⚠️ {result.uploaded.filter(u=>u.duplicate).length} duplicado(s) detectados — no se volvieron a subir
                </div>
              )}
              {result.uploaded?.filter(u=>u.error)?.length > 0 && (
                <div style={{ background:"#fee2e2", borderRadius:8, padding:"8px 12px", marginBottom:12, fontSize:13 }}>
                  ❌ Errores: {result.uploaded.filter(u=>u.error).map(u=>u.originalname).join(", ")}
                </div>
              )}
              <button onClick={onClose} style={{ width:"100%", padding:12, background:PALETTE.navy,
                color:"white", border:"none", borderRadius:10, cursor:"pointer", fontWeight:700 }}>
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetDetailModal({ asset, onClose, onUpdated, canEdit }) {
  const [tags, setTags] = useState(asset.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await api.updateMedia(asset.id, { tags });
    setSaving(false);
    onUpdated?.();
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) { setTags(prev=>[...prev,t]); setTagInput(""); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1001,
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:PALETTE.white, borderRadius:16, width:"min(700px,95vw)",
        maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"16px 24px", borderBottom:`1px solid ${PALETTE.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontWeight:700, fontSize:16, color:PALETTE.navy }}>{asset.original_name}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20,
            cursor:"pointer", color:PALETTE.gray }}>×</button>
        </div>
        <div style={{ display:"flex", gap:0 }}>
          <div style={{ flex:1, padding:24 }}>
            {asset.mime_type?.startsWith("image/") && asset.public_url ? (
              <img src={asset.public_url} alt={asset.original_name}
                style={{ width:"100%", borderRadius:10, objectFit:"cover", maxHeight:300 }} />
            ) : (
              <div style={{ height:200, background:"#f1f5f9", borderRadius:10,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:48, color:PALETTE.gray }}>
                {asset.mime_type === "application/pdf" ? "📄" : "📁"}
              </div>
            )}
            {asset.public_url && (
              <a href={asset.public_url} target="_blank" rel="noopener noreferrer"
                style={{ display:"block", textAlign:"center", marginTop:10, color:PALETTE.blue,
                  fontSize:13, textDecoration:"none" }}>
                🔗 Abrir en nueva pestaña
              </a>
            )}
          </div>
          <div style={{ width:280, padding:24, borderLeft:`1px solid ${PALETTE.border}` }}>
            <InfoRow label="Categoría" value={asset.category} />
            <InfoRow label="Subcategoría" value={asset.subcategory} />
            <InfoRow label="País" value={asset.country_origin} />
            <InfoRow label="Producto" value={asset.product_relation} />
            <InfoRow label="Tamaño" value={formatBytes(asset.file_size)} />
            <InfoRow label="Dimensiones" value={asset.image_width ? `${asset.image_width}×${asset.image_height}px` : null} />
            <InfoRow label="Subido por" value={asset.uploaded_by} />
            <InfoRow label="Fecha" value={asset.upload_date?.slice(0,10)} />
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:PALETTE.gray, marginBottom:6 }}>TAGS</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
                {tags.map(t => <TagChip key={t} tag={t} onRemove={canEdit ? tag=>setTags(p=>p.filter(x=>x!==tag)) : null} />)}
              </div>
              {canEdit && (
                <div style={{ display:"flex", gap:6 }}>
                  <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter" && addTag()} placeholder="Nuevo tag"
                    style={{ flex:1, padding:"6px 8px", borderRadius:6,
                      border:`1px solid ${PALETTE.border}`, fontSize:12 }} />
                  <button onClick={addTag} style={{ padding:"6px 10px", background:PALETTE.navy,
                    color:"white", border:"none", borderRadius:6, cursor:"pointer", fontSize:12 }}>+</button>
                </div>
              )}
            </div>
            {canEdit && (
              <button onClick={save} disabled={saving} style={{ width:"100%", marginTop:16,
                padding:"8px", background:PALETTE.navy, color:"white", border:"none",
                borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ fontSize:11, fontWeight:600, color:PALETTE.gray, textTransform:"uppercase" }}>{label}</div>
      <div style={{ fontSize:13, color:PALETTE.navy }}>{value}</div>
    </div>
  );
}

function AssetCard({ asset, onSelect }) {
  const isImg = asset.mime_type?.startsWith("image/");
  const thumb = asset.thumbnail_url || asset.public_url;
  return (
    <div onClick={() => onSelect(asset)} style={{ background:PALETTE.white, borderRadius:12,
      border:`1px solid ${PALETTE.border}`, overflow:"hidden", cursor:"pointer",
      transition:"all 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.12)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)"}>
      <div style={{ height:140, background:"#f1f5f9", overflow:"hidden",
        display:"flex", alignItems:"center", justifyContent:"center" }}>
        {isImg && thumb ? (
          <img src={thumb} alt={asset.original_name} loading="lazy"
            style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        ) : (
          <span style={{ fontSize:48 }}>{asset.mime_type==="application/pdf" ? "📄" : "📁"}</span>
        )}
      </div>
      <div style={{ padding:"10px 12px" }}>
        <div style={{ fontSize:12, fontWeight:600, color:PALETTE.navy,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={asset.original_name}>
          {asset.original_name}
        </div>
        <div style={{ fontSize:11, color:PALETTE.gray, marginTop:2 }}>
          {asset.category?.split("/").slice(-1)[0]} {asset.country_origin ? `· ${asset.country_origin}` : ""}
        </div>
        <div style={{ fontSize:11, color:PALETTE.gray }}>{formatBytes(asset.file_size)}</div>
        {asset.tags?.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:6 }}>
            {asset.tags.slice(0,3).map(t => (
              <span key={t} style={{ fontSize:10, background:"#e0e7ff", color:"#3730a3",
                borderRadius:10, padding:"1px 7px" }}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MediaCenter({ user }) {
  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState(null);
  const [r2Status, setR2Status] = useState(null);
  const [page, setPage] = useState(0);
  const PER_PAGE = 40;

  const ADMIN_ROLES = new Set(["SUPER_ADMIN","CORPORATE_ADMIN","DIRECTIVO","DIRECTOR_COMERCIAL"]);
  const canEdit = ADMIN_ROLES.has(user?.role) || user?.username === "mvalencia";

  const CATEGORY_LIST = [
    { value:"", label:"Todos los archivos" },
    { value:"products/fruits", label:"🍎 Frutas" },
    { value:"products/fruits/colombia", label:"  ↳ Colombia" },
    { value:"products/fruits/brazil", label:"  ↳ Brasil" },
    { value:"products/fruits/peru", label:"  ↳ Perú" },
    { value:"products/live-animals", label:"🐑 Animales Vivos" },
    { value:"products/meat", label:"🥩 Carnes" },
    { value:"products/grains", label:"🌾 Granos" },
    { value:"products/oils", label:"🫒 Aceites" },
    { value:"operations", label:"⚙️ Operaciones" },
    { value:"certificates", label:"📜 Certificados" },
    { value:"branding", label:"🏢 Branding" },
    { value:"corporate", label:"💼 Corporativo" },
    { value:"general", label:"📁 General" },
  ];

  const COUNTRIES = ["Colombia","Brazil","Peru","Chile","Argentina","Uruguay","Australia","New Zealand","South Africa","USA"];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: PER_PAGE, offset: page * PER_PAGE };
      if (filterCat) params.category = filterCat;
      if (filterCountry) params.country = filterCountry;
      if (search) params.search = search;
      const data = await api.getMedia(params);
      setAssets(data.assets || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterCat, filterCountry, search, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.getR2Status().then(s => setR2Status(s)).catch(() => {});
  }, []);

  const handleSearch = e => { setSearch(e.target.value); setPage(0); };
  const pages = Math.ceil(total / PER_PAGE);

  return (
    <div style={{ display:"flex", height:"100%", minHeight:"calc(100vh - 60px)", background:"#f8fafc" }}>
      {/* Sidebar */}
      <div style={{ width:220, flexShrink:0, background:PALETTE.white,
        borderRight:`1px solid ${PALETTE.border}`, padding:"16px 0", overflowY:"auto" }}>
        <div style={{ padding:"0 16px 12px", fontSize:11, fontWeight:700,
          color:PALETTE.gray, letterSpacing:"0.08em", textTransform:"uppercase" }}>
          Categorías
        </div>
        {CATEGORY_LIST.map(c => (
          <button key={c.value} onClick={() => { setFilterCat(c.value); setPage(0); }}
            style={{ width:"100%", textAlign:"left", padding:"8px 16px", border:"none",
              cursor:"pointer", fontSize:13, color: filterCat===c.value ? PALETTE.gold : PALETTE.navy,
              fontWeight: filterCat===c.value ? 700 : 400,
              background: filterCat===c.value ? "#fef9ee" : "none" }}>
            {c.label}
          </button>
        ))}
        <div style={{ margin:"16px 16px 8px", borderTop:`1px solid ${PALETTE.border}` }} />
        <div style={{ padding:"0 16px 8px", fontSize:11, fontWeight:700,
          color:PALETTE.gray, letterSpacing:"0.08em", textTransform:"uppercase" }}>
          País de origen
        </div>
        <button onClick={() => { setFilterCountry(""); setPage(0); }}
          style={{ width:"100%", textAlign:"left", padding:"6px 16px", background:"none",
            border:"none", cursor:"pointer", fontSize:13,
            color: !filterCountry ? PALETTE.gold : PALETTE.navy,
            fontWeight: !filterCountry ? 700 : 400 }}>
          Todos
        </button>
        {COUNTRIES.map(c => (
          <button key={c} onClick={() => { setFilterCountry(c); setPage(0); }}
            style={{ width:"100%", textAlign:"left", padding:"6px 16px", background:"none",
              border:"none", cursor:"pointer", fontSize:13,
              color: filterCountry===c ? PALETTE.gold : PALETTE.navy,
              fontWeight: filterCountry===c ? 700 : 400 }}>
            {c}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex:1, padding:24, overflowY:"auto" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:PALETTE.navy }}>
              🎯 GLV Media Intelligence Center
            </h2>
            <div style={{ fontSize:13, color:PALETTE.gray, marginTop:2 }}>
              {total} activos · almacenamiento en la nube Cloudflare R2
            </div>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            {r2Status && (
              <span style={{ fontSize:12, padding:"4px 12px", borderRadius:20,
                background: r2Status.configured ? "#dcfce7" : "#fef3c7",
                color: r2Status.configured ? PALETTE.green : PALETTE.yellow, fontWeight:600 }}>
                {r2Status.configured
                  ? `✅ R2 Activo · ${r2Status.auth_mode === "token" ? "API Token" : "S3 Keys"}`
                  : "⚠️ R2 sin configurar"}
              </span>
            )}
            {canEdit && (
              <button onClick={() => setShowUpload(true)}
                style={{ padding:"10px 20px", background:PALETTE.navy, color:"white",
                  border:"none", borderRadius:10, cursor:"pointer", fontWeight:700, fontSize:14,
                  display:"flex", alignItems:"center", gap:8 }}>
                📤 Subir archivos
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom:20 }}>
          <input value={search} onChange={handleSearch} placeholder="Buscar por nombre, tags, subcategoría..."
            style={{ width:"100%", padding:"10px 16px", borderRadius:10,
              border:`1px solid ${PALETTE.border}`, fontSize:14,
              boxSizing:"border-box", background:PALETTE.white, outline:"none" }} />
        </div>

        {/* R2 warning banner */}
        {r2Status && !r2Status.configured && (
          <div style={{ background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:10,
            padding:"12px 16px", marginBottom:20, fontSize:13, color:"#92400e" }}>
            ⚠️ <strong>R2 no configurado.</strong> Configure las variables de entorno en Railway:
            <code style={{ margin:"0 4px", background:"#fde68a", padding:"1px 6px", borderRadius:4 }}>CLOUDFLARE_ACCOUNT_ID</code>
            <code style={{ margin:"0 4px", background:"#fde68a", padding:"1px 6px", borderRadius:4 }}>R2_BUCKET_NAME</code>
            <code style={{ margin:"0 4px", background:"#fde68a", padding:"1px 6px", borderRadius:4 }}>R2_API_TOKEN</code>
            (o alternativamente <code style={{ margin:"0 4px", background:"#fde68a", padding:"1px 6px", borderRadius:4 }}>R2_ACCESS_KEY_ID</code>
            + <code style={{ margin:"0 4px", background:"#fde68a", padding:"1px 6px", borderRadius:4 }}>R2_SECRET_ACCESS_KEY</code>).
            Los archivos subidos quedan en espera hasta que R2 esté activo.
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:PALETTE.gray, fontSize:16 }}>
            Cargando activos...
          </div>
        ) : assets.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:PALETTE.gray }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
            <div style={{ fontWeight:600, fontSize:16 }}>No hay activos en esta categoría</div>
            <div style={{ fontSize:13, marginTop:4 }}>
              {canEdit ? "Sube el primer archivo usando el botón de arriba" : "El administrador debe subir archivos"}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display:"grid",
              gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:14 }}>
              {assets.map(a => (
                <AssetCard key={a.id} asset={a} onSelect={setSelected} />
              ))}
            </div>
            {pages > 1 && (
              <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:24 }}>
                <button onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0}
                  style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${PALETTE.border}`,
                    background:PALETTE.white, cursor: page===0?"not-allowed":"pointer", fontSize:13 }}>
                  ← Anterior
                </button>
                <span style={{ padding:"6px 12px", fontSize:13, color:PALETTE.gray }}>
                  Página {page+1} de {pages} · {total} activos
                </span>
                <button onClick={() => setPage(p=>Math.min(pages-1,p+1))} disabled={page===pages-1}
                  style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${PALETTE.border}`,
                    background:PALETTE.white, cursor: page===pages-1?"not-allowed":"pointer", fontSize:13 }}>
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showUpload && (
        <UploadModal user={user} onClose={() => setShowUpload(false)} onUploaded={() => { load(); setShowUpload(false); }} />
      )}
      {selected && (
        <AssetDetailModal asset={selected} canEdit={canEdit}
          onClose={() => setSelected(null)} onUpdated={() => { load(); setSelected(null); }} />
      )}
    </div>
  );
}

export function MediaCenterModal({ user, onClose, onSelect, productCategory }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (productCategory) {
          const data = await api.getMediaMatch(productCategory, { limit: 12 });
          setAssets(Array.isArray(data) ? data : []);
        } else {
          const data = await api.getMedia({ limit: 12 });
          setAssets(data.assets || []);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [productCategory]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:16, width:"min(700px,95vw)",
        maxHeight:"85vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"16px 24px", borderBottom:"1px solid #e2e8f0",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontWeight:700, fontSize:16, color:"#1B2A4A" }}>
            🎯 Seleccionar imagen de Media Center
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none",
            fontSize:20, cursor:"pointer", color:"#6b7280" }}>×</button>
        </div>
        <div style={{ padding:20 }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:40, color:"#6b7280" }}>Cargando...</div>
          ) : assets.length === 0 ? (
            <div style={{ textAlign:"center", padding:40, color:"#6b7280" }}>
              Sin activos para esta categoría
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12 }}>
              {assets.map(a => (
                <div key={a.id} onClick={() => onSelect?.(a)}
                  style={{ borderRadius:10, overflow:"hidden", cursor:"pointer",
                    border:"2px solid #e2e8f0", transition:"border-color 0.15s" }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="#C8A84B"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="#e2e8f0"}>
                  {a.thumbnail_url || a.public_url ? (
                    <img src={a.thumbnail_url || a.public_url} alt={a.original_name}
                      style={{ width:"100%", height:110, objectFit:"cover" }} />
                  ) : (
                    <div style={{ height:110, background:"#f1f5f9", display:"flex",
                      alignItems:"center", justifyContent:"center", fontSize:36 }}>📁</div>
                  )}
                  <div style={{ padding:"6px 8px", fontSize:11, color:"#1B2A4A",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {a.original_name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
