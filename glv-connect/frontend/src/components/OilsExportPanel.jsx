/**
 * OilsExportPanel.jsx — V8.1 Enterprise Export Oils Commercial Panel
 *
 * Renders ONLY when category === "OILS".
 * Fully isolated. Zero coupling to livestock / frozen cargo / other categories.
 *
 * V8.1 changes vs V8.0:
 *   - Correct 7-section commercial hierarchy
 *   - Role-aware financial visibility (canViewInternalFinancials guard)
 *   - Global destination support (any country, any port)
 *   - Admin-only Section 7 fully removed from render tree for non-admin
 *   - Technical oil spec fields added
 */

import { useState, useEffect } from "react";
import { canViewInternalFinancials, normalizeRole } from "../engines/oils/userRoleEngine.js";
import { OIL_PRODUCTS, getOilPrice, getOilPriceTriplet, calcFreightRatioPct, calcInsuranceRatioPct } from "../engines/oils/oilsPricingEngine.js";
import { PRESET_DESTINATIONS, GLOBAL_REGIONS, resolveDestination, calcGlobalContainerFreight, calcGlobalInsurance, hasPresetFreight } from "../engines/oils/globalDestinationEngine.js";
import { OIL_PACKAGING_TYPES, getPackagingCostPerUnit, calcTotalPackagingCost } from "../engines/oils/packagingCostEngine.js";
import { MARKET_SEGMENTS, MARKET_IDS, getMarketMOQ } from "../engines/oils/exportMarketEngine.js";
import { getCapacityPreset } from "../engines/oils/logisticsCapacityEngine.js";
import { runProfitSimulation, PROFIT_TARGET_MIN_USD, PROFIT_TARGET_MAX_USD, calcPriceAdjustmentNeeded } from "../engines/oils/profitSimulationEngine.js";
import { OIL_POUCH_TYPES, OIL_FILM_MATERIALS, OIL_SEAL_TYPES, OIL_POUCH_SIZES, OIL_FOOD_GRADE_LEVELS, OIL_OEM_CAPABILITIES, getOilPouchCartonOptions } from "../engines/oils/oilsPouchEngine.js";
import { PET_OIL_SIZES, getPetCartonOptions } from "../engines/oils/petPackagingEngine.js";
import { INDUSTRIAL_FORMATS } from "../engines/oils/jerrycanEngine.js";
import { createOilSku, autoPopulateSkuPrice, calcOilSkuValue, calcOilMultiSkuSummary, validateOilSku } from "../engines/oils/retailSkuEngine.js";

// ─── Packaging group resolver ─────────────────────────────────────────────────

const JERRY_IDS = new Set(["JERRYCAN_20L","DRUM_200L","IBC_1000L","FLEXITANK","ISOTANK"]);
const POUCH_IDS = new Set(["RETAIL_POUCH","DOYPACK","SPOUT_POUCH","PILLOW_POUCH","LAMINATED_POUCH","MULTILAYER_POUCH","FLEXIBLE_OIL_POUCH"]);

function resolveGroup(pt) {
  if (JERRY_IDS.has(pt)) return "JERRY";
  if (POUCH_IDS.has(pt)) return "POUCH";
  return "PET";
}

