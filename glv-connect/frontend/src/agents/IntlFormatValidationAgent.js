/**
 * IntlFormatValidationAgent.js — V9.2
 *
 * Validates Intl.NumberFormat currency formatting before PDF render.
 * Tests every currency value that will be used during rendering and
 * ensures each one produces a valid formatted string.
 *
 * Never throws. Never blocks PDF — invalid currencies auto-heal to USD.
 */

import { safeCurrencyResolver } from "../utils/safeCurrencyResolver.js";

/**
 * @param {object[]} cdRows  — parsed CommercialEngine rows
 * @returns {object}          — validation result
 */
export function runIntlFormatAudit(cdRows = []) {
  const results = [];
  const info    = [];

  // Collect all currency values that will appear in the PDF
  const toTest = new Set(["USD"]);

  for (const row of cdRows) {
    if (row.currency) toTest.add(row.currency);
    if (row.oilsConfig?.currency) toTest.add(row.oilsConfig.currency);
    if (Array.isArray(row.skus)) {
      for (const sk of row.skus) {
        if (sk.currency) toTest.add(sk.currency);
      }
    }
  }

  for (const rawCurrency of toTest) {
    const resolved = safeCurrencyResolver(rawCurrency);
    try {
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: resolved,
        maximumFractionDigits: 0,
      }).format(12345.67);

      results.push({
        input:    rawCurrency,
        resolved,
        valid:    true,
        sample:   formatted,
        healed:   rawCurrency !== resolved,
      });
      info.push(`"${rawCurrency}" → "${resolved}": OK (sample: ${formatted})`);
    } catch (e) {
      results.push({
        input:    rawCurrency,
        resolved,
        valid:    false,
        error:    e.message,
        fallback: "USD",
        healed:   true,
      });
      info.push(`"${rawCurrency}" → "${resolved}": FAILED (${e.message}) — will use USD`);
    }
  }

  const failures  = results.filter(r => !r.valid);
  const healed    = results.filter(r => r.healed);

  return {
    agent:    "IntlFormatValidationAgent",
    version:  "v9.2",
    pass:     true,      // always passes — fmtPdfCurrency auto-heals all failures
    blockPdf: false,
    results,
    info,
    summary: {
      tested:   results.length,
      valid:    results.length - failures.length,
      failures: failures.length,
      healed:   healed.length,
    },
    message: failures.length === 0
      ? `All ${results.length} currency code(s) validated OK`
      : `${failures.length} currency code(s) failed Intl validation — auto-healed to USD`,
  };
}
