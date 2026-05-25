// Commercial Calculation Engine — GLV SAT v3
// All monetary values returned in the selected currency.

const FREQ_MULTIPLIERS = {
  ONE_SHIPMENT: 1,
  MONTHLY:      12,
  BIMONTHLY:    6,
  QUARTERLY:    4,
  CUSTOM:       1, // user provides num_shipments directly
};

/**
 * GLV policy: mortality is buyer responsibility, covered by buyer insurance.
 * Seller invoices on certified loaded quantity. No mortality deduction from commercial totals.
 * LOT WEIGHT = headCount × avgWeight (gross loaded weight)
 */
export function calcLiveAnimalKg({ headCount, avgWeight }) {
  const head = parseFloat(headCount) || 0;
  const wgt  = parseFloat(avgWeight) || 0;
  return head * wgt;
}

/**
 * Per-shipment value based on category and form data.
 *
 * Extended for V5 liquid/packaged engine:
 *   commercialUnit — pricing mode (perKg|perMT|perLiter|perBox|perUnit|perContainer|perDrum|perJerrycan|perBottle|perPallet)
 *   unitsPerBox    — number of bottles/units per export carton (box engine)
 *   netWeightPerUnit — net weight in kg per individual unit (box engine, weight-priced products)
 *
 * LIVE_ANIMALS path is completely isolated — not affected by any V5 params.
 */
export function calcShipmentValue({
  category,
  quantity,
  unitType,
  unitPrice,
  currency = "USD",
  // Live animal extra — untouched
  headCount,
  avgWeight,
  mortalityMargin,
  // Container
  containerCapacity,
  // V5 liquid/packaged engine
  commercialUnit,
  unitsPerBox,
  netWeightPerUnit,
}) {
  const qty   = parseFloat(quantity)  || 0;
  const price = parseFloat(unitPrice) || 0;

  if (!price) return 0;

  // ── LIVE_ANIMALS: isolated, zero changes ──────────────────────────────────
  if (category === "LIVE_ANIMALS") {
    const kg = calcLiveAnimalKg({ headCount, avgWeight, mortalityMargin });
    return kg * price;
  }

  // ── V5: explicit commercial unit pricing ──────────────────────────────────
  if (commercialUnit && commercialUnit !== "perKg") {
    const upb = parseFloat(unitsPerBox)      || 0;
    const nwu = parseFloat(netWeightPerUnit) || 0;

    switch (commercialUnit) {
      case "perMT":
        // qty in MT, price per MT
        return qty * price;
      case "perLiter":
        // qty in liters, price per liter
        return qty * price;
      case "perBox":
        // qty = number of export cartons/boxes, price per box
        return qty * price;
      case "perUnit":
      case "perBottle":
        // qty = total units/bottles (or qty × unitsPerBox if box engine)
        if (upb > 0) return qty * upb * price;
        return qty * price;
      case "perDrum":
      case "perJerrycan":
      case "perIBC":
      case "perFlexitank":
        // qty = number of drums/jerrycans/IBCs/flexitanks, price per unit
        return qty * price;
      case "perPallet":
        // qty = pallets, price per pallet
        return qty * price;
      case "perContainer":
        // qty = containers, price per container
        return qty * price;
      default:
        break;
    }
  }

  // ── V5: perKg with box engine (cartons × units × weight × price/kg) ───────
  if ((!commercialUnit || commercialUnit === "perKg")) {
    const upb = parseFloat(unitsPerBox)      || 0;
    const nwu = parseFloat(netWeightPerUnit) || 0;
    if (upb > 0 && nwu > 0) {
      // Box engine: qty = number of boxes → total kg = qty × upb × nwu
      const totalKg = qty * upb * nwu;
      return totalKg * price;
    }
  }

  // ── Standard weight/container logic (backward compatible) ─────────────────
  switch (category) {
    case "COMMODITIES":
    case "OILS":
    case "FROZEN_MEAT":
    case "FROZEN_POULTRY":
    case "CANNED_MEAT":
    case "BEANS":
    case "LENTILS":
    case "CHICKPEAS":
    case "ANIMAL_FEED":
    case "COLOMBIAN_EXOTIC_FRUITS":
    case "FRUIT_PRODUCTS": {
      if (unitType?.includes("Container") || unitType?.includes("Contenedor")) {
        const cap = parseFloat(containerCapacity) || 27;
        return qty * cap * 1000 * price;
      }
      if (unitType?.includes("MT") || unitType?.includes("Tonelada")) {
        return qty * 1000 * price;
      }
      return qty * price;
    }
    case "EGGS":
      return qty * price;
    default:
      return qty * price;
  }
}

/**
 * Convert quantity to containers based on container capacity.
 */
