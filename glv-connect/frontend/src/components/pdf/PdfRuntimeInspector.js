/**
 * PdfRuntimeInspector.js — V9.2
 *
 * Runtime diagnostics for PDF generation pipeline.
 * Inspects payload, sections, adapters, language, numbers, arrays.
 * Returns structured diagnostics — never throws.
 */

export const INSPECTOR_VERSION = "v9.2";

// ─── Safe type checks ─────────────────────────────────────────────────────────

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isReactElement(v) {
  return isPlainObject(v) && (v.$$typeof != null || v.type != null);
}

// ─── inspectPayload ───────────────────────────────────────────────────────────

export function inspectPayload(doc = {}) {
  const issues = [];
  const info   = [];

  try {
    const cd = doc.commercialData || doc.commercial_data;
    const cdType = typeof cd;
    info.push(`commercialData type: ${cdType}`);

    let parsed = null;
    if (cdType === "string") {
      try {
        parsed = JSON.parse(cd);
        info.push("commercialData parsed from JSON string OK");
      } catch (e) {
        issues.push(`FATAL: commercialData is a string but JSON.parse failed: ${e.message}`);
      }
    } else if (isPlainObject(cd)) {
      parsed = cd;
      info.push("commercialData is already an object");
    } else if (cd == null) {
      issues.push("WARN: commercialData is null/undefined — cdRows will be []");
    }

    if (parsed) {
      const rows = parsed.rows;
      if (!Array.isArray(rows)) {
        issues.push("WARN: commercialData.rows is not an array — cdRows will be []");
      } else {
        info.push(`cdRows.length = ${rows.length}`);
        const first = rows[0];
        if (first) {
          info.push(`firstCdRow.category = ${first.category}`);
          info.push(`firstCdRow.incoterms = ${JSON.stringify(first.incoterms)}`);
          info.push(`firstCdRow.quantity = ${first.quantity}`);
          if (first.oilsConfig) info.push("firstCdRow.oilsConfig: present");
          if (first.skus) info.push(`firstCdRow.skus.length = ${Array.isArray(first.skus) ? first.skus.length : "NOT_ARRAY"}`);
        }
      }
    }

    // Check for circular reference
    try {
      JSON.stringify(doc);
      info.push("doc serialization: OK (no circular reference)");
    } catch (e) {
      issues.push(`FATAL: doc has circular reference: ${e.message}`);
    }

    // Required string fields
    const required = ["id", "type", "date", "destination", "client", "product", "agent"];
    for (const f of required) {
      if (doc[f] == null || doc[f] === "") {
        issues.push(`WARN: doc.${f} is empty/null`);
      } else if (isPlainObject(doc[f]) || Array.isArray(doc[f])) {
        issues.push(`FATAL: doc.${f} is an object/array — will crash <Text> in react-pdf`);
      } else {
        info.push(`doc.${f} = "${String(doc[f]).slice(0, 40)}"`);
      }
    }

    // Check destination
    if (!doc.destination) {
      issues.push("FATAL: doc.destination is empty — generation will be aborted by handleDownload guard");
    }

  } catch (err) {
    issues.push(`INSPECTOR_ERROR in inspectPayload: ${err.message}`);
  }

  const fatal = issues.filter(i => i.startsWith("FATAL"));
  return { ok: fatal.length === 0, issues, info, fatal };
}

// ─── inspectSections ─────────────────────────────────────────────────────────

