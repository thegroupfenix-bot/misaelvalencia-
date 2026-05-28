/**
 * PayrollLayoutEngine.js — GLV GOS Financial Domain — Payroll Layouts Foundation V1.0
 *
 * Foundation for country-specific payroll export formats.
 *
 * STATUS: FOUNDATION — layout registry and record schema defined.
 * Country-specific generators to be implemented per country rollout.
 */

export const PAYROLL_LAYOUTS = Object.freeze({

  ESOCIAL_BRAZIL: {
    id:         "ESOCIAL_BRAZIL",
    name:       "eSocial — Brazil",
    country:    "BRAZIL",
    format:     "xml",
    description:"Brazilian federal payroll reporting system (eSocial)",
    requiredFields: ["cpf", "name", "salary", "admissionDate", "role", "department"],
    status:     "planned",
  },

  AFIP_ARGENTINA: {
    id:         "AFIP_ARGENTINA",
    name:       "AFIP SiCore — Argentina",
    country:    "ARGENTINA",
    format:     "txt",
    description:"Argentine AFIP payroll and withholding export format",
    requiredFields: ["cuil", "name", "grossSalary", "retentions", "period"],
    status:     "planned",
  },

  PREVIRED_CHILE: {
    id:         "PREVIRED_CHILE",
    name:       "Previred — Chile",
    country:    "CHILE",
    format:     "csv",
    description:"Chilean Previred format for AFP and health contributions",
    requiredFields: ["rut", "name", "salary", "afp", "health", "period"],
    status:     "planned",
  },

  BPS_URUGUAY: {
    id:         "BPS_URUGUAY",
    name:       "BPS — Uruguay",
    country:    "URUGUAY",
    format:     "txt",
    description:"Uruguayan BPS social security export format",
    requiredFields: ["ci", "name", "salary", "category", "period"],
    status:     "planned",
  },

  PILA_COLOMBIA: {
    id:         "PILA_COLOMBIA",
    name:       "PILA — Colombia",
    country:    "COLOMBIA",
    format:     "txt",
    description:"Colombian PILA payroll contributions format",
    requiredFields: ["cedula", "name", "ibc", "eps", "afp", "arl", "period"],
    status:     "planned",
  },

});

/**
 * Create a canonical payroll record — all layout formatters accept this schema.
 */
export function createPayrollRecord({
  employeeId,
  nationalId,
  name,
  role,
  department,
  country,
  grossSalary,
  currency,
  period,          // "YYYY-MM"
  deductions = {},
  contributions = {},
  bankInfo    = {},
}) {
  return Object.freeze({
    employeeId,
    nationalId,
    name,
    role,
    department,
    country,
    grossSalary,
    netSalary: grossSalary - Object.values(deductions).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    currency,
    period,
    deductions:    Object.freeze(deductions),
    contributions: Object.freeze(contributions),
    bankInfo:      Object.freeze(bankInfo),
    _schema:       "GLV_PAYROLL_V1",
    _generated:    new Date().toISOString(),
  });
}

/**
 * Get available payroll layouts for a country.
 */
export function getPayrollLayoutsForCountry(countryId) {
  return Object.values(PAYROLL_LAYOUTS).filter(l => l.country === countryId);
}
