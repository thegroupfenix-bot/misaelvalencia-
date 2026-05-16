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
 * Calculate total KG from live animal fields.
 * headCount × avgWeight × (1 - mortalityMargin/100)
 */
export function calcLiveAnimalKg({ headCount, avgWeight, mortalityMargin = 0 }) {
  const head = parseFloat(headCount) || 0;
  const wgt  = parseFloat(avgWeight) || 0;
  const mort = parseFloat(mortalityMargin) || 0;
  return head * wgt * (1 - mort / 100);
}

/**
 * Per-shipment value based on category and form data.
 */
export function calcShipmentValue({
  category,
  quantity,
  unitType,
  unitPrice,
  currency = "USD",
  // Live animal extra
  headCount,
  avgWeight,
  mortalityMargin,
  // Container
  containerCapacity,
}) {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;

  if (!price) return 0;

  switch (category) {
    case "LIVE_ANIMALS": {
      const kg = calcLiveAnimalKg({ headCount, avgWeight, mortalityMargin });
      return kg * price;
    }
    case "COMMODITIES":
    case "OILS":
    case "FROZEN_MEAT":
    case "FRUIT_PRODUCTS": {
      if (unitType?.includes("Container") || unitType?.includes("Contenedor")) {
        const cap = parseFloat(containerCapacity) || 27;
        return qty * cap * 1000 * price; // containers × MT × 1000kg × price/kg
      }
      if (unitType?.includes("MT") || unitType?.includes("Tonelada")) {
        return qty * 1000 * price; // MT → kg × price/kg
      }
      return qty * price; // KG or unit
    }
    case "EGGS": {
      return qty * price; // price per unit
    }
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
  numShipments,     // for CUSTOM frequency
  contractDuration, // in months
  headCount,
  avgWeight,
  mortalityMargin,
  containerCapacity,
}) {
  const shipmentValue = calcShipmentValue({
    category, quantity, unitType, unitPrice, currency,
    headCount, avgWeight, mortalityMargin, containerCapacity,
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
  if (category === "LIVE_ANIMALS") {
    liveAnimalKg = calcLiveAnimalKg({ headCount, avgWeight, mortalityMargin });
  }

  return {
    shipmentValue,
    monthlyValue,
    contractValue,
    shipmentsPerYear,
    durationMonths,
    containers,
    liveAnimalKg,
    currency,
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
