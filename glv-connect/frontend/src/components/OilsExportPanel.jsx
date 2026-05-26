/**
 * OilsExportPanel.jsx — V8.0 Enterprise Export Oils Commercial Panel
 *
 * Renders ONLY when category === "OILS".
 * Fully isolated state. Zero coupling to livestock / frozen cargo / other categories.
 *
 * Sections:
 *   1. Oil Type + Market + Incoterm
 *   2. Packaging Configuration (PET / Pouch / Jerrycan)
 *   3. Destination + Freight
 *   4. Price Center (live price matrix lookup)
 *   5. Profit Simulation
 *   6. Multi-SKU Retail Export
 */

import { useState, useEffect, useCallback } from "react";

import { OIL_PRODUCTS, getOilPrice, getOilPriceTriplet, getAvailableSizes, calcFreightRatioPct, calcInsuranceRatioPct } from "../engines/oils/oilsPricingEngine.js";
import { DESTINATION_MATRIX, DESTINATIONS, EXPORT_MARKETS, calcContainerFreight, calcInsurance } from "../engines/oils/exportFreightEngine.js";
import { OIL_PACKAGING_TYPES, getPackagingCostPerUnit, getPackagingForSegment, calcTotalPackagingCost } from "../engines/oils/packagingCostEngine.js";
import { MARKET_SEGMENTS, MARKET_IDS, getMarketMOQ, getPreferredPackaging, getPreferredSizes } from "../engines/oils/exportMarketEngine.js";
import { logisticsCapacityEngine_getCapacityPreset, calcContainerLogistics, validateContainerLoad } from "../engines/oils/logisticsCapacityEngine.js";
import { runProfitSimulation, PROFIT_TARGET_MIN_USD, PROFIT_TARGET_MAX_USD, calcPriceAdjustmentNeeded } from "../engines/oils/profitSimulationEngine.js";
import { OIL_POUCH_TYPES, OIL_FILM_MATERIALS, OIL_SEAL_TYPES, OIL_POUCH_SIZES, OIL_FOOD_GRADE_LEVELS, OIL_OEM_CAPABILITIES, getOilPouchCartonOptions } from "../engines/oils/oilsPouchEngine.js";
import { PET_OIL_SIZES, getPetCartonOptions, getPetDefaultCarton } from "../engines/oils/petPackagingEngine.js";
import { INDUSTRIAL_FORMATS, getIndustrialFormat, calcIndustrialShipment, validateJerrycanMOQ } from "../engines/oils/jerrycanEngine.js";
import { createOilSku, autoPopulateSkuPrice, calcOilSkuValue, calcOilMultiSkuSummary, validateOilSku } from "../engines/oils/retailSkuEngine.js";
import { getCapacityPreset } from "../engines/oils/logisticsCapacityEngine.js";

// ─── Style helpers ────────────────────────────────────────────────────────────

