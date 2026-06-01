/**
 * BankExportEngine.js — GLV GOS Financial Domain — Bank Exports Foundation V1.0
 *
 * Foundation for CSV/TXT bank export generation per country format.
 *
 * STATUS: FOUNDATION — format registry defined. Generator logic pending.
 *
 * Supported formats (to be implemented):
 *   FEBRABAN_240 — Brazil (Banco do Brasil, Itaú, Santander)
 *   FEBRABAN_150 — Brazil (Caixa Econômica, legacy formats)
 *   INTERBANKING  — Argentina
 *   ABIF          — Chile
 *   ACH_Colombia  — Colombia
 *   ACH_RD        — Dominican Republic
 */

export const BANK_EXPORT_FORMATS = Object.freeze({

  FEBRABAN_240: {
    id:        "FEBRABAN_240",
    name:      "FEBRABAN CNAB 240",
    country:   "BRAZIL",
    currency:  "BRL",
    type:      "txt",
    description: "Brazilian banking standard CNAB 240 — supports salary, payments, collections",
    status:    "planned",
  },

  FEBRABAN_150: {
    id:        "FEBRABAN_150",
    name:      "FEBRABAN CNAB 150",
    country:   "BRAZIL",
    currency:  "BRL",
    type:      "txt",
    description: "Brazilian banking standard CNAB 150 — legacy format for salary and commissions",
    status:    "planned",
  },

  INTERBANKING: {
    id:        "INTERBANKING",
    name:      "Interbanking Argentina",
    country:   "ARGENTINA",
    currency:  "ARS",
    type:      "txt",
    description: "Argentine banking exchange format for salary, payments, and collections",
    status:    "planned",
  },

  ABIF: {
    id:        "ABIF",
    name:      "ABIF Chile",
    country:   "CHILE",
    currency:  "CLP",
    type:      "txt",
    description: "Chilean ABIF standard — banco export for salary and payment batches",
    status:    "planned",
  },

  ACH_COLOMBIA: {
    id:        "ACH_COLOMBIA",
    name:      "ACH Colombia",
    country:   "COLOMBIA",
    currency:  "COP",
    type:      "txt",
    description: "Colombian ACH network format for payroll and supplier payments",
    status:    "planned",
  },

  GENERIC_CSV: {
    id:        "GENERIC_CSV",
    name:      "Generic CSV Export",
    country:   null,
    currency:  "USD",
    type:      "csv",
    description: "Generic CSV export for treasury reconciliation and data exchange",
    status:    "foundation",
  },

});

/**
 * Get available export formats for a country.
 */
export function getFormatsForCountry(countryId) {
  return Object.values(BANK_EXPORT_FORMATS).filter(
    f => f.country === countryId || f.country === null
  );
}

/**
 * Export record schema — all bank export rows conform to this structure.
 * Specific formatters map these fields to country-specific byte positions.
 */
export function createExportRecord({
  type,          // "SALARY" | "COMMISSION" | "PAYMENT" | "COLLECTION"
  beneficiaryId,
  beneficiaryName,
  bankCode,
  agencyCode     = null,
  accountType,   // "CHECKING" | "SAVINGS"
  accountNumber,
  amount,
  currency,
  reference      = null,
  dueDate        = null,
  description    = null,
}) {
  return Object.freeze({
    type,
    beneficiary: Object.freeze({ id: beneficiaryId, name: beneficiaryName }),
    bank: Object.freeze({ code: bankCode, agency: agencyCode, accountType, accountNumber }),
    amount,
    currency,
    reference:   reference || `GLV_${Date.now()}`,
    dueDate:     dueDate || new Date().toISOString().split("T")[0],
    description: description || "",
    _schema:     "GLV_BANK_EXPORT_V1",
  });
}

// TODO: Implement per-country formatters:
// export function generateFEBRABAN240(records, header) { ... }
// export function generateINTERBANKING(records, header) { ... }
// export function generateABIF(records, header) { ... }
