import { useState, useEffect, useCallback } from "react";
import { api } from "../api.js";

// ─── Price status helpers ─────────────────────────────────────────────────────
function getPriceStatus(updatedAt) {
  if (!updatedAt) return "red";
  const diff = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 1) return "green";
  if (diff <= 3) return "yellow";
  return "red";
}

const PRICE_BADGE = {
  green:  { bg: "#dcfce7", color: "#166534", dot: "#22c55e", label: "Actualizado hoy" },
  yellow: { bg: "#fef9c3", color: "#854d0e", dot: "#eab308", label: "1-3 días" },
  red:    { bg: "#fee2e2", color: "#991b1b", dot: "#ef4444", label: "Verificar" },
};

function PriceStatusBadge({ status }) {
  const s = PRICE_BADGE[status] || PRICE_BADGE.red;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
      {s.label}
    </span>
  );
}

const fmt = (v, currency = "USD") => v != null
  ? new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(v)
  : "—";

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px" }}>
      <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 2px", fontWeight: 600, textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontSize: 13, color: "#1B2A4A", margin: 0, fontWeight: 500 }}>{value}</p>
    </div>
  );
}

function InfoSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</p>
      {children}
    </div>
  );
}

function Tag({ text, color }) {
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: color + "15", color, border: `1px solid ${color}30` }}>{text}</span>
  );
}