const s = {
  panel:   { border: "1.5px solid #7c3aed", borderRadius: 12, marginTop: 14, overflow: "hidden", background: "#faf5ff" },
  header:  { background: "linear-gradient(135deg,#6d28d9,#7c3aed)", color: "#fff", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" },
  section: { padding: "12px 16px", borderBottom: "1px solid #e9d5ff" },
  label:   { fontSize: 11, fontWeight: 700, color: "#6d28d9", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "block" },
  row:     { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 },
  field:   { flex: 1, minWidth: 140 },
  select:  { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #c4b5fd", fontSize: 12, background: "#fff" },
  input:   { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #c4b5fd", fontSize: 12, background: "#fff", boxSizing: "border-box" },
  chip:    (active, color = "#7c3aed") => ({
    padding: "4px 12px", borderRadius: 16, fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400,
    border: active ? `2px solid ${color}` : "1px solid #ddd6fe",
    background: active ? color : "#faf5ff", color: active ? "#fff" : "#6d28d9",
  }),
  stat:    { background: "#fff", border: "1px solid #e9d5ff", borderRadius: 8, padding: "8px 12px", flex: 1, minWidth: 110 },
  statVal: { fontSize: 16, fontWeight: 800, color: "#1B2A4A", marginBottom: 2 },
  statLbl: { fontSize: 10, color: "#6d28d9", fontWeight: 600, textTransform: "uppercase" },
  badge:   (ok) => ({ display: "inline-block", padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: ok ? "#d1fae5" : "#fee2e2", color: ok ? "#065f46" : "#991b1b" }),
  sectionTitle: { fontSize: 12, fontWeight: 800, color: "#4c1d95", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  skuCard: { background: "#fff", border: "1.5px solid #ddd6fe", borderRadius: 8, padding: "10px 12px", marginBottom: 8 },
  addBtn:  { padding: "6px 14px", borderRadius: 8, background: "#7c3aed", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  rmBtn:   { padding: "3px 10px", borderRadius: 6, background: "#fee2e2", color: "#991b1b", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" },
};

const Sel = ({ label: lbl, value, onChange, options, placeholder = "—" }) => (
  <div style={s.field}>
    {lbl && <span style={s.label}>{lbl}</span>}
    <select style={s.select} value={value || ""} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.id || o} value={o.id || o}>{o.label || o}</option>
      ))}
    </select>
  </div>
);

const Inp = ({ label: lbl, value, onChange, type = "number", placeholder = "" }) => (
  <div style={s.field}>
    {lbl && <span style={s.label}>{lbl}</span>}
    <input style={s.input} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

const fmtUSD = (v) => v != null ? `$${Number(v).toFixed(2)}` : "—";
const fmtNum = (v) => v != null ? Number(v).toLocaleString() : "—";
const fmtPct = (v) => v != null ? `${v}%` : "—";

// ─── Packaging group resolver ─────────────────────────────────────────────────

const JERRY_IDS  = new Set(["JERRYCAN_20L","DRUM_200L","IBC_1000L","FLEXITANK","ISOTANK"]);
const POUCH_IDS  = new Set(["RETAIL_POUCH","DOYPACK","SPOUT_POUCH","PILLOW_POUCH","LAMINATED_POUCH","MULTILAYER_POUCH","FLEXIBLE_OIL_POUCH"]);

function resolveGroup(packagingType) {
  if (JERRY_IDS.has(packagingType)) return "JERRY";
  if (POUCH_IDS.has(packagingType)) return "POUCH";
  return "PET";
}

function getSizesForPackaging(packagingType) {
  const g = resolveGroup(packagingType);
  if (g === "POUCH")  return OIL_POUCH_SIZES;
  if (g === "JERRY")  return [{ id: "20L", label: "20 L" }];
  return PET_OIL_SIZES;
}

// ─── SKU Card component ───────────────────────────────────────────────────────

function OilSkuCard({ sku, onChange, onRemove }) {
  const sizes = getSizesForPackaging(sku.packagingType);
  const group = resolveGroup(sku.packagingType);

  const handleField = (k, v) => {
    let updated = { ...sku, [k]: v };
    if (k === "productId" || k === "packagingType" || k === "sizeId" || k === "incoterm") {
      updated = autoPopulateSkuPrice(updated);
    }
    if (k === "packagingType") {
      updated.sizeId = "";
      updated.pricePerUnit = 0;
    }
    onChange(updated);
  };

  const triplet = sku.productId && sku.packagingType && sku.sizeId
    ? getOilPriceTriplet(sku.productId, sku.packagingType, sku.sizeId)
    : null;

  const errors = validateOilSku(sku);
  const value  = calcOilSkuValue(sku);

  return (
    <div style={s.skuCard}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9" }}>SKU #{sku._id}</span>
        <button style={s.rmBtn} onClick={onRemove}>✕ Remove</button>
      </div>

      <div style={s.row}>
        <Sel label="Oil Type"      value={sku.productId}     onChange={v => handleField("productId", v)}     options={OIL_PRODUCTS} />
        <Sel label="Packaging"     value={sku.packagingType} onChange={v => handleField("packagingType", v)} options={OIL_PACKAGING_TYPES} />
        <Sel label="Size"          value={sku.sizeId}        onChange={v => handleField("sizeId", v)}        options={sizes} />
        <Sel label="Incoterm"      value={sku.incoterm}      onChange={v => handleField("incoterm", v)}      options={["FOB","CFR","CIF"]} />
      </div>
      <div style={s.row}>
        <Inp label="Price / Unit (USD)" value={sku.pricePerUnit}   onChange={v => handleField("pricePerUnit", parseFloat(v)||0)}   placeholder="0.00" />
        <Inp label="Quantity (units)"   value={sku.quantity}        onChange={v => handleField("quantity", parseFloat(v)||0)}        placeholder="0" />
        <Inp label="Units / Carton"     value={sku.unitsPerCarton}  onChange={v => handleField("unitsPerCarton", parseInt(v)||12)}   placeholder="12" />
      </div>

      {triplet && (
        <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          {["FOB","CFR","CIF"].map(inc => (
            <span key={inc} style={{ fontSize: 11, background: sku.incoterm === inc ? "#ede9fe" : "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 6, padding: "2px 8px", color: "#4c1d95", fontWeight: sku.incoterm === inc ? 700 : 400 }}>
              {inc} {fmtUSD(triplet[inc])}
            </span>
          ))}
          <span style={{ fontSize: 11, color: "#6d28d9", padding: "2px 8px" }}>
            Shipment: <strong>{fmtUSD(value)}</strong>
          </span>
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 10, color: "#991b1b" }}>
          {errors.map(e => <div key={e}>⚠ {e}</div>)}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {string} props.category          — must be "OILS" to render
 * @param {function} props.onChange        — callback({ oilsConfig }) called on every state change
 * @param {object} [props.initial]         — initial state for session restore
 */
export default function OilsExportPanel({ category, onChange, initial = {} }) {
  // Guard: only render for OILS category
  if (category !== "OILS") return null;

  const [open, setOpen]             = useState(true);
  const [productId, setProductId]   = useState(initial.productId     || "");
  const [market, setMarket]         = useState(initial.market         || "");
  const [incoterm, setIncoterm]     = useState(initial.incoterm       || "FOB");
  const [packagingType, setPkg]     = useState(initial.packagingType  || "PET_BOTTLE");
  const [sizeId, setSizeId]         = useState(initial.sizeId         || "");
  const [destination, setDest]      = useState(initial.destination    || "");
  const [moq, setMoq]               = useState(initial.moq            || "");
  const [exportMarginPct, setMargin] = useState(initial.exportMarginPct ?? 0.05);
  const [commissionPct, setCommission] = useState(initial.commissionPct ?? 0.02);
  const [agentPct, setAgent]        = useState(initial.agentPct       ?? 0.015);
  const [intermediaryPct, setInter] = useState(initial.intermediaryPct ?? 0.01);
  // Pouch-specific
  const [pouchType, setPouchType]   = useState(initial.pouchType      || "");
  const [filmMaterial, setFilm]     = useState(initial.filmMaterial   || "");
  const [sealType, setSeal]         = useState(initial.sealType       || "");
  const [foodGrade, setFoodGrade]   = useState(initial.foodGrade      || []);
  const [oemCaps, setOemCaps]       = useState(initial.oemCaps        || []);
  // Multi-SKU
  const [skus, setSkus]             = useState(initial.skus           || []);

  const group = resolveGroup(packagingType);
  const sizes = getSizesForPackaging(packagingType);
  const triplet = productId && packagingType && sizeId
    ? getOilPriceTriplet(productId, packagingType, sizeId) : null;
  const basePrice = triplet?.[incoterm] ?? 0;

  // Container logistics
  const capacity = sizeId ? getCapacityPreset(packagingType, sizeId) : null;
  const unitsPerContainer = capacity
    ? Math.round((capacity.unitsMin + capacity.unitsMax) / 2)
    : 0;

  // Freight / insurance
  const freightUSD   = destination ? calcContainerFreight(destination) : 0;
  const fobTotal     = basePrice * unitsPerContainer;
  const insuranceUSD = destination ? calcInsurance(fobTotal, destination) : 0;

  // Packaging cost
  const pkgCostPerUnit = sizeId ? getPackagingCostPerUnit(packagingType, sizeId) : 0;

  // Profit simulation
  const simulation = (basePrice && unitsPerContainer) ? runProfitSimulation({
    fobPricePerUnit:       basePrice,
    unitsPerContainer,
    packagingCostPerUnit:  pkgCostPerUnit,
    freightUSD,
    insuranceUSD,
    exportMarginPct,
    commissionReservePct:  commissionPct,
    agentReservePct:       agentPct,
    intermediaryReservePct: intermediaryPct,
  }) : null;

  // Multi-SKU summary
  const skuSummary = calcOilMultiSkuSummary(skus);

  const toggleChip = (arr, setArr, id) => {
    setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Propagate state to parent
  useEffect(() => {
    onChange?.({
      oilsConfig: {
        productId, market, incoterm, packagingType, sizeId, destination,
        moq, exportMarginPct, commissionPct, agentPct, intermediaryPct,
        pouchType, filmMaterial, sealType, foodGrade, oemCaps,
        skus, simulation, skuSummary,
        basePrice, freightUSD, insuranceUSD, pkgCostPerUnit,
        unitsPerContainer, triplet,
      },
    });
  }, [productId, market, incoterm, packagingType, sizeId, destination,
      moq, exportMarginPct, commissionPct, agentPct, intermediaryPct,
      pouchType, filmMaterial, sealType, foodGrade, oemCaps, skus]);

  return (
    <div style={s.panel}>
      {/* Header / toggle */}
      <div style={s.header} onClick={() => setOpen(o => !o)}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.5 }}>🛢 GLOBAL PRICE CENTER V8 — OILS</span>
          <span style={{ marginLeft: 12, fontSize: 11, opacity: 0.85 }}>Enterprise Export Engine</span>
        </div>
        <span style={{ fontSize: 16 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <>
          {/* ── Section 1: Product + Market + Incoterm ──────────────────── */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Commercial Configuration</div>
            <div style={s.row}>
              <Sel label="Oil Type"       value={productId}    onChange={setProductId}  options={OIL_PRODUCTS} />
              <Sel label="Export Market"  value={market}       onChange={setMarket}     options={MARKET_IDS.map(id => ({ id, label: MARKET_SEGMENTS[id].label }))} />
              <Sel label="Incoterm"       value={incoterm}     onChange={setIncoterm}   options={["FOB","CFR","CIF"]} />
            </div>
            <div style={s.row}>
              <Inp label="MOQ (units)"       value={moq}            onChange={setMoq}    placeholder={getMarketMOQ(market) || "22000"} />
              <Inp label="Export Margin %"   value={Math.round(exportMarginPct * 100)} onChange={v => setMargin(parseFloat(v)/100||0)} placeholder="5" />
              <Inp label="Commission %"      value={Math.round(commissionPct * 100)}   onChange={v => setCommission(parseFloat(v)/100||0)} placeholder="2" />
              <Inp label="Agent Reserve %"   value={Math.round(agentPct * 100)}        onChange={v => setAgent(parseFloat(v)/100||0)} placeholder="1.5" />
            </div>
          </div>

          {/* ── Section 2: Packaging Configuration ─────────────────────── */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Packaging Configuration</div>
            <div style={s.row}>
              <Sel label="Packaging Type" value={packagingType} onChange={v => { setPkg(v); setSizeId(""); }} options={OIL_PACKAGING_TYPES} />
              <Sel label="Size"           value={sizeId}        onChange={setSizeId}                          options={sizes} />
            </div>

            {/* Pouch-specific fields */}
            {group === "POUCH" && (
              <>
                <div style={s.row}>
                  <Sel label="Pouch Type"     value={pouchType}    onChange={setPouchType}  options={OIL_POUCH_TYPES} />
                  <Sel label="Film Material"  value={filmMaterial} onChange={setFilm}       options={OIL_FILM_MATERIALS} />
                  <Sel label="Seal Type"      value={sealType}     onChange={setSeal}       options={OIL_SEAL_TYPES} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={s.label}>Food Grade / Certifications</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {OIL_FOOD_GRADE_LEVELS.map(c => (
                      <button key={c.id} type="button" style={s.chip(foodGrade.includes(c.id))} onClick={() => toggleChip(foodGrade, setFoodGrade, c.id)}>{c.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span style={s.label}>OEM / Capabilities</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {OIL_OEM_CAPABILITIES.map(o => (
                      <button key={o.id} type="button" style={s.chip(oemCaps.includes(o.id))} onClick={() => toggleChip(oemCaps, setOemCaps, o.id)}>{o.label}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Logistics capacity display */}
            {capacity && sizeId && (
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <div style={s.stat}><div style={s.statVal}>{fmtNum(capacity.unitsMin)}–{fmtNum(capacity.unitsMax)}</div><div style={s.statLbl}>Units / 40HQ</div></div>
                <div style={s.stat}><div style={s.statVal}>{capacity.unitsPerCarton}</div><div style={s.statLbl}>Units / Carton</div></div>
                <div style={s.stat}><div style={s.statVal}>{capacity.cartonsPerPallet}</div><div style={s.statLbl}>Cartons / Pallet</div></div>
                <div style={s.stat}><div style={s.statVal}>{capacity.pallets}</div><div style={s.statLbl}>Pallets / Container</div></div>
              </div>
            )}
          </div>

          {/* ── Section 3: Price Center ─────────────────────────────────── */}
          {triplet && (
            <div style={{ ...s.section, background: "#f5f3ff" }}>
              <div style={s.sectionTitle}>Price Center</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["FOB","CFR","CIF"].map(inc => (
                  <div key={inc} style={{ ...s.stat, border: incoterm === inc ? "2px solid #7c3aed" : "1px solid #e9d5ff" }}>
                    <div style={{ ...s.statVal, color: incoterm === inc ? "#6d28d9" : "#1B2A4A" }}>{fmtUSD(triplet[inc])}</div>
                    <div style={s.statLbl}>{inc} / unit</div>
                  </div>
                ))}
                <div style={s.stat}>
                  <div style={s.statVal}>{fmtPct(calcFreightRatioPct(productId, packagingType, sizeId))}</div>
                  <div style={s.statLbl}>Freight ratio</div>
                </div>
                <div style={s.stat}>
                  <div style={s.statVal}>{fmtPct(calcInsuranceRatioPct(productId, packagingType, sizeId))}</div>
                  <div style={s.statLbl}>Insurance ratio</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Section 4: Destination + Freight ───────────────────────── */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Destination & Freight</div>
            <div style={s.row}>
              <Sel label="Destination" value={destination} onChange={setDest}
                options={DESTINATIONS.map(d => ({ id: d, label: DESTINATION_MATRIX[d].label }))} />
            </div>
            {destination && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                <div style={s.stat}><div style={s.statVal}>{fmtUSD(freightUSD)}</div><div style={s.statLbl}>Freight / Container</div></div>
                <div style={s.stat}><div style={s.statVal}>{fmtUSD(insuranceUSD)}</div><div style={s.statLbl}>Insurance</div></div>
                <div style={s.stat}><div style={s.statVal}>{DESTINATION_MATRIX[destination]?.market}</div><div style={s.statLbl}>Market Segment</div></div>
              </div>
            )}
          </div>

          {/* ── Section 5: Profit Simulation ────────────────────────────── */}
          {simulation && (
            <div style={{ ...s.section, background: simulation.meetsTarget ? "#f0fdf4" : "#fff7ed" }}>
              <div style={{ ...s.sectionTitle, color: simulation.meetsTarget ? "#065f46" : "#92400e" }}>
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
                    : `⚠ BELOW TARGET — Adjust price by ${fmtUSD(Math.abs(calcPriceAdjustmentNeeded(simulation, unitsPerContainer)))} / unit to reach minimum`}
                </span>
              </div>
            </div>
          )}

          {/* ── Section 6: Multi-SKU Retail Export ──────────────────────── */}
          <div style={{ ...s.section, borderBottom: "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={s.sectionTitle}>Multi-SKU Retail Export</div>
              <button style={s.addBtn} onClick={() => setSkus(prev => [...prev, createOilSku()])}>+ Add SKU</button>
            </div>

            {skus.length === 0 && (
              <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Add SKUs to configure a multi-size retail export order.</p>
            )}

            {skus.map(sku => (
              <OilSkuCard
                key={sku._id}
                sku={sku}
                onChange={updated => setSkus(prev => prev.map(s => s._id === updated._id ? updated : s))}
                onRemove={() => setSkus(prev => prev.filter(s => s._id !== sku._id))}
              />
            ))}

            {skuSummary && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, padding: "10px 12px", background: "#ede9fe", borderRadius: 8 }}>
                <div style={s.stat}><div style={s.statVal}>{fmtUSD(skuSummary.totalFOB)}</div><div style={s.statLbl}>Total FOB</div></div>
                <div style={s.stat}><div style={s.statVal}>{fmtNum(skuSummary.totalUnits)}</div><div style={s.statLbl}>Total Units</div></div>
                <div style={s.stat}><div style={s.statVal}>{fmtUSD(skuSummary.totalPackaging)}</div><div style={s.statLbl}>Packaging Cost</div></div>
                <div style={s.stat}><div style={s.statVal}>{skuSummary.skuCount}</div><div style={s.statLbl}>SKUs</div></div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
