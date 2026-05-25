/**
 * validationSupervisor.js — GLV Commercial Document Validation Supervisor V5.
 *
 * 12 mandatory validation checks before any PDF generation or document submission:
 *
 *   VAL-001  Pricing consistency        — unit price must be > 0
 *   VAL-002  Unit consistency           — unit type compatible with category
 *   VAL-003  Packaging consistency      — packaging field filled for packaged categories
 *   VAL-004  PDF overflow risk          — description length within safe limits
 *   VAL-005  Media contamination        — enforced server-side, surfaced as info
 *   VAL-006  Country contamination      — destination country must be set
 *   VAL-007  Port contamination         — destination port should be set
 *   VAL-008  Container mismatch         — selected container compatible with category
 *   VAL-009  Stale cache detection      — multiple categories in one document
 *   VAL-010  Formula mismatch           — required fields present for category engine
 *   VAL-011  Commercial unit required   — liquid/packaged categories must declare sale unit
 *   VAL-012  Packaging mode required    — packaged categories must declare packaging mode
 */

import { getCategoryEngine } from "./categoryEngine.js";
import { getCategoryProfile } from "./categoryProfiles.js";
import { isLivestockContainer, isLiquidContainer } from "./containerEngine.js";

/**
 * Run all 10 validation checks against a document + its CD rows.
 *
 * @param {object}   doc
 * @param {object[]} cdRows
 * @returns {{ valid: boolean, errors: Check[], warnings: Check[], checks: Check[] }}
 */
export function validateDocument(doc, cdRows = []) {
  const firstRow  = cdRows.find(r => r.category) || {};
  const category  = firstRow.category || null;
  const engine    = category ? getCategoryEngine(category)  : null;
  const profile   = category ? getCategoryProfile(category) : null;

  const checks = [
    checkPricingConsistency(firstRow),
    checkUnitConsistency(firstRow, profile),
    checkPackagingConsistency(firstRow, profile),
    checkPDFOverflow(doc),
    checkMediaContamination(category),
    checkCountryContamination(doc),
    checkPortContamination(doc),
    checkContainerMismatch(firstRow, engine),
    checkStaleCache(cdRows),
    checkFormulaMismatch(firstRow, engine),
    checkCommercialUnitRequired(firstRow, profile),
    checkPackagingModeRequired(firstRow, profile),
  ];

  const errors   = checks.filter(c => !c.pass && c.severity === "error");
  const warnings = checks.filter(c => !c.pass && c.severity === "warning");

  return {
    valid:    errors.length === 0,
    errors,
    warnings,
    checks,
  };
}

// ─── Individual checks ────────────────────────────────────────────────────────

function checkPricingConsistency(row) {
  const price = parseFloat(row.unitPrice || 0);
  return {
    id:       "VAL-001",
    name:     "Pricing Consistency",
    pass:     price > 0,
    message:  price > 0 ? `Unit price: ${price}` : "Unit price is zero or missing — PDF will show USD 0",
    severity: "error",
  };
}

function checkUnitConsistency(row, profile) {
  const unit = row.unitType || "";
  if (!profile || !unit) {
    return { id: "VAL-002", name: "Unit Consistency", pass: true, message: "Unit not yet selected", severity: "warning" };
  }
  const allowed = profile.allowedUnits || [];
  const compatible = allowed.length === 0 || allowed.some(u => unit.toLowerCase().includes(u.toLowerCase()));
  return {
    id:       "VAL-002",
    name:     "Unit Consistency",
    pass:     compatible,
    message:  compatible
      ? `Unit "${unit}" compatible with ${profile.category}`
      : `Unit "${unit}" may not be compatible with ${profile.category} — expected one of: ${allowed.join(", ")}`,
    severity: "warning",
  };
}

function checkPackagingConsistency(row, profile) {
  if (!profile?.supportsPackaging) {
    return { id: "VAL-003", name: "Packaging Consistency", pass: true, message: "Category does not require packaging spec", severity: "warning" };
  }
  const packaging = row.specs?.packaging || row.specs?.packagingUnit || "";
  return {
    id:       "VAL-003",
    name:     "Packaging Consistency",
    pass:     !!packaging,
    message:  packaging ? `Packaging: ${packaging}` : "Packaging not specified — add packaging type to complete the document",
    severity: "warning",
  };
}

function checkPDFOverflow(doc) {
  const descLen = (doc.custom_product_desc || doc.customProductDesc || "").length;
  return {
    id:       "VAL-004",
    name:     "PDF Overflow Risk",
    pass:     descLen < 500,
    message:  descLen < 500
      ? "Product description length OK"
      : `Description too long (${descLen} chars) — may overflow PDF text box (max ~500)`,
    severity: "warning",
  };
}

