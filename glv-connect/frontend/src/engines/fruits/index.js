/**
 * fruits/index.js — V9 Fruits Engine Namespace
 *
 * Entry point for the FRUITS agent directory.
 * Future fruit-specific engines (cold chain, box weight table,
 * phytosanitary cert engine) will be added here.
 *
 * DO NOT import LIVE_ANIMALS, oils, grains, or meat logic here.
 */

// Fruits PDF adapter (V9)
export { normalizeFruitsRow } from "../core/pdf/fruitsPdfAdapter.js";

// Agent metadata
export const AGENT_ID      = "FRUITS_AGENT";
export const AGENT_VERSION = "v9.0";
export const SUPPORTED_CATEGORIES = ["FRUITS"];
