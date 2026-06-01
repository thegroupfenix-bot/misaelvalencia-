/**
 * ReconciliationEngine.js — GLV GOS Financial Domain — Reconciliation Foundation V1.0
 *
 * Foundation for bank statement import and reconciliation matching.
 *
 * STATUS: FOUNDATION — transaction schema, matching logic stub defined.
 * Full matching engine and bank statement parsers to be implemented.
 */

// ─── Transaction types ─────────────────────────────────────────────────────────

export const TRANSACTION_TYPES = Object.freeze({
  CREDIT:    "CREDIT",
  DEBIT:     "DEBIT",
  TRANSFER:  "TRANSFER",
  FEE:       "FEE",
  INTEREST:  "INTEREST",
  REVERSAL:  "REVERSAL",
});

export const RECONCILIATION_STATUS = Object.freeze({
  MATCHED:    "MATCHED",
  UNMATCHED:  "UNMATCHED",
  PARTIAL:    "PARTIAL",
  EXCEPTION:  "EXCEPTION",
  IGNORED:    "IGNORED",
});

// ─── Transaction schema ────────────────────────────────────────────────────────

/**
 * Create a canonical bank transaction record for reconciliation.
 */
export function createTransaction({
  id,
  date,
  type,
  amount,
  currency,
  description,
  reference     = null,
  counterparty  = null,
  bankAccount   = null,
  country       = null,
  rawData       = null,
}) {
  return Object.freeze({
    id:          id || `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date,
    type,
    amount:      parseFloat(amount) || 0,
    currency,
    description,
    reference,
    counterparty,
    bankAccount,
    country,
    status:      RECONCILIATION_STATUS.UNMATCHED,
    matchedTo:   null,
    rawData:     rawData || null,
    _schema:     "GLV_RECONCILIATION_V1",
    _imported:   new Date().toISOString(),
  });
}

// ─── Matching stubs ────────────────────────────────────────────────────────────

/**
 * Match a transaction against a set of expected payments.
 * Foundation stub — implement matching logic based on reference, amount, date tolerance.
 *
 * @param {object}   transaction  — bank transaction
 * @param {object[]} expectedList — list of expected payment records from GLV system
 * @returns {{ matched: boolean, matchId: string|null, confidence: number }}
 */
export function matchTransaction(transaction, expectedList = []) {
  if (!transaction || !expectedList.length) {
    return { matched: false, matchId: null, confidence: 0 };
  }

  // TODO: Implement fuzzy matching:
  //   1. Exact reference match (confidence: 1.0)
  //   2. Amount + counterparty match within 3-day tolerance (confidence: 0.85)
  //   3. Amount-only match within 1-day tolerance (confidence: 0.6)

  return { matched: false, matchId: null, confidence: 0, note: "TODO: matching engine not yet implemented" };
}

/**
 * Import a raw bank statement and return parsed transactions.
 * Foundation stub.
 *
 * @param {string} rawContent  — raw CSV/TXT bank statement content
 * @param {string} formatId    — bank format identifier (e.g. "FEBRABAN_240")
 * @param {string} country     — country context
 * @returns {object[]}          — array of parsed transaction records
 */
export function importBankStatement(rawContent, formatId, country) {
  // TODO: Implement per-format parsers
  console.warn(`[GLV-GOS][RECONCILIATION] importBankStatement: format "${formatId}" parser not yet implemented`);
  return [];
}

/**
 * Generate a reconciliation summary report.
 */
export function generateReconciliationReport(transactions = []) {
  const matched   = transactions.filter(t => t.status === RECONCILIATION_STATUS.MATCHED).length;
  const unmatched = transactions.filter(t => t.status === RECONCILIATION_STATUS.UNMATCHED).length;
  const total     = transactions.length;
  const totalCredit = transactions.filter(t => t.type === TRANSACTION_TYPES.CREDIT).reduce((s, t) => s + t.amount, 0);
  const totalDebit  = transactions.filter(t => t.type === TRANSACTION_TYPES.DEBIT).reduce((s, t) => s + t.amount, 0);

  return Object.freeze({
    period:       new Date().toISOString().slice(0, 7),
    total,
    matched,
    unmatched,
    matchRate:    total > 0 ? ((matched / total) * 100).toFixed(1) + "%" : "0%",
    totalCredit,
    totalDebit,
    netPosition: totalCredit - totalDebit,
    _generated:  new Date().toISOString(),
  });
}