export function calcContainers(quantityMT, containerCapacityMT = 27) {
  const qty = parseFloat(quantityMT) || 0;
  const cap = parseFloat(containerCapacityMT) || 27;
  if (!qty || !cap) return null;
  return { containers: Math.ceil(qty / cap), exact: qty / cap };
}

/**
 * Full commercial summary calculation.
 */
export function calcCommercialSummary({
  category,
  quantity,
  unitType,
  unitPrice,
  currency = "USD",
  deliveryFrequency = "MONTHLY",
  numShipments,
  contractDuration,
  headCount,
  avgWeight,
  mortalityMargin,
  containerCapacity,
  // V5 liquid/packaged engine
  commercialUnit,
  unitsPerBox,
  netWeightPerUnit,
  containerType,
}) {
  const shipmentValue = calcShipmentValue({
    category, quantity, unitType, unitPrice, currency,
    headCount, avgWeight, mortalityMargin, containerCapacity,
    commercialUnit, unitsPerBox, netWeightPerUnit,
  });

  let shipmentsPerYear;
  if (deliveryFrequency === "CUSTOM") {
    shipmentsPerYear = parseFloat(numShipments) || 1;
  } else {
    shipmentsPerYear = FREQ_MULTIPLIERS[deliveryFrequency] || 1;
  }

  const monthlyValue = deliveryFrequency === "ONE_SHIPMENT"
    ? shipmentValue
    : shipmentValue * (shipmentsPerYear / 12);

  const durationMonths = parseFloat(contractDuration) || 12;
  const contractValue  = monthlyValue * durationMonths;

  // Container conversion
  let containers = null;
  if (quantity && containerCapacity && !String(unitType).includes("Container")) {
    const qtMT = unitType?.includes("MT") || unitType?.includes("Tonelada")
      ? parseFloat(quantity)
      : (parseFloat(quantity) || 0) / 1000;
    if (qtMT > 0) containers = calcContainers(qtMT, containerCapacity);
  }

  // Live animal breakdown
  let liveAnimalKg = null;
  let lotWeightGross = null;
  let totalShipments = null;
  let totalContractHeadcount = null;
  let totalContractWeight = null;
  let annualValue = null;

  if (category === "LIVE_ANIMALS") {
    const hc = parseFloat(headCount) || 0;
    const aw = parseFloat(avgWeight) || 0;
    liveAnimalKg     = calcLiveAnimalKg({ headCount, avgWeight });
    lotWeightGross   = hc * aw;
    totalShipments   = deliveryFrequency === "ONE_SHIPMENT" ? 1
                     : Math.round(shipmentsPerYear * (durationMonths / 12));
    totalContractHeadcount = hc * totalShipments;
    totalContractWeight    = totalContractHeadcount * aw; // loaded contractual weight, no mortality deduction
    annualValue            = shipmentValue * shipmentsPerYear;
  }

  // V5: resolve total liters/kg for liquid display
  const upb = parseFloat(unitsPerBox) || 0;
  const nwu = parseFloat(netWeightPerUnit) || 0;
  const qty = parseFloat(quantity) || 0;
  const totalUnits = upb > 0 ? qty * upb : null;
  const totalNetKg = upb > 0 && nwu > 0 ? qty * upb * nwu : null;

  return {
    shipmentValue,
    monthlyValue,
    contractValue,
    shipmentsPerYear,
    durationMonths,
    containers,
    containerType: containerType || null,
    liveAnimalKg,
    lotWeightGross,
    totalShipments,
    totalContractHeadcount,
    totalContractWeight,
    annualValue,
    currency,
    // V5 packaged engine extras
    commercialUnit: commercialUnit || null,
    totalUnits,
    totalNetKg,
  };
}

/**
 * Format currency value with symbol.
 */
export function fmtMoney(value, currency = "USD", compact = false) {
  if (!value && value !== 0) return "—";
  const opts = { style: "currency", currency, maximumFractionDigits: 0 };
  if (compact && Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + "M " + currency;
  }
  return new Intl.NumberFormat("en-US", opts).format(value);
}

/**
 * Format a number with thousands separators.
 */
export function fmtNum(value, decimals = 0) {
  if (!value && value !== 0) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(value);
}

/**
 * Convert a quantity to kg based on the unit type string.
 * MT/Tonelada → qty × 1000; Container/Contenedor → qty × 27,000; else identity.
 */
export function normalizeToKg(qty, unitType) {
  const q = parseFloat(qty) || 0;
  if (!q) return 0;
  if (unitType?.includes("Container") || unitType?.includes("Contenedor")) return q * 27 * 1000;
  if (unitType?.includes("MT") || unitType?.includes("Tonelada")) return q * 1000;
  return q;
}
