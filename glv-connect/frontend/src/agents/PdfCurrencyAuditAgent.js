/**
 * PdfCurrencyAuditAgent.js — V9.2
 *
 * Audits all currency references in the PDF rendering pipeline before
 * pdf().toBlob() is called. Detects scope leaks, missing declarations,
 * and OILS-specific currency path failures.
 *
 * Invariant: never throws, never blocks PDF. Always returns a result object.
 */

// ─── Sections with known currency variable declarations ───────────────────────
const CURRENCY_SECTIONS = [
  { id: "DOC_SCOPE",      description: "resolvedCurrency at DocPDF function scope",       guard: "always" },
  { id: "V5_IIFE",        description: "const currency = resolvedCurrency in V5 IIFE",    guard: "(packagingType || presentationSize || commercialUnit) && !isLiveAnimalRow" },
  { id: "V6_IIFE",        description: "const currency = resolvedCurrency in V6 IIFE",    guard: "rowSkus.length > 0 && !isLiveAnimalRow" },
  { id: "CD_TABLE_ROW",   description: "const currency = row.currency || 'USD' per-row",  guard: "rows.length > 0" },
  { id: "CD_TABLE_TOTAL", description: "const currency = rows[0]?.currency || 'USD'",     guard: "rows.length > 1" },
  { id: "OILS_IIFE",      description: "No bare currency variable — uses hardcoded USD",  guard: "isOilsRow" },
];

/**
 * Run the currency audit against a pre-render payload.
 *
 * @param {object}   doc      — raw document payload
 * @param {object[]} cdRows   — parsed CommercialEngine rows
 * @param {string}   lang     — "es" | "en"
 * @returns {object}          — audit result
 */
export function runCurrencyAudit(doc = {}, cdRows = [], lang = "es") {
  const findings = [];
  const info     = [];

  try {
    const firstRow = cdRows[0] || {};
    const category = firstRow.category || "(none)";
    const isOils   = category === "OILS";
    const isLive   = category === "LIVE_ANIMALS";

    // ── 1. Canonical resolver check ───────────────────────────────────────────
    const resolvedCurrency = firstRow.currency || "USD";
    info.push(`category: ${category}`);
    info.push(`resolvedCurrency: "${resolvedCurrency}" (from firstRow.currency="${firstRow.currency ?? "missing"}")`);
    if (!firstRow.currency) {
      findings.push({ severity: "warning", section: "DOC_SCOPE", message: "firstRow.currency missing — resolvedCurrency auto-injected USD" });
    }

    // ── 2. Per-section status ─────────────────────────────────────────────────
    for (const sec of CURRENCY_SECTIONS) {
      info.push(`${sec.id}: ${sec.description} | guard: ${sec.guard}`);
    }

    // ── 3. OILS-specific path check ───────────────────────────────────────────
    if (isOils) {
      const oilsCfg = firstRow.oilsConfig || {};
      info.push(`OILS: packagingType=${oilsCfg.packagingType ?? "null"} | sizeId=${oilsCfg.sizeId ?? "null"}`);
      info.push(`OILS: firstRow.packagingType=${firstRow.packagingType ?? "null"} (may trigger V5 IIFE)`);
      info.push(`OILS: firstRow.commercialUnit=${firstRow.commercialUnit ?? "null"} (may trigger V5 IIFE)`);

      // If OILS row has packagingType at top level, V5 IIFE would have triggered
      // before VAL-045 fix — now guarded by resolvedCurrency at doc scope + try/catch
      if (firstRow.packagingType || firstRow.commercialUnit || firstRow.presentationSize) {
        findings.push({
          severity: "info",
          section: "V5_IIFE",
          message: `OILS row has packagingType/commercialUnit at row level — V5 IIFE will execute. resolvedCurrency guards are active.`,
        });
      }
    }

    // ── 4. Multi-row currency consistency ─────────────────────────────────────
    if (cdRows.length > 1) {
      const currencies = cdRows.map((r, i) => ({ i, c: r.currency || "USD" }));
      const unique = new Set(currencies.map(x => x.c));
      if (unique.size > 1) {
        findings.push({
          severity: "info",
          section: "CD_TABLE_ROW",
          message: `Multi-currency rows detected: ${[...unique].join(", ")} — each row uses its own currency`,
        });
      } else {
        info.push(`All ${cdRows.length} rows use currency: ${[...unique][0]}`);
      }
    }

    // ── 5. SKU currency consistency ───────────────────────────────────────────
    if (Array.isArray(firstRow.skus) && firstRow.skus.length > 0) {
      const skuCurrencies = firstRow.skus.map((sk, i) => ({ i, c: sk.currency })).filter(x => x.c != null);
      for (const { i, c } of skuCurrencies) {
        if (c !== resolvedCurrency) {
          findings.push({ severity: "warning", section: "V6_IIFE", message: `SKU[${i}].currency="${c}" differs from resolvedCurrency="${resolvedCurrency}" — PDF uses resolvedCurrency` });
        }
      }
    }

  } catch (auditErr) {
    findings.push({ severity: "error", section: "AUDIT_CRASH", message: `Audit agent crashed: ${auditErr.message}` });
  }

  const warnings = findings.filter(f => f.severity === "warning");
  const errors   = findings.filter(f => f.severity === "error");

  return {
    agent:    "PdfCurrencyAuditAgent",
    version:  "v9.2",
    pass:     errors.length === 0,       // errors = audit crash only; warnings never block
    blockPdf: false,                     // VAL-045 never blocks — resolvedCurrency always fallbacks
    findings,
    info,
    summary: {
      warnings: warnings.length,
      errors:   errors.length,
      resolvedCurrency: (cdRows[0]?.currency) || "USD (auto-injected)",
    },
  };
}
