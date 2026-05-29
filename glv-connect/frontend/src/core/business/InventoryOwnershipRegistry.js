/**
 * InventoryOwnershipRegistry.js
 * Inventory ownership model.
 * GLV_BUSINESS_OPERATING_MODEL_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// INVENTORY_OWNERSHIP (frozen enum)
// ---------------------------------------------------------------------------
export const INVENTORY_OWNERSHIP = Object.freeze({
  SUPPLIER: 'SUPPLIER',
  GLV_CONTROLLED: 'GLV_CONTROLLED',
  IN_TRANSIT: 'IN_TRANSIT',
  PORT: 'PORT',
  QUARANTINE: 'QUARANTINE',
  WAREHOUSE: 'WAREHOUSE',
});

// ---------------------------------------------------------------------------
// INVENTORY_STATUS (frozen enum)
// ---------------------------------------------------------------------------
export const INVENTORY_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  COMMITTED: 'COMMITTED',
  IN_TRANSIT: 'IN_TRANSIT',
  HELD: 'HELD',
  RELEASED: 'RELEASED',
  CONSUMED: 'CONSUMED',
  DAMAGED: 'DAMAGED',
  LOST: 'LOST',
});

// ---------------------------------------------------------------------------
// OWNERSHIP_TRANSITIONS (frozen)
// Maps each ownership type to valid next ownership types.
// ---------------------------------------------------------------------------
export const OWNERSHIP_TRANSITIONS = Object.freeze({
  [INVENTORY_OWNERSHIP.SUPPLIER]: Object.freeze([
    INVENTORY_OWNERSHIP.GLV_CONTROLLED,
  ]),

  [INVENTORY_OWNERSHIP.GLV_CONTROLLED]: Object.freeze([
    INVENTORY_OWNERSHIP.IN_TRANSIT,
    INVENTORY_OWNERSHIP.WAREHOUSE,
    INVENTORY_OWNERSHIP.QUARANTINE,
  ]),

  [INVENTORY_OWNERSHIP.IN_TRANSIT]: Object.freeze([
    INVENTORY_OWNERSHIP.PORT,
    INVENTORY_OWNERSHIP.WAREHOUSE,
    INVENTORY_OWNERSHIP.QUARANTINE,
  ]),

  [INVENTORY_OWNERSHIP.PORT]: Object.freeze([
    INVENTORY_OWNERSHIP.WAREHOUSE,
    INVENTORY_OWNERSHIP.QUARANTINE,
    INVENTORY_OWNERSHIP.GLV_CONTROLLED,
  ]),

  [INVENTORY_OWNERSHIP.QUARANTINE]: Object.freeze([
    INVENTORY_OWNERSHIP.GLV_CONTROLLED,
    INVENTORY_OWNERSHIP.WAREHOUSE,
  ]),

  [INVENTORY_OWNERSHIP.WAREHOUSE]: Object.freeze([
    INVENTORY_OWNERSHIP.IN_TRANSIT,
    INVENTORY_OWNERSHIP.GLV_CONTROLLED,
  ]),
});

// ---------------------------------------------------------------------------
// STORAGE_TYPES (frozen enum)
// ---------------------------------------------------------------------------
export const STORAGE_TYPES = Object.freeze({
  AMBIENT: 'AMBIENT',
  REFRIGERATED: 'REFRIGERATED',
  FROZEN: 'FROZEN',
  BONDED: 'BONDED',
  QUARANTINE_FACILITY: 'QUARANTINE_FACILITY',
  OPEN_YARD: 'OPEN_YARD',
});

// ---------------------------------------------------------------------------
// createInventoryRecord(fields)
// Validates required fields, applies defaults, returns frozen inventory record.
// ---------------------------------------------------------------------------
export function createInventoryRecord(fields = {}) {
  const now = new Date().toISOString();

  const REQUIRED_FIELDS = [
    'inventoryId',
    'productCode',
    'productName',
    'ownershipType',
    'storageType',
    'quantity',
    'unit',
    'country',
    'entityRef',
    'createdBy',
  ];

  for (const field of REQUIRED_FIELDS) {
    if (fields[field] === undefined || fields[field] === null || fields[field] === '') {
      throw new Error(`createInventoryRecord: missing required field "${field}"`);
    }
  }

  const record = {
    status: INVENTORY_STATUS.AVAILABLE,
    createdAt: now,
    updatedAt: now,
    ...fields,
    // Stamps always set by engine
    updatedAt: now,
  };

  const validationError = validateInventoryRecord(record);
  if (validationError) {
    throw new Error(`createInventoryRecord validation failed: ${validationError}`);
  }

  return Object.freeze(record);
}

// ---------------------------------------------------------------------------
// validateInventoryRecord(record)
// Returns error string or null.
// ---------------------------------------------------------------------------
export function validateInventoryRecord(record) {
  if (!record || typeof record !== 'object') {
    return 'Inventory record must be a non-null object';
  }

  const REQUIRED_FIELDS = [
    'inventoryId',
    'productCode',
    'productName',
    'ownershipType',
    'storageType',
    'quantity',
    'unit',
    'country',
    'entityRef',
    'createdBy',
  ];

  for (const field of REQUIRED_FIELDS) {
    if (record[field] === undefined || record[field] === null || record[field] === '') {
      return `Missing or empty required field: ${field}`;
    }
  }

  if (!Object.values(INVENTORY_OWNERSHIP).includes(record.ownershipType)) {
    return `Invalid ownershipType: "${record.ownershipType}". Must be one of: ${Object.values(INVENTORY_OWNERSHIP).join(', ')}`;
  }

  if (!Object.values(STORAGE_TYPES).includes(record.storageType)) {
    return `Invalid storageType: "${record.storageType}". Must be one of: ${Object.values(STORAGE_TYPES).join(', ')}`;
  }

  if (!Object.values(INVENTORY_STATUS).includes(record.status)) {
    return `Invalid status: "${record.status}". Must be one of: ${Object.values(INVENTORY_STATUS).join(', ')}`;
  }

  if (typeof record.quantity !== 'number' || record.quantity <= 0) {
    return `quantity must be a number greater than 0, got: ${record.quantity}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// canTransferOwnership(fromOwnership, toOwnership)
// Returns boolean — checks OWNERSHIP_TRANSITIONS.
// ---------------------------------------------------------------------------
export function canTransferOwnership(fromOwnership, toOwnership) {
  const validNext = OWNERSHIP_TRANSITIONS[fromOwnership];
  if (!Array.isArray(validNext)) return false;
  return validNext.includes(toOwnership);
}
