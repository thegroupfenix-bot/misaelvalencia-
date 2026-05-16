import { useState, useEffect, useRef } from "react";
import { PRODUCT_CATEGORIES, DELIVERY_FREQUENCIES, CURRENCIES, INCOTERMS } from "../config/productCategories.js";
import { searchCountries } from "../config/worldCountries.js";
import { calcCommercialSummary, fmtMoney, fmtNum } from "../utils/calculations.js";

const s = {
  section: { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1.25rem", marginBottom: 16 },
  title:   { fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 14px", paddingBottom: 8, borderBottom: "0.5px solid var(--color-border-tertiary)" },
  row:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 0 },
  field:   { marginBottom: 12 },
  label:   { fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 },
  input:   { width: "100%", padding: "8px 11px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" },
  select:  { width: "100%", padding: "8px 11px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" },
};

const CATEGORY_KEYS = Object.keys(PRODUCT_CATEGORIES);

// ─── Incoterms that show individual price fields ────────────────────────────
const PRICED_INCOTERMS = ["FOB", "CFR", "CIF", "DDP"];

function Field({ label, children, required }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}{required && <span style={{ color: "#dc2626" }}> *</span>}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder, min }) {
  return (
    <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} min={min} style={s.input} />
  );
}

function Select({ value, onChange, children }) {
  return (
    <select value={value ?? ""} onChange={e => onChange(e.target.value)} style={s.select}>
      {children}
    </select>
  );
}

// ─── Country Search Combobox ──────────────────────────────────────────────────
function CountrySearch({ value, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const ref = useRef();

  useEffect(() => {
    if (query.length > 0) {
      setResults(searchCountries(query).slice(0, 8));
    } else {
      setResults([]);
    }
  }, [query]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (country) => {
    setQuery(country.name);
    onChange(country.name);
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(""); }}
        onFocus={() => query && setOpen(true)}
        placeholder="Buscar país destino... / Search destination country..."
        style={s.input}
      />
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)",
          borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", maxHeight: 240, overflowY: "auto",
        }}>
          {results.map(c => (
            <button key={c.code} type="button" onMouseDown={() => select(c)}
              style={{
                width: "100%", textAlign: "left", padding: "8px 12px", border: "none",
                background: "none", cursor: "pointer", fontSize: 13, display: "flex",
                justifyContent: "space-between", alignItems: "center",
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                color: "var(--color-text-primary)",
              }}>
              <span>{c.name}</span>
              {c.port && <span style={{ fontSize: 11, color: "var(--color-text-secondary)", maxWidth: "55%", textAlign: "right" }}>{c.port.split("/")[0].trim()}</span>}
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
    if (selected.includes(inc)) {
      if (selected.length === 1) return; // at least one required
      onChange(selected.filter(i => i !== inc));
    } else {
      onChange([...selected, inc]);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {INCOTERMS.map(inc => {
          const active = selected.includes(inc);
          return (
            <button key={inc} type="button" onClick={() => toggle(inc)}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: active ? "2px solid #1B2A4A" : "1px solid #d1d5db",
                background: active ? "#1B2A4A" : "var(--color-background-primary)",
                color: active ? "#fff" : "var(--color-text-secondary)",
                transition: "all 0.15s",
              }}>
              {inc}
            </button>
          );
        })}
      </div>
      {/* Dynamic price fields for priced incoterms */}
      {PRICED_INCOTERMS.filter(i => selected.includes(i)).length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 10 }}>
          {PRICED_INCOTERMS.filter(i => selected.includes(i)).map(inc => (
            <div key={inc} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px", border: "0.5px solid var(--color-border-tertiary)" }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#1B2A4A", display: "block", marginBottom: 5, textTransform: "uppercase" }}>
                Precio {inc}
              </label>
              <input
                type="number"
                value={prices[inc] ?? ""}
                onChange={e => onPriceChange(inc, e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={{ ...s.input, marginBottom: 0 }}
              />
            </div>
          ))}
        </div>
      )}
      {selected.length > 1 && (
        <p style={{ fontSize: 11, color: "#6b7280", margin: "8px 0 0" }}>
          Múltiples Incoterms seleccionados — el PDF mostrará todos con sus precios respectivos.
        </p>
      )}
    </div>
  );
}

