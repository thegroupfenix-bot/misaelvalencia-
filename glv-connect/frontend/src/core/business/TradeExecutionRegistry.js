/**
 * TradeExecutionRegistry.js
 * Trade program type registry.
 * GLV_BUSINESS_OPERATING_MODEL_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// TRADE_PROGRAM_TYPES (frozen enum)
// ---------------------------------------------------------------------------
export const TRADE_PROGRAM_TYPES = Object.freeze({
  CONTAINER_PROGRAM: 'CONTAINER_PROGRAM',
  BULK_VESSEL_PROGRAM: 'BULK_VESSEL_PROGRAM',
});

// ---------------------------------------------------------------------------
// CONTAINER_TYPES (frozen enum)
// ---------------------------------------------------------------------------
export const CONTAINER_TYPES = Object.freeze({
  FCL_20: 'FCL_20',
  FCL_40: 'FCL_40',
  FCL_40HC: 'FCL_40HC',
  LCL: 'LCL',
  REEFER_20: 'REEFER_20',
  REEFER_40: 'REEFER_40',
});

// ---------------------------------------------------------------------------
// VESSEL_CLASSES (frozen object with metadata — not a simple string enum)
// ---------------------------------------------------------------------------
export const VESSEL_CLASSES = Object.freeze({
  HANDYMAX: Object.freeze({ key: 'HANDYMAX', label: 'Handymax', minMT: 25000, maxMT: 40000 }),
  SUPRAMAX: Object.freeze({ key: 'SUPRAMAX', label: 'Supramax', minMT: 40000, maxMT: 60000 }),
  PANAMAX: Object.freeze({ key: 'PANAMAX', label: 'Panamax', minMT: 60000, maxMT: 80000 }),
  CAPESIZE: Object.freeze({ key: 'CAPESIZE', label: 'Capesize', minMT: 80000, maxMT: null }),
});

// ---------------------------------------------------------------------------
// INCOTERMS (frozen enum)
// ---------------------------------------------------------------------------
export const INCOTERMS = Object.freeze({
  EXW: 'EXW',
  FCA: 'FCA',
  FAS: 'FAS',
  FOB: 'FOB',
  CFR: 'CFR',
  CIF: 'CIF',
  CPT: 'CPT',
  CIP: 'CIP',
  DAP: 'DAP',
  DPU: 'DPU',
  DDP: 'DDP',
});

// ---------------------------------------------------------------------------
// TRADE_EXECUTION_STATUS (frozen enum)
// ---------------------------------------------------------------------------
export const TRADE_EXECUTION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  LOADING: 'LOADING',
  IN_TRANSIT: 'IN_TRANSIT',
  AT_PORT: 'AT_PORT',
  CUSTOMS_CLEARANCE: 'CUSTOMS_CLEARANCE',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  DISPUTED: 'DISPUTED',
  CANCELLED: 'CANCELLED',
});

// ---------------------------------------------------------------------------
// getVesselClass(totalMT)
// Iterates VESSEL_CLASSES, returns matching entry or null if totalMT < 25000.
// ---------------------------------------------------------------------------
export function getVesselClass(totalMT) {
  if (typeof totalMT !== 'number' || totalMT < 25000) {
    return null;
  }

  // CAPESIZE has no maxMT — check it last
  const ordered = [
    VESSEL_CLASSES.HANDYMAX,
    VESSEL_CLASSES.SUPRAMAX,
    VESSEL_CLASSES.PANAMAX,
    VESSEL_CLASSES.CAPESIZE,
  ];

  for (const vesselClass of ordered) {
    const withinMin = totalMT >= vesselClass.minMT;
    const withinMax = vesselClass.maxMT === null || totalMT < vesselClass.maxMT;
    if (withinMin && withinMax) {
      return vesselClass;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// getTradeProgram(totalMT)
// Returns CONTAINER_PROGRAM if totalMT < 25000, else BULK_VESSEL_PROGRAM.
// ---------------------------------------------------------------------------
export function getTradeProgram(totalMT) {
  if (typeof totalMT !== 'number') {
    throw new Error(`getTradeProgram: totalMT must be a number, got "${typeof totalMT}"`);
  }
  return totalMT < 25000
    ? TRADE_PROGRAM_TYPES.CONTAINER_PROGRAM
    : TRADE_PROGRAM_TYPES.BULK_VESSEL_PROGRAM;
}
