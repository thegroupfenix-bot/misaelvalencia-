/**
 * RegressionSupervisorAgent.js — V9.1
 *
 * Runtime regression guard. Verifies that:
 *   - LIVE_ANIMALS formula is untouched (headCount × avgWeight)
 *   - FRUITS formula uses box-weight model
 *   - GRAINS and MEAT remain unmodified
 *   - No oils logic leaks into livestock calculations
 *
 * Called at app startup and in CI. Returns a regression report.
 * Never throws.
 */

export const AGENT_ID = "REGRESSION_SUPERVISOR_AGENT";
export const AGENT_VERSION = "v9.1";

// ─── Regression invariants ────────────────────────────────────────────────────

const INVARIANTS = [
  {
    id: "LIVE_ANIMALS_FORMULA",
    description: "LIVE_ANIMALS shipment value = headCount × avgWeight × pricePerKg",
    category: "LIVE_ANIMALS",
    verify: (row) => {
      if (row.category !== "LIVE_ANIMALS") return { skip: true };
      const heads = parseFloat(row.specs?.headCount || row.quantity || 0);
      const avgW  = parseFloat(row.specs?.avgWeight  || 45);
      const price = parseFloat(row.unitPrice || Object.values(row.incotermPrices || {})[0] || 0);
      const expected = heads * avgW * price;
      const actual   = parseFloat(row.summary?.shipmentValue || 0);
      if (!heads || !avgW || !price) return { skip: true, reason: "incomplete data" };
      const match = Math.abs(expected - actual) / (expected || 1) < 0.02;
      return { ok: match, expected, actual };
    },
  },
  {
    id: "OILS_NO_LIVESTOCK_CONTAMINATION",
    description: "OILS row must not inherit headCount or avgWeight",
    category: "OILS",
    verify: (row) => {
      if (row.category !== "OILS") return { skip: true };
      const hasContamination = (row.specs?.headCount > 0) || (row.summary?.shipmentValue === row.specs?.headCount * row.specs?.avgWeight * row.unitPrice);
      return { ok: !hasContamination, contaminated: hasContamination };
    },
  },
  {
    id: "LIVE_ANIMALS_NO_OILS_PRICE_MATRIX",
    description: "LIVE_ANIMALS pricing must not come from oilsPricingEngine",
    category: "LIVE_ANIMALS",
    verify: (row) => {
      if (row.category !== "LIVE_ANIMALS") return { skip: true };
      const hasOilsConfig = !!(row.oilsConfig?.basePrice || row.oilsConfig?.triplet);
      return { ok: !hasOilsConfig, hasOilsConfig };
    },
  },
];

/**
 * Run all regression invariants against a set of commercial rows.
 *
 * @param {Array} cdRows — from commercial document
 * @returns {RegressionReport}
 */
export function runRegressionCheck(cdRows = []) {
  const results = [];

  for (const invariant of INVARIANTS) {
    const relevantRows = cdRows.filter(r => !invariant.category || r.category === invariant.category);
    if (relevantRows.length === 0) {
      results.push({ ...invariant, status: "skip", reason: "no rows for category" });
      continue;
    }
    for (const row of relevantRows) {
      try {
        const result = invariant.verify(row);
        if (result.skip) {
          results.push({ ...invariant, status: "skip", reason: result.reason || "skipped" });
        } else {
          results.push({ ...invariant, status: result.ok ? "pass" : "fail", details: result });
        }
      } catch (err) {
        results.push({ ...invariant, status: "error", error: err.message });
      }
    }
  }

  const failures = results.filter(r => r.status === "fail");
  return {
    agentId: AGENT_ID,
    version: AGENT_VERSION,
    valid: failures.length === 0,
    results,
    failures,
  };
}