export function inspectSections(doc = {}, cdRows = []) {
  const issues = [];
  const info   = [];

  try {
    const first = cdRows[0] || {};

    // Category detection
    const isLiveAnimal = first.category === "LIVE_ANIMALS";
    const isOils       = first.category === "OILS" && !isLiveAnimal;
    const isPouch      = ["RETAIL_POUCH","PILLOW_POUCH","STAND_UP_POUCH","SPOUT_POUCH",
                          "GUSSET_POUCH","SIDE_SEAL_POUCH","BAG_IN_BOX","RETAIL_DOYPACK"]
                         .includes(first.exportFormat);
    info.push(`category: ${first.category || "(none)"}`);
    info.push(`isLiveAnimalRow: ${isLiveAnimal}`);
    info.push(`isOilsRow: ${isOils}`);
    info.push(`isPouchFormat: ${isPouch}`);

    // Oils config check
    if (isOils) {
      const oc = first.oilsConfig || {};
      const oFields = ["productId","packagingType","sizeId","incoterm","basePrice","unitsPerContainer","freightUSD"];
      for (const f of oFields) {
        if (oc[f] == null) issues.push(`WARN: oilsConfig.${f} is null/undefined`);
        else info.push(`oilsConfig.${f} = ${oc[f]}`);
      }
      if (Array.isArray(oc.foodGrade)) info.push(`oilsConfig.foodGrade: [${oc.foodGrade.join(",")}]`);
      else if (oc.foodGrade != null) issues.push(`WARN: oilsConfig.foodGrade is not an array: ${typeof oc.foodGrade}`);
    }

    // Livestock check
    if (isLiveAnimal) {
      const headCount = parseFloat(first.specs?.headCount || first.quantity || 0);
      const avgWeight = parseFloat(first.specs?.avgWeight || 45);
      info.push(`LIVE_ANIMALS: headCount=${headCount}, avgWeight=${avgWeight}`);
      if (headCount === 0) issues.push("WARN: LIVE_ANIMALS headCount is 0");
    }

    // SKU check
    if (Array.isArray(first.skus) && first.skus.length > 0) {
      info.push(`Multi-SKU: ${first.skus.length} SKUs`);
      first.skus.forEach((sk, i) => {
        if (sk.packagingType == null) issues.push(`WARN: SKU[${i}].packagingType is null`);
        if (parseFloat(sk.quantity) <= 0) issues.push(`WARN: SKU[${i}].quantity is 0`);
      });
    }

    // All rows check
    info.push(`cdRows.length = ${cdRows.length}`);

  } catch (err) {
    issues.push(`INSPECTOR_ERROR in inspectSections: ${err.message}`);
  }

  const fatal = issues.filter(i => i.startsWith("FATAL"));
  return { ok: fatal.length === 0, issues, info, fatal };
}

// ─── inspectAdapters ─────────────────────────────────────────────────────────

export function inspectAdapters(cdRows = []) {
  const issues = [];
  const info   = [];

  try {
    const first = cdRows[0] || {};
    const cat   = first.category;

    if (!cat) {
      issues.push("WARN: firstCdRow has no category — pdfTextKey will use legacy string-match");
    } else {
      info.push(`adapter category: ${cat}`);
    }

    // Check incotermPrices
    const inc = (first.incoterms || ["CFR"])[0];
    const prices = first.incotermPrices || {};
    const ePrice = parseFloat(prices[inc] || Object.values(prices).find(v => parseFloat(v) > 0) || first.unitPrice || 0);
    info.push(`incoterm: ${inc}, engineUnitPrice: ${ePrice}`);
    if (ePrice === 0) issues.push("WARN: engineUnitPrice is 0 — price section will show $0");

  } catch (err) {
    issues.push(`INSPECTOR_ERROR in inspectAdapters: ${err.message}`);
  }

  const fatal = issues.filter(i => i.startsWith("FATAL"));
  return { ok: fatal.length === 0, issues, info, fatal };
}

// ─── inspectLanguage ─────────────────────────────────────────────────────────

export function inspectLanguage(lang = "es", doc = {}) {
  const issues = [];
  const info   = [];

  const SUPPORTED = ["es", "en", "zh", "ar", "fr"];
  info.push(`lang: "${lang}"`);
  if (!SUPPORTED.includes(lang)) {
    issues.push(`WARN: lang "${lang}" not in supported list ${JSON.stringify(SUPPORTED)} — will fallback to "es"`);
  }

  const resolvedLang = lang === "en" ? "en" : "es";
  info.push(`resolvedLang: "${resolvedLang}"`);

  return { ok: true, issues, info, fatal: [] };
}