// ─── Price History Modal ──────────────────────────────────────────────────────
function PriceHistoryModal({ productId, productName, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPcPriceHistory(productId)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [productId]);

  const fieldLabel = (f) => f === "fob_price" ? "FOB" : f === "cif_price" ? "CIF" : f;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1B2A4A", margin: 0 }}>Historial de Precios</h3>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{productName}</p>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "1rem 1.5rem" }}>
          {loading ? (
            <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: "2rem 0" }}>Cargando historial...</p>
          ) : history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <i className="ti ti-history" style={{ fontSize: 36, color: "#d1d5db", display: "block", marginBottom: 8 }} />
              <p style={{ color: "#6b7280", fontSize: 13 }}>Sin cambios de precio registrados</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Fecha</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Campo</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Anterior</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Nuevo</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 6px", color: "#6b7280", whiteSpace: "nowrap" }}>
                      {new Date(h.ts).toLocaleDateString("es-CO")} {new Date(h.ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "8px 6px", fontWeight: 600, color: "#1B2A4A" }}>{fieldLabel(h.field)}</td>
                    <td style={{ padding: "8px 6px", textAlign: "right", color: "#ef4444", textDecoration: "line-through" }}>
                      {h.old_value != null ? fmt(h.old_value) : "—"}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>
                      {h.new_value != null ? fmt(h.new_value) : "—"}
                    </td>
                    <td style={{ padding: "8px 6px", color: "#6b7280" }}>{h.changed_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Product Detail Modal ─────────────────────────────────────────────────────
function ProductModal({ product: p, onClose, isModal, isAdmin, onEdit, onArchive, onDuplicate, onHistoryOpen }) {
  if (!p) return null;
  const status = getPriceStatus(p.price_updated_at);

  return (
    <div style={{ position: isModal ? "fixed" : "relative", inset: isModal ? 0 : "auto", background: isModal ? "rgba(0,0,0,0.6)" : "transparent", zIndex: isModal ? 1200 : 1, display: "flex", alignItems: isModal ? "center" : "stretch", justifyContent: isModal ? "center" : "stretch", padding: isModal ? "1rem" : 0 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#1B2A4A,#2d4070)", padding: "1.5rem", borderRadius: "16px 16px 0 0", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, opacity: 0.7, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>{p.name_en}</p>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>{p.name_es}</h2>
              {p.commercial_name && <p style={{ fontSize: 13, opacity: 0.85, margin: 0 }}>{p.commercial_name}</p>}
            </div>
            {isModal && (
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", borderRadius: 8, padding: "4px 10px" }}>✕</button>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <PriceStatusBadge status={status} />
            {p.availability === "available" && <span style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>● Disponible</span>}
            {p.availability === "seasonal" && <span style={{ background: "rgba(234,179,8,0.2)", color: "#fbbf24", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>◑ Temporada</span>}
            {p.availability === "limited" && <span style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>◌ Stock Limitado</span>}
          </div>
          {/* Admin actions in header */}
          {isAdmin && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => onEdit(p)} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                <i className="ti ti-edit" style={{ marginRight: 5 }} />Editar
              </button>
              <button onClick={() => onDuplicate(p)} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                <i className="ti ti-copy" style={{ marginRight: 5 }} />Duplicar
              </button>
              <button onClick={() => onHistoryOpen(p)} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                <i className="ti ti-history" style={{ marginRight: 5 }} />Historial
              </button>
              <button onClick={() => { if (confirm(`¿Archivar "${p.name_es}"?`)) { onArchive(p); onClose(); } }} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(239,68,68,0.5)", background: "rgba(239,68,68,0.2)", color: "#fca5a5", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                <i className="ti ti-archive" style={{ marginRight: 5 }} />Archivar
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: "1.5rem" }}>
          {/* REFERENCE ONLY warning */}
          <div style={{ background: "#fef9c3", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#78350f", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span><strong>SOLO REFERENCIA:</strong> Los precios aquí son referenciales. Los valores finales deben ser negociados manualmente por el agente e ingresados directamente en la SCO.</span>
          </div>

          {/* Price grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {p.fob_price != null && (
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "14px 16px", border: "1px solid #bbf7d0" }}>
                <p style={{ fontSize: 11, color: "#166534", margin: "0 0 4px", fontWeight: 600, textTransform: "uppercase" }}>Precio FOB Referencia</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#15803d", margin: 0 }}>{fmt(p.fob_price)}<span style={{ fontSize: 13, color: "#6b7280", fontWeight: 400 }}>/kg</span></p>
              </div>
            )}
            {p.cif_price != null && (
              <div style={{ background: "#eff6ff", borderRadius: 10, padding: "14px 16px", border: "1px solid #bfdbfe" }}>
                <p style={{ fontSize: 11, color: "#1e40af", margin: "0 0 4px", fontWeight: 600, textTransform: "uppercase" }}>Precio CIF Referencia</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#2563eb", margin: 0 }}>{fmt(p.cif_price)}<span style={{ fontSize: 13, color: "#6b7280", fontWeight: 400 }}>/kg</span></p>
              </div>
            )}
          </div>

          {/* Details grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <DetailRow label="MOQ" value={p.moq} />
            <DetailRow label="Código HS" value={p.hs_code} />
            <DetailRow label="Empaque" value={p.packaging} />
            <DetailRow label="Vida Útil" value={p.shelf_life} />
            <DetailRow label="Cap. Contenedor" value={p.container_capacity ? `${p.container_capacity} MT` : null} />
            <DetailRow label="Tipo de Carga" value={p.cargo_type} />
            {p.reefer_required ? <DetailRow label="Cadena de Frío" value="Requerida ❄️" /> : null}
            {p.frozen_required ? <DetailRow label="Cadena Congelada" value="Requerida 🧊" /> : null}
          </div>

          {p.origin_countries?.length > 0 && (
            <InfoSection title="Países de Origen">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.origin_countries.map(c => <Tag key={c} text={c} color="#1B2A4A" />)}
              </div>
            </InfoSection>
          )}
          {p.incoterms?.length > 0 && (
            <InfoSection title="Incoterms Disponibles">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.incoterms.map(i => <Tag key={i} text={i} color="#2563eb" />)}
              </div>
            </InfoSection>
          )}
          {p.market_segments?.length > 0 && (
            <InfoSection title="Segmentos de Mercado">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.market_segments.map(s => <Tag key={s} text={s} color="#7c3aed" />)}
              </div>
            </InfoSection>
          )}
          {p.certifications?.length > 0 && (
            <InfoSection title="Certificaciones">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.certifications.map(c => <Tag key={c} text={c} color="#059669" />)}
              </div>
            </InfoSection>
          )}
          {p.ports?.length > 0 && (
            <InfoSection title="Puertos de Embarque">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.ports.map(pt => <Tag key={pt} text={pt} color="#0369a1" />)}
              </div>
            </InfoSection>
          )}
          {p.export_notes && (
            <InfoSection title="Notas de Exportación">
              <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.6 }}>{p.export_notes}</p>
            </InfoSection>
          )}
          {p.specs && Object.keys(p.specs).length > 0 && (
            <InfoSection title="Especificaciones Técnicas">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Object.entries(p.specs).map(([k, v]) => (
                  <div key={k} style={{ background: "#f8f9fa", borderRadius: 6, padding: "6px 10px" }}>
                    <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 2px", textTransform: "uppercase", fontWeight: 600 }}>{k.replace(/_/g, " ")}</p>
                    <p style={{ fontSize: 12, color: "#1B2A4A", margin: 0, fontWeight: 500 }}>{String(v)}</p>
                  </div>
                ))}
              </div>
            </InfoSection>
          )}

          <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 16 }}>
            Precio actualizado: {p.price_updated_at ? new Date(p.price_updated_at).toLocaleDateString("es-CO") : "—"}
            {p.supplier_name && ` · Proveedor: ${p.supplier_name}`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product: p, onClick, isAdmin, onEdit, onArchive, onRestore, onDuplicate, onHistoryOpen, selected, onSelect, isArchived }) {
  const status = getPriceStatus(p.price_updated_at);

  const stopProp = (fn) => (e) => { e.stopPropagation(); fn(p); };

  return (
    <div style={{ background: isArchived ? "#fafafa" : "#fff", border: `1px solid ${selected ? "#1B2A4A" : "#e5e7eb"}`, borderRadius: 12, padding: "1rem", cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s", boxSizing: "border-box", position: "relative", opacity: isArchived ? 0.8 : 1 }}
      onClick={() => onClick(p)}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.boxShadow = "0 4px 20px rgba(27,42,74,0.15)"; e.currentTarget.style.borderColor = "#1B2A4A"; } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#e5e7eb"; } }}>

      {/* Bulk select checkbox (admin) */}
      {isAdmin && (
        <div onClick={e => { e.stopPropagation(); onSelect(p.id); }} style={{ position: "absolute", top: 10, left: 10 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${selected ? "#1B2A4A" : "#d1d5db"}`, background: selected ? "#1B2A4A" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {selected && <i className="ti ti-check" style={{ fontSize: 10, color: "#fff" }} />}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, paddingLeft: isAdmin ? 22 : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1B2A4A", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name_es}</h3>
          {p.commercial_name && <p style={{ fontSize: 11, color: "#6b7280", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.commercial_name}</p>}
        </div>
        {!isArchived && <PriceStatusBadge status={status} />}
        {isArchived && <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600 }}>ARCHIVADO</span>}
      </div>

      {!isArchived && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {p.fob_price != null && (
            <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 10, color: "#166534", margin: "0 0 2px", fontWeight: 700 }}>FOB REF.</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#15803d", margin: 0 }}>{fmt(p.fob_price)}<span style={{ fontSize: 10, fontWeight: 400, color: "#6b7280" }}>/kg</span></p>
            </div>
          )}
          {p.cif_price != null && (
            <div style={{ flex: 1, background: "#eff6ff", borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 10, color: "#1e40af", margin: "0 0 2px", fontWeight: 700 }}>CIF REF.</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#2563eb", margin: 0 }}>{fmt(p.cif_price)}<span style={{ fontSize: 10, fontWeight: 400, color: "#6b7280" }}>/kg</span></p>
            </div>
          )}
        </div>
      )}

      {!isArchived && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {p.origin_countries?.slice(0, 2).map(c => <Tag key={c} text={c} color="#1B2A4A" />)}
            {p.incoterms?.slice(0, 3).map(i => <Tag key={i} text={i} color="#2563eb" />)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {p.moq && <span style={{ fontSize: 11, color: "#6b7280" }}>MOQ: {p.moq}</span>}
            {p.hs_code && <span style={{ fontSize: 11, color: "#6b7280" }}>HS: {p.hs_code}</span>}
          </div>
          {p.certifications?.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {p.certifications.slice(0, 3).map(c => (
                <span key={c} style={{ fontSize: 10, background: "#f0fdf4", color: "#166534", padding: "1px 6px", borderRadius: 4, border: "1px solid #bbf7d0" }}>{c}</span>
              ))}
              {p.certifications.length > 3 && <span style={{ fontSize: 10, color: "#6b7280" }}>+{p.certifications.length - 3}</span>}
            </div>
          )}
        </>
      )}

      {/* Admin action buttons */}
      {isAdmin && (
        <div style={{ display: "flex", gap: 4, marginTop: 10, paddingTop: 8, borderTop: "1px solid #f3f4f6" }} onClick={e => e.stopPropagation()}>
          {!isArchived ? (
            <>
              <button onClick={stopProp(onEdit)} style={{ flex: 1, padding: "5px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11, color: "#374151", fontWeight: 600 }}>
                <i className="ti ti-edit" style={{ marginRight: 3 }} />Editar
              </button>
              <button onClick={stopProp(onDuplicate)} style={{ flex: 1, padding: "5px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11, color: "#374151", fontWeight: 600 }}>
                <i className="ti ti-copy" style={{ marginRight: 3 }} />Duplicar
              </button>
              <button onClick={stopProp(onHistoryOpen)} style={{ padding: "5px 8px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11, color: "#6b7280" }} title="Historial de precios">
                <i className="ti ti-history" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); if (confirm(`¿Archivar "${p.name_es}"?`)) onArchive(p); }} style={{ padding: "5px 8px", border: "1px solid #fee2e2", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11, color: "#ef4444" }} title="Archivar">
                <i className="ti ti-archive" />
              </button>
            </>
          ) : (
            <button onClick={stopProp(onRestore)} style={{ flex: 1, padding: "6px", border: "1px solid #d1fae5", borderRadius: 6, background: "#f0fdf4", cursor: "pointer", fontSize: 11, color: "#166534", fontWeight: 600 }}>
              <i className="ti ti-restore" style={{ marginRight: 4 }} />Restaurar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Category Sidebar ─────────────────────────────────────────────────────────
function CategorySidebar({ categories, selected, onSelect, counts }) {
  const parentCats = categories.filter(c => !c.parent_slug);
  const childCats  = (parentSlug) => categories.filter(c => c.parent_slug === parentSlug);

  return (
    <div style={{ width: 220, minWidth: 220, background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem", overflowY: "auto" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 1 }}>Categorías</p>

      <button onClick={() => onSelect(null)}
        style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 4, background: !selected ? "#1B2A4A" : "none", color: !selected ? "#fff" : "#374151", fontSize: 13, fontWeight: !selected ? 700 : 400 }}>
        Todos los productos {counts.total ? `(${counts.total})` : ""}
      </button>

      {parentCats.map(cat => {
        const children = childCats(cat.slug);
        const isSelected = selected === cat.slug;
        return (
          <div key={cat.slug}>
            <button onClick={() => onSelect(cat.slug)}
              style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2, background: isSelected ? cat.color + "20" : "none", color: isSelected ? cat.color : "#374151", fontSize: 13, fontWeight: isSelected ? 700 : 400, display: "flex", alignItems: "center", gap: 6 }}>
              <i className={`ti ${cat.icon || "ti-package"}`} style={{ fontSize: 14, color: cat.color }} />
              <span style={{ flex: 1 }}>{cat.name_es}</span>
              {counts[cat.slug] > 0 && <span style={{ fontSize: 11, background: "#f3f4f6", color: "#6b7280", borderRadius: 10, padding: "1px 6px" }}>{counts[cat.slug]}</span>}
            </button>
            {children.map(child => {
              const isChildSelected = selected === child.slug;
              return (
                <button key={child.slug} onClick={() => onSelect(child.slug)}
                  style={{ width: "100%", textAlign: "left", padding: "6px 10px 6px 28px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2, background: isChildSelected ? child.color + "15" : "none", color: isChildSelected ? child.color : "#6b7280", fontSize: 12, fontWeight: isChildSelected ? 600 : 400 }}>
                  <i className={`ti ${child.icon || "ti-corner-down-right"}`} style={{ fontSize: 12, marginRight: 5 }} />
                  {child.name_es}
                  {counts[child.slug] > 0 && <span style={{ marginLeft: 6, fontSize: 10, background: "#f3f4f6", borderRadius: 8, padding: "1px 5px" }}>{counts[child.slug]}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Admin Product Form Modal ─────────────────────────────────────────────────
function AdminProductModal({ categories, product, onSave, onClose }) {
  const [form, setForm] = useState({
    category_slug: product?.category_slug || "",
    name_es: product?.name_es || "",
    name_en: product?.name_en || "",
    commercial_name: product?.commercial_name || "",
    fob_price: product?.fob_price ?? "",
    cif_price: product?.cif_price ?? "",
    moq: product?.moq || "",
    packaging: product?.packaging || "",
    hs_code: product?.hs_code || "",
    container_capacity: product?.container_capacity ?? "",
    shelf_life: product?.shelf_life || "",
    availability: product?.availability || "available",
    cargo_type: product?.cargo_type || "Dry Cargo",
    reefer_required: product?.reefer_required || 0,
    frozen_required: product?.frozen_required || 0,
    export_notes: product?.export_notes || "",
    supplier_name: product?.supplier_name || "",
    origin_countries: product?.origin_countries?.join(", ") || "",
    incoterms: product?.incoterms?.join(", ") || "FOB, CFR, CIF",
    certifications: product?.certifications?.join(", ") || "",
    ports: product?.ports?.join(", ") || "",
    market_segments: product?.market_segments?.join(", ") || "",
    change_reason: "",
  });
  const [saving, setSaving] = useState(false);

  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toArr = (s) => s.split(",").map(x => x.trim()).filter(Boolean);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        ...form,
        fob_price: form.fob_price !== "" ? parseFloat(form.fob_price) : null,
        cif_price: form.cif_price !== "" ? parseFloat(form.cif_price) : null,
        container_capacity: form.container_capacity !== "" ? parseFloat(form.container_capacity) : null,
        origin_countries: toArr(form.origin_countries),
        incoterms: toArr(form.incoterms),
        certifications: toArr(form.certifications),
        ports: toArr(form.ports),
        market_segments: toArr(form.market_segments),
      };
      await onSave(data);
      onClose();
    } finally { setSaving(false); }
  };

  const inp = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, boxSizing: "border-box" };
  const lbl = { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 };
  const isEdit = !!product;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1B2A4A", margin: 0 }}>{isEdit ? "Editar Producto" : "Nuevo Producto"}</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>Categoría *</label>
            <select value={form.category_slug} onChange={e => sf("category_slug", e.target.value)} style={inp}>
              <option value="">Seleccionar...</option>
              {categories.map(c => <option key={c.slug} value={c.slug}>{c.name_es}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Nombre ES *</label><input value={form.name_es} onChange={e => sf("name_es", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Nombre EN</label><input value={form.name_en} onChange={e => sf("name_en", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Nombre Comercial</label><input value={form.commercial_name} onChange={e => sf("commercial_name", e.target.value)} style={inp} /></div>
          <div>
            <label style={lbl}>Precio FOB (USD/kg)</label>
            <input type="number" value={form.fob_price} onChange={e => sf("fob_price", e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Precio CIF (USD/kg)</label>
            <input type="number" value={form.cif_price} onChange={e => sf("cif_price", e.target.value)} style={inp} />
          </div>
          {isEdit && (
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ ...lbl, color: "#d97706" }}>Razón del cambio de precio (opcional)</label>
              <input value={form.change_reason} onChange={e => sf("change_reason", e.target.value)} placeholder="Ej: Actualización mercado, nuevo proveedor..." style={{ ...inp, borderColor: "#f59e0b" }} />
            </div>
          )}
          <div><label style={lbl}>MOQ</label><input value={form.moq} onChange={e => sf("moq", e.target.value)} placeholder="Ej: 5 MT" style={inp} /></div>
          <div><label style={lbl}>Empaque</label><input value={form.packaging} onChange={e => sf("packaging", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Código HS</label><input value={form.hs_code} onChange={e => sf("hs_code", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Cap. Contenedor (MT)</label><input type="number" value={form.container_capacity} onChange={e => sf("container_capacity", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Vida Útil</label><input value={form.shelf_life} onChange={e => sf("shelf_life", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Proveedor</label><input value={form.supplier_name} onChange={e => sf("supplier_name", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Disponibilidad</label>
            <select value={form.availability} onChange={e => sf("availability", e.target.value)} style={inp}>
              <option value="available">Disponible</option>
              <option value="seasonal">Temporada</option>
              <option value="limited">Limitado</option>
              <option value="unavailable">No disponible</option>
            </select>
          </div>
          <div><label style={lbl}>Tipo de Carga</label>
            <select value={form.cargo_type} onChange={e => sf("cargo_type", e.target.value)} style={inp}>
              {["Dry Cargo","Refrigerated Cargo","Frozen Cargo","Live Animals","ISO Tank","Air Cargo"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", paddingTop: 20 }}>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={!!form.reefer_required} onChange={e => sf("reefer_required", e.target.checked ? 1 : 0)} />Reefer requerido
            </label>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={!!form.frozen_required} onChange={e => sf("frozen_required", e.target.checked ? 1 : 0)} />Cadena congelada
            </label>
          </div>
          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Países de Origen (separados por coma)</label><input value={form.origin_countries} onChange={e => sf("origin_countries", e.target.value)} placeholder="Colombia, Brazil, Peru" style={inp} /></div>
          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Incoterms (separados por coma)</label><input value={form.incoterms} onChange={e => sf("incoterms", e.target.value)} placeholder="FOB, CFR, CIF, DDP" style={inp} /></div>
          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Certificaciones (separadas por coma)</label><input value={form.certifications} onChange={e => sf("certifications", e.target.value)} placeholder="Halal, GlobalG.A.P., HACCP" style={inp} /></div>
          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Puertos (separados por coma)</label><input value={form.ports} onChange={e => sf("ports", e.target.value)} placeholder="Buenaventura, Cartagena" style={inp} /></div>
          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Segmentos de mercado (separados por coma)</label><input value={form.market_segments} onChange={e => sf("market_segments", e.target.value)} placeholder="Premium Industrial, General B2B" style={inp} /></div>
          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Notas de exportación</label><textarea rows={3} value={form.export_notes} onChange={e => sf("export_notes", e.target.value)} style={{ ...inp, resize: "vertical" }} /></div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid #d1d5db", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "9px 24px", background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main PriceCenterView ─────────────────────────────────────────────────────
export function PriceCenterView({ user, isModal = false, onClose, onSelectReference }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(true);
  const [detailProduct, setDetailProduct] = useState(null);
  const [adminModal, setAdminModal] = useState(null); // null | "new" | product
  const [showArchived, setShowArchived]   = useState(false);
  const [selectedIds, setSelectedIds]     = useState(new Set());
  const [historyProduct, setHistoryProduct] = useState(null);
  const [bulkLoading, setBulkLoading]       = useState(false);

  const isAdmin = ["SUPER_ADMIN", "CORPORATE_ADMIN"].includes(user?.role);

  const loadProducts = useCallback(async (catSlug, q, archived) => {
    setLoading(true);
    try {
      const params = {};
      if (catSlug) params.category = catSlug;
      if (q) params.search = q;
      if (archived) params.archived = "1";
      const data = await api.getPcProducts(params);
      setProducts(data);
      setSelectedIds(new Set());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    api.getPcCategories().then(setCategories).catch(() => {});
    loadProducts(null, "", false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadProducts(selected, search, showArchived), 300);
    return () => clearTimeout(t);
  }, [selected, search, showArchived]);

  const counts = {};
  products.forEach(p => { counts[p.category_slug] = (counts[p.category_slug] || 0) + 1; });
  counts.total = products.length;

  const handleSaveProduct = async (data) => {
    if (adminModal === "new") {
      await api.adminCreatePcProduct(data);
    } else {
      await api.adminUpdatePcProduct(adminModal.id, data);
    }
    loadProducts(selected, search, showArchived);
  };

  const handleArchive = async (p) => {
    await api.adminArchivePcProduct(p.id);
    loadProducts(selected, search, showArchived);
  };

  const handleRestore = async (p) => {
    await api.adminRestorePcProduct(p.id);
    loadProducts(selected, search, showArchived);
  };

  const handleDuplicate = async (p) => {
    await api.adminDuplicatePcProduct(p.id);
    loadProducts(selected, search, showArchived);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulk = async (action) => {
    if (!selectedIds.size) return;
    const label = action === "archive" ? "archivar" : action === "restore" ? "restaurar" : "eliminar definitivamente";
    if (!confirm(`¿${label.charAt(0).toUpperCase() + label.slice(1)} ${selectedIds.size} producto(s)?`)) return;
    setBulkLoading(true);
    try {
      await api.adminBulkPcProducts({ ids: [...selectedIds], action });
      loadProducts(selected, search, showArchived);
    } finally { setBulkLoading(false); }
  };

  const containerStyle = isModal ? {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1100,
    display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
  } : {};
  const innerStyle = isModal ? {
    background: "#fff", borderRadius: 16, width: "100%", maxWidth: 1100,
    height: "92vh", display: "flex", flexDirection: "column", overflow: "hidden",
  } : {};

  const content = (
    <div style={isModal ? innerStyle : { height: "100%" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1B2A4A,#2d4070)", padding: "1.25rem 1.5rem", color: "#fff", flexShrink: 0, borderRadius: isModal ? "16px 16px 0 0" : 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>
              <i className="ti ti-database" style={{ marginRight: 8 }} />
              Global Price Center
            </h1>
            <p style={{ fontSize: 13, opacity: 0.75, margin: 0 }}>Base de datos de referencia — GLV Global Food Services</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isAdmin && (
              <>
                <button onClick={() => setShowArchived(v => !v)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: showArchived ? "rgba(234,179,8,0.3)" : "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  <i className={`ti ${showArchived ? "ti-eye" : "ti-archive"}`} style={{ marginRight: 5 }} />
                  {showArchived ? "Ver activos" : "Ver archivados"}
                </button>
                {!showArchived && (
                  <button onClick={() => setAdminModal("new")}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    + Nuevo Producto
                  </button>
                )}
              </>
            )}
            {isModal && (
              <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 18, cursor: "pointer", borderRadius: 8, padding: "5px 10px" }}>✕</button>
            )}
          </div>
        </div>
        <div style={{ marginTop: 10, background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#fbbf24" }}>
          <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} />
          <strong>MÓDULO DE REFERENCIA:</strong> Los precios aquí publicados son orientativos. El agente debe verificar y negociar valores finales antes de emitir cualquier SCO.
        </div>
      </div>

      {/* Bulk action toolbar */}
      {isAdmin && selectedIds.size > 0 && (
        <div style={{ padding: "10px 16px", background: "#1B2A4A", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{selectedIds.size} seleccionado(s)</span>
          <button onClick={() => setSelectedIds(new Set())} style={{ padding: "5px 12px", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, background: "none", color: "#fff", cursor: "pointer", fontSize: 12 }}>Deseleccionar</button>
          {!showArchived && (
            <button onClick={() => handleBulk("archive")} disabled={bulkLoading} style={{ padding: "5px 12px", border: "none", borderRadius: 6, background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              <i className="ti ti-archive" style={{ marginRight: 4 }} />Archivar seleccionados
            </button>
          )}
          {showArchived && (
            <>
              <button onClick={() => handleBulk("restore")} disabled={bulkLoading} style={{ padding: "5px 12px", border: "none", borderRadius: 6, background: "#059669", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                <i className="ti ti-restore" style={{ marginRight: 4 }} />Restaurar seleccionados
              </button>
              <button onClick={() => handleBulk("delete")} disabled={bulkLoading} style={{ padding: "5px 12px", border: "none", borderRadius: 6, background: "#7f1d1d", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                <i className="ti ti-trash" style={{ marginRight: 4 }} />Eliminar definitivamente
              </button>
            </>
          )}
        </div>
      )}

      {/* Search bar */}
      <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
        <div style={{ position: "relative", maxWidth: 500 }}>
          <i className="ti ti-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 16 }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto, categoría, certificación..."
            style={{ width: "100%", padding: "9px 12px 9px 36px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, boxSizing: "border-box", background: "#fff" }} />
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
        {!showArchived && (
          <div style={{ width: 230, minWidth: 230, overflowY: "auto", borderRight: "1px solid #e5e7eb", padding: "1rem" }}>
            <CategorySidebar categories={categories} selected={selected} onSelect={setSelected} counts={counts} />
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
          {showArchived && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, fontSize: 13, color: "#92400e" }}>
              <i className="ti ti-archive" style={{ marginRight: 6 }} />
              <strong>Productos archivados</strong> — Visibles solo para administradores. Restaura o elimina definitivamente.
            </div>
          )}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
              <p style={{ color: "#6b7280", fontSize: 14 }}>Cargando productos...</p>
            </div>
          ) : products.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200 }}>
              <i className="ti ti-database-off" style={{ fontSize: 40, color: "#d1d5db", marginBottom: 12 }} />
              <p style={{ color: "#6b7280", fontSize: 14 }}>{showArchived ? "No hay productos archivados" : "No se encontraron productos"}</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {products.map(p => (
                <ProductCard key={p.id} product={p}
                  onClick={setDetailProduct}
                  isAdmin={isAdmin}
                  isArchived={showArchived}
                  selected={selectedIds.has(p.id)}
                  onSelect={toggleSelect}
                  onEdit={(prod) => setAdminModal(prod)}
                  onArchive={handleArchive}
                  onRestore={handleRestore}
                  onDuplicate={handleDuplicate}
                  onHistoryOpen={setHistoryProduct}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isModal ? <div style={containerStyle}>{content}</div> : content}

      {/* Product detail modal */}
      {detailProduct && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <ProductModal
              product={detailProduct}
              onClose={() => setDetailProduct(null)}
              isModal
              isAdmin={isAdmin}
              onEdit={(p) => { setDetailProduct(null); setAdminModal(p); }}
              onArchive={(p) => { handleArchive(p); setDetailProduct(null); }}
              onDuplicate={(p) => { handleDuplicate(p); setDetailProduct(null); }}
              onHistoryOpen={(p) => { setDetailProduct(null); setHistoryProduct(p); }}
            />
            {onSelectReference && (
              <div style={{ padding: "0 1.5rem 1.5rem" }}>
                <button onClick={() => { onSelectReference(detailProduct); setDetailProduct(null); }}
                  style={{ width: "100%", padding: "11px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  <i className="ti ti-copy" style={{ marginRight: 8 }} />
                  Copiar precios de referencia al portapapeles
                </button>
                <p style={{ fontSize: 11, color: "#6b7280", textAlign: "center", margin: "6px 0 0" }}>Los precios NO se auto-rellenan en la SCO. Ingrese los valores manualmente.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin product form modal */}
      {adminModal && (
        <AdminProductModal
          categories={categories}
          product={adminModal !== "new" ? adminModal : null}
          onSave={handleSaveProduct}
          onClose={() => setAdminModal(null)}
        />
      )}

      {/* Price history modal */}
      {historyProduct && (
        <PriceHistoryModal
          productId={historyProduct.id}
          productName={historyProduct.name_es}
          onClose={() => setHistoryProduct(null)}
        />
      )}
    </>
  );
}

// ─── Price Center Modal (for SCO inline button) ───────────────────────────────
export function PriceCenterModal({ user, onClose }) {
  const handleSelectReference = (product) => {
    const text = [
      `REFERENCIA: ${product.name_es}`,
      product.fob_price != null ? `FOB: USD ${product.fob_price.toFixed(2)}/kg` : "",
      product.cif_price != null ? `CIF: USD ${product.cif_price.toFixed(2)}/kg` : "",
      `Origen: ${product.origin_countries?.join(", ")}`,
      `Incoterms: ${product.incoterms?.join(", ")}`,
      product.hs_code ? `HS: ${product.hs_code}` : "",
    ].filter(Boolean).join(" | ");

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  return (
    <PriceCenterView user={user} isModal onClose={onClose} onSelectReference={handleSelectReference} />
  );
}
