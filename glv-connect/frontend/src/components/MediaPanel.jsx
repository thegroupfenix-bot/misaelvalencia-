import { useState, useEffect } from "react";
import { api } from "../api.js";

const s = {
  panel: { background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 12, marginBottom: 16, overflow: "hidden" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", background: "linear-gradient(135deg,#1B2A4A 0%,#2d4070 100%)" },
  body: { padding: "14px 16px" },
  tab: (active) => ({ padding: "6px 14px", borderRadius: 20, border: active ? "2px solid #1B2A4A" : "1px solid #d1d5db", background: active ? "#1B2A4A" : "#f9fafb", color: active ? "#fff" : "#374151", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer" }),
  imgCard: (selected) => ({ border: selected ? "2px solid #2563eb" : "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", cursor: "pointer", position: "relative", background: "#f9fafb" }),
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10, marginTop: 10 },
  checkBadge: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "#2563eb", color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 },
  slotBadge: { position: "absolute", top: 4, left: 4, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 },
};

const SLOT_LABELS = ["Main", "2", "3", "4", "5", "Brand"];
const MAX_SLOTS = 6;

// Category-to-branding isolation: what categories of media are allowed per document category
const CATEGORY_MEDIA_MAP = {
  LIVE_ANIMALS: ["LIVE_ANIMALS","branding"],
  FROZEN_MEAT: ["FROZEN_MEAT","CANNED_MEAT","branding"],
  FROZEN_POULTRY: ["FROZEN_POULTRY","branding"],
  FRUIT_PRODUCTS: ["FRUIT_PRODUCTS","COLOMBIAN_EXOTIC_FRUITS","branding"],
  COLOMBIAN_EXOTIC_FRUITS: ["COLOMBIAN_EXOTIC_FRUITS","FRUIT_PRODUCTS","branding"],
  COMMODITIES: ["COMMODITIES","BEANS","branding"],
  BEANS: ["BEANS","COMMODITIES","branding"],
  CANNED_MEAT: ["CANNED_MEAT","FROZEN_MEAT","branding"],
};

function isCategoryCompatible(assetCategory, docCategory) {
  if (!docCategory) return true;
  const allowed = CATEGORY_MEDIA_MAP[docCategory];
  if (!allowed) return true;
  const ac = (assetCategory || "").toLowerCase();
  return allowed.some(a => ac.includes(a.toLowerCase()) || a.toLowerCase().includes(ac));
}

function AssetCard({ asset, slotIndex, onToggle, selectedIds }) {
  const isSelected = selectedIds.includes(asset.id);
  const slotPos = selectedIds.indexOf(asset.id);
  const thumb = asset.thumbnail_url || asset.public_url;
  return (
    <div style={s.imgCard(isSelected)} onClick={() => onToggle(asset)}>
      <img src={thumb} alt={asset.original_name} style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} onError={e => { e.target.style.display = "none"; }} />
      {isSelected && <div style={s.checkBadge}>✓</div>}
      {isSelected && <div style={s.slotBadge}>{SLOT_LABELS[slotPos] || slotPos + 1}</div>}
      <div style={{ padding: "4px 6px" }}>
        <p style={{ fontSize: 9, color: "#374151", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.original_name}</p>
      </div>
    </div>
  );
}

export default function MediaPanel({ category, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("auto");
  const [autoMedia, setAutoMedia] = useState(null);
  const [allAssets, setAllAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [layout, setLayout] = useState("grid-2"); // grid-2 | grid-3 | full | side-brand

  // Load auto-bind suggestions when category changes or panel opens
  useEffect(() => {
    if (!open || !category) return;
    setLoading(true);
    api.bindMedia({ category, limit: 6 })
      .then(result => {
        setAutoMedia(result);
        if (selectedIds.length === 0 && result) {
          // Pre-select auto suggestions
          const ids = [];
          if (result.main?.id) ids.push(result.main.id);
          (result.secondary || []).forEach(a => { if (ids.length < 5 && a?.id) ids.push(a.id); });
          if (result.branding?.[0]?.id) ids.push(result.branding[0].id);
          setSelectedIds(ids.slice(0, MAX_SLOTS));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, category]);

  // Load full media library when manual tab is active
  useEffect(() => {
    if (activeTab !== "manual" && activeTab !== "branding" && activeTab !== "library") return;
    if (allAssets.length > 0) return;
    api.getMedia({ limit: 200 })
      .then(data => setAllAssets(data?.assets || []))
      .catch(() => {});
  }, [activeTab]);

  const toggleAsset = (asset) => {
    setSelectedIds(prev => {
      if (prev.includes(asset.id)) return prev.filter(id => id !== asset.id);
      if (prev.length >= MAX_SLOTS) return prev; // max 6 slots
      return [...prev, asset.id];
    });
  };

  // Publish selection upward whenever it changes
  useEffect(() => {
    onChange({ selectedIds, layout });
  }, [selectedIds, layout]);

  const autoAssets = autoMedia ? [
    autoMedia.main,
    ...(autoMedia.secondary || []),
    ...(autoMedia.branding || []),
  ].filter(Boolean) : [];

  const brandingAssets = allAssets.filter(a => (a.category || "").toLowerCase().includes("brand"));
  const categoryAssets = allAssets.filter(a => isCategoryCompatible(a.category, category) && !(a.category || "").toLowerCase().includes("brand"));
  const allManual = allAssets.filter(a => isCategoryCompatible(a.category, category));

  const TABS = [
    { id: "auto",     label: "Auto ✨" },
    { id: "branding", label: "Branding Corporativo" },
    { id: "library",  label: "Librería de Categoría" },
    { id: "manual",   label: "Selección Manual" },
    { id: "layout",   label: "Layout" },
  ];

  const LAYOUTS = [
    { id: "grid-2",     label: "2 imágenes", desc: "Main + Branding" },
    { id: "grid-3",     label: "3 imágenes", desc: "Main + Sec + Branding" },
    { id: "full",       label: "Imagen completa", desc: "Solo main, ancho completo" },
    { id: "side-brand", label: "Lateral + Branding", desc: "Main grande, branding pequeño" },
  ];

  return (
    <div style={s.panel}>
      <div style={s.header} onClick={() => setOpen(v => !v)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🖼</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>Administrar contenido visual</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", margin: 0 }}>
              {selectedIds.length > 0 ? `${selectedIds.length} imagen(es) seleccionada(s) — layout: ${layout}` : "Sin selección — se usará auto-binding al generar"}
            </p>
          </div>
        </div>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 18 }}>{open ? "▾" : "▸"}</span>
      </div>

      {open && (
        <div style={s.body}>
          {/* Slot indicator */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginRight: 4 }}>Slots seleccionados:</span>
            {SLOT_LABELS.slice(0, MAX_SLOTS).map((lbl, i) => {
              const filled = i < selectedIds.length;
              return (
                <div key={i} style={{ width: 28, height: 28, borderRadius: 6, background: filled ? "#1B2A4A" : "#e5e7eb", color: filled ? "#fff" : "#9ca3af", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {lbl}
                </div>
              );
            })}
            {selectedIds.length > 0 && (
              <button type="button" onClick={() => setSelectedIds([])}
                style={{ fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer", marginLeft: 8 }}>
                Limpiar selección
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {TABS.map(tab => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={s.tab(activeTab === tab.id)}>{tab.label}</button>
            ))}
          </div>

          {/* Tab: Auto Suggestions */}
          {activeTab === "auto" && (
            <div>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>
                Sugerencias automáticas basadas en categoría: <strong>{category || "sin categoría"}</strong>
              </p>
              {loading && <p style={{ fontSize: 12, color: "#6b7280" }}>Cargando sugerencias...</p>}
              {!loading && autoAssets.length === 0 && <p style={{ fontSize: 12, color: "#6b7280" }}>Sin sugerencias disponibles para esta categoría.</p>}
              <div style={s.grid}>
                {autoAssets.map(asset => (
                  <AssetCard key={asset.id} asset={asset} onToggle={toggleAsset} selectedIds={selectedIds} />
                ))}
              </div>
            </div>
          )}

          {/* Tab: Corporate Branding */}
          {activeTab === "branding" && (
            <div>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>Logos y elementos corporativos GLV</p>
              <div style={s.grid}>
                {brandingAssets.map(asset => (
                  <AssetCard key={asset.id} asset={asset} onToggle={toggleAsset} selectedIds={selectedIds} />
                ))}
                {brandingAssets.length === 0 && <p style={{ fontSize: 12, color: "#6b7280" }}>Sin activos de branding cargados.</p>}
              </div>
            </div>
          )}

          {/* Tab: Category Library */}
          {activeTab === "library" && (
            <div>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>
                Imágenes de categoría: <strong>{category || "todas"}</strong>
              </p>
              <div style={s.grid}>
                {categoryAssets.map(asset => (
                  <AssetCard key={asset.id} asset={asset} onToggle={toggleAsset} selectedIds={selectedIds} />
                ))}
                {categoryAssets.length === 0 && <p style={{ fontSize: 12, color: "#6b7280" }}>Sin imágenes para esta categoría.</p>}
              </div>
            </div>
          )}

          {/* Tab: Manual Selection */}
          {activeTab === "manual" && (
            <div>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>
                Todos los activos disponibles (máx. 6 selecciones)
              </p>
              <div style={s.grid}>
                {allManual.map(asset => (
                  <AssetCard key={asset.id} asset={asset} onToggle={toggleAsset} selectedIds={selectedIds} />
                ))}
                {allManual.length === 0 && <p style={{ fontSize: 12, color: "#6b7280" }}>Sin activos disponibles.</p>}
              </div>
            </div>
          )}

          {/* Tab: Layout Selection */}
          {activeTab === "layout" && (
            <div>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>Selecciona cómo se mostrarán las imágenes en el PDF</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {LAYOUTS.map(l => (
                  <button key={l.id} type="button" onClick={() => setLayout(l.id)}
                    style={{ padding: "12px 14px", borderRadius: 10, border: layout === l.id ? "2px solid #1B2A4A" : "1px solid #d1d5db", background: layout === l.id ? "#f0f4ff" : "#f9fafb", cursor: "pointer", textAlign: "left" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1B2A4A", margin: "0 0 3px" }}>{l.label}</p>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{l.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: 10, color: "#9ca3af", margin: "12px 0 0", fontStyle: "italic" }}>
            Si no seleccionas imágenes, el sistema usará auto-binding automático al generar el PDF.
          </p>
        </div>
      )}
    </div>
  );
}
