/**
 * profitSimulationEngine.js — V8.0 Export Oils Profit Simulation Engine
 * Target: USD 4,500 – 6,000 net profit / 40HQ container.
 * Isolated. No LIVE_ANIMALS / frozen cargo coupling.
 */

// ─── Profit target thresholds ─────────────────────────────────────────────────

export const PROFIT_TARGET_MIN_USD = 4500;
export const PROFIT_TARGET_MAX_USD = 6000;

// ─── Reserve structure ────────────────────────────────────────────────────────

export const DEFAULT_RESERVES = {
  exportMarginPct:      0.05,  // 5%  of FOB
  commissionReservePct: 0.02,  // 2%  of FOB
  agentReservePct:      0.015, // 1.5% of FOB
  intermediaryReservePct: 0.01,// 1%  of FOB
};

// ─── Core simulation ──────────────────────────────────────────────────────────

/**
 * Run a full profit simulation for one container.
 *
 * @param {object} p
 * @param {number} p.fobPricePerUnit      — USD/unit from price matrix
 * @param {number} p.unitsPerContainer
 * @param {number} p.packagingCostPerUnit  — USD/unit
 * @param {number} p.freightUSD            — total ocean freight for the container
 * @param {number} p.insuranceUSD          — total insurance for the container
 * @param {number} [p.exportMarginPct]
 * @param {number} [p.commissionReservePct]
 * @param {number} [p.agentReservePct]
 * @param {number} [p.intermediaryReservePct]
 * @param {number} [p.productionCostPerUnit] — optional COGS per unit
 * @returns {SimulationResult}
 */
export function runProfitSimulation({
  fobPricePerUnit,
  unitsPerContainer,
  packagingCostPerUnit = 0,
  freightUSD = 0,
  insuranceUSD = 0,
  exportMarginPct      = DEFAULT_RESERVES.exportMarginPct,
  commissionReservePct = DEFAULT_RESERVES.commissionReservePct,
  agentReservePct      = DEFAULT_RESERVES.agentReservePct,
  intermediaryReservePct = DEFAULT_RESERVES.intermediaryReservePct,
  productionCostPerUnit = 0,
}) {
  const totalFOB        = fobPricePerUnit * unitsPerContainer;
  const totalPackaging  = packagingCostPerUnit * unitsPerContainer;
  const totalProduction = productionCostPerUnit * unitsPerContainer;

  const exportMargin      = totalFOB * exportMarginPct;
  const commissionReserve = totalFOB * commissionReservePct;
  const agentReserve      = totalFOB * agentReservePct;
  const intermediaryReserve = totalFOB * intermediaryReservePct;
  const totalReserves     = exportMargin + commissionReserve + agentReserve + intermediaryReserve;

  const totalCost  = totalPackaging + totalProduction + freightUSD + insuranceUSD + totalReserves;
  const grossProfit = totalFOB - totalPackaging - totalProduction;
  const netProfit   = totalFOB - totalCost;
  const marginPct   = totalFOB > 0 ? parseFloat((netProfit / totalFOB * 100).toFixed(2)) : 0;

  const freightRatioPct    = totalFOB > 0 ? parseFloat((freightUSD / totalFOB * 100).toFixed(2)) : 0;
  const packagingRatioPct  = totalFOB > 0 ? parseFloat((totalPackaging / totalFOB * 100).toFixed(2)) : 0;
  const logisticsRatioPct  = totalFOB > 0 ? parseFloat(((freightUSD + insuranceUSD) / totalFOB * 100).toFixed(2)) : 0;
  const reserveRatioPct    = totalFOB > 0 ? parseFloat((totalReserves / totalFOB * 100).toFixed(2)) : 0;
  const salesEfficiency    = totalFOB > 0 ? parseFloat((netProfit / (freightUSD || 1)).toFixed(2)) : 0;

  const meetsTarget = netProfit >= PROFIT_TARGET_MIN_USD && netProfit <= PROFIT_TARGET_MAX_USD;
  const targetDelta = parseFloat((netProfit - PROFIT_TARGET_MIN_USD).toFixed(2));

  return {
    totalFOB:              parseFloat(totalFOB.toFixed(2)),
    totalPackaging:        parseFloat(totalPackaging.toFixed(2)),
    totalProduction:       parseFloat(totalProduction.toFixed(2)),
    freightUSD:            parseFloat(freightUSD.toFixed(2)),
    insuranceUSD:          parseFloat(insuranceUSD.toFixed(2)),
    exportMargin:          parseFloat(exportMargin.toFixed(2)),
    commissionReserve:     parseFloat(commissionReserve.toFixed(2)),
    agentReserve:          parseFloat(agentReserve.toFixed(2)),
    intermediaryReserve:   parseFloat(intermediaryReserve.toFixed(2)),
    totalReserves:         parseFloat(totalReserves.toFixed(2)),
    totalCost:             parseFloat(totalCost.toFixed(2)),
    grossProfit:           parseFloat(grossProfit.toFixed(2)),
    netProfit:             parseFloat(netProfit.toFixed(2)),
    marginPct,
    freightRatioPct,
    packagingRatioPct,
    logisticsRatioPct,
    reserveRatioPct,
    salesEfficiency,
    meetsTarget,
    targetDelta,
    targetMin: PROFIT_TARGET_MIN_USD,
    targetMax: PROFIT_TARGET_MAX_USD,
  };
}

/**
 * Quick check: does this configuration produce a profitable container?
 */
export function isContainerProfitable(simulation) {
  return simulation?.netProfit >= PROFIT_TARGET_MIN_USD;
}

/**
 * Suggest required FOB adjustment to hit minimum profit target.
 * Returns positive = needs price increase, negative = has headroom.
 */
export function calcPriceAdjustmentNeeded(simulation, unitsPerContainer) {
  if (!simulation || !unitsPerContainer) return 0;
  const gap = PROFIT_TARGET_MIN_USD - simulation.netProfit;
  return parseFloat((gap / unitsPerContainer).toFixed(4));
}