// ─── Commercial Summary Panel ─────────────────────────────────────────────────
function CommercialSummary({ summary, currency }) {
  if (!summary?.shipmentValue) return null;
  const { shipmentValue, monthlyValue, contractValue, containers, liveAnimalKg, shipmentsPerYear, durationMonths } = summary;

  return (
    <div style={{ background: "linear-gradient(135deg,#1B2A4A 0%,#2d4070 100%)", borderRadius: 12, padding: "1.25rem", color: "#fff" }}>
      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, opacity: 0.7, margin: "0 0 12px", textTransform: "uppercase" }}>Resumen Comercial / Commercial Summary</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
        <SummaryBox label="Valor por Embarque" value={fmtMoney(shipmentValue, currency)} highlight />
        {monthlyValue !== shipmentValue && <SummaryBox label="Valor Mensual" value={fmtMoney(monthlyValue, currency)} />}
        <SummaryBox label="Valor Total Contrato" value={fmtMoney(contractValue, currency)} big />
        <SummaryBox label="Embarques / Año" value={String(shipmentsPerYear)} />
        <SummaryBox label="Duración" value={`${durationMonths} meses`} />
        {liveAnimalKg > 0 && <SummaryBox label="KG Peso Vivo Total" value={fmtNum(liveAnimalKg) + " kg"} />}
        {containers && <SummaryBox label="Contenedores Estimados" value={`${containers.containers} × 20' (${containers.exact.toFixed(1)} exacto)`} />}
      </div>
    </div>
  );
}