function checkMediaContamination(category) {
  return {
    id:       "VAL-005",
    name:     "Media Contamination",
    pass:     true,
    message:  category
      ? `Media category isolation active for ${category} (enforced server-side)`
      : "No category — media isolation inactive",
    severity: "warning",
  };
}

function checkCountryContamination(doc) {
  const dest = doc.destination || doc.destinationCountry || "";
  return {
    id:       "VAL-006",
    name:     "Country Contamination",
    pass:     !!dest,
    message:  dest
      ? `Destination: ${dest}`
      : "Destination country not set — PDF Section 2 will be incomplete",
    severity: "error",
  };
}

function checkPortContamination(doc) {
  const port = doc.destinationPort || doc.destination_port || "";
  return {
    id:       "VAL-007",
    name:     "Port Contamination",
    pass:     !!port,
    message:  port ? `Port: ${port}` : "Destination port not set",
    severity: "warning",
  };
}

function checkContainerMismatch(row, engine) {
  const selected = row.containerType || "";
  if (!selected || !engine) {
    return { id: "VAL-008", name: "Container Mismatch", pass: true, message: "Container not yet selected", severity: "warning" };
  }

  if (engine.isLiveAnimal && !isLivestockContainer(selected)) {
    return {
      id: "VAL-008", name: "Container Mismatch", pass: false,
      message: `LIVE_ANIMALS requires Livestock Vessel — selected: ${selected}`,
      severity: "warning",
    };
  }
  if (engine.isLiquid && !isLiquidContainer(selected)) {
    return {
      id: "VAL-008", name: "Container Mismatch", pass: false,
      message: `Liquid category (${engine.category}) should use Flexitank or ISO Tank — selected: ${selected}`,
      severity: "warning",
    };
  }
  return { id: "VAL-008", name: "Container Mismatch", pass: true, message: `Container ${selected} compatible`, severity: "warning" };
}

function checkStaleCache(cdRows) {
  const categories = [...new Set(cdRows.map(r => r.category).filter(Boolean))];
  const contaminated = categories.length > 1;
  return {
    id:       "VAL-009",
    name:     "Stale Cache Detection",
    pass:     !contaminated,
    message:  contaminated
      ? `Multiple categories in document (${categories.join(", ")}) — possible stale form state`
      : "Single category — no stale state",
    severity: "warning",
  };
}

function checkFormulaMismatch(row, engine) {
  if (!engine) {
    return { id: "VAL-010", name: "Formula Mismatch", pass: true, message: "No engine — category not selected", severity: "warning" };
  }
  if (engine.isLiveAnimal) {
    const heads = parseFloat(row.specs?.headCount || 0);
    const avgWt = parseFloat(row.specs?.avgWeight  || 0);
    if (heads <= 0 || avgWt <= 0) {
      return {
        id: "VAL-010", name: "Formula Mismatch", pass: false,
        message: "LIVE_ANIMALS: headCount and avgWeight are both required to calculate shipment value",
        severity: "error",
      };
    }
  }
  return { id: "VAL-010", name: "Formula Mismatch", pass: true, message: "Formula inputs consistent with category engine", severity: "warning" };
}

const LIQUID_PACKAGED_CATEGORIES = new Set(["OILS", "FRUIT_PRODUCTS", "COLOMBIAN_EXOTIC_FRUITS"]);

function checkCommercialUnitRequired(row, profile) {
  const category = row.category || "";
  if (!LIQUID_PACKAGED_CATEGORIES.has(category)) {
    return { id: "VAL-011", name: "Commercial Unit Required", pass: true, message: "Category does not require explicit commercial sale unit", severity: "warning" };
  }
  const unit = row.commercialUnit || "";
  return {
    id:       "VAL-011",
    name:     "Commercial Unit Required",
    pass:     !!unit,
    message:  unit
      ? `Commercial sale unit declared: ${unit}`
      : `${category} requires a commercial sale unit (perKg, perLiter, perBox, etc.) — PDF pricing basis will be incomplete`,
    severity: "warning",
  };
}

function checkPackagingModeRequired(row, profile) {
  if (!profile?.supportsLiquidPackaging && !profile?.supportsPackaging) {
    return { id: "VAL-012", name: "Packaging Mode Required", pass: true, message: "Category does not require packaging mode", severity: "warning" };
  }
  const mode = row.packagingMode || "";
  return {
    id:       "VAL-012",
    name:     "Packaging Mode Required",
    pass:     !!mode,
    message:  mode
      ? `Packaging mode: ${mode}`
      : "Packaging mode not declared — select BULK/INDUSTRIAL or RETAIL/CONSUMER to generate correct PDF output",
    severity: "warning",
  };
}
