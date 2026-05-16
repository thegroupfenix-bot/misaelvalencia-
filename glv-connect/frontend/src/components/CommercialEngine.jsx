import { useState, useEffect, useRef } from "react";
import { PRODUCT_CATEGORIES, DELIVERY_FREQUENCIES, CURRENCIES, INCOTERMS } from "../config/productCategories.js";
import { searchCountries } from "../config/worldCountries.js";
import { calcCommercialSummary, fmtMoney, fmtNum } from "../utils/calculations.js";

const ORIGINS = ["Brazil", "Argentina", "Colombia", "Uruguay", "Chile", "Paraguay", "USA", "Canada", "Australia", "New Zealand", "South Africa", "Other"];
const PRICED_INCOTERMS = ["FOB", "CFR", "CIF", "DDP"];

const s = {
  section: { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem", marginBottom: 16 },
  title:   { fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 14px", paddingBottom: 8, borderBottom: "0.5px solid var(--color-border-tertiary)" },
  row2:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 0 },
  row3:    { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 0 },
  field:   { marginBottom: 12 },
  label:   { fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 },
  input:   { width: "100%", padding: "8px 11px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" },
  select:  { width: "100%", padding: "8px 11px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" },
};

let _rid = 1;
function newRowData() {
  return { id: _rid++, category: "", product: "", specs: {}, quantity: "", unitType: "", incoterms: ["CFR"], incotermPrices: {}, unitPrice: "", currency: "USD", deliveryFrequency: "ONE_SHIPMENT", numShipments: "1", contractDuration: "12", containerCapacity: "", origin: "Brazil" };
}

// ─── Field helpers ────────────────────────────────────────────────────────────
function Field({ label, children, required }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}{required && <span style={{ color: "#dc2626" }}> *</span>}</label>
      {children}
    </div>
  );
}
function Inp({ value, onChange, type = "text", placeholder, min }) {
  return <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} min={min} style={s.input} />;
}
function Sel({ value, onChange, children }) {
  return <select value={value ?? ""} onChange={e => onChange(e.target.value)} style={s.select}>{children}</select>;
}