// ─── inspectNumbers ───────────────────────────────────────────────────────────

export function inspectNumbers(doc = {}, cdRows = []) {
  const issues = [];
  const info   = [];

  try {
    const first = cdRows[0] || {};
    const fields = {
      quantity:      parseFloat(first.quantity),
      unitPrice:     parseFloat(first.unitPrice),
      contractValue: first.summary?.contractValue,
      shipmentValue: first.summary?.shipmentValue,
      headCount:     first.specs?.headCount,
      avgWeight:     first.specs?.avgWeight,
    };

    for (const [k, v] of Object.entries(fields)) {
      const n = parseFloat(v);
      if (isNaN(n)) {
        info.push(`${k}: NaN (will use 0 fallback)`);
      } else if (!isFinite(n)) {
        issues.push(`WARN: ${k} is Infinity — may cause PDF render crash`);
      } else {
        info.push(`${k}: ${n}`);
      }
    }
  } catch (err) {
    issues.push(`INSPECTOR_ERROR in inspectNumbers: ${err.message}`);
  }

  const fatal = issues.filter(i => i.startsWith("FATAL"));
  return { ok: fatal.length === 0, issues, info, fatal };
}

// ─── inspectArrays ────────────────────────────────────────────────────────────

export function inspectArrays(doc = {}, cdRows = []) {
  const issues = [];
  const info   = [];

  try {
    // cdRows itself
    if (!Array.isArray(cdRows)) {
      issues.push("FATAL: cdRows is not an array");
    } else {
      info.push(`cdRows: OK (length ${cdRows.length})`);
    }

    // SKUs
    const first = cdRows[0] || {};
    if (first.skus != null && !Array.isArray(first.skus)) {
      issues.push("FATAL: firstCdRow.skus exists but is not an array — rowSkus.map() will crash");
    }

    // oilsConfig arrays
    const oc = first.oilsConfig || {};
    for (const f of ["foodGrade", "oemCaps", "certifications"]) {
      if (oc[f] != null && !Array.isArray(oc[f])) {
        issues.push(`FATAL: oilsConfig.${f} exists but is not an array — safeArr must be used`);
      }
    }

    // pouchConfig.oemCapabilities
    const pc = first.pouchConfig || {};
    if (pc.oemCapabilities != null && !Array.isArray(pc.oemCapabilities)) {
      issues.push("WARN: pouchConfig.oemCapabilities is not an array");
    }

  } catch (err) {
    issues.push(`INSPECTOR_ERROR in inspectArrays: ${err.message}`);
  }

  const fatal = issues.filter(i => i.startsWith("FATAL"));
  return { ok: fatal.length === 0, issues, info, fatal };
}

// ─── Full inspection ──────────────────────────────────────────────────────────

export function runFullInspection(doc = {}, cdRows = [], lang = "es") {
  const results = {
    version: INSPECTOR_VERSION,
    timestamp: new Date().toISOString(),
    docId: doc.id,
    payload:  inspectPayload(doc),
    sections: inspectSections(doc, cdRows),
    adapters: inspectAdapters(cdRows),
    language: inspectLanguage(lang, doc),
    numbers:  inspectNumbers(doc, cdRows),
    arrays:   inspectArrays(doc, cdRows),
  };

  const allFatals = [
    ...results.payload.fatal,
    ...results.sections.fatal,
    ...results.adapters.fatal,
    ...results.arrays.fatal,
  ];

  const allWarnings = [
    ...results.payload.issues.filter(i => i.startsWith("WARN")),
    ...results.sections.issues.filter(i => i.startsWith("WARN")),
    ...results.adapters.issues.filter(i => i.startsWith("WARN")),
    ...results.numbers.issues.filter(i => i.startsWith("WARN")),
    ...results.arrays.issues.filter(i => i.startsWith("WARN")),
  ];

  results.summary = {
    blockPdf: allFatals.length > 0,
    fatals:   allFatals,
    warnings: allWarnings,
    ok:       allFatals.length === 0,
  };

  return results;
}
