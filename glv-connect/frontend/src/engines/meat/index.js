/**
 * meat/index.js — V9 Meat Engine Namespace
 *
 * Entry point for the MEAT agent directory.
 * Future meat-specific engines (cut table, halal/kosher cert,
 * cold chain specs, USDA/SENASA compliance) will be added here.
 *
 * DO NOT import LIVE_ANIMALS, oils, fruits, or grains logic here.
 */

// Agent metadata
export const AGENT_ID      = "MEAT_AGENT";
export const AGENT_VERSION = "v9.0";
export const SUPPORTED_CATEGORIES = ["MEAT", "POULTRY", "BEEF", "PORK", "LAMB"];
