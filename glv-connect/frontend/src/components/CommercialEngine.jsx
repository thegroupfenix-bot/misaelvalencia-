import { useState, useEffect, useRef } from "react";
import { PRODUCT_CATEGORIES, DELIVERY_FREQUENCIES, CURRENCIES, INCOTERMS } from "../config/productCategories.js";
import { searchCountries, WORLD_COUNTRIES } from "../config/worldCountries.js";
import { calcCommercialSummary, calcSkuShipmentValue, calcMultiSkuSummary, fmtMoney, fmtNum } from "../utils/calculations.js";
import { BREEDS, SPECIES_LABELS, getBreedsForSpecies } from "../config/breeds.js";
import { getPortsForCountry } from "../config/destinationPorts.js";
import { getDefaultContainer, getDefaultCargoType } from "../engines/categoryEngine.js";
import { CONTAINER_TYPES as CONTAINER_TYPES_ENGINE, getContainerLabel } from "../engines/containerEngine.js";
// V8: Oils Export Engine panel — only renders when category === "OILS"
import OilsExportPanel from "./OilsExportPanel.jsx";
import { getCategoryProfile } from "../engines/categoryProfiles.js";
import {
  BULK_INDUSTRIAL_OPTIONS, RETAIL_CONSUMER_OPTIONS, RETAIL_BOX_ENGINE_TYPES,
  LIQUID_SIZE_RETAIL, LIQUID_SIZE_INDUSTRIAL, COMMERCIAL_SALE_UNITS, getSaleUnitsForProfile,
  // V6 Multi-SKU engine
  EXPORT_FORMAT_OPTIONS, INDUSTRIAL_SALE_UNITS, SKU_SALE_UNITS, SKU_PACKAGING_TYPES,
  isRetailExportFormat, isPouchExportFormat, getExportFormatLabel, getUnitContext,
  // V7.1 Single source of truth
  resolveNormalizedPresentationSize,
} from "../engines/packagingEngine.js";
import {
  POUCH_TYPES, FILM_STRUCTURES, POUCH_SIZES, SEAL_TYPES, PRINT_TYPES, FINISH_TYPES,
  VALVE_OPTIONS, FOOD_GRADE_CERTS, MASTER_CARTON_CONFIG, PALLET_CONFIG, OEM_CAPABILITIES,
  getCartonConfig, getDefaultUnitsPerCarton, getContainerUtilization, calcPouchLogistics,
  POUCH_EXPORT_DESCRIPTION, isPouchExportFormat as isPouchFmt, SKU_POUCH_PACKAGING_TYPES,
  POUCH_MEDIA_TAGS,
} from "../engines/PouchPackagingEngine.js";

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
  return { id: _rid++, category: "", product: "", specs: {}, quantity: "", unitType: "", incoterms: ["CFR"], incotermPrices: {}, unitPrice: "", currency: "USD", deliveryFrequency: "ONE_SHIPMENT", numShipments: "1", contractDuration: "12", containerCapacity: "", containerType: "", origin: "Brazil" };
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

  // Sync the visible input text whenever the parent resets the value (e.g. on remount
  // or when the parent clears the destination after a stale-state reset).
  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => { setResults(query.length > 0 ? searchCountries(query).slice(0, 8) : []); }, [query]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange("", ""); }}
        onFocus={() => query && setOpen(true)}
        placeholder="Buscar país destino..." style={s.input} />
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", maxHeight: 220, overflowY: "auto" }}>
          {results.map(c => (
            <button key={c.code} type="button" onMouseDown={() => { setQuery(c.name); onChange(c.name, c.port || ""); setOpen(false); }}
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
function IncotermSelector({ selected, onChange, prices, onPriceChange, commercialUnit }) {
  const toggle = (inc) => {
    if (selected.includes(inc)) { if (selected.length === 1) return; onChange(selected.filter(i => i !== inc)); }
    else onChange([...selected, inc]);
  };
  // Dynamic label driven by commercialUnit — never hardcoded /kg
  const priceUnitLabel = COMMERCIAL_SALE_UNITS.find(u => u.id === commercialUnit)?.abbr || "/kg";

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
              <label style={{ fontSize: 11, fontWeight: 600, color: "#1B2A4A", display: "block", marginBottom: 5 }}>
                Precio {inc} <span style={{ color: "#2563eb", fontWeight: 700 }}>{priceUnitLabel}</span>
              </label>
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

  const setBreeds = (newBreeds) => {
    setSpecField("breeds", newBreeds);
    setSpecField("breed", newBreeds.map(b => b.name).join(" / "));
  };

  const toggleBreed = (breed) => {
    const newBreeds = hasBreed(breed.id)
      ? selectedBreeds.filter(b => b.breedId !== breed.id)
      : [...selectedBreeds, { breedId: breed.id, name: breed.name }];
    setBreeds(newBreeds);
  };

  const addCustomBreed = () => {
    if (!customBreed.trim()) return;
    setBreeds([...selectedBreeds, { breedId: "CUSTOM_" + Date.now(), name: customBreed.trim(), custom: true }]);
    setCustomBreed("");
    setShowCustom(false);
  };

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

      {/* Selected breeds summary — indicative preference, no per-breed quantity */}
      {selectedBreeds.length > 0 && (
        <div style={{ background: "#f0f4ff", borderRadius: 10, padding: "10px 14px", marginBottom: 10, border: "1px solid #c7d2fe" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#1e3a8a", margin: "0 0 8px" }}>
            Preferencia comercial: {selectedBreeds.length} raza(s) seleccionada(s)
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {selectedBreeds.map(b => (
              <span key={b.breedId} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 16, background: "#1B2A4A", color: "#fff", fontSize: 12 }}>
                {b.name}{b.custom && " *"}
                <button type="button" onClick={() => setBreeds(selectedBreeds.filter(x => x.breedId !== b.breedId))}
                  style={{ border: "none", background: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
              </span>
            ))}
          </div>
          <p style={{ fontSize: 10, color: "#6b7280", margin: "6px 0 0", fontStyle: "italic" }}>
            Razas indicativas. El total de cabezas se define en el campo de cantidad.
          </p>
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

// ─── Container Type Selector ──────────────────────────────────────────────────
// Source of truth is containerEngine.js — imported above as CONTAINER_TYPES_ENGINE
const CONTAINER_TYPES = CONTAINER_TYPES_ENGINE;

// Default container per category — delegates to categoryEngine (single source of truth)
function defaultContainerForCategory(cat) {
  return getDefaultContainer(cat);
}

function ContainerTypeSelector({ value, onChange, category }) {
  useEffect(() => {
    if (!value && category) onChange(defaultContainerForCategory(category));
  }, [category]);

  const selected = value || (category ? defaultContainerForCategory(category) : "");

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={s.label}>Tipo de Contenedor / Vessel</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {CONTAINER_TYPES.map(ct => {
          const active = selected === ct.id;
          return (
            <button key={ct.id} type="button" onClick={() => onChange(ct.id)}
              title={ct.desc}
              style={{ padding: "5px 12px", borderRadius: 20, border: active ? "2px solid #1B2A4A" : "1px solid #d1d5db", background: active ? "#1B2A4A" : "#f9fafb", color: active ? "#fff" : "#374151", fontSize: 11, cursor: "pointer", fontWeight: active ? 600 : 400 }}>
              {ct.label}
            </button>
          );
        })}
      </div>
      {selected && (() => {
        const ct = CONTAINER_TYPES.find(c => c.id === selected);
        return ct ? <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0" }}>{ct.label} — {ct.desc}</p> : null;
      })()}
    </div>
  );
}

// ─── Cargo Type Selector ──────────────────────────────────────────────────────
function CargoTypeSelector({ value, onChange, category }) {
  const defaultCargo = getDefaultCargoType(category);

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

// ─── V6: SKU Card ─────────────────────────────────────────────────────────────
// One retail product variant (size + packaging + sale basis + price + qty).

let _skuId = 1;
function newSku(packagingHint = "") {
  return { _id: _skuId++, presentationSize: "", packagingType: packagingHint || "PET_BOTTLE", unitsPerCarton: "", cartonNetWeightKg: "", litValuePerUnit: 0, commercialUnit: "perBox", price: "", quantity: "", shipmentValue: 0 };
}

function SkuCard({ sku, onChange, onRemove, canRemove, index, currency }) {
  const selectedSize = LIQUID_SIZE_RETAIL.find(s => s.id === sku.presentationSize);
  const autoCartonKg = selectedSize && parseFloat(sku.unitsPerCarton) > 0
    ? (parseFloat(sku.unitsPerCarton) * selectedSize.litValue).toFixed(2)
    : null;

  // Keep cartonNetWeightKg + litValuePerUnit in sync with size selection
  useEffect(() => {
    if (selectedSize) {
      const nwk = autoCartonKg || sku.cartonNetWeightKg;
      const sv  = calcSkuShipmentValue({ ...sku, cartonNetWeightKg: nwk, litValuePerUnit: selectedSize.litValue });
      onChange({ ...sku, cartonNetWeightKg: nwk, litValuePerUnit: selectedSize.litValue, shipmentValue: sv });
    }
  }, [sku.presentationSize, sku.unitsPerCarton]);

  // Recalc shipment value when price/quantity/basis change
  useEffect(() => {
    const sv = calcSkuShipmentValue(sku);
    if (sv !== sku.shipmentValue) onChange({ ...sku, shipmentValue: sv });
  }, [sku.price, sku.quantity, sku.commercialUnit]);

  const priceAbbr  = COMMERCIAL_SALE_UNITS.find(u => u.id === sku.commercialUnit)?.abbr || "/box";
  const qtyContext = getUnitContext(sku.commercialUnit, "en");

  return (
    <div style={{ border: "1px solid #c4b5fd", borderRadius: 10, padding: "12px 14px", background: "#fff", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#4c1d95", background: "#f5f3ff", padding: "2px 10px", borderRadius: 20 }}>
          SKU {index + 1}
        </span>
        {canRemove && (
          <button type="button" onClick={onRemove}
            style={{ fontSize: 11, color: "#dc2626", background: "#fee2e2", border: "none", borderRadius: 6, padding: "2px 10px", cursor: "pointer" }}>
            ✕ Quitar SKU
          </button>
        )}
      </div>

      {/* Row 1: Size + Packaging Type */}
      <div style={s.row2}>
        <Field label="Presentation Size *">
          <Sel value={sku.presentationSize} onChange={v => onChange({ ...sku, presentationSize: v })}>
            <option value="">Select size...</option>
            {LIQUID_SIZE_RETAIL.map(sz => <option key={sz.id} value={sz.id}>{sz.label}</option>)}
          </Sel>
        </Field>
        <Field label="Packaging Type">
          <Sel value={sku.packagingType} onChange={v => onChange({ ...sku, packagingType: v })}>
            {SKU_PACKAGING_TYPES.map(pt => <option key={pt.id} value={pt.id}>{pt.label}</option>)}
          </Sel>
        </Field>
      </div>

      {/* Row 2: Units/Carton + Carton Net Weight + Sale Basis */}
      <div style={s.row3}>
        <Field label="Units / Carton *">
          <Inp type="number" value={sku.unitsPerCarton} onChange={v => onChange({ ...sku, unitsPerCarton: v })} placeholder="12, 20, 24..." min="1" />
        </Field>
        <Field label="Carton Net Weight (kg)">
          <input
            type="text"
            value={autoCartonKg ? `${autoCartonKg} kg` : (sku.cartonNetWeightKg ? `${sku.cartonNetWeightKg} kg` : "")}
            readOnly
            style={{ ...s.input, background: "#f0fdf4", color: "#166534", fontWeight: 600, cursor: "default" }}
            placeholder="Auto-calculated" />
          {selectedSize && sku.unitsPerCarton && (
            <p style={{ fontSize: 10, color: "#059669", margin: "2px 0 0" }}>
              {sku.unitsPerCarton} × {selectedSize.label} = {autoCartonKg} kg
            </p>
          )}
        </Field>
        <Field label="Sale Basis *">
          <Sel value={sku.commercialUnit} onChange={v => onChange({ ...sku, commercialUnit: v })}>
            {SKU_SALE_UNITS.map(u => <option key={u.id} value={u.id}>{u.label.en} ({u.abbr})</option>)}
          </Sel>
        </Field>
      </div>

      {/* Row 3: Price + Quantity */}
      <div style={s.row2}>
        <Field label={`Price ${priceAbbr} *`}>
          <Inp type="number" value={sku.price} onChange={v => onChange({ ...sku, price: v })} placeholder="0.00" min="0" step="0.01" />
        </Field>
        <Field label={`Quantity (${qtyContext}) *`}>
          <Inp type="number" value={sku.quantity} onChange={v => onChange({ ...sku, quantity: v })} placeholder="How many?" min="0" />
        </Field>
      </div>

      {/* SKU Shipment Value */}
      {sku.shipmentValue > 0 && (
        <div style={{ background: "#f5f3ff", borderRadius: 6, padding: "6px 10px", marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 10, color: "#6b7280", margin: 0, textTransform: "uppercase" }}>SKU Value</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#4c1d95", margin: 0 }}>{fmtMoney(sku.shipmentValue, currency || "USD")}</p>
          </div>
          <p style={{ fontSize: 10, color: "#6b7280", margin: 0 }}>
            {fmtNum(parseFloat(sku.quantity))} {qtyContext} × {currency || "USD"} {parseFloat(sku.price).toFixed(2)}{priceAbbr}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── V6: Multi-SKU Retail Engine ──────────────────────────────────────────────
// Replaces single presentation size/packaging fields for RETAIL export formats.
// Allows 1–5 SKU cards per product (different sizes, prices, quantities).

function MultiSkuEngine({ skus, setSkus, currency, exportFormat }) {
  const packagingHint = exportFormat === "RETAIL_PET"      ? "PET_BOTTLE"
                      : exportFormat === "RETAIL_TETRA"    ? "TETRA_PAK"
                      : exportFormat === "RETAIL_DOYPACK"  ? "DOYPACK"
                      : exportFormat === "STAND_UP_POUCH"  ? "STAND_UP_POUCH"
                      : exportFormat === "PILLOW_POUCH"    ? "PILLOW_POUCH"
                      : exportFormat === "SPOUT_POUCH"     ? "SPOUT_POUCH"
                      : exportFormat === "GUSSET_POUCH"    ? "GUSSET_POUCH"
                      : exportFormat === "SIDE_SEAL_POUCH" ? "SIDE_SEAL_POUCH"
                      : exportFormat === "BAG_IN_BOX"      ? "BAG_IN_BOX"
                      : exportFormat === "RETAIL_POUCH"    ? "STAND_UP_POUCH"
                      : "";

  const addSku = () => {
    if (skus.length >= 5) return;
    setSkus(prev => [...prev, newSku(packagingHint)]);
  };

  const removeSku = (idx) => setSkus(prev => prev.filter((_, i) => i !== idx));

  const updateSku = (idx, updated) => setSkus(prev => prev.map((s, i) => i === idx ? updated : s));

  // Aggregate display
  const totalShipV  = skus.reduce((s, sk) => s + (sk.shipmentValue || 0), 0);
  const totalBoxes  = skus.reduce((s, sk) => s + (sk.commercialUnit === "perBox" ? parseFloat(sk.quantity)||0 : 0), 0);
  const totalUnits  = skus.reduce((s, sk) => {
    const q = parseFloat(sk.quantity)||0;
    const upb = parseFloat(sk.unitsPerCarton)||0;
    return s + (sk.commercialUnit === "perBox" ? q * upb : (["perUnit","perBottle"].includes(sk.commercialUnit) ? q : 0));
  }, 0);
  const totalNetKg  = skus.reduce((s, sk) => {
    const q = parseFloat(sk.quantity)||0;
    const nwk = parseFloat(sk.cartonNetWeightKg)||0;
    return s + (sk.commercialUnit === "perBox" ? q * nwk : 0);
  }, 0);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#4c1d95", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>
          ▤ Multi-SKU Retail Engine — {skus.length} SKU{skus.length !== 1 ? "s" : ""}
        </p>
        {skus.length < 5 && (
          <button type="button" onClick={addSku}
            style={{ fontSize: 12, fontWeight: 600, color: "#4c1d95", background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8, padding: "5px 14px", cursor: "pointer" }}>
            + Add SKU
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {skus.map((sku, idx) => (
          <SkuCard
            key={sku._id}
            sku={sku}
            index={idx}
            currency={currency}
            canRemove={skus.length > 1}
            onChange={updated => updateSku(idx, updated)}
            onRemove={() => removeSku(idx)}
          />
        ))}
      </div>

      {/* Aggregate summary across SKUs */}
      {totalShipV > 0 && (
        <div style={{ background: "#1e1b4b", borderRadius: 8, padding: "10px 14px", marginTop: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 1 }}>
            Resumen del Embarque — {skus.length} SKU(s)
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px,1fr))", gap: 8 }}>
            <MiniBox label="TOTAL SHIPMENT" value={fmtMoney(totalShipV, currency || "USD")} highlight />
            {totalBoxes > 0 && <MiniBox label="CAJAS / BOXES" value={fmtNum(totalBoxes)} />}
            {totalUnits > 0 && <MiniBox label="UNIDADES / UNITS" value={fmtNum(totalUnits)} />}
            {totalNetKg > 0 && <MiniBox label="KG NETO / CARTONS" value={fmtNum(totalNetKg) + " kg"} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── V6: Export Format Engine ─────────────────────────────────────────────────
// Top-level selector: defines HOW the product is exported (not what size the bottles are).
// INDUSTRIAL → single commercial unit selector.
// RETAIL     → opens MultiSkuEngine (per-SKU pricing).
// CUSTOM     → free text + commercial unit.

// ─── V7: Pouch Configuration Panel ───────────────────────────────────────────
// Shown inline inside ExportFormatEngine when a POUCH group format is selected.
// Completely isolated — never shown for LIVE_ANIMALS or industrial formats.

function PouchConfigPanel({ pouchConfig, setPouchConfig, onPresentationSizeChange }) {
  const set = (k, v) => {
    setPouchConfig(p => ({ ...p, [k]: v }));
    if (k === "presentationSize" && onPresentationSizeChange) onPresentationSizeChange(v);
  };
  const toggleArr = (k, v) => {
    const arr = pouchConfig[k] || [];
    set(k, arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  };

  const chipBtn = (active, onClick, label, color = "#6d28d9") => ({
    style: {
      padding: "4px 11px", borderRadius: 16, fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400,
      border: active ? `2px solid ${color}` : "1px solid #ddd6fe",
      background: active ? color : "#faf5ff", color: active ? "#fff" : "#5b21b6",
    },
    onClick,
    children: label,
  });

  return (
    <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, border: "1px solid #ddd6fe", background: "#faf5ff" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#5b21b6", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>
        ⬡ Pouch Packaging Configuration
      </p>

      {/* Pouch Type */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ ...s.label, color: "#5b21b6", marginBottom: 5 }}>Pouch Type</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {POUCH_TYPES.map(pt => {
            const active = pouchConfig.pouchType === pt.id;
            return (
              <button key={pt.id} type="button" title={pt.desc}
                onClick={() => set("pouchType", pt.id)}
                style={{ padding: "5px 12px", borderRadius: 16, fontSize: 12, cursor: "pointer",
                  border: active ? "2px solid #5b21b6" : "1px solid #ddd6fe",
                  background: active ? "#5b21b6" : "#faf5ff",
                  color: active ? "#fff" : "#5b21b6", fontWeight: active ? 700 : 400 }}>
                {pt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Film Structure */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ ...s.label, color: "#1e40af", marginBottom: 5 }}>Film Structure</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {FILM_STRUCTURES.map(fs => {
            const active = pouchConfig.filmStructure === fs.id;
            const color = fs.tier === "EXPORT_HEAVY_DUTY" ? "#b45309" : fs.tier === "PREMIUM" ? "#1e40af" : "#374151";
            return (
              <button key={fs.id} type="button" title={fs.desc}
                onClick={() => set("filmStructure", fs.id)}
                style={{ padding: "5px 12px", borderRadius: 16, fontSize: 12, cursor: "pointer",
                  border: active ? `2px solid ${color}` : "1px solid #e5e7eb",
                  background: active ? color : "#f9fafb",
                  color: active ? "#fff" : color, fontWeight: active ? 700 : 400 }}>
                {fs.label}
                <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 5 }}>({fs.tier.replace("_"," ")})</span>
              </button>
            );
          })}
        </div>
        {pouchConfig.filmStructure && (
          <p style={{ fontSize: 10, color: "#6b7280", margin: "3px 0 0" }}>
            {FILM_STRUCTURES.find(f => f.id === pouchConfig.filmStructure)?.desc}
          </p>
        )}
      </div>

      {/* Presentation Size */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ ...s.label, color: "#0369a1", marginBottom: 5 }}>Presentation Size</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {POUCH_SIZES.map(sz => {
            const active = pouchConfig.presentationSize === sz.id;
            return (
              <button key={sz.id} type="button"
                onClick={() => set("presentationSize", sz.id)}
                style={{ padding: "5px 12px", borderRadius: 16, fontSize: 12, cursor: "pointer",
                  border: active ? "2px solid #0369a1" : "1px solid #bae6fd",
                  background: active ? "#0369a1" : "#f0f9ff",
                  color: active ? "#fff" : "#0369a1", fontWeight: active ? 600 : 400 }}>
                {sz.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Units per Carton — shows suggested configs for selected size */}
      {pouchConfig.presentationSize && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ ...s.label, marginBottom: 5 }}>Units / Carton</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {getCartonConfig(pouchConfig.presentationSize).map(cfg => {
              const active = String(pouchConfig.unitsPerCarton) === String(cfg.units);
              return (
                <button key={cfg.units} type="button"
                  onClick={() => set("unitsPerCarton", cfg.units)}
                  style={{ padding: "5px 12px", borderRadius: 16, fontSize: 12, cursor: "pointer",
                    border: active ? "2px solid #059669" : "1px solid #d1d5db",
                    background: active ? "#059669" : "#f9fafb",
                    color: active ? "#fff" : "#374151", fontWeight: active ? 600 : 400 }}>
                  {cfg.label}
                </button>
              );
            })}
          </div>
          {pouchConfig.unitsPerCarton && pouchConfig.presentationSize && (() => {
            const sz = POUCH_SIZES.find(s => s.id === pouchConfig.presentationSize);
            const netKg = (parseFloat(pouchConfig.unitsPerCarton) * (sz?.litValue || 0)).toFixed(2);
            const palCfg = PALLET_CONFIG[pouchConfig.presentationSize] || { cartonsPerPallet: 40 };
            return (
              <p style={{ fontSize: 10, color: "#059669", margin: "3px 0 0", fontWeight: 500 }}>
                {pouchConfig.unitsPerCarton} × {sz?.label} = {netKg} kg/carton
                {" · "}{palCfg.cartonsPerPallet} cartons/pallet
              </p>
            );
          })()}
        </div>
      )}

      {/* Optional fields: Seal / Print / Finish / Valve — 2-col grid */}
      <div style={s.row2}>
        <Field label="Seal Type">
          <Sel value={pouchConfig.sealType || ""} onChange={v => set("sealType", v)}>
            <option value="">Select...</option>
            {SEAL_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Sel>
        </Field>
        <Field label="Valve / Spout">
          <Sel value={pouchConfig.valveOption || ""} onChange={v => set("valveOption", v)}>
            <option value="">None / Select...</option>
            {VALVE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Sel>
        </Field>
        <Field label="Print Type">
          <Sel value={pouchConfig.printType || ""} onChange={v => set("printType", v)}>
            <option value="">Select...</option>
            {PRINT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Sel>
        </Field>
        <Field label="Finish">
          <Sel value={pouchConfig.finishType || ""} onChange={v => set("finishType", v)}>
            <option value="">Select...</option>
            {FINISH_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Sel>
        </Field>
      </div>

      {/* Food Grade Certifications (multi-select chips) */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ ...s.label, marginBottom: 5 }}>Food Grade Certifications</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {FOOD_GRADE_CERTS.map(c => {
            const active = (pouchConfig.certifications || []).includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggleArr("certifications", c.id)}
                style={{ padding: "4px 11px", borderRadius: 16, fontSize: 11, cursor: "pointer",
                  border: active ? "2px solid #059669" : "1px solid #d1d5db",
                  background: active ? "#059669" : "#f9fafb",
                  color: active ? "#fff" : "#374151", fontWeight: active ? 600 : 400 }}>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* OEM / Private Label */}
      <div style={{ marginBottom: 6 }}>
        <label style={{ ...s.label, marginBottom: 5 }}>OEM / Private Label Capability</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {OEM_CAPABILITIES.map(o => {
            const active = (pouchConfig.oemCapabilities || []).includes(o.id);
            return (
              <button key={o.id} type="button" title={o.desc} onClick={() => toggleArr("oemCapabilities", o.id)}
                style={{ padding: "4px 11px", borderRadius: 16, fontSize: 11, cursor: "pointer",
                  border: active ? "2px solid #1B2A4A" : "1px solid #d1d5db",
                  background: active ? "#1B2A4A" : "#f9fafb",
                  color: active ? "#fff" : "#374151", fontWeight: active ? 600 : 400 }}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExportFormatEngine({ category, exportFormat, setExportFormat, skus, setSkus, currency,
  commercialUnit, setCommercialUnit, pouchConfig, setPouchConfig, onPouchSizeChange }) {
  const profile = getCategoryProfile(category);
  if (!profile?.supportsPackaging && !profile?.supportsLiquidPackaging) return null;
  if (category === "LIVE_ANIMALS") return null;
  // OILS uses OilsExportPanel for all format/packaging/pricing config — no ExportFormatEngine needed
  if (category === "OILS") return null;

  const isRetail = isRetailExportFormat(exportFormat);
  const isPouch  = isPouchExportFormat(exportFormat);
  const byGroup  = (grp) => EXPORT_FORMAT_OPTIONS.filter(f => f.group === grp);

  const btnStyle = (active) => ({
    padding: "5px 13px", borderRadius: 16, fontSize: 12, cursor: "pointer", fontWeight: active ? 700 : 400,
    border: active ? "2px solid #1B2A4A" : "1px solid #d1d5db",
    background: active ? "#1B2A4A" : "#f9fafb", color: active ? "#fff" : "#374151",
  });
  const retailBtnStyle = (active) => ({
    ...btnStyle(active),
    border: active ? "2px solid #059669" : "1px solid #d1d5db",
    background: active ? "#059669" : "#f0fdf4", color: active ? "#fff" : "#166534",
  });
  const pouchBtnStyle = (active) => ({
    padding: "5px 13px", borderRadius: 16, fontSize: 12, cursor: "pointer", fontWeight: active ? 700 : 400,
    border: active ? "2px solid #6d28d9" : "1px solid #ddd6fe",
    background: active ? "#6d28d9" : "#faf5ff", color: active ? "#fff" : "#5b21b6",
  });

  return (
    <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, border: "0.5px solid #c4b5fd", background: "#fafafa" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Export Format — Formato de Exportación
      </p>

      {/* Industrial options */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ ...s.label, marginBottom: 6 }}>Industrial / Bulk</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {byGroup("INDUSTRIAL").map(f => (
            <button key={f.id} type="button" title={f.desc}
              onClick={() => { setExportFormat(f.id); if (skus.length === 0) setSkus([newSku()]); }}
              style={btnStyle(exportFormat === f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Retail options */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ ...s.label, marginBottom: 6 }}>Retail Distribution</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {byGroup("RETAIL").map(f => (
            <button key={f.id} type="button" title={f.desc}
              onClick={() => { setExportFormat(f.id); if (skus.length === 0) setSkus([newSku()]); }}
              style={retailBtnStyle(exportFormat === f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* V7: Pouch / Flexible Packaging */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ ...s.label, marginBottom: 6, color: "#5b21b6" }}>Pouch / Flexible Packaging (V7)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {byGroup("POUCH").map(f => (
            <button key={f.id} type="button" title={f.desc}
              onClick={() => { setExportFormat(f.id); if (skus.length === 0) setSkus([newSku("STAND_UP_POUCH")]); }}
              style={pouchBtnStyle(exportFormat === f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom */}
      <div>
        {byGroup("CUSTOM").map(f => (
          <button key={f.id} type="button"
            onClick={() => setExportFormat(f.id)}
            style={{ ...btnStyle(exportFormat === f.id), fontSize: 11, color: exportFormat === f.id ? "#fff" : "#6b7280" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Selected format description */}
      {exportFormat && (
        <p style={{ fontSize: 11, color: "#6b7280", margin: "8px 0 0", borderTop: "0.5px solid #e5e7eb", paddingTop: 8 }}>
          ✓ <strong>{getExportFormatLabel(exportFormat)}</strong>
          {" — "}
          {EXPORT_FORMAT_OPTIONS.find(f => f.id === exportFormat)?.desc || ""}
        </p>
      )}

      {/* INDUSTRIAL: show commercial unit selector */}
      {exportFormat && !isRetail && !isPouch && exportFormat !== "CUSTOM" && (
        <div style={{ marginTop: 10 }}>
          <label style={{ ...s.label, marginBottom: 6 }}>Commercial Sale Basis</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {INDUSTRIAL_SALE_UNITS.map(u => {
              const active = commercialUnit === u.id;
              return (
                <button key={u.id} type="button" onClick={() => setCommercialUnit(u.id)}
                  style={{ padding: "5px 12px", borderRadius: 16, fontSize: 12, cursor: "pointer",
                    border: active ? "2px solid #b45309" : "1px solid #fbbf24",
                    background: active ? "#b45309" : "#fffbeb",
                    color: active ? "#fff" : "#78350f", fontWeight: active ? 700 : 400 }}>
                  {u.label.es} <span style={{ opacity: 0.7, fontSize: 10 }}>({u.abbr})</span>
                </button>
              );
            })}
          </div>
          {commercialUnit && (
            <p style={{ fontSize: 11, color: "#92400e", margin: "5px 0 0", fontWeight: 600 }}>
              Precio base: <strong>{COMMERCIAL_SALE_UNITS.find(u=>u.id===commercialUnit)?.label.es}</strong>
              {" — el label del precio mostrará "}
              <strong>{COMMERCIAL_SALE_UNITS.find(u=>u.id===commercialUnit)?.abbr}</strong>
            </p>
          )}
        </div>
      )}

      {/* V7: POUCH — show PouchConfigPanel + Multi-SKU engine */}
      {exportFormat && isPouch && (
        <PouchConfigPanel pouchConfig={pouchConfig} setPouchConfig={setPouchConfig}
          onPresentationSizeChange={onPouchSizeChange} />
      )}

      {/* RETAIL (non-pouch) or POUCH: show Multi-SKU engine */}
      {exportFormat && (isRetail || isPouch) && (
        <div style={{ marginTop: 10 }}>
          <MultiSkuEngine skus={skus} setSkus={setSkus} currency={currency} exportFormat={exportFormat} />
        </div>
      )}
    </div>
  );
}

// ─── Liquid & Packaged Product Engine ────────────────────────────────────────
// Shown ONLY for non-LIVE_ANIMALS categories that support packaging.
// 4 visually separated layers:
//   LAYER 1 — Presentation Type (packaging container / format)
//   LAYER 2 — Presentation Size (conditional: retail bottles only)
//   LAYER 3 — Box / Carton Engine (conditional: bottle types + size set)
//   LAYER 4 — Commercial Sale Basis (always shown; drives price label)

const PACKAGING_MODES = [
  { id: "BULK",   label: "Bulk / Industrial", desc: "Flexi Tank, IBC, Drum, Jerrycan..." },
  { id: "RETAIL", label: "Retail / Consumer",  desc: "PET, Glass, Tetra Pak, Doypack..." },
  { id: "CUSTOM", label: "Custom Packaging",   desc: "Otro tipo de empaque" },
];

// Retail container types that require a presentation size selection
const REQUIRES_PRESENTATION_SIZE = new Set([
  "PET_BOTTLE","GLASS_BOTTLE","TETRA_PAK","DOYPACK","SACHET","PREMIUM_BOTTLE","CAN_TIN","PLASTIC_GALLON",
]);

function LiquidPackagingEngine({
  category,
  packagingMode, setPackagingMode,
  packagingType, setPackagingType,
  presentationSize, setPresentationSize,
  commercialUnit, setCommercialUnit,
  unitsPerBox, setUnitsPerBox,
  netWeightPerUnit, setNetWeightPerUnit,
}) {
  const profile = getCategoryProfile(category);
  if (!profile?.supportsPackaging && !profile?.supportsLiquidPackaging) return null;
  if (category === "LIVE_ANIMALS") return null;

  const isLiquid    = profile?.supportsLiquidPackaging;
  const packOptions = packagingMode === "BULK"   ? BULK_INDUSTRIAL_OPTIONS
                    : packagingMode === "RETAIL"  ? RETAIL_CONSUMER_OPTIONS
                    : [];
  const showSizeSelector  = packagingMode === "RETAIL" && packagingType && REQUIRES_PRESENTATION_SIZE.has(packagingType);
  const showBoxEngine     = showSizeSelector && RETAIL_BOX_ENGINE_TYPES.has(packagingType) && presentationSize;
  const saleUnits         = getSaleUnitsForProfile(profile);

  // Auto-calculate net weight per unit from presentation size (litValue → kg for liquids, ~1:1 density)
  const selectedSizeEntry = LIQUID_SIZE_RETAIL.find(s => s.id === presentationSize);
  const autoNetWeightKg   = selectedSizeEntry ? selectedSizeEntry.litValue : null; // 1L ≈ 1kg for food liquids
  const effectiveNwu      = autoNetWeightKg ?? (parseFloat(netWeightPerUnit) || 0);

  // Auto-push derived weight back to parent (only when auto-calculable)
  // (parent still holds netWeightPerUnit state but it's derived, not manually entered)

  const totalNetLitersDisplay = (() => {
    const upb  = parseFloat(unitsPerBox) || 0;
    const size = selectedSizeEntry?.litValue || 0;
    if (!upb || !size) return null;
    return (upb * size).toFixed(2);
  })();

  const totalNetKgDisplay = (() => {
    const upb = parseFloat(unitsPerBox) || 0;
    if (!upb || !effectiveNwu) return null;
    return (upb * effectiveNwu).toFixed(3);
  })();

  const layerStyle = {
    borderRadius: 8, padding: "10px 12px", marginBottom: 10,
    border: "0.5px solid #e9d5ff", background: "#fff",
  };
  const layerHeader = (num, title, color = "#4c1d95") => (
    <p style={{ fontSize: 10, fontWeight: 700, color, margin: "0 0 8px", letterSpacing: 0.8, textTransform: "uppercase" }}>
      <span style={{ display: "inline-block", width: 18, height: 18, borderRadius: "50%", background: color, color: "#fff", textAlign: "center", lineHeight: "18px", fontSize: 10, marginRight: 6, fontWeight: 700 }}>{num}</span>
      {title}
    </p>
  );

  return (
    <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, border: "0.5px solid #c4b5fd", background: "#f5f3ff" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#4c1d95", margin: "0 0 12px", letterSpacing: 0.5, textTransform: "uppercase" }}>
        {isLiquid ? "⬡ Liquid / Packaged Product Engine" : "⬡ Packaged Product Engine"}
      </p>

      {/* ── LAYER 1: PRESENTATION TYPE ──────────────────────────────────────── */}
      <div style={layerStyle}>
        {layerHeader(1, "Presentation / Packaging Type")}

        {/* Mode selector — BULK / RETAIL / CUSTOM */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {PACKAGING_MODES.map(m => (
            <button key={m.id} type="button"
              onClick={() => { setPackagingMode(m.id); setPackagingType(""); setPresentationSize(""); setUnitsPerBox(""); setNetWeightPerUnit(""); }}
              title={m.desc}
              style={{ padding: "5px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: packagingMode === m.id ? "2px solid #4c1d95" : "1px solid #c4b5fd",
                background: packagingMode === m.id ? "#4c1d95" : "#fff",
                color: packagingMode === m.id ? "#fff" : "#4c1d95" }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Packaging type dropdown — changes per mode */}
        {packagingMode === "BULK" && (
          <div>
            <label style={{ ...s.label, marginBottom: 4 }}>Tipo de Envase Industrial</label>
            <Sel value={packagingType} onChange={v => { setPackagingType(v); setPresentationSize(""); setUnitsPerBox(""); }}>
              <option value="">Seleccionar envase industrial...</option>
              {BULK_INDUSTRIAL_OPTIONS.map(o => (
                <option key={o.id} value={o.id}>{o.label} — {o.desc}</option>
              ))}
            </Sel>
            {packagingType && (
              <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0" }}>
                {BULK_INDUSTRIAL_OPTIONS.find(o => o.id === packagingType)?.desc || ""}
              </p>
            )}
          </div>
        )}

        {packagingMode === "RETAIL" && (
          <div>
            <label style={{ ...s.label, marginBottom: 4 }}>Tipo de Envase Retail / Consumer</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {RETAIL_CONSUMER_OPTIONS.map(o => {
                const active = packagingType === o.id;
                return (
                  <button key={o.id} type="button"
                    onClick={() => { setPackagingType(o.id); setPresentationSize(""); setUnitsPerBox(""); setNetWeightPerUnit(""); }}
                    title={o.desc}
                    style={{ padding: "5px 12px", borderRadius: 16, fontSize: 12, cursor: "pointer",
                      border: active ? "2px solid #059669" : "1px solid #d1d5db",
                      background: active ? "#059669" : "#f9fafb",
                      color: active ? "#fff" : "#374151",
                      fontWeight: active ? 600 : 400 }}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {packagingMode === "CUSTOM" && (
          <div>
            <label style={{ ...s.label, marginBottom: 4 }}>Describe el empaque personalizado</label>
            <Inp value={packagingType} onChange={setPackagingType} placeholder="Ej: Bolsa laminada 500g con válvula de desgasificación..." />
          </div>
        )}
      </div>

      {/* ── LAYER 2: PRESENTATION SIZE (retail bottles/cans only) ─────────────── */}
      {showSizeSelector && (
        <div style={layerStyle}>
          {layerHeader(2, "Presentation Size", "#0369a1")}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {LIQUID_SIZE_RETAIL.map(sz => {
              const active = presentationSize === sz.id;
              return (
                <button key={sz.id} type="button"
                  onClick={() => { setPresentationSize(sz.id); setNetWeightPerUnit(String(sz.litValue)); }}
                  style={{ padding: "5px 12px", borderRadius: 16, fontSize: 12, cursor: "pointer",
                    border: active ? "2px solid #0369a1" : "1px solid #bae6fd",
                    background: active ? "#0369a1" : "#f0f9ff",
                    color: active ? "#fff" : "#0369a1",
                    fontWeight: active ? 600 : 400 }}>
                  {sz.label}
                </button>
              );
            })}
          </div>
          {presentationSize && (
            <p style={{ fontSize: 11, color: "#0369a1", margin: "6px 0 0", fontWeight: 500 }}>
              ✓ {LIQUID_SIZE_RETAIL.find(s => s.id === presentationSize)?.label} seleccionado
              {autoNetWeightKg ? ` — peso neto referencia: ${autoNetWeightKg} kg/und` : ""}
            </p>
          )}
        </div>
      )}

      {/* ── LAYER 3: BOX / CARTON ENGINE ─────────────────────────────────────── */}
      {showBoxEngine && (
        <div style={{ ...layerStyle, background: "#ede9fe", border: "0.5px solid #c4b5fd" }}>
          {layerHeader(3, "Box / Carton Engine", "#5b21b6")}
          <div style={s.row2}>
            <Field label="Unidades por Caja / Units per Box">
              <Inp type="number" value={unitsPerBox} onChange={setUnitsPerBox} placeholder="Ej: 12, 24, 48" min="1" />
            </Field>
            <Field label="Peso Neto por Unidad (kg)">
              <input type="number" value={effectiveNwu || netWeightPerUnit || ""}
                onChange={e => setNetWeightPerUnit(e.target.value)}
                placeholder={autoNetWeightKg ? String(autoNetWeightKg) : "Ej: 0.9 (para 900ml)"}
                min="0.001" step="0.001"
                style={{ ...s.input, background: autoNetWeightKg ? "#f0fdf4" : undefined }}
                readOnly={!!autoNetWeightKg} />
              {autoNetWeightKg && <p style={{ fontSize: 10, color: "#059669", margin: "3px 0 0" }}>Auto-calculado desde tamaño seleccionado</p>}
            </Field>
          </div>
          {totalNetKgDisplay && (
            <div style={{ background: "#4c1d95", borderRadius: 6, padding: "8px 12px", marginTop: 6 }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: 0.5 }}>Peso Neto / Litros por Caja de Exportación</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>
                {totalNetKgDisplay} kg
                {totalNetLitersDisplay && ` (${totalNetLitersDisplay} L)`}
                {" / caja"}
              </p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", margin: "3px 0 0" }}>
                {unitsPerBox} {packagingType ? (RETAIL_CONSUMER_OPTIONS.find(o=>o.id===packagingType)?.label || "unidades") : "und"}
                {" × "}
                {LIQUID_SIZE_RETAIL.find(s=>s.id===presentationSize)?.label || `${effectiveNwu} kg`}
                {" = "}{totalNetKgDisplay} kg neto por cartón
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── LAYER 4: COMMERCIAL SALE BASIS ───────────────────────────────────── */}
      <div style={{ ...layerStyle, background: "#fefce8", border: "0.5px solid #fde68a" }}>
        {layerHeader(4, "Commercial Sale Basis — How the product is sold", "#92400e")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: saleUnits.length > 0 ? 8 : 0 }}>
          {saleUnits.map(u => {
            const active = commercialUnit === u.id;
            return (
              <button key={u.id} type="button" onClick={() => setCommercialUnit(u.id)}
                style={{ padding: "5px 12px", borderRadius: 16, fontSize: 12, cursor: "pointer",
                  border: active ? "2px solid #b45309" : "1px solid #fbbf24",
                  background: active ? "#b45309" : "#fffbeb",
                  color: active ? "#fff" : "#78350f",
                  fontWeight: active ? 700 : 400 }}>
                {u.label.es}
                <span style={{ opacity: 0.7, fontSize: 10, marginLeft: 4 }}>({u.abbr})</span>
              </button>
            );
          })}
        </div>
        {commercialUnit && (
          <p style={{ fontSize: 11, color: "#92400e", margin: 0, fontWeight: 600 }}>
            Base de venta seleccionada: <strong>{COMMERCIAL_SALE_UNITS.find(u=>u.id===commercialUnit)?.label.es}</strong>
            {" — "}precio se ingresará como USD {COMMERCIAL_SALE_UNITS.find(u=>u.id===commercialUnit)?.abbr}
          </p>
        )}
        {!commercialUnit && (
          <p style={{ fontSize: 11, color: "#d97706", margin: 0, fontStyle: "italic" }}>
            ⚠ Selecciona la base comercial de venta para activar el cálculo correcto
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Dynamic Spec Fields ──────────────────────────────────────────────────────
// hiddenKeys: Set of field keys to suppress (used to hide legacy fields superseded by V6 engines)
function DynamicFields({ category, specs, setSpecs, hiddenKeys = null }) {
  const catDef = PRODUCT_CATEGORIES[category];
  if (!catDef?.fields?.length) return null;
  const setSpec = (key, val) => setSpecs(prev => ({ ...prev, [key]: val }));
  return (
    <div style={s.row2}>
      {catDef.fields.map(f => {
        // suppress fields superseded by V6 ExportFormatEngine (e.g. legacy "Presentación" for OILS)
        if (hiddenKeys && hiddenKeys.has(f.key)) return null;
        // breed field for LIVE_ANIMALS — auto-populated from selected breeds, read-only
        if (f.key === "breed" && category === "LIVE_ANIMALS") {
          const breedSummary = (specs.breeds || []).map(b => b.name).join(" / ") || "";
          return (
            <Field key={f.key} label={f.label?.es || f.label}>
              <input type="text" value={breedSummary} readOnly
                placeholder="Se completa automáticamente al seleccionar razas arriba"
                style={{ ...s.input, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", cursor: "default" }} />
            </Field>
          );
        }
        // headCount for LIVE_ANIMALS is entered via the "Cantidad por embarque" qty field — skip here
        if (f.key === "headCount" && category === "LIVE_ANIMALS") return null;
        return (
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
        );
      })}
    </div>
  );
}

// ─── Single Product Row ───────────────────────────────────────────────────────
function defaultSpecsForCat(cat, existing) {
  if (cat !== "LIVE_ANIMALS") return existing || {};
  return { species: "SHEEP", avgWeight: 45, mortalityMargin: 2, ...(existing || {}) };
}

function ProductRowPanel({ rowId, initial, onChange, onRemove, index, isOnly }) {
  const [cat, setCat] = useState(initial?.category || "");
  const [product, setProduct] = useState(initial?.product || "");
  const [specs, setSpecs] = useState(() => defaultSpecsForCat(initial?.category || "", initial?.specs));
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
  const [containerType, setContainerType] = useState(initial?.containerType || "");
  const [origin, setOrigin] = useState(initial?.origin || "Brazil");
  const [cargoType, setCargoType] = useState(initial?.cargoType || "");
  const [collapsed, setCollapsed] = useState(false);
  // V5: liquid/packaged engine (kept for backward compat)
  const [packagingMode, setPackagingMode]         = useState(initial?.packagingMode       || "");
  const [packagingType, setPackagingType]         = useState(initial?.packagingType       || "");
  const [presentationSize, setPresentationSize]   = useState(initial?.presentationSize    || "");
  const [commercialUnit, setCommercialUnit]       = useState(initial?.commercialUnit      || "");
  const [unitsPerBox, setUnitsPerBox]             = useState(initial?.unitsPerBox         || "");
  const [netWeightPerUnit, setNetWeightPerUnit]   = useState(initial?.netWeightPerUnit    || "");
  // V6: export format + multi-SKU engine
  const [exportFormat, setExportFormat]           = useState(initial?.exportFormat        || "");
  const [skus, setSkus]                           = useState(initial?.skus || []);
  // V7: pouch packaging configuration
  const [pouchConfig, setPouchConfig]             = useState(initial?.pouchConfig || {});
  // V8: oils export engine configuration — isolated state, never shared with other categories
  const [oilsConfig, setOilsConfig]               = useState(initial?.oilsConfig  || {});

  const catDef      = cat ? PRODUCT_CATEGORIES[cat] : null;
  const isRetailMode = isRetailExportFormat(exportFormat);

  useEffect(() => {
    if (catDef) { setUnitType(catDef.defaultUnit || ""); setContainerCap(catDef.containerCapacity || ""); }
  }, [cat]);

  // For LIVE_ANIMALS, qty IS the headcount — keep specs.headCount in sync
  const handleQtyChange = (v) => {
    setQty(v);
    if (cat === "LIVE_ANIMALS") setSpecs(p => ({ ...p, headCount: v }));
  };

  const handleIncotermPrice = (inc, price) => {
    setIncotermPrices(prev => ({ ...prev, [inc]: price }));
    if (!unitPrice && price) setUnitPrice(price);
  };

  const primaryPrice = incotermPrices[incoterms[0]] || unitPrice;

  // V6: compute summary — retail multi-SKU overrides standard calc
  const summary = cat ? (
    isRetailMode && skus.length > 0
      ? calcMultiSkuSummary(skus, { currency, deliveryFrequency: frequency, numShipments, contractDuration: duration })
      : calcCommercialSummary({
          category: cat, quantity: qty, unitType, unitPrice: primaryPrice, currency,
          deliveryFrequency: frequency, numShipments, contractDuration: duration,
          headCount: specs.headCount, avgWeight: specs.avgWeight, mortalityMargin: specs.mortalityMargin,
          containerCapacity: containerCap || catDef?.containerCapacity,
          containerType,
          commercialUnit, unitsPerBox, netWeightPerUnit,
        })
  ) : null;

  useEffect(() => {
    const normalizedPresentationSize = isPouchExportFormat(exportFormat)
      ? resolveNormalizedPresentationSize(pouchConfig, skus)
      : (presentationSize || null);

    onChange(rowId, {
      category: cat, product, specs, quantity: qty, unitType, incoterms, incotermPrices,
      unitPrice: primaryPrice, currency, deliveryFrequency: frequency, numShipments,
      contractDuration: duration, containerCapacity: containerCap, containerType, origin, cargoType,
      packagingMode, packagingType, presentationSize, commercialUnit, unitsPerBox, netWeightPerUnit,
      exportFormat, skus, pouchConfig,
      normalizedPresentationSize,
      oilsConfig,
      summary,
    });
  }, [cat, product, specs, qty, unitType, incoterms, incotermPrices, primaryPrice, currency,
      frequency, numShipments, duration, containerCap, containerType, origin,
      packagingMode, packagingType, presentationSize, commercialUnit, unitsPerBox, netWeightPerUnit,
      exportFormat, skus, pouchConfig, oilsConfig]);

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
              <Sel value={cat} onChange={v => { setCat(v); setProduct(""); setSpecs(defaultSpecsForCat(v, {})); }}>
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

          {/* Origin — shown first for LIVE_ANIMALS so breeds filter by country */}
          {cat === "LIVE_ANIMALS" && (
            <Field label="País de Origen del ganado *">
              <Sel value={origin} onChange={v => { setOrigin(v); setSpecs(p => ({ ...p, breeds: [], breed: "" })); }}>
                {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
              </Sel>
            </Field>
          )}

          {/* Livestock breed selector — special flow for LIVE_ANIMALS */}
          {cat === "LIVE_ANIMALS" && (
            <LivestockBreedSelector origin={origin} specs={specs} setSpecs={setSpecs} />
          )}

          {cat && cat !== "LIVE_ANIMALS" && <DynamicFields category={cat} specs={specs} setSpecs={setSpecs}
            hiddenKeys={exportFormat && ["OILS","FRUIT_PRODUCTS","COLOMBIAN_EXOTIC_FRUITS"].includes(cat)
              ? new Set(["packaging"]) : null} />}
          {cat === "LIVE_ANIMALS" && <DynamicFields category={cat} specs={specs} setSpecs={setSpecs} />}

          {/* V8: Oils Export Panel — isolated, only renders for OILS category */}
          <OilsExportPanel
            category={cat}
            initial={oilsConfig}
            onChange={({ oilsConfig: cfg }) => setOilsConfig(cfg)}
          />

          {/* V6/V7: Export Format Engine — replaces V5 LiquidPackagingEngine for supported categories */}
          {cat && cat !== "LIVE_ANIMALS" && (
            <ExportFormatEngine
              category={cat}
              exportFormat={exportFormat} setExportFormat={setExportFormat}
              skus={skus} setSkus={setSkus}
              currency={currency}
              commercialUnit={commercialUnit} setCommercialUnit={setCommercialUnit}
              pouchConfig={pouchConfig} setPouchConfig={setPouchConfig}
              onPouchSizeChange={(sizeId) => {
                setSkus(prev => prev.map(s => ({ ...s, presentationSize: sizeId })));
              }}
            />
          )}
          {/* V5: fallback for docs without exportFormat set (backward compat) */}
          {cat && cat !== "LIVE_ANIMALS" && !exportFormat && (
            <LiquidPackagingEngine
              category={cat}
              packagingMode={packagingMode} setPackagingMode={setPackagingMode}
              packagingType={packagingType} setPackagingType={setPackagingType}
              presentationSize={presentationSize} setPresentationSize={setPresentationSize}
              commercialUnit={commercialUnit} setCommercialUnit={setCommercialUnit}
              unitsPerBox={unitsPerBox} setUnitsPerBox={setUnitsPerBox}
              netWeightPerUnit={netWeightPerUnit} setNetWeightPerUnit={setNetWeightPerUnit}
            />
          )}

          {/* Origin for non-LIVE_ANIMALS */}
          {cat && cat !== "LIVE_ANIMALS" && (
            <Field label="Origen del producto">
              <Sel value={origin} onChange={setOrigin}>
                {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
              </Sel>
            </Field>
          )}

          {/* Cargo type selector */}
          {cat && <CargoTypeSelector value={cargoType} onChange={setCargoType} category={cat} />}

          {/* Container / vessel type selector */}
          {cat && <ContainerTypeSelector value={containerType} onChange={setContainerType} category={cat} />}

          {/* Quantity + Unit + Currency — hidden in retail multi-SKU mode (each SKU carries its own qty) */}
          {cat && (
            <div>
              {/* Currency always visible */}
              <Field label="Moneda / Currency">
                <Sel value={currency} onChange={setCurrency}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </Sel>
              </Field>

              {!isRetailMode && (
                <div style={s.row2}>
                  <Field label={cat === "LIVE_ANIMALS" ? "Cabezas por embarque *" : "Cantidad por embarque *"} required>
                    <Inp type="number" value={qty} onChange={handleQtyChange} placeholder={cat === "LIVE_ANIMALS" ? "Ej: 25000" : "Ej: 540"} min="0" />
                  </Field>
                  <Field label="Unidad *" required>
                    <Sel value={unitType} onChange={setUnitType}>
                      <option value="">Seleccionar...</option>
                      {catDef?.units?.map(u => <option key={u} value={u}>{u}</option>)}
                    </Sel>
                  </Field>
                </div>
              )}

              {/* Incoterms — shown in all modes; price label is dynamic */}
              <Field label="Incoterm(s) — selecciona uno o varios">
                <IncotermSelector selected={incoterms} onChange={setIncoterms} prices={incotermPrices} onPriceChange={handleIncotermPrice} commercialUnit={commercialUnit} />
              </Field>

              {/* Manual price only when no priced incoterm is selected AND not in retail mode */}
              {!isRetailMode && PRICED_INCOTERMS.filter(i => incoterms.includes(i)).length === 0 && (
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
            <CommercialSummaryPanel summary={summary} currency={currency} unitPrice={primaryPrice} qty={qty} unitType={unitType} specs={specs} frequency={frequency} duration={duration} category={cat} containerType={containerType} commercialUnit={commercialUnit} exportFormat={exportFormat} />
          )}
        </div>
      )}
    </div>
  );
}

function CommercialSummaryPanel({ summary, currency, unitPrice, qty, unitType, specs, frequency, duration, category, containerType, commercialUnit, exportFormat }) {
  const hasPrice   = parseFloat(unitPrice) > 0;
  const hasQty     = parseFloat(qty) > 0;
  const isLive     = category === "LIVE_ANIMALS";
  const isMultiSku = !!summary?.isMultiSku;
  const isSingleShipment = frequency === "ONE_SHIPMENT";

  const panelStyle = {
    background: summary?.contractValue > 0
      ? "linear-gradient(135deg,#1B2A4A 0%,#2d4070 100%)"
      : "linear-gradient(135deg,#374151 0%,#4b5563 100%)",
    borderRadius: 10, padding: "14px 16px", color: "#fff", marginTop: 10,
  };

  // Multi-SKU retail mode — show aggregate immediately
  if (isMultiSku) {
    const hasSummary = summary.contractValue > 0;
    if (!hasSummary) {
      return (
        <div style={{ ...panelStyle, opacity: 0.7 }}>
          <p style={{ fontSize: 11, opacity: 0.7, margin: "0 0 6px", letterSpacing: 1, textTransform: "uppercase" }}>Resumen Multi-SKU</p>
          <p style={{ fontSize: 12, margin: 0, opacity: 0.8 }}>
            Complete los SKUs con precio y cantidad para ver los totales del contrato.
          </p>
        </div>
      );
    }
    return (
      <div style={panelStyle}>
        <p style={{ fontSize: 11, opacity: 0.7, margin: "0 0 12px", letterSpacing: 1, textTransform: "uppercase" }}>
          Resumen Comercial — {summary.skuCount} SKU{summary.skuCount !== 1 ? "s" : ""}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: 10 }}>
          {summary.shipmentValue > 0 && <MiniBox label="VALOR / EMBARQUE" value={fmtMoney(summary.shipmentValue, currency)} highlight />}
          {summary.totalBoxes  > 0 && <MiniBox label="CAJAS / BOXES"        value={fmtNum(summary.totalBoxes) + " BOXES"} />}
          {summary.totalUnits  > 0 && <MiniBox label="UNIDADES / UNITS"     value={fmtNum(summary.totalUnits) + " UNITS"} />}
          {summary.totalNetKg  > 0 && <MiniBox label="PESO NETO / NET KG"   value={fmtNum(summary.totalNetKg) + " KG NET"} />}
          {summary.shipmentsPerYear != null && !isSingleShipment && <MiniBox label="EMBARQUES / AÑO"  value={String(summary.shipmentsPerYear)} />}
          {isSingleShipment      && <MiniBox label="TIPO"                    value="Embarque único" />}
          {duration              && !isSingleShipment && <MiniBox label="DURACIÓN"    value={`${duration} meses`} />}
          {summary.contractValue > 0 && <MiniBox label="TOTAL CONTRATO"     value={fmtMoney(summary.contractValue, currency)} big />}
          {summary.contractValue > 0 && !isSingleShipment && summary.durationMonths > 0 && (
            <MiniBox label="VALOR ANUAL" value={fmtMoney(summary.contractValue / (summary.durationMonths / 12), currency)} />
          )}
        </div>
      </div>
    );
  }

  const pendingItems = [];
  if (!hasQty)   pendingItems.push(isLive ? "cabezas por embarque" : "cantidad");
  if (!hasPrice) pendingItems.push("precio por unidad");

  if (!hasQty && !hasPrice) {
    return (
      <div style={{ ...panelStyle, opacity: 0.7 }}>
        <p style={{ fontSize: 11, opacity: 0.7, margin: "0 0 6px", letterSpacing: 1, textTransform: "uppercase" }}>Resumen Comercial</p>
        <p style={{ fontSize: 12, margin: 0, opacity: 0.8 }}>Ingrese {pendingItems.join(" y ")} para ver los cálculos.</p>
      </div>
    );
  }

  // Unit context label for quantity display — "1,400 BOXES", "24 MT", "20,000 LITERS"
  const unitCtx = commercialUnit ? getUnitContext(commercialUnit, "en") : (unitType?.split("/")[0].trim() || "units");

  return (
    <div style={panelStyle}>
      <p style={{ fontSize: 11, opacity: 0.7, margin: "0 0 12px", letterSpacing: 1, textTransform: "uppercase" }}>
        Resumen Comercial del Programa
      </p>

      {/* LIVE_ANIMALS — highlighted shipment value block */}
      {isLive && summary?.shipmentValue > 0 && (
        <div style={{ background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
          <p style={{ fontSize: 10, opacity: 0.8, margin: "0 0 4px", letterSpacing: 0.8, textTransform: "uppercase" }}>Valor de Referencia por Embarque / Lot Value</p>
          <p style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#4ade80" }}>{fmtMoney(summary.shipmentValue, currency)}</p>
          {summary.liveAnimalKg > 0 && (
            <p style={{ fontSize: 11, opacity: 0.7, margin: "3px 0 0" }}>
              {fmtNum(parseFloat(qty))} cabezas × {specs?.avgWeight || "?"}kg × {currency} {parseFloat(unitPrice).toFixed(2)}/kg
            </p>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: 10 }}>
        {/* Price with dynamic unit context */}
        {hasPrice && (
          <MiniBox
            label={`PRECIO ${commercialUnit ? `(${COMMERCIAL_SALE_UNITS.find(u=>u.id===commercialUnit)?.abbr || commercialUnit})` : "/ KG"}`}
            value={`${currency} ${parseFloat(unitPrice).toFixed(2)}`} />
        )}
        {/* Quantity with unit context — "1,400 BOXES" not just "1,400" */}
        {hasQty && !isLive && (
          <MiniBox label={`CANTIDAD — ${unitCtx}`} value={`${fmtNum(parseFloat(qty))} ${unitCtx}`} />
        )}
        {hasQty && !isLive && (unitType?.includes("MT") || unitType?.includes("Tonelada")) && (
          <MiniBox label="PESO TOTAL" value={fmtNum(parseFloat(qty) * 1000) + " KG"} />
        )}

        {/* LIVE_ANIMALS specific fields */}
        {isLive && hasQty && <MiniBox label="CABEZAS / EMBARQUE" value={fmtNum(parseFloat(qty))} />}
        {isLive && specs?.avgWeight > 0 && <MiniBox label="PESO PROM. / CABEZA" value={`${specs.avgWeight} KG`} />}
        {isLive && summary?.lotWeightGross > 0 && <MiniBox label="PESO LOTE CARGADO" value={fmtNum(summary.lotWeightGross) + " KG"} />}

        {/* Non-live: shipment value smaller highlight */}
        {!isLive && summary?.shipmentValue > 0 && <MiniBox label="VALOR / EMBARQUE" value={fmtMoney(summary.shipmentValue, currency)} highlight />}

        {summary?.shipmentsPerYear != null && !isSingleShipment && (
          <MiniBox label="EMBARQUES / AÑO" value={String(summary.shipmentsPerYear)} />
        )}
        {isSingleShipment && <MiniBox label="TIPO" value="Embarque único" />}
        {duration && !isSingleShipment && <MiniBox label="DURACIÓN CONTRATO" value={`${duration} MESES`} />}

        {/* LIVE_ANIMALS contract-level totals */}
        {isLive && summary?.totalContractHeadcount > 0 && (
          <MiniBox label="CABEZAS TOTALES" value={fmtNum(summary.totalContractHeadcount)} />
        )}
        {isLive && summary?.totalContractWeight > 0 && (
          <MiniBox label="PESO TOTAL CONTRATO" value={fmtNum(summary.totalContractWeight) + " KG"} />
        )}
        {isLive && summary?.annualValue > 0 && (
          <MiniBox label="VALOR ANUAL EST." value={fmtMoney(summary.annualValue, currency)} />
        )}

        {summary?.contractValue > 0 && (
          <MiniBox label="TOTAL CONTRATO" value={fmtMoney(summary.contractValue, currency)} big />
        )}
        {!isLive && summary?.containers && (
          <MiniBox label="CONTENEDORES EST." value={`${summary.containers.containers} × ${getContainerLabel(containerType) || "40FT"}`} />
        )}
        {!isLive && summary?.totalNetKg > 0 && (
          <MiniBox label="Peso Neto Total" value={fmtNum(summary.totalNetKg) + " kg"} />
        )}
        {!isLive && summary?.totalUnits > 0 && (
          <MiniBox label="Unidades Totales" value={fmtNum(summary.totalUnits)} />
        )}
        {!isLive && summary?.contractValue > 0 && !isSingleShipment && summary?.durationMonths > 0 && (
          <MiniBox label="Valor Anual" value={fmtMoney(summary.contractValue / (summary.durationMonths / 12), currency)} />
        )}
        {/* Export-format context — industrial modes: show logistics basis */}
        {!isLive && exportFormat && !isRetailExportFormat(exportFormat) && commercialUnit && (
          <MiniBox label="BASE LOGÍSTICA"
            value={`${getExportFormatLabel(exportFormat)} — ${COMMERCIAL_SALE_UNITS.find(u=>u.id===commercialUnit)?.abbr || commercialUnit}`} />
        )}
      </div>
      {!summary?.contractValue && hasQty && hasPrice && (
        <p style={{ fontSize: 11, opacity: 0.7, margin: "10px 0 0", fontStyle: "italic" }}>
          Selecciona frecuencia y duración para ver el valor total del contrato.
        </p>
      )}
      {isLive && specs?.mortalityMargin > 0 && (
        <p style={{ fontSize: 10, opacity: 0.55, margin: "8px 0 0", fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 8 }}>
          Nota logística: Mortalidad {specs.mortalityMargin}% — responsabilidad del comprador. No se deduce del valor comercial ni del peso contractual.
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
        {totalContainers > 0 && <MiniBox label="Contenedores Tot." value={`${totalContainers} contenedores`} />}
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
  const [destinationPort, setDestinationPort] = useState(value?.destinationPort || "");
  const [destPortFallback, setDestPortFallback] = useState("");

  const availablePorts = getPortsForCountry(destination, destPortFallback);

  const addRow = () => setRows(prev => [...prev, newRowData()]);
  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));

  const handleRowChange = (id, data) => {
    setRowData(prev => ({ ...prev, [id]: data }));
  };

  const handleDestinationChange = (name, portFallback) => {
    setDestination(name);
    setDestPortFallback(portFallback || "");
    setDestinationPort(""); // reset port when country changes
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
      destinationPort,
      origin: firstRow.origin || "Brazil",
    });
  }, [rowData, destination, destinationPort, rows]);

  return (
    <div>
      {/* Destination — document level */}
      <div style={s.section}>
        <p style={s.title}>País de Destino / Destination Country</p>
        <CountrySearch value={destination} onChange={handleDestinationChange} />
        {/* Dynamic port selector — appears after country is selected */}
        {destination && availablePorts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <label style={s.label}>Puerto de destino / Destination Port</label>
            <select value={destinationPort} onChange={e => setDestinationPort(e.target.value)} style={s.select}>
              <option value="">Seleccionar puerto...</option>
              {availablePorts.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
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
