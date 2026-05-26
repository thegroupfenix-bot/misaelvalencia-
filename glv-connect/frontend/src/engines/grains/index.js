/**
 * grains/index.js — V9 Grains Engine Namespace
 *
 * Entry point for the GRAINS agent directory.
 * Future grain-specific engines (bulk weight tables, moisture specs,
 * fumigation cert engine) will be added here.
 *
 * DO NOT import LIVE_ANIMALS, oils, fruits, or meat logic here.
 */

// Agent metadata
export const AGENT_ID      = "GRAINS_AGENT";
export const AGENT_VERSION = "v9.0";
export const SUPPORTED_CATEGORIES = ["GRAINS", "CEREALS", "LEGUMES"];
