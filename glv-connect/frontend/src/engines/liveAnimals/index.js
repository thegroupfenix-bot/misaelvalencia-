/**
 * liveAnimals/index.js — V9 Live Animals Engine Namespace
 *
 * Entry point for the LIVE_ANIMALS agent directory.
 * Re-exports existing livestock logic from its original locations.
 *
 * CRITICAL: Never import oils, fruits, grains, or meat logic here.
 * DO NOT modify existing livestock calculation formulas.
 */

// Livestock breed registry — existing engine, unchanged
export { BREEDS, SPECIES_LABELS, getBreedsForSpecies } from "../../config/breeds.js";

// Category profile for LIVE_ANIMALS
export { getCategoryProfile } from "../categoryProfiles.js";

// Livestock PDF adapter (V9)
export { normalizeLivestockRow } from "../core/pdf/livestockPdfAdapter.js";

// Agent metadata
export const AGENT_ID      = "LIVE_ANIMALS_AGENT";
export const AGENT_VERSION = "v9.0";
export const SUPPORTED_CATEGORIES = ["LIVE_ANIMALS"];