function SummaryBox({ label, value, highlight, big }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px" }}>
      <p style={{ fontSize: 10, opacity: 0.7, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
      <p style={{ fontSize: big ? 18 : highlight ? 15 : 13, fontWeight: big || highlight ? 700 : 500, margin: 0, color: highlight ? "#4ade80" : "#fff" }}>{value}</p>
    </div>
  );
}

// ─── Dynamic Category Fields ──────────────────────────────────────────────────
function DynamicFields({ category, specs, setSpecs }) {
  const catDef = PRODUCT_CATEGORIES[category];
  if (!catDef?.fields?.length) return null;

  const setSpec = (key, val) => setSpecs(prev => ({ ...prev, [key]: val }));

  return (
    <div>
      <p style={{ ...s.title, marginTop: 12 }}>{catDef?.label?.es || category} — Especificaciones</p>
      <div style={s.row}>
        {catDef.fields.map(f => (
          <Field key={f.key} label={f.label?.es || f.label} required={f.required}>
            {f.type === "select" ? (
              <Select value={specs[f.key] ?? ""} onChange={v => setSpec(f.key, v)}>
                <option value="">Seleccionar...</option>
                {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            ) : f.type === "checkbox" ? (
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={!!specs[f.key]}
                  onChange={e => setSpec(f.key, e.target.checked)} style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>Sí / Yes</span>
              </label>
            ) : f.type === "textarea" ? (
              <textarea rows={3} value={specs[f.key] ?? ""} onChange={e => setSpec(f.key, e.target.value)}
                placeholder={f.placeholder || ""}
                style={{ ...s.input, resize: "vertical", height: 72 }} />
            ) : (
              <Input type={f.type === "number" ? "number" : "text"}
                value={specs[f.key] ?? (f.default !== undefined ? f.default : "")}
                onChange={v => setSpec(f.key, v)} placeholder={f.placeholder} />
            )}
          </Field>
        ))}
      </div>
    </div>
  );
}

// ─── Main Commercial Engine Component ────────────────────────────────────────
export function CommercialEngine({ value, onChange }) {
  const [cat, setCat] = useState(value?.category || "");
  const [product, setProduct] = useState(value?.product || "");
  const [specs, setSpecs] = useState(value?.specs || {});
  const [qty, setQty] = useState(value?.quantity || "");
  const [unitType, setUnitType] = useState(value?.unitType || "");
  const [incoterms, setIncoterms] = useState(value?.incoterms || ["CFR"]);
  const [incotermPrices, setIncotermPrices] = useState(value?.incotermPrices || {});
  const [unitPrice, setUnitPrice] = useState(value?.unitPrice || "");
  const [currency, setCurrency] = useState(value?.currency || "USD");
  const [frequency, setFrequency] = useState(value?.deliveryFrequency || "ONE_SHIPMENT");
  const [numShipments, setNumShipments] = useState(value?.numShipments || "1");
  const [duration, setDuration] = useState(value?.contractDuration || "12");
  const [containerCap, setContainerCap] = useState("");
  const [destination, setDestination] = useState(value?.destination || "");

  const catDef = cat ? PRODUCT_CATEGORIES[cat] : null;

  useEffect(() => {
    if (catDef) {
      setUnitType(catDef.defaultUnit || "");
      setContainerCap(catDef.containerCapacity || "");
    }
  }, [cat]);

  const handleIncotermPrice = (inc, price) => {
    setIncotermPrices(prev => ({ ...prev, [inc]: price }));
    // Set primary unit price from the first priced incoterm if not set
    if (!unitPrice && price) setUnitPrice(price);
  };

  // Use primary incoterm price for calculations (first selected priced incoterm, or unitPrice)
  const primaryPrice = incotermPrices[incoterms[0]] || unitPrice;

  const summary = calcCommercialSummary({
    category: cat,
    quantity: qty,
    unitType,
    unitPrice: primaryPrice,
    currency,
    deliveryFrequency: frequency,
    numShipments,
    contractDuration: duration,
    headCount: specs.headCount,
    avgWeight: specs.avgWeight,
    mortalityMargin: specs.mortalityMargin,
    containerCapacity: containerCap || catDef?.containerCapacity,
  });

  useEffect(() => {
    onChange?.({
      category: cat,
      product,
      specs,
      quantity: qty,
      unitType,
      unitPrice: primaryPrice,
      incotermPrices,
      incoterms,
      incoterm: incoterms[0] || "CFR",
      currency,
      deliveryFrequency: frequency,
      numShipments,
      contractDuration: duration,
      containerCapacity: containerCap,
      destination,
      summary,
    });
  }, [cat, product, specs, qty, unitType, primaryPrice, incotermPrices, incoterms, currency, frequency, numShipments, duration, containerCap, destination]);

  return (
    <div>
      {/* Category + Product */}
      <div style={s.section}>
        <p style={s.title}>Categoría de Producto / Product Category</p>
        <div style={s.row}>
          <Field label="Categoría *" required>
            <Select value={cat} onChange={v => { setCat(v); setProduct(""); setSpecs({}); }}>
              <option value="">Seleccionar categoría...</option>
              {CATEGORY_KEYS.map(k => (
                <option key={k} value={k}>{PRODUCT_CATEGORIES[k].label?.es || k}</option>
              ))}
            </Select>
          </Field>
          {catDef && Object.keys(catDef.products || {}).length > 0 && (
            <Field label="Sub-producto / Especie">
              <Select value={product} onChange={setProduct}>
                <option value="">Seleccionar...</option>
                {Object.entries(catDef.products).map(([k, v]) => (
                  <option key={k} value={k}>{v.label?.es || k}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {cat && <DynamicFields category={cat} specs={specs} setSpecs={setSpecs} />}
      </div>

      {/* Destination */}
      {cat && (
        <div style={s.section}>
          <p style={s.title}>Destino / Destination Country</p>
          <Field label="País de Destino">
            <CountrySearch value={destination} onChange={setDestination} />
          </Field>
        </div>
      )}

      {/* Commercial terms */}
      {cat && (
        <div style={s.section}>
          <p style={s.title}>Términos Comerciales / Commercial Terms</p>
          <div style={s.row}>
            <Field label="Cantidad *" required>
              <Input type="number" value={qty} onChange={setQty} placeholder="Ej: 540" min="0" />
            </Field>
            <Field label="Unidad *" required>
              <Select value={unitType} onChange={setUnitType}>
                <option value="">Seleccionar unidad...</option>
                {catDef?.units?.map(u => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
            <Field label="Moneda">
              <Select value={currency} onChange={setCurrency}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </Select>
            </Field>
            {catDef?.containerCapacity && (
              <Field label="Capacidad Contenedor (MT)">
                <Input type="number" value={containerCap} onChange={setContainerCap} placeholder={String(catDef.containerCapacity)} />
              </Field>
            )}
          </div>
          {/* Multi-Incoterm Selector */}
          <Field label="Incoterm(s) — selecciona uno o varios">
            <IncotermSelector
              selected={incoterms}
              onChange={setIncoterms}
              prices={incotermPrices}
              onPriceChange={handleIncotermPrice}
            />
          </Field>
          {/* Fallback unit price if no incoterm price set */}
          {PRICED_INCOTERMS.filter(i => incoterms.includes(i)).length === 0 && (
            <Field label="Precio por Unidad *" required>
              <Input type="number" value={unitPrice} onChange={setUnitPrice} placeholder="Ej: 4.90" min="0" />
            </Field>
          )}
        </div>
      )}

      {/* Delivery & contract */}
      {cat && (
        <div style={s.section}>
          <p style={s.title}>Frecuencia y Duración / Delivery & Duration</p>
          <div style={s.row}>
            <Field label="Frecuencia de Embarque">
              <Select value={frequency} onChange={setFrequency}>
                {DELIVERY_FREQUENCIES.map(f => (
                  <option key={f.id} value={f.id}>{f.label?.es || f.id}</option>
                ))}
              </Select>
            </Field>
            {frequency === "CUSTOM" && (
              <Field label="Número de Embarques / Año">
                <Input type="number" value={numShipments} onChange={setNumShipments} min="1" />
              </Field>
            )}
            <Field label="Duración del Contrato (meses)">
              <Input type="number" value={duration} onChange={setDuration} placeholder="12" min="1" />
            </Field>
          </div>
        </div>
      )}

      {/* Summary */}
      {summary?.shipmentValue > 0 && (
        <CommercialSummary summary={summary} currency={currency} />
      )}
    </div>
  );
}

export { CommercialSummary };
