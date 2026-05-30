/**
 * FrozenPalletizationRegistry.js
 * Palletization standards for every frozen cargo presentation.
 * FROZEN_LOGISTICS_INTELLIGENCE_V1
 *
 * Bridge between individual units, master cases, and full pallets.
 * Pure ES module — no external dependencies, no side effects at load time.
 */

import { PRODUCT_PRESENTATIONS } from './ProductPresentationRegistry.js';
import { MASTER_CASES } from './PackagingRegistry.js';
import { PALLET_STANDARDS } from './PalletRegistry.js';

// ---------------------------------------------------------------------------
// PALLETIZATION_STANDARDS (frozen object)
// One entry per presentation key.
// ---------------------------------------------------------------------------
export const PALLETIZATION_STANDARDS = Object.freeze({
  RETAIL_100G: Object.freeze({
    presentationKey: 'RETAIL_100G',
    masterCaseKey: 'MASTER_CASE_10KG',
    palletKey: 'EURO',
    unitsPerCase: 100,
    casesPerPallet: 100,
    palletNetWeightKg: 1000,
    palletGrossWeightKg: 1050,
    palletHeightMm: 2000,
    palletLengthMm: 1200,
    palletWidthMm: 800,
  }),
  RETAIL_250G: Object.freeze({
    presentationKey: 'RETAIL_250G',
    masterCaseKey: 'MASTER_CASE_10KG',
    palletKey: 'EURO',
    unitsPerCase: 40,
    casesPerPallet: 100,
    palletNetWeightKg: 1000,
    palletGrossWeightKg: 1050,
    palletHeightMm: 2000,
    palletLengthMm: 1200,
    palletWidthMm: 800,
  }),
  RETAIL_500G: Object.freeze({
    presentationKey: 'RETAIL_500G',
    masterCaseKey: 'MASTER_CASE_10KG',
    palletKey: 'EURO',
    unitsPerCase: 20,
    casesPerPallet: 100,
    palletNetWeightKg: 1000,
    palletGrossWeightKg: 1050,
    palletHeightMm: 2000,
    palletLengthMm: 1200,
    palletWidthMm: 800,
  }),
  RETAIL_1KG: Object.freeze({
    presentationKey: 'RETAIL_1KG',
    masterCaseKey: 'MASTER_CASE_10KG',
    palletKey: 'EURO',
    unitsPerCase: 10,
    casesPerPallet: 100,
    palletNetWeightKg: 1000,
    palletGrossWeightKg: 1050,
    palletHeightMm: 2000,
    palletLengthMm: 1200,
    palletWidthMm: 800,
  }),
  FOODSERVICE_2KG: Object.freeze({
    presentationKey: 'FOODSERVICE_2KG',
    masterCaseKey: 'MASTER_CASE_12KG',
    palletKey: 'EURO',
    unitsPerCase: 6,
    casesPerPallet: 80,
    palletNetWeightKg: 960,
    palletGrossWeightKg: 1011,
    palletHeightMm: 2000,
    palletLengthMm: 1200,
    palletWidthMm: 800,
  }),
  FOODSERVICE_5KG: Object.freeze({
    presentationKey: 'FOODSERVICE_5KG',
    masterCaseKey: 'MASTER_CASE_20KG',
    palletKey: 'EURO',
    unitsPerCase: 4,
    casesPerPallet: 50,
    palletNetWeightKg: 1000,
    palletGrossWeightKg: 1050,
    palletHeightMm: 2000,
    palletLengthMm: 1200,
    palletWidthMm: 800,
  }),
  INDUSTRIAL_20KG: Object.freeze({
    presentationKey: 'INDUSTRIAL_20KG',
    masterCaseKey: 'MASTER_CASE_20KG',
    palletKey: 'ISPM_48X40',
    unitsPerCase: 1,
    casesPerPallet: 40,
    palletNetWeightKg: 800,
    palletGrossWeightKg: 840,
    palletHeightMm: 2000,
    palletLengthMm: 1219,
    palletWidthMm: 1016,
  }),
});

// ---------------------------------------------------------------------------
// getPalletization(presentationKey)
// Returns the palletization standard for the given presentation key or throws.
// ---------------------------------------------------------------------------
export function getPalletization(presentationKey) {
  const entry = PALLETIZATION_STANDARDS[presentationKey];
  if (!entry) {
    throw new Error(
      `getPalletization: key "${presentationKey}" not found. ` +
        `Valid keys: ${Object.keys(PALLETIZATION_STANDARDS).join(', ')}`
    );
  }
  return entry;
}

// ---------------------------------------------------------------------------
// getAllPalletizationStandards()
// Returns array of all PALLETIZATION_STANDARDS entries.
// ---------------------------------------------------------------------------
export function getAllPalletizationStandards() {
  return Object.values(PALLETIZATION_STANDARDS);
}

// ---------------------------------------------------------------------------
// getPalletWeightForPresentation(presentationKey)
// Returns { netKg, grossKg } for the given presentation key.
// ---------------------------------------------------------------------------
export function getPalletWeightForPresentation(presentationKey) {
  const entry = getPalletization(presentationKey);
  return Object.freeze({
    netKg: entry.palletNetWeightKg,
    grossKg: entry.palletGrossWeightKg,
  });
}
