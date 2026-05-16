import { useState, useEffect } from "react";
import { PRODUCT_CATEGORIES, DELIVERY_FREQUENCIES, CURRENCIES, INCOTERMS } from "../config/productCategories.js";
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
  const [unitPrice, setUnitPrice] = useState(value?.unitPrice || "");
  const [currency, setCurrency] = useState(value?.currency || "USD");
  const [incoterm, setIncoterm] = useState(value?.incoterm || "CFR");
  const [frequency, setFrequency] = useState(value?.deliveryFrequency || "ONE_SHIPMENT");
  const [numShipments, setNumShipments] = useState(value?.numShipments || "1");
  const [duration, setDuration] = useState(value?.contractDuration || "12");
  const [containerCap, setContainerCap] = useState("");

  const catDef = cat ? PRODUCT_CATEGORIES[cat] : null;

  useEffect(() => {
    if (catDef) {
      setUnitType(catDef.defaultUnit || "");
      setContainerCap(catDef.containerCapacity || "");
    }
  }, [cat]);

  const summary = calcCommercialSummary({
    category: cat,
    quantity: qty,
    unitType,
    unitPrice,
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
      unitPrice,
      currency,
      incoterm,
      deliveryFrequency: frequency,
      numShipments,
      contractDuration: duration,
      containerCapacity: containerCap,
      summary,
    });
  }, [cat, product, specs, qty, unitType, unitPrice, currency, incoterm, frequency, numShipments, duration, containerCap]);

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
            <Field label="Precio por Unidad *" required>
              <Input type="number" value={unitPrice} onChange={setUnitPrice} placeholder="Ej: 4.90" min="0" />
            </Field>
            <Field label="Moneda">
              <Select value={currency} onChange={setCurrency}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </Select>
            </Field>
            <Field label="Incoterm">
              <Select value={incoterm} onChange={setIncoterm}>
                {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
              </Select>
            </Field>
            {catDef?.containerCapacity && (
              <Field label="Capacidad Contenedor (MT)">
                <Input type="number" value={containerCap} onChange={setContainerCap} placeholder={String(catDef.containerCapacity)} />
              </Field>
            )}
          </div>
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
