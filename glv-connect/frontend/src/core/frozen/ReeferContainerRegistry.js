/**
 * ReeferContainerRegistry.js
 * Reefer container profiles for frozen cargo export.
 * FROZEN_CARGO_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// REEFER_CONTAINER_TYPES (frozen enum)
// ---------------------------------------------------------------------------
export const REEFER_CONTAINER_TYPES = Object.freeze({
  RF20: 'RF20',
  RF40: 'RF40',
  RF40HC: 'RF40HC',
});

// ---------------------------------------------------------------------------
// REEFER_CONTAINERS (frozen object — rich metadata)
// ---------------------------------------------------------------------------
export const REEFER_CONTAINERS = Object.freeze({
  RF20: Object.freeze({
    key: 'RF20',
    label: '20ft Reefer',
    internalVolumeM3: 28.3,
    palletCapacity: 10,
    maxPayloadKg: 21600,
    temperatureRange: Object.freeze({ minC: -30, maxC: 30 }),
    footprint: 20,
  }),
  RF40: Object.freeze({
    key: 'RF40',
    label: '40ft Reefer',
    internalVolumeM3: 59.3,
    palletCapacity: 20,
    maxPayloadKg: 26580,
    temperatureRange: Object.freeze({ minC: -30, maxC: 30 }),
    footprint: 40,
  }),
  RF40HC: Object.freeze({
    key: 'RF40HC',
    label: '40ft High Cube Reefer',
    internalVolumeM3: 67.3,
    palletCapacity: 22,
    maxPayloadKg: 26580,
    temperatureRange: Object.freeze({ minC: -30, maxC: 30 }),
    footprint: 40,
  }),
});

// ---------------------------------------------------------------------------
// getContainer(key)
// Returns the entry for the given key or throws a descriptive error.
// ---------------------------------------------------------------------------
export function getContainer(key) {
  const entry = REEFER_CONTAINERS[key];
  if (!entry) {
    throw new Error(
      `getContainer: key "${key}" not found. ` +
        `Valid keys: ${Object.keys(REEFER_CONTAINERS).join(', ')}`
    );
  }
  return entry;
}

// ---------------------------------------------------------------------------
// getContainersForTemperature(targetTempC)
// Returns array of containers whose temperatureRange includes targetTempC.
// ---------------------------------------------------------------------------
export function getContainersForTemperature(targetTempC) {
  return Object.values(REEFER_CONTAINERS).filter(
    (c) =>
      targetTempC >= c.temperatureRange.minC &&
      targetTempC <= c.temperatureRange.maxC
  );
}

// ---------------------------------------------------------------------------
// isValidContainerType(key)
// Returns boolean — true if key matches a known container type.
// ---------------------------------------------------------------------------
export function isValidContainerType(key) {
  return Object.prototype.hasOwnProperty.call(REEFER_CONTAINERS, key);
}
