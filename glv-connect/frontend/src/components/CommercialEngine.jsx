import { useState, useEffect, useRef } from "react";
import { PRODUCT_CATEGORIES, DELIVERY_FREQUENCIES, CURRENCIES, INCOTERMS } from "../config/productCategories.js";
import { searchCountries } from "../config/worldCountries.js";
import { calcCommercialSummary, fmtMoney, fmtNum } from "../utils/calculations.js";
import { BREEDS, SPECIES_LABELS, getBreedsForSpecies } from "../config/breeds.js";

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

// ─── Livestock Breed Selector ─────────────────────────────────────────────────
const CARGO_TYPES = ["Dry Cargo","Refrigerated Cargo","Frozen Cargo","Live Animals","ISO Tank","Air Cargo"];

function LivestockBreedSelector({ origin, specs, setSpecs }) {
  const species = specs.species || "SHEEP";
  const selectedBreeds = specs.breeds || []; // [{ breedId, name, quantity, notes }]
  const [customBreed, setCustomBreed] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const availableBreeds = getBreedsForSpecies(species, origin);
  const hasBreed = (id) => selectedBreeds.some(b => b.breedId === id);

  const setSpecField = (k, v) => setSpecs(p => ({ ...p, [k]: v }));

  const toggleBreed = (breed) => {
    if (hasBreed(breed.id)) {
      setSpecField("breeds", selectedBreeds.filter(b => b.breedId !== breed.id));
    } else {
      setSpecField("breeds", [...selectedBreeds, { breedId: breed.id, name: breed.name, quantity: "", notes: "" }]);
    }
  };

  const updateBreedQty = (breedId, qty) => {
    setSpecField("breeds", selectedBreeds.map(b => b.breedId === breedId ? { ...b, quantity: qty } : b));
  };

  const addCustomBreed = () => {
    if (!customBreed.trim()) return;
    setSpecField("breeds", [...selectedBreeds, { breedId: "CUSTOM_" + Date.now(), name: customBreed.trim(), quantity: "", notes: "", custom: true }]);
    setCustomBreed("");
    setShowCustom(false);
  };

  const totalAllocated = selectedBreeds.reduce((s, b) => s + (parseFloat(b.quantity) || 0), 0);
  const totalHeads = parseFloat(specs.headCount) || 0;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Species selector */}
      <div style={{ marginBottom: 12 }}>
        <label style={s.label}>Especie / Animal Type *</label>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(SPECIES_LABELS).map(([key, lbl]) => (
            <button key={key} type="button" onClick={() => { setSpecField("species", key); setSpecField("breeds", []); }}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: species === key ? "2px solid #1B2A4A" : "1px solid #d1d5db", background: species === key ? "#1B2A4A" : "none", color: species === key ? "#fff" : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {lbl.es}
            </button>
          ))}
        </div>
      </div>

      {/* Breed selection */}
      {availableBreeds.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label style={s.label}>Razas disponibles — {origin || "seleccione origen"}</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {availableBreeds.map(breed => (
              <button key={breed.id} type="button" onClick={() => toggleBreed(breed)}
                style={{ padding: "5px 12px", borderRadius: 20, border: hasBreed(breed.id) ? "2px solid #1B2A4A" : "1px solid #d1d5db", background: hasBreed(breed.id) ? "#1B2A4A" : "#f9fafb", color: hasBreed(breed.id) ? "#fff" : "#374151", fontSize: 12, fontWeight: hasBreed(breed.id) ? 600 : 400, cursor: "pointer" }}>
                {breed.name}
                {hasBreed(breed.id) && <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.8 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Multi-breed quantity allocation */}
      {selectedBreeds.length > 0 && (
        <div style={{ background: "#f0f4ff", borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: "1px solid #c7d2fe" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#1e3a8a", margin: "0 0 10px" }}>
            Distribución por Raza — Total asignado: {fmtNum(totalAllocated)} cabezas
            {totalHeads > 0 && totalAllocated !== totalHeads && (
              <span style={{ marginLeft: 8, color: "#dc2626" }}>⚠ Diferencia: {fmtNum(totalHeads - totalAllocated)} cab.</span>
            )}
          </p>
          {selectedBreeds.map(b => (
            <div key={b.breedId} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1B2A4A", minWidth: 140 }}>{b.name}{b.custom && " (personalizada)"}</span>
              <input type="number" value={b.quantity} onChange={e => updateBreedQty(b.breedId, e.target.value)}
                placeholder="Cantidad" min="0" style={{ ...s.input, width: 110, flex: "none" }} />
              <span style={{ fontSize: 11, color: "#6b7280" }}>cabezas</span>
              <button type="button" onClick={() => setSpecField("breeds", selectedBreeds.filter(x => x.breedId !== b.breedId))}
                style={{ border: "none", background: "#fee2e2", color: "#991b1b", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Custom breed */}
      {showCustom ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input value={customBreed} onChange={e => setCustomBreed(e.target.value)} placeholder="Nombre de la raza personalizada"
            onKeyDown={e => e.key === "Enter" && addCustomBreed()} style={{ ...s.input, flex: 1 }} />
          <button type="button" onClick={addCustomBreed} style={{ padding: "8px 14px", borderRadius: 7, border: "none", background: "#1B2A4A", color: "#fff", cursor: "pointer", fontSize: 12 }}>Agregar</button>
          <button type="button" onClick={() => setShowCustom(false)} style={{ padding: "8px 10px", borderRadius: 7, border: "1px solid #d1d5db", background: "none", cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowCustom(true)}
          style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
          + Agregar raza personalizada
        </button>
      )}
    </div>
  );
}

// ─── Cargo Type Selector ──────────────────────────────────────────────────────
function CargoTypeSelector({ value, onChange, category }) {
  const defaultCargo = category === "LIVE_ANIMALS" ? "Live Animals"
    : ["FROZEN_MEAT","FROZEN_POULTRY","CANNED_MEAT"].includes(category) ? "Frozen Cargo"
    : ["FRUIT_PRODUCTS","COLOMBIAN_EXOTIC_FRUITS"].includes(category) ? "Refrigerated Cargo"
    : "Dry Cargo";

  useEffect(() => {
    if (!value && category) onChange(defaultCargo);
  }, [category]);

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={s.label}>Tipo de Carga / Cargo Type</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {CARGO_TYPES.map(ct => {
          const active = (value || defaultCargo) === ct;
          const isLiveWarning = ct === "Live Animals" && category !== "LIVE_ANIMALS";
          return (
            <button key={ct} type="button" onClick={() => onChange(ct)}
              style={{ padding: "5px 12px", borderRadius: 20, border: active ? "2px solid #1B2A4A" : "1px solid #d1d5db", background: active ? "#1B2A4A" : "#f9fafb", color: active ? "#fff" : "#374151", fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400 }}>
              {ct}
            </button>
          );
        })}
      </div>
      {(value || defaultCargo) === "Frozen Cargo" && (
        <p style={{ fontSize: 11, color: "#2563eb", margin: "5px 0 0" }}>❄ Contenedor Reefer 40FT por defecto. Nota: disponibilidad de 20FT reefer es limitada en mercados internacionales actuales.</p>
      )}
      {(value || defaultCargo) === "Live Animals" && (
        <p style={{ fontSize: 11, color: "#059669", margin: "5px 0 0" }}>🐄 Transporte en buque ganadero especializado, avión de carga o camión con ventilación. No se calculan contenedores estándar.</p>
      )}
      {(value || defaultCargo) === "Refrigerated Cargo" && (
        <p style={{ fontSize: 11, color: "#0369a1", margin: "5px 0 0" }}>❄ Contenedor refrigerado 40FT Reefer recomendado.</p>
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
  const [cargoType, setCargoType] = useState(initial?.cargoType || "");
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
    onChange(rowId, { category: cat, product, specs, quantity: qty, unitType, incoterms, incotermPrices, unitPrice: primaryPrice, currency, deliveryFrequency: frequency, numShipments, contractDuration: duration, containerCapacity: containerCap, origin, cargoType, summary });
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

          {/* Livestock breed selector — special flow for LIVE_ANIMALS */}
          {cat === "LIVE_ANIMALS" && (
            <LivestockBreedSelector origin={origin} specs={specs} setSpecs={setSpecs} />
          )}

          {cat && cat !== "LIVE_ANIMALS" && <DynamicFields category={cat} specs={specs} setSpecs={setSpecs} />}
          {cat === "LIVE_ANIMALS" && <DynamicFields category={cat} specs={specs} setSpecs={setSpecs} />}

          {/* Origin */}
          {cat && (
            <Field label="Origen del producto">
              <Sel value={origin} onChange={setOrigin}>
                {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
              </Sel>
            </Field>
          )}

          {/* Cargo type selector */}
          {cat && <CargoTypeSelector value={cargoType} onChange={setCargoType} category={cat} />}

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

          {/* Row commercial summary — always shown when category + price are set */}
          {cat && (
            <CommercialSummaryPanel summary={summary} currency={currency} unitPrice={primaryPrice} qty={qty} unitType={unitType} specs={specs} frequency={frequency} duration={duration} />
          )}
        </div>
      )}
    </div>
  );
}

function CommercialSummaryPanel({ summary, currency, unitPrice, qty, unitType, specs, frequency, duration }) {
  const hasPrice = parseFloat(unitPrice) > 0;
  const hasQty   = parseFloat(qty) > 0;

  const panelStyle = {
    background: summary?.contractValue > 0
      ? "linear-gradient(135deg,#1B2A4A 0%,#2d4070 100%)"
      : "linear-gradient(135deg,#374151 0%,#4b5563 100%)",
    borderRadius: 10, padding: "14px 16px", color: "#fff", marginTop: 10,
  };

  const pendingItems = [];
  if (!hasQty)   pendingItems.push("cantidad");
  if (!hasPrice) pendingItems.push("precio por unidad");

  if (!hasQty && !hasPrice) {
    return (
      <div style={{ ...panelStyle, opacity: 0.7 }}>
        <p style={{ fontSize: 11, opacity: 0.7, margin: "0 0 6px", letterSpacing: 1, textTransform: "uppercase" }}>Resumen Comercial</p>
        <p style={{ fontSize: 12, margin: 0, opacity: 0.8 }}>Ingrese {pendingItems.join(" y ")} para ver los cálculos.</p>
      </div>
    );
  }

  const fmtFreq = { ONE_SHIPMENT: "Embarque único", MONTHLY: "Mensual", BIMONTHLY: "Bimestral", QUARTERLY: "Trimestral", CUSTOM: "Personalizado" };

  return (
    <div style={panelStyle}>
      <p style={{ fontSize: 11, opacity: 0.7, margin: "0 0 12px", letterSpacing: 1, textTransform: "uppercase" }}>
        Resumen Comercial del Programa
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: 10 }}>
        {hasPrice && <MiniBox label="Precio / Unidad" value={`${currency} ${parseFloat(unitPrice).toFixed(2)}`} />}
        {hasQty && <MiniBox label={`Cantidad (${unitType || "unid."})`} value={fmtNum(parseFloat(qty))} />}
        {summary?.shipmentValue > 0 && <MiniBox label="Valor por Embarque" value={fmtMoney(summary.shipmentValue, currency)} highlight />}
        {summary?.shipmentValue > 0 && summary?.monthlyValue !== summary?.shipmentValue && (
          <MiniBox label="Valor Mensual" value={fmtMoney(summary.monthlyValue, currency)} />
        )}
        {summary?.shipmentsPerYear != null && (
          <MiniBox label="Embarques / Año" value={String(summary.shipmentsPerYear)} />
        )}
        {duration && <MiniBox label="Duración Contrato" value={`${duration} meses`} />}
        {summary?.contractValue > 0 && (
          <MiniBox label="TOTAL PROGRAMA" value={fmtMoney(summary.contractValue, currency)} big />
        )}
        {summary?.liveAnimalKg > 0 && (
          <MiniBox label="Peso Vivo Total" value={fmtNum(summary.liveAnimalKg) + " kg"} />
        )}
        {specs?.headCount > 0 && (
          <MiniBox label="Cabezas" value={fmtNum(parseFloat(specs.headCount))} />
        )}
        {specs?.avgWeight > 0 && (
          <MiniBox label="Peso Prom." value={`${specs.avgWeight} kg/cabeza`} />
        )}
        {summary?.containers && (
          <MiniBox label="Contenedores est." value={`${summary.containers.containers} × 20'`} />
        )}
        {summary?.contractValue > 0 && summary?.durationMonths > 0 && (
          <MiniBox label="Valor Anual" value={fmtMoney(summary.contractValue / (summary.durationMonths / 12), currency)} />
        )}
      </div>
      {!summary?.contractValue && hasQty && hasPrice && (
        <p style={{ fontSize: 11, opacity: 0.7, margin: "10px 0 0", fontStyle: "italic" }}>
          Selecciona frecuencia y duración para ver el valor total del contrato.
        </p>
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

  if (activeRows.length === 1) return null;

  const totalContainers = activeRows.reduce((s, r) => s + (r.summary?.containers?.containers || 0), 0);
  const annualValue = activeRows[0]?.summary?.durationMonths > 0
    ? totalContract / (activeRows[0].summary.durationMonths / 12)
    : totalContract;

  return (
    <div style={{ background: "linear-gradient(135deg,#0f172a 0%,#1B2A4A 100%)", borderRadius: 12, padding: "1.25rem", color: "#fff", marginTop: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, opacity: 0.7, margin: "0 0 14px", textTransform: "uppercase" }}>
        Totales Consolidados del Programa — {activeRows.length} productos
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        <MiniBox label="Valor por Embarque" value={fmtMoney(totalShipment, currency)} highlight />
        <MiniBox label="Valor Mensual Total" value={fmtMoney(totalMonthly, currency)} />
        <MiniBox label="Valor Anual Estimado" value={fmtMoney(annualValue, currency)} />
        <MiniBox label="TOTAL PROGRAMA" value={fmtMoney(totalContract, currency)} big />
        {totalContainers > 0 && <MiniBox label="Contenedores Tot." value={`${totalContainers} × 20'`} />}
        <MiniBox label="Líneas de Producto" value={String(activeRows.length)} />
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