// ─── Country Search Combobox ──────────────────────────────────────────────────
function CountrySearch({ value, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const ref = useRef();

  useEffect(() => { setResults(query.length > 0 ? searchCountries(query).slice(0, 8) : []); }, [query]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(""); }}
        onFocus={() => query && setOpen(true)}
        placeholder="Buscar país destino..." style={s.input} />
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", maxHeight: 220, overflowY: "auto" }}>
          {results.map(c => (
            <button key={c.code} type="button" onMouseDown={() => { setQuery(c.name); onChange(c.name); setOpen(false); }}
              style={{ width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "none", cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between", borderBottom: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)" }}>
              <span>{c.name}</span>
              {c.port && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{c.port.split("/")[0].trim()}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Multi-Incoterm Selector ──────────────────────────────────────────────────
function IncotermSelector({ selected, onChange, prices, onPriceChange }) {
  const toggle = (inc) => {
    if (selected.includes(inc)) { if (selected.length === 1) return; onChange(selected.filter(i => i !== inc)); }
    else onChange([...selected, inc]);
  };
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {INCOTERMS.map(inc => {
          const active = selected.includes(inc);
          return (
            <button key={inc} type="button" onClick={() => toggle(inc)}
              style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: active ? "2px solid #1B2A4A" : "1px solid #d1d5db", background: active ? "#1B2A4A" : "var(--color-background-primary)", color: active ? "#fff" : "var(--color-text-secondary)", transition: "all 0.15s" }}>
              {inc}
            </button>
          );
        })}
      </div>
      {PRICED_INCOTERMS.filter(i => selected.includes(i)).length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 10 }}>
          {PRICED_INCOTERMS.filter(i => selected.includes(i)).map(inc => (
            <div key={inc} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px", border: "0.5px solid var(--color-border-tertiary)" }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#1B2A4A", display: "block", marginBottom: 5 }}>Precio {inc} / kg</label>
              <input type="number" value={prices[inc] ?? ""} onChange={e => onPriceChange(inc, e.target.value)} placeholder="0.00" min="0" step="0.01" style={s.input} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dynamic Spec Fields ──────────────────────────────────────────────────────
function DynamicFields({ category, specs, setSpecs }) {
  const catDef = PRODUCT_CATEGORIES[category];
  if (!catDef?.fields?.length) return null;
  const setSpec = (key, val) => setSpecs(prev => ({ ...prev, [key]: val }));
  return (
    <div style={s.row2}>
      {catDef.fields.map(f => (
        <Field key={f.key} label={f.label?.es || f.label} required={f.required}>
          {f.type === "select" ? (
            <Sel value={specs[f.key] ?? ""} onChange={v => setSpec(f.key, v)}>
              <option value="">Seleccionar...</option>
              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
            </Sel>
          ) : f.type === "checkbox" ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={!!specs[f.key]} onChange={e => setSpec(f.key, e.target.checked)} style={{ width: 15, height: 15 }} />
              <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>Sí / Yes</span>
            </label>
          ) : f.type === "textarea" ? (
            <textarea rows={2} value={specs[f.key] ?? ""} onChange={e => setSpec(f.key, e.target.value)} placeholder={f.placeholder || ""} style={{ ...s.input, resize: "vertical", height: 64 }} />
          ) : (
            <Inp type={f.type === "number" ? "number" : "text"} value={specs[f.key] ?? (f.default !== undefined ? f.default : "")} onChange={v => setSpec(f.key, v)} placeholder={f.placeholder} />
          )}
        </Field>
      ))}
    </div>
  );
}

// ─── Single Product Row ───────────────────────────────────────────────────────
function ProductRowPanel({ rowId, initial, onChange, onRemove, index, isOnly }) {
  const [cat, setCat] = useState(initial?.category || "");
  const [product, setProduct] = useState(initial?.product || "");
  const [specs, setSpecs] = useState(initial?.specs || {});
  const [qty, setQty] = useState(initial?.quantity || "");
  const [unitType, setUnitType] = useState(initial?.unitType || "");
  const [incoterms, setIncoterms] = useState(initial?.incoterms || ["CFR"]);
  const [incotermPrices, setIncotermPrices] = useState(initial?.incotermPrices || {});
  const [unitPrice, setUnitPrice] = useState(initial?.unitPrice || "");
  const [currency, setCurrency] = useState(initial?.currency || "USD");
  const [frequency, setFrequency] = useState(initial?.deliveryFrequency || "ONE_SHIPMENT");
  const [numShipments, setNumShipments] = useState(initial?.numShipments || "1");
  const [duration, setDuration] = useState(initial?.contractDuration || "12");
  const [containerCap, setContainerCap] = useState("");
  const [origin, setOrigin] = useState(initial?.origin || "Brazil");
  const [collapsed, setCollapsed] = useState(false);

  const catDef = cat ? PRODUCT_CATEGORIES[cat] : null;

  useEffect(() => {
    if (catDef) { setUnitType(catDef.defaultUnit || ""); setContainerCap(catDef.containerCapacity || ""); }
  }, [cat]);

  const handleIncotermPrice = (inc, price) => {
    setIncotermPrices(prev => ({ ...prev, [inc]: price }));
    if (!unitPrice && price) setUnitPrice(price);
  };

  const primaryPrice = incotermPrices[incoterms[0]] || unitPrice;

  const summary = cat ? calcCommercialSummary({
    category: cat, quantity: qty, unitType, unitPrice: primaryPrice, currency,
    deliveryFrequency: frequency, numShipments, contractDuration: duration,
    headCount: specs.headCount, avgWeight: specs.avgWeight, mortalityMargin: specs.mortalityMargin,
    containerCapacity: containerCap || catDef?.containerCapacity,
  }) : null;

  useEffect(() => {
    onChange(rowId, { category: cat, product, specs, quantity: qty, unitType, incoterms, incotermPrices, unitPrice: primaryPrice, currency, deliveryFrequency: frequency, numShipments, contractDuration: duration, containerCapacity: containerCap, origin, summary });
  }, [cat, product, specs, qty, unitType, incoterms, incotermPrices, primaryPrice, currency, frequency, numShipments, duration, containerCap, origin]);

  return (
    <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
      {/* Row header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "var(--color-background-secondary)", cursor: "pointer" }} onClick={() => setCollapsed(v => !v)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {catDef && <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: catDef.color + "20", color: catDef.color, fontWeight: 600 }}>{catDef.label?.es || cat}</span>}
          {product && <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>— {PRODUCT_CATEGORIES[cat]?.products?.[product]?.label?.es || product}</span>}
          {!catDef && <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Producto {index + 1} — sin categoría</span>}
          {summary?.contractValue > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "#059669" }}>{fmtMoney(summary.contractValue, currency)}</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!isOnly && (
            <button type="button" onClick={e => { e.stopPropagation(); onRemove(rowId); }}
              style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#991b1b", fontSize: 12, cursor: "pointer" }}>
              Quitar
            </button>
          )}
          <span style={{ fontSize: 18, color: "var(--color-text-secondary)", lineHeight: 1 }}>{collapsed ? "▸" : "▾"}</span>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: "1rem" }}>
          {/* Category + Product */}
          <div style={s.row2}>
            <Field label="Categoría *" required>
              <Sel value={cat} onChange={v => { setCat(v); setProduct(""); setSpecs({}); }}>
                <option value="">Seleccionar categoría...</option>
                {Object.keys(PRODUCT_CATEGORIES).map(k => (
                  <option key={k} value={k}>{PRODUCT_CATEGORIES[k].label?.es || k}</option>
                ))}
              </Sel>
            </Field>
            {catDef && Object.keys(catDef.products || {}).length > 0 && (
              <Field label="Variedad / Sub-producto">
                <Sel value={product} onChange={setProduct}>
                  <option value="">Seleccionar...</option>
                  {Object.entries(catDef.products).map(([k, v]) => (
                    <option key={k} value={k}>{v.label?.es || k}</option>
                  ))}
                </Sel>
              </Field>
            )}
          </div>

          {cat && <DynamicFields category={cat} specs={specs} setSpecs={setSpecs} />}

          {/* Origin */}
          {cat && (
            <Field label="Origen del producto">
              <Sel value={origin} onChange={setOrigin}>
                {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
              </Sel>
            </Field>
          )}

          {/* Quantity + Unit + Currency */}
          {cat && (
            <div>
              <div style={s.row3}>
                <Field label="Cantidad por embarque *" required>
                  <Inp type="number" value={qty} onChange={setQty} placeholder="Ej: 540" min="0" />
                </Field>
                <Field label="Unidad *" required>
                  <Sel value={unitType} onChange={setUnitType}>
                    <option value="">Seleccionar...</option>
                    {catDef?.units?.map(u => <option key={u} value={u}>{u}</option>)}
                  </Sel>
                </Field>
                <Field label="Moneda">
                  <Sel value={currency} onChange={setCurrency}>
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                  </Sel>
                </Field>
              </div>

              {/* Incoterms */}
              <Field label="Incoterm(s) — selecciona uno o varios">
                <IncotermSelector selected={incoterms} onChange={setIncoterms} prices={incotermPrices} onPriceChange={handleIncotermPrice} />
              </Field>

              {PRICED_INCOTERMS.filter(i => incoterms.includes(i)).length === 0 && (
                <Field label="Precio por unidad" required>
                  <Inp type="number" value={unitPrice} onChange={setUnitPrice} placeholder="0.00" min="0" />
                </Field>
              )}

              {catDef?.containerCapacity && (
                <Field label="Cap. Contenedor (MT)">
                  <Inp type="number" value={containerCap} onChange={setContainerCap} placeholder={String(catDef.containerCapacity)} />
                </Field>
              )}
            </div>
          )}

          {/* Frequency + Duration */}
          {cat && (
            <div style={s.row3}>
              <Field label="Frecuencia de embarque">
                <Sel value={frequency} onChange={setFrequency}>
                  {DELIVERY_FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label?.es || f.id}</option>)}
                </Sel>
              </Field>
              {frequency === "CUSTOM" && (
                <Field label="Embarques / año">
                  <Inp type="number" value={numShipments} onChange={setNumShipments} min="1" />
                </Field>
              )}
              <Field label="Duración del contrato (meses)">
                <Inp type="number" value={duration} onChange={setDuration} placeholder="12" min="1" />
              </Field>
            </div>
          )}

          {/* Row mini-summary */}
          {summary?.shipmentValue > 0 && (
            <div style={{ background: "linear-gradient(135deg,#1B2A4A 0%,#2d4070 100%)", borderRadius: 10, padding: "12px 14px", color: "#fff", marginTop: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                <MiniBox label="Valor por Embarque" value={fmtMoney(summary.shipmentValue, currency)} highlight />
                {summary.monthlyValue !== summary.shipmentValue && <MiniBox label="Valor Mensual" value={fmtMoney(summary.monthlyValue, currency)} />}
                <MiniBox label="Valor Total Contrato" value={fmtMoney(summary.contractValue, currency)} big />
                <MiniBox label="Embarques/año" value={String(summary.shipmentsPerYear)} />
                {summary.liveAnimalKg > 0 && <MiniBox label="KG Peso Vivo" value={fmtNum(summary.liveAnimalKg) + " kg"} />}
                {summary.containers && <MiniBox label="Contenedores" value={`${summary.containers.containers} × 20'`} />}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniBox({ label, value, highlight, big }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px" }}>
      <p style={{ fontSize: 10, opacity: 0.7, margin: "0 0 3px", textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontSize: big ? 15 : highlight ? 13 : 12, fontWeight: big || highlight ? 700 : 500, margin: 0, color: highlight ? "#4ade80" : "#fff" }}>{value}</p>
    </div>
  );
}

// ─── Aggregate Summary Panel ──────────────────────────────────────────────────
function AggregateSummary({ rows, rowData }) {
  const activeRows = rowData.filter(r => r.summary?.contractValue > 0);
  if (activeRows.length === 0) return null;

  const totalContract = activeRows.reduce((s, r) => s + (r.summary?.contractValue || 0), 0);
  const totalMonthly  = activeRows.reduce((s, r) => s + (r.summary?.monthlyValue || 0), 0);
  const totalShipment = activeRows.reduce((s, r) => s + (r.summary?.shipmentValue || 0), 0);
  const currency = activeRows[0]?.currency || "USD";

  if (activeRows.length === 1) return null; // single row has its own summary

  return (
    <div style={{ background: "linear-gradient(135deg,#0f172a 0%,#1B2A4A 100%)", borderRadius: 12, padding: "1.25rem", color: "#fff", marginTop: 8 }}>
      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, opacity: 0.7, margin: "0 0 12px", textTransform: "uppercase" }}>
        Totales del Programa Comercial ({activeRows.length} productos)
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        <MiniBox label="Valor Total Embarques" value={fmtMoney(totalShipment, currency)} highlight />
        <MiniBox label="Valor Mensual Total" value={fmtMoney(totalMonthly, currency)} />
        <MiniBox label="TOTAL CONTRATO PROGRAMA" value={fmtMoney(totalContract, currency)} big />
      </div>
    </div>
  );
}

// ─── Main CommercialEngine Component ─────────────────────────────────────────
export function CommercialEngine({ value, onChange }) {
  const [rows, setRows] = useState(() => {
    if (value?.rows?.length > 0) return value.rows;
    return [newRowData()];
  });
  const [rowData, setRowData] = useState({});
  const [destination, setDestination] = useState(value?.destination || "");

  const addRow = () => setRows(prev => [...prev, newRowData()]);
  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));

  const handleRowChange = (id, data) => {
    setRowData(prev => ({ ...prev, [id]: data }));
  };

  const dataArray = rows.map(r => rowData[r.id] || r);
  const firstRow = dataArray[0] || {};

  // Aggregate summary for backward-compat (first row data exposed at top level)
  useEffect(() => {
    onChange?.({
      // Backward-compat fields (from first row)
      category: firstRow.category || "",
      product: firstRow.product || "",
      specs: firstRow.specs || {},
      quantity: firstRow.quantity || "",
      unitType: firstRow.unitType || "",
      unitPrice: firstRow.unitPrice || "",
      incotermPrices: firstRow.incotermPrices || {},
      incoterms: firstRow.incoterms || ["CFR"],
      incoterm: (firstRow.incoterms || ["CFR"])[0],
      currency: firstRow.currency || "USD",
      deliveryFrequency: firstRow.deliveryFrequency || "ONE_SHIPMENT",
      numShipments: firstRow.numShipments || "1",
      contractDuration: firstRow.contractDuration || "12",
      containerCapacity: firstRow.containerCapacity || "",
      summary: firstRow.summary || null,
      // Multi-row
      rows: dataArray,
      destination,
      origin: firstRow.origin || "Brazil",
    });
  }, [rowData, destination, rows]);

  return (
    <div>
      {/* Destination — document level */}
      <div style={s.section}>
        <p style={s.title}>País de Destino / Destination Country</p>
        <CountrySearch value={destination} onChange={setDestination} />
      </div>

      {/* Product rows */}
      {rows.map((row, index) => (
        <ProductRowPanel
          key={row.id}
          rowId={row.id}
          initial={row}
          index={index}
          onChange={handleRowChange}
          onRemove={removeRow}
          isOnly={rows.length === 1}
        />
      ))}

      {/* Add product row */}
      <button type="button" onClick={addRow}
        style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px dashed var(--color-border-secondary)", background: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 300 }}>+</span> Agregar otro producto al programa
      </button>

      {/* Aggregate summary */}
      <AggregateSummary rows={rows} rowData={dataArray} />
    </div>
  );
}

export { MiniBox as CommercialSummaryBox };
