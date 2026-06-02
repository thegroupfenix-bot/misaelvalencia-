/**
 * pdfPayloadNormalizer.js — V9 PDF Payload Normalizer
 *
 * Converts a raw CommercialEngine row into a normalized PDF payload.
 * Routes to the correct per-category adapter automatically.
 * Returns a validated, null-safe object that GlvPDF can consume directly.
 *
 * Categories handled:
 *   OILS       → oilsPdfAdapter
 *   LIVE_ANIMALS → livestockPdfAdapter (passthrough — do NOT transform livestock data)
 *   FRUITS     → fruitsPdfAdapter
 *   default    → base adapter (copies fields as-is)
 */

import { createEmptyNormalizedPayload } from "../commercialCore.js";
import { normalizeOilsRow }      from "./oilsPdfAdapter.js";
import { normalizeLivestockRow } from "./livestockPdfAdapter.js";
import { normalizeFruitsRow }    from "./fruitsPdfAdapter.js";

/**
 * Normalize a raw commercial row into a PDF-ready payload.
 *
 * @param {object} row — raw row from CommercialEngine onChange payload
 * @returns {object}   — normalized payload (createEmptyNormalizedPayload shape)
 */
export function normalizePdfPayload(row) {
  if (!row || typeof row !== "object") {
    return createEmptyNormalizedPayload();
  }

  const category = row.category || "";

  try {
    if (category === "OILS")        return normalizeOilsRow(row);
    if (category === "LIVE_ANIMALS") return normalizeLivestockRow(row);
    if (category === "FRUITS")      return normalizeFruitsRow(row);
    return normalizeDefaultRow(row);
  } catch {
    // Never crash PDF — return safe base payload
    return { ...createEmptyNormalizedPayload(), category, _sourceCategory: category, _adapterVersion: "fallback-v9" };
  }
}

/**
 * Default passthrough adapter for categories without a dedicated adapter.
 */
function normalizeDefaultRow(row) {
  const base = createEmptyNormalizedPayload();
  return {
    ...base,
    category:           row.category        || null,
    productLabel:       row.product         || null,
    incoterm:           (row.incoterms && row.incoterms[0]) || null,
    currency:           row.currency        || "USD",
    origin:             row.origin          || null,
    containerType:      row.containerType   || null,
    _sourceCategory:    row.category        || null,
    _adapterVersion:    "default-v9",
  };
}