function getSizesForPackaging(pt) {
  const g = resolveGroup(pt);
  if (g === "POUCH") return OIL_POUCH_SIZES;
  if (g === "JERRY") return [{ id: "20L", label: "20 L" }];
  return PET_OIL_SIZES;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const SEC_COLORS = {
  1: "#1B2A4A", // Product Identity — navy
  2: "#0369a1", // Export Format — blue
  3: "#7c3aed", // Packaging — purple
  4: "#065f46", // Logistics — green
  5: "#92400e", // Commercial Terms — amber
  6: "#1B2A4A", // Commercial Summary — navy
  7: "#dc2626", // Admin Financials — red (admin-only)
};

const s = {
  panel:    { border: "1.5px solid #7c3aed", borderRadius: 12, marginTop: 14, overflow: "hidden", background: "#faf5ff" },
  hdr:      (c) => ({ background: c, color: "#fff", padding: "7px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }),
  section:  { padding: "12px 16px", borderBottom: "1px solid #e9d5ff" },
  label:    (c = "#6d28d9") => ({ fontSize: 11, fontWeight: 700, color: c, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" }),
  row:      { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 },
  field:    { flex: 1, minWidth: 140 },
  select:   { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #c4b5fd", fontSize: 12, background: "#fff" },
  input:    { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #c4b5fd", fontSize: 12, background: "#fff", boxSizing: "border-box" },
  chip:     (active, color = "#7c3aed") => ({
    padding: "4px 12px", borderRadius: 16, fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400,
    border: active ? `2px solid ${color}` : "1px solid #ddd6fe",
    background: active ? color : "#faf5ff", color: active ? "#fff" : "#6d28d9",
  }),
  stat:     { background: "#fff", border: "1px solid #e9d5ff", borderRadius: 8, padding: "8px 12px", flex: 1, minWidth: 110 },
  statVal:  { fontSize: 15, fontWeight: 800, color: "#1B2A4A", marginBottom: 2 },
  statLbl:  { fontSize: 10, color: "#6d28d9", fontWeight: 600, textTransform: "uppercase" },
  badge:    (ok) => ({ display: "inline-block", padding: "3px 12px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: ok ? "#d1fae5" : "#fee2e2", color: ok ? "#065f46" : "#991b1b" }),
  title:    (c = "#4c1d95") => ({ fontSize: 12, fontWeight: 800, color: c, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }),
  addBtn:   { padding: "6px 14px", borderRadius: 8, background: "#7c3aed", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  rmBtn:    { padding: "3px 10px", borderRadius: 6, background: "#fee2e2", color: "#991b1b", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  adminBadge: { fontSize: 10, background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", padding: "2px 8px", borderRadius: 6, fontWeight: 700, marginLeft: 8 },
};

const Sel = ({ label: lbl, value, onChange, options, placeholder = "—", color }) => (
  <div style={s.field}>
    {lbl && <span style={s.label(color)}>{lbl}</span>}
    <select style={s.select} value={value || ""} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.id || o} value={o.id || o}>{o.label || o}</option>)}
    </select>
  </div>
);

const Inp = ({ label: lbl, value, onChange, type = "text", placeholder = "", color }) => (
  <div style={s.field}>
    {lbl && <span style={s.label(color)}>{lbl}</span>}
    <input style={s.input} type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

const fmtUSD = (v) => v != null && !isNaN(v) ? `$${Number(v).toFixed(2)}` : "—";
const fmtNum = (v) => v != null && !isNaN(v) ? Number(v).toLocaleString() : "—";
const fmtPct = (v) => v != null && !isNaN(v) ? `${v}%` : "—";

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ num, title, open, onToggle, children, adminOnly = false }) {
  const color = SEC_COLORS[num] || "#1B2A4A";
  return (
    <div style={{ borderBottom: "1px solid #e9d5ff" }}>
      <div style={s.hdr(color)} onClick={onToggle}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>
          {num}. {title}
          {adminOnly && <span style={s.adminBadge}>ADMIN ONLY</span>}
        </span>
        <span>{open ? "▲" : "▼"}</span>
      </div>
      {open && <div style={{ padding: "12px 16px" }}>{children}</div>}
    </div>
  );
}

// ─── Oil SKU card ─────────────────────────────────────────────────────────────

function OilSkuCard({ sku, onChange, onRemove }) {
  const sizes = getSizesForPackaging(sku.packagingType);
  const handleField = (k, v) => {
    let updated = { ...sku, [k]: v };
    if (["productId","packagingType","sizeId","incoterm"].includes(k)) updated = autoPopulateSkuPrice(updated);
    if (k === "packagingType") { updated.sizeId = ""; updated.pricePerUnit = 0; }
    onChange(updated);
  };
  const triplet = sku.productId && sku.packagingType && sku.sizeId ? getOilPriceTriplet(sku.productId, sku.packagingType, sku.sizeId) : null;
  const errors = validateOilSku(sku);

  return (
    <div style={{ background: "#fff", border: "1.5px solid #ddd6fe", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9" }}>SKU #{sku._id}</span>
        <button style={s.rmBtn} onClick={onRemove}>✕</button>
      </div>
      <div style={s.row}>
        <Sel label="Oil Type"    value={sku.productId}     onChange={v => handleField("productId", v)}     options={OIL_PRODUCTS} />
        <Sel label="Packaging"   value={sku.packagingType} onChange={v => handleField("packagingType", v)} options={OIL_PACKAGING_TYPES} />
        <Sel label="Size"        value={sku.sizeId}        onChange={v => handleField("sizeId", v)}        options={sizes} />
        <Sel label="Incoterm"    value={sku.incoterm}      onChange={v => handleField("incoterm", v)}      options={["FOB","CFR","CIF"]} />
      </div>
      <div style={s.row}>
        <Inp label="Price/Unit" value={sku.pricePerUnit}  onChange={v => handleField("pricePerUnit", parseFloat(v)||0)} type="number" placeholder="0.00" />
        <Inp label="Qty (units)"value={sku.quantity}      onChange={v => handleField("quantity",     parseFloat(v)||0)} type="number" placeholder="0" />
        <Inp label="Units/Carton"value={sku.unitsPerCarton}onChange={v => handleField("unitsPerCarton",parseInt(v)||12)} type="number" placeholder="12" />
      </div>
      {triplet && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
          {["FOB","CFR","CIF"].map(inc => (
            <span key={inc} style={{ fontSize: 11, background: sku.incoterm === inc ? "#ede9fe" : "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 6, padding: "2px 8px", color: "#4c1d95", fontWeight: sku.incoterm === inc ? 700 : 400 }}>
              {inc} {fmtUSD(triplet[inc])}
            </span>
          ))}
          <span style={{ fontSize: 11, color: "#6d28d9", padding: "2px 8px" }}>= <strong>{fmtUSD(calcOilSkuValue(sku))}</strong></span>
        </div>
      )}
      {errors.length > 0 && <div style={{ marginTop: 6, fontSize: 10, color: "#991b1b" }}>{errors.map(e => <div key={e}>⚠ {e}</div>)}</div>}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {string}   props.category   — must be "OILS" to render
 * @param {string}   [props.userRole] — from app auth context, defaults to EXTERNAL
 * @param {function} [props.onChange] — callback({ oilsConfig })
 * @param {object}   [props.initial]  — restore state
 */
export default function OilsExportPanel({ category, userRole, onChange, initial = {} }) {
  if (category !== "OILS") return null;

  const role        = normalizeRole(userRole);
  const canFinance  = canViewInternalFinancials(role);

  // ── State ───────────────────────────────────────────────────────────────────
  // Section 1: Product Identity
  const [productId,    setProductId]   = useState(initial.productId    || "");
  const [grade,        setGrade]       = useState(initial.grade        || "RBD");
  const [origin,       setOrigin]      = useState(initial.origin       || "");
  const [gmoStatus,    setGmo]         = useState(initial.gmoStatus    || "Non-GMO");
  const [certifications,setCerts]      = useState(initial.certifications || []);
  const [market,       setMarket]      = useState(initial.market       || "");
  // Section 2: Export Format
  const [packagingType, setPkg]        = useState(initial.packagingType || "PET_BOTTLE");
  // Section 3: Presentation + Packaging
  const [sizeId,       setSizeId]      = useState(initial.sizeId       || "");
  const [unitsPerCarton,setUpc]        = useState(initial.unitsPerCarton || "");
  const [pouchType,    setPouchType]   = useState(initial.pouchType    || "");
  const [filmMaterial, setFilm]        = useState(initial.filmMaterial || "");
  const [sealType,     setSeal]        = useState(initial.sealType     || "");
  const [foodGrade,    setFoodGrade]   = useState(initial.foodGrade    || []);
  const [oemCaps,      setOemCaps]     = useState(initial.oemCaps      || []);
  const [shelfLife,    setShelfLife]   = useState(initial.shelfLife    || "");
  // Section 4: Logistics
  const [containerType,setContainer]   = useState(initial.containerType || "40HQ");
  // Section 5: Commercial Terms
  const [incoterm,     setIncoterm]    = useState(initial.incoterm     || "FOB");
  const [destination,  setDest]        = useState(initial.destination  || "");
  const [customCountry,setCustomCountry]=useState(initial.customCountry|| "");
  const [customFreightUSD,setCustomFreight]=useState(initial.customFreightUSD||"");
  const [regionId,     setRegion]      = useState(initial.regionId     || "");
  const [moq,          setMoq]         = useState(initial.moq          || "");
  const [frequency,    setFrequency]   = useState(initial.frequency    || "");
  const [contractDuration,setDuration] = useState(initial.contractDuration || "");
  // Admin-only reserves (only stored/sent if canFinance)
  const [exportMarginPct,  setMargin]  = useState(initial.exportMarginPct  ?? 0.05);
  const [commissionPct,    setComm]    = useState(initial.commissionPct    ?? 0.02);
  const [agentPct,         setAgent]   = useState(initial.agentPct         ?? 0.015);
  const [intermediaryPct,  setInter]   = useState(initial.intermediaryPct  ?? 0.01);
  // Section 6: Multi-SKU
  const [skus,         setSkus]        = useState(initial.skus         || []);

  // Section open/close state
  const [open, setOpen]   = useState(initial._sectionOpen ?? { 1:true,2:true,3:true,4:false,5:true,6:false,7:false });
  const toggle = (n) => setOpen(p => ({ ...p, [n]: !p[n] }));

  // ── Derived values ──────────────────────────────────────────────────────────
  const group          = resolveGroup(packagingType);
  const sizes          = getSizesForPackaging(packagingType);
  const triplet        = (productId && packagingType && sizeId) ? getOilPriceTriplet(productId, packagingType, sizeId) : null;
  const basePrice      = triplet?.[incoterm] ?? 0;
  const capacity       = sizeId ? getCapacityPreset(packagingType, sizeId) : null;
  const nominalUnits   = capacity ? Math.round((capacity.unitsMin + capacity.unitsMax) / 2) : 0;
  const destInfo       = destination ? resolveDestination(destination, { customCountry, customFreightUSD: parseFloat(customFreightUSD)||0, regionId }) : null;
  const freightUSD     = destInfo ? calcGlobalContainerFreight(destination, { customCountry, customFreightUSD: parseFloat(customFreightUSD)||0, regionId }) : 0;
  const fobTotal       = basePrice * nominalUnits;
  const insuranceUSD   = destInfo ? calcGlobalInsurance(fobTotal, destination, { customCountry, customFreightUSD: parseFloat(customFreightUSD)||0, regionId }) : 0;
  const pkgCostPerUnit = sizeId ? getPackagingCostPerUnit(packagingType, sizeId) : 0;
  const isCustomDest   = destination === "Custom" || !hasPresetFreight(destination);

  const simulation = canFinance && basePrice && nominalUnits ? runProfitSimulation({
    fobPricePerUnit:        basePrice,
    unitsPerContainer:      nominalUnits,
    packagingCostPerUnit:   pkgCostPerUnit,
    freightUSD,
    insuranceUSD,
    exportMarginPct,
    commissionReservePct:   commissionPct,
    agentReservePct:        agentPct,
    intermediaryReservePct: intermediaryPct,
  }) : null;

  const skuSummary = calcOilMultiSkuSummary(skus);

  const toggleChip = (arr, setArr, id) => setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ── Propagate to parent ─────────────────────────────────────────────────────
  useEffect(() => {
    onChange?.({
      oilsConfig: {
        productId, grade, origin, gmoStatus, certifications, market,
        packagingType, sizeId, unitsPerCarton, pouchType, filmMaterial, sealType,
        foodGrade, oemCaps, shelfLife,
        containerType, incoterm, destination, customCountry, customFreightUSD,
        regionId, moq, frequency, contractDuration,
        // Only pass admin financials if role permits
        ...(canFinance ? { exportMarginPct, commissionPct, agentPct, intermediaryPct, simulation } : {}),
        skus, skuSummary,
        basePrice, freightUSD, insuranceUSD, pkgCostPerUnit,
        unitsPerContainer: nominalUnits, triplet,
        _sectionOpen: open,
      },
    });
  }, [productId, grade, origin, gmoStatus, certifications, market,
      packagingType, sizeId, unitsPerCarton, pouchType, filmMaterial, sealType,
      foodGrade, oemCaps, shelfLife, containerType, incoterm, destination,
      customCountry, customFreightUSD, regionId, moq, frequency, contractDuration,
      exportMarginPct, commissionPct, agentPct, intermediaryPct, skus, open]);

  const CERT_OPTIONS = ["Kosher","Halal","FDA","FSSC 22000","BRC","ISO 22000","Non-GMO Project","RSPO"];
  const GRADE_OPTIONS = ["RBD","Crude","Refined","Degummed","Bleached","Deodorized"];
  const GMO_OPTIONS   = ["Non-GMO","GMO","IP Non-GMO","Non-GMO Verified"];
  const FREQ_OPTIONS  = ["Monthly","Bimonthly","Quarterly","Spot"];
  const DURATION_OPTIONS = ["3 months","6 months","12 months","24 months","Spot"];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.panel}>
      {/* Master header */}
      <div style={{ background: "linear-gradient(135deg,#1B2A4A,#7c3aed)", color: "#fff", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.5 }}>🛢 GLOBAL PRICE CENTER V8 — OILS</span>
          <span style={{ marginLeft: 10, fontSize: 11, opacity: 0.85 }}>Enterprise Export Engine</span>
        </div>
        <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", padding: "2px 8px", borderRadius: 6 }}>{role}</span>
      </div>

      {/* ── SECTION 1: Commercial Product Identity ──────────────────────────── */}
      <Section num={1} title="Commercial Product Identity" open={open[1]} onToggle={() => toggle(1)}>
        <div style={s.row}>
          <Sel label="Oil Type"     value={productId}   onChange={setProductId} options={OIL_PRODUCTS}                        color={SEC_COLORS[1]} />
          <Sel label="Grade"        value={grade}        onChange={setGrade}     options={GRADE_OPTIONS.map(g=>({id:g,label:g}))} color={SEC_COLORS[1]} />
          <Sel label="GMO Status"   value={gmoStatus}    onChange={setGmo}       options={GMO_OPTIONS.map(g=>({id:g,label:g}))} color={SEC_COLORS[1]} />
        </div>
        <div style={s.row}>
          <Inp label="Origin (Country)" value={origin} onChange={setOrigin} placeholder="e.g. Colombia, Malaysia" color={SEC_COLORS[1]} />
          <Sel label="Export Market"    value={market} onChange={setMarket}
            options={MARKET_IDS.map(id => ({ id, label: MARKET_SEGMENTS[id].label }))} color={SEC_COLORS[1]} />
        </div>
        <div style={{ marginBottom: 6 }}>
          <span style={s.label(SEC_COLORS[1])}>Certifications</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {CERT_OPTIONS.map(c => (
              <button key={c} type="button" style={s.chip(certifications.includes(c), SEC_COLORS[1])}
                onClick={() => toggleChip(certifications, setCerts, c)}>{c}</button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── SECTION 2: Export Format ─────────────────────────────────────────── */}
      <Section num={2} title="Export Format" open={open[2]} onToggle={() => toggle(2)}>
        <Sel label="Packaging Type" value={packagingType}
          onChange={v => { setPkg(v); setSizeId(""); setUpc(""); }}
          options={OIL_PACKAGING_TYPES} color={SEC_COLORS[2]} />
        <div style={{ marginTop: 6, fontSize: 11, color: SEC_COLORS[2], fontWeight: 600 }}>
          Format group: <strong>{resolveGroup(packagingType)}</strong>
        </div>
      </Section>

      {/* ── SECTION 3: Presentation + Packaging ──────────────────────────────── */}
      <Section num={3} title="Presentation & Packaging" open={open[3]} onToggle={() => toggle(3)}>
        <div style={s.row}>
          <Sel label="Size" value={sizeId} onChange={setSizeId} options={sizes} color={SEC_COLORS[3]} />
          <Inp label="Units / Carton" value={unitsPerCarton} onChange={setUpc} type="number"
            placeholder={capacity?.unitsPerCarton || "12"} color={SEC_COLORS[3]} />
          <Inp label="Shelf Life" value={shelfLife} onChange={setShelfLife} placeholder="e.g. 18 months" color={SEC_COLORS[3]} />
        </div>

        {group === "POUCH" && (
          <>
            <div style={s.row}>
              <Sel label="Pouch Type"    value={pouchType}    onChange={setPouchType} options={OIL_POUCH_TYPES}    color={SEC_COLORS[3]} />
              <Sel label="Film Material" value={filmMaterial} onChange={setFilm}      options={OIL_FILM_MATERIALS} color={SEC_COLORS[3]} />
              <Sel label="Seal Type"     value={sealType}     onChange={setSeal}      options={OIL_SEAL_TYPES}     color={SEC_COLORS[3]} />
            </div>
          </>
        )}

        <div style={{ marginBottom: 8 }}>
          <span style={s.label(SEC_COLORS[3])}>Food Grade / Certifications</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {OIL_FOOD_GRADE_LEVELS.map(c => (
              <button key={c.id} type="button" style={s.chip(foodGrade.includes(c.id), SEC_COLORS[3])}
                onClick={() => toggleChip(foodGrade, setFoodGrade, c.id)}>{c.label}</button>
            ))}
          </div>
        </div>

        <div>
          <span style={s.label(SEC_COLORS[3])}>OEM / Capabilities</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {OIL_OEM_CAPABILITIES.map(o => (
              <button key={o.id} type="button" style={s.chip(oemCaps.includes(o.id), SEC_COLORS[3])}
                onClick={() => toggleChip(oemCaps, setOemCaps, o.id)}>{o.label}</button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── SECTION 4: Logistics — READ-ONLY resolved from packaging selection ── */}
      <Section num={4} title="Logistics (Auto-Resolved)" open={open[4]} onToggle={() => toggle(4)}>
        <div style={{ marginBottom: 8, fontSize: 11, color: SEC_COLORS[4], fontWeight: 600, fontStyle: "italic" }}>
          Container logistics are resolved automatically from your packaging selection in Section 3.
        </div>
        {capacity && sizeId ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={s.stat}><div style={s.statVal}>{containerType || "40HQ"}</div><div style={s.statLbl}>Container Type</div></div>
            <div style={s.stat}><div style={s.statVal}>{fmtNum(capacity.unitsMin)}–{fmtNum(capacity.unitsMax)}</div><div style={s.statLbl}>Units / 40HQ</div></div>
            <div style={s.stat}><div style={s.statVal}>{capacity.unitsPerCarton}</div><div style={s.statLbl}>Units / Carton</div></div>
            <div style={s.stat}><div style={s.statVal}>{capacity.cartonsPerPallet}</div><div style={s.statLbl}>Cartons / Pallet</div></div>
            <div style={s.stat}><div style={s.statVal}>{capacity.pallets}</div><div style={s.statLbl}>Pallets / Container</div></div>
            <div style={s.stat}><div style={s.statVal}>{fmtNum(nominalUnits)}</div><div style={s.statLbl}>Nominal Units</div></div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Select a packaging type and size in Section 3 to see logistics capacity.</div>
        )}
      </Section>

      {/* ── SECTION 5: Commercial Terms ───────────────────────────────────────── */}
      <Section num={5} title="Commercial Terms" open={open[5]} onToggle={() => toggle(5)}>
        <div style={s.row}>
          <Sel label="Incoterm"   value={incoterm}   onChange={setIncoterm}  options={["FOB","CFR","CIF"]}            color={SEC_COLORS[5]} />
          <Inp label="MOQ (units)"value={moq}         onChange={setMoq}       type="number" placeholder={getMarketMOQ(market)||"22000"} color={SEC_COLORS[5]} />
          <Sel label="Frequency"  value={frequency}   onChange={setFrequency} options={FREQ_OPTIONS.map(f=>({id:f,label:f}))}  color={SEC_COLORS[5]} />
          <Sel label="Duration"   value={contractDuration} onChange={setDuration} options={DURATION_OPTIONS.map(d=>({id:d,label:d}))} color={SEC_COLORS[5]} />
        </div>

        {/* Price Center — live matrix lookup */}
        {triplet && (
          <div style={{ background: "#fff7ed", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
            <div style={s.title(SEC_COLORS[5])}>Price Center</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["FOB","CFR","CIF"].map(inc => (
                <div key={inc} style={{ ...s.stat, border: incoterm === inc ? `2px solid ${SEC_COLORS[5]}` : "1px solid #e9d5ff" }}>
                  <div style={{ ...s.statVal, color: incoterm === inc ? SEC_COLORS[5] : "#1B2A4A" }}>{fmtUSD(triplet[inc])}</div>
                  <div style={s.statLbl}>{inc} / unit</div>
                </div>
              ))}
              <div style={s.stat}><div style={s.statVal}>{fmtPct(calcFreightRatioPct(productId, packagingType, sizeId))}</div><div style={s.statLbl}>Freight ratio</div></div>
              <div style={s.stat}><div style={s.statVal}>{fmtPct(calcInsuranceRatioPct(productId, packagingType, sizeId))}</div><div style={s.statLbl}>Insurance ratio</div></div>
            </div>
          </div>
        )}

        {/* Destination — global, any country */}
        <div style={{ marginTop: 8 }}>
          <span style={s.label(SEC_COLORS[5])}>Export Destination</span>
          <div style={s.row}>
            <Sel label="" value={destination} onChange={setDest}
              options={PRESET_DESTINATIONS} color={SEC_COLORS[5]} />
            {isCustomDest && (
              <Inp label="Custom Country / Port" value={customCountry} onChange={setCustomCountry}
                placeholder="Any country or port worldwide" color={SEC_COLORS[5]} />
            )}
          </div>
          {isCustomDest && (
            <div style={s.row}>
              <Sel label="Region (for freight estimate)" value={regionId} onChange={setRegion}
                options={GLOBAL_REGIONS} color={SEC_COLORS[5]} />
              <Inp label="Override Freight USD / Container" value={customFreightUSD} onChange={setCustomFreight}
                type="number" placeholder="Leave blank to use regional estimate" color={SEC_COLORS[5]} />
            </div>
          )}
          {destInfo && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              <div style={s.stat}><div style={s.statVal}>{fmtUSD(freightUSD)}</div><div style={s.statLbl}>Freight / Container</div></div>
              <div style={s.stat}><div style={s.statVal}>{fmtUSD(insuranceUSD)}</div><div style={s.statLbl}>Insurance</div></div>
              {destInfo.isCustom && <div style={{ ...s.stat, background: "#fffbeb" }}><div style={{ ...s.statVal, color: "#92400e", fontSize: 11 }}>Custom</div><div style={s.statLbl}>Destination</div></div>}
            </div>
          )}
        </div>
      </Section>

      {/* ── SECTION 6: Commercial Summary ────────────────────────────────────── */}
      <Section num={6} title="Commercial Summary" open={open[6]} onToggle={() => toggle(6)}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {basePrice > 0 && nominalUnits > 0 && (
            <>
              <div style={s.stat}><div style={s.statVal}>{fmtUSD(basePrice * nominalUnits)}</div><div style={s.statLbl}>Shipment FOB Value</div></div>
              <div style={s.stat}><div style={s.statVal}>{fmtNum(nominalUnits)}</div><div style={s.statLbl}>Units / Container</div></div>
              <div style={s.stat}><div style={s.statVal}>{fmtUSD(basePrice)}</div><div style={s.statLbl}>{incoterm} / Unit</div></div>
              <div style={s.stat}><div style={s.statVal}>{containerType || "40HQ"}</div><div style={s.statLbl}>Container Type</div></div>
            </>
          )}
          {frequency && contractDuration && (
            <div style={s.stat}><div style={s.statVal}>{frequency}</div><div style={s.statLbl}>Frequency / {contractDuration}</div></div>
          )}
        </div>

        {/* Multi-SKU retail export */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={s.label(SEC_COLORS[6])}>Multi-SKU Retail Export</span>
            <button style={s.addBtn} onClick={() => setSkus(p => [...p, createOilSku()])}>+ Add SKU</button>
          </div>
          {skus.length === 0 && <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Add SKUs to configure a multi-size export order.</p>}
          {skus.map(sku => (
            <OilSkuCard key={sku._id} sku={sku}
              onChange={u => setSkus(p => p.map(s => s._id === u._id ? u : s))}
              onRemove={() => setSkus(p => p.filter(s => s._id !== sku._id))} />
          ))}
          {skuSummary && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 12px", background: "#ede9fe", borderRadius: 8 }}>
              <div style={s.stat}><div style={s.statVal}>{fmtUSD(skuSummary.totalFOB)}</div><div style={s.statLbl}>Total FOB</div></div>
              <div style={s.stat}><div style={s.statVal}>{fmtNum(skuSummary.totalUnits)}</div><div style={s.statLbl}>Total Units</div></div>
              <div style={s.stat}><div style={s.statVal}>{fmtUSD(skuSummary.totalPackaging)}</div><div style={s.statLbl}>Packaging Cost</div></div>
              <div style={s.stat}><div style={s.statVal}>{skuSummary.skuCount}</div><div style={s.statLbl}>SKUs</div></div>
            </div>
          )}
        </div>
      </Section>

      {/* ── SECTION 7: Admin Financials — fully removed from render tree for non-admin ── */}
      {canFinance && (
        <Section num={7} title="Admin Financials" open={open[7]} onToggle={() => toggle(7)} adminOnly>
          <div style={s.row}>
            <Inp label="Export Margin %" value={Math.round(exportMarginPct*100)} onChange={v => setMargin(parseFloat(v)/100||0)} type="number" placeholder="5" color={SEC_COLORS[7]} />
            <Inp label="Commission %"    value={Math.round(commissionPct*100)}   onChange={v => setComm(parseFloat(v)/100||0)}   type="number" placeholder="2" color={SEC_COLORS[7]} />
            <Inp label="Agent Reserve %" value={Math.round(agentPct*100)}        onChange={v => setAgent(parseFloat(v)/100||0)}  type="number" placeholder="1.5" color={SEC_COLORS[7]} />
            <Inp label="Intermediary %"  value={Math.round(intermediaryPct*100)} onChange={v => setInter(parseFloat(v)/100||0)}  type="number" placeholder="1" color={SEC_COLORS[7]} />
          </div>
          {simulation && (
            <div style={{ background: simulation.meetsTarget ? "#f0fdf4" : "#fff7ed", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ ...s.title(simulation.meetsTarget ? "#065f46" : "#92400e"), marginBottom: 8 }}>
                Profit Simulation — Target: {fmtUSD(PROFIT_TARGET_MIN_USD)}–{fmtUSD(PROFIT_TARGET_MAX_USD)} / Container
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <div style={s.stat}><div style={{ ...s.statVal, color: simulation.meetsTarget ? "#065f46" : "#dc2626" }}>{fmtUSD(simulation.netProfit)}</div><div style={s.statLbl}>Net Profit</div></div>
                <div style={s.stat}><div style={s.statVal}>{fmtUSD(simulation.grossProfit)}</div><div style={s.statLbl}>Gross Profit</div></div>
                <div style={s.stat}><div style={s.statVal}>{fmtUSD(simulation.totalFOB)}</div><div style={s.statLbl}>Total FOB</div></div>
                <div style={s.stat}><div style={s.statVal}>{fmtPct(simulation.marginPct)}</div><div style={s.statLbl}>Margin %</div></div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={s.stat}><div style={s.statVal}>{fmtPct(simulation.freightRatioPct)}</div><div style={s.statLbl}>Freight ratio</div></div>
                <div style={s.stat}><div style={s.statVal}>{fmtPct(simulation.packagingRatioPct)}</div><div style={s.statLbl}>Packaging ratio</div></div>
                <div style={s.stat}><div style={s.statVal}>{fmtPct(simulation.reserveRatioPct)}</div><div style={s.statLbl}>Reserve ratio</div></div>
                <div style={s.stat}><div style={s.statVal}>{fmtUSD(simulation.totalReserves)}</div><div style={s.statLbl}>Total Reserves</div></div>
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={s.badge(simulation.meetsTarget)}>
                  {simulation.meetsTarget
                    ? `✓ TARGET MET — Net profit ${fmtUSD(simulation.netProfit)} / container`
                    : `⚠ BELOW TARGET — Adjust price +${fmtUSD(Math.abs(calcPriceAdjustmentNeeded(simulation, nominalUnits)))} / unit`}
                </span>
              </div>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
