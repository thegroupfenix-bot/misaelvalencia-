/**
 * commercialCore.js — V9 Enterprise Commercial Calculation Bridge
 *
 * Shared calculation primitives used by all category PDF adapters.
 * No category-specific business logic here — pure math and currency helpers.
 * Fully isolated: no imports from LIVE_ANIMALS, frozen cargo, or category engines.
 */

// ─── Currency helpers ─────────────────────────────────────────────────────────

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AED", "SAR", "BRL"];

export function fmtCurrency(amount, currency = "USD", decimals = 2) {
  if (amount == null || isNaN(amount)) return "—";
  return `${currency} ${Number(amount).toFixed(decimals)}`;
}

export function fmtNumber(n, decimals = 0) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ─── Incoterm price resolution ────────────────────────────────────────────────

/**
 * Resolve the operative price given an incoterm selection and a price triplet.
 * @param {"FOB"|"CFR"|"CIF"} incoterm
 * @param {{ FOB: number, CFR: number, CIF: number }} triplet
 * @returns {number}
 */
export function resolveIncotermPrice(incoterm, triplet) {
  if (!triplet) return 0;
  return triplet[incoterm] ?? triplet.FOB ?? 0;
}

// ─── Shipment value calculations ──────────────────────────────────────────────

/**
 * Total FOB value for a single-SKU shipment.
 */
export function calcFOBTotal({ pricePerUnit = 0, unitsPerContainer = 0 }) {
  return pricePerUnit * unitsPerContainer;
}

/**
 * Total CFR value.
 */
export function calcCFRTotal({ fobTotal = 0, freightUSD = 0 }) {
  return fobTotal + freightUSD;
}

/**
 * Total CIF value.
 */
export function calcCIFTotal({ cfrTotal = 0, insuranceUSD = 0 }) {
  return cfrTotal + insuranceUSD;
}

/**
 * Resolve shipment total based on incoterm.
 */
export function resolveShipmentTotal({ incoterm, fobTotal, freightUSD, insuranceUSD }) {
  const cfrTotal = calcCFRTotal({ fobTotal, freightUSD });
  const cifTotal = calcCIFTotal({ cfrTotal, insuranceUSD });
  if (incoterm === "CIF") return cifTotal;
  if (incoterm === "CFR") return cfrTotal;
  return fobTotal;
}

// ─── Margin and reserve calculations ─────────────────────────────────────────

/**
 * Gross profit = total revenue - COGS.
 */
export function calcGrossProfit({ revenueTotal = 0, packagingCostTotal = 0, freightUSD = 0, insuranceUSD = 0 }) {
  return revenueTotal - packagingCostTotal - freightUSD - insuranceUSD;
}

/**
 * Reserve deductions from gross profit.
 */
export function calcTotalReserves({
  grossProfit = 0,
  exportMarginPct = 0,
  commissionReservePct = 0,
  agentReservePct = 0,
  intermediaryReservePct = 0,
}) {
  return grossProfit * (exportMarginPct + commissionReservePct + agentReservePct + intermediaryReservePct);
}

/**
 * Net profit after reserves.
 */
export function calcNetProfit({ grossProfit = 0, totalReserves = 0 }) {
  return grossProfit - totalReserves;
}

/**
 * Margin percentage of revenue.
 */
export function calcMarginPct({ netProfit = 0, revenueTotal = 1 }) {
  if (!revenueTotal) return 0;
  return Math.round((netProfit / revenueTotal) * 1000) / 10;
}

// ─── Multi-SKU aggregation ────────────────────────────────────────────────────

/**
 * Aggregate multiple SKU line items into a summary.
 * Each item: { pricePerUnit, quantity, packagingCostPerUnit }
 */
export function aggregateSkuLines(items = []) {
  let totalRevenue = 0;
  let totalUnits   = 0;
  let totalPkgCost = 0;
  for (const item of items) {
    const qty  = item.quantity      || 0;
    const rev  = (item.pricePerUnit || 0) * qty;
    const pkg  = (item.packagingCostPerUnit || 0) * qty;
    totalRevenue += rev;
    totalUnits   += qty;
    totalPkgCost += pkg;
  }
  return { totalRevenue, totalUnits, totalPkgCost, skuCount: items.length };
}

// ─── Normalized payload shape ─────────────────────────────────────────────────

/**
 * Canonical payload shape consumed by GlvPDF.
 * All fields nullable — PDF adapters fill what they know.
 */
export function createEmptyNormalizedPayload() {
  return {
    // Meta
    category: null,
    productLabel: null,
    exportFormat: null,

    // Pricing
    incoterm: null,
    pricePerUnit: null,
    currency: "USD",
    triplet: null,

    // Volume
    unitsPerContainer: null,
    containerType: null,
    packagingType: null,
    sizeId: null,
    unitsPerCarton: null,

    // Logistics
    destination: null,
    freightUSD: null,
    insuranceUSD: null,

    // Totals
    fobTotal: null,
    cfrTotal: null,
    cifTotal: null,
    shipmentTotal: null,
    packagingCostPerUnit: null,
    packagingCostTotal: null,

    // Commercial terms
    moq: null,
    frequency: null,
    contractDuration: null,
    shelfLife: null,
    origin: null,
    certifications: [],

    // Technical spec (oils)
    grade: null,
    gmoStatus: null,
    oilProductId: null,

    // Admin financials (only present when canFinance)
    simulation: null,

    // Multi-SKU
    skus: [],
    skuSummary: null,

    // Source row (for debugging / traceability)
    _sourceCategory: null,
    _adapterVersion: null,
  };
}
