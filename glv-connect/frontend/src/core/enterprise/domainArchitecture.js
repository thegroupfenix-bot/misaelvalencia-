/**
 * domainArchitecture.js — GLV GOS Enterprise Domain Architecture V1.0
 *
 * Defines the 6 operational domains of the GLV Global Operating System.
 * Each domain owns its modules, workflows, roles, and data boundaries.
 *
 * This file is the foundation for future domain-based routing, RBAC,
 * audit trails, and multi-country workflow configuration.
 */

export const DOMAINS = Object.freeze({

  // ─── 1. COMMERCIAL DOMAIN ───────────────────────────────────────────────────
  COMMERCIAL: {
    id:          "COMMERCIAL",
    name:        "Commercial Domain",
    description: "Export documentation, pricing, contracts, negotiations",
    icon:        "ti-file-description",
    modules: [
      { id: "SCO",         name: "Soft Corporate Offer",       status: "active" },
      { id: "FCO",         name: "Full Corporate Offer",       status: "active" },
      { id: "SPA",         name: "Sales Purchase Agreement",   status: "active" },
      { id: "PRICING",     name: "Global Price Center",        status: "active" },
      { id: "NEGOTIATIONS",name: "Negotiations Tracker",       status: "planned" },
    ],
  },

  // ─── 2. OPERATIONS DOMAIN ──────────────────────────────────────────────────
  OPERATIONS: {
    id:          "OPERATIONS",
    name:        "Operations Domain",
    description: "Shipments, inspections, veterinary, loading, ports, warehouse",
    icon:        "ti-truck",
    modules: [
      { id: "SHIPMENTS",    name: "Shipment Tracking",         status: "active" },
      { id: "INSPECTIONS",  name: "SGS / Quality Inspections", status: "planned" },
      { id: "VETERINARY",   name: "Veterinary & Sanitary",     status: "planned" },
      { id: "LOADING",      name: "Loading Management",        status: "planned" },
      { id: "PORTS",        name: "Port Operations",           status: "planned" },
      { id: "WAREHOUSE",    name: "Warehouse Management",      status: "planned" },
    ],
  },

  // ─── 3. FINANCIAL DOMAIN ───────────────────────────────────────────────────
  FINANCIAL: {
    id:          "FINANCIAL",
    name:        "Financial Domain",
    description: "Invoices, banking, treasury, reconciliations, commissions, accounting",
    icon:        "ti-currency-dollar",
    modules: [
      { id: "INVOICES",       name: "Invoicing",                status: "active" },
      { id: "BANKING",        name: "Banking & Bank Exports",   status: "foundation" },
      { id: "TREASURY",       name: "Treasury Operations",      status: "foundation" },
      { id: "RECONCILIATION", name: "Bank Reconciliation",      status: "foundation" },
      { id: "COMMISSIONS",    name: "Agent Commissions",        status: "planned" },
      { id: "ACCOUNTING",     name: "Accounting Integrations",  status: "planned" },
    ],
  },

  // ─── 4. HR DOMAIN ──────────────────────────────────────────────────────────
  HR: {
    id:          "HR",
    name:        "Human Resources Domain",
    description: "Employees, payroll, attendance, biometrics, approvals",
    icon:        "ti-users",
    modules: [
      { id: "EMPLOYEES",   name: "Employee Registry",          status: "planned" },
      { id: "PAYROLL",     name: "Payroll & Bank Exports",     status: "foundation" },
      { id: "ATTENDANCE",  name: "Attendance & Time",          status: "planned" },
      { id: "BIOMETRICS",  name: "Biometrics Integration",     status: "planned" },
      { id: "REGIONAL",    name: "Regional Staff",             status: "planned" },
      { id: "APPROVALS",   name: "Approval Workflows",         status: "planned" },
    ],
  },

  // ─── 5. COMPLIANCE DOMAIN ──────────────────────────────────────────────────
  COMPLIANCE: {
    id:          "COMPLIANCE",
    name:        "Compliance Domain",
    description: "ISO 9001, CAPA, audit trails, document control, certifications",
    icon:        "ti-shield-check",
    modules: [
      { id: "ISO9001",        name: "ISO 9001 Quality System",  status: "planned" },
      { id: "CAPA",           name: "CAPA Management",          status: "planned" },
      { id: "AUDIT_TRAIL",    name: "Global Audit Trail",       status: "foundation" },
      { id: "DOC_CONTROL",    name: "Document Control",         status: "active" },
      { id: "CERTIFICATIONS", name: "Certification Registry",   status: "planned" },
    ],
  },

  // ─── 6. MEDIA & DOCUMENT DOMAIN ────────────────────────────────────────────
  MEDIA: {
    id:          "MEDIA",
    name:        "Media & Document Domain",
    description: "Technical sheets, branding, export media, downloadable assets",
    icon:        "ti-photo",
    modules: [
      { id: "MEDIA_CENTER",   name: "Media Center",             status: "active" },
      { id: "TECH_SHEETS",    name: "Technical Datasheets",     status: "planned" },
      { id: "BRANDING",       name: "Brand Asset Library",      status: "active" },
      { id: "EXPORT_MEDIA",   name: "Export Media Hub",         status: "active" },
      { id: "DOWNLOADS",      name: "Downloadable Assets",      status: "planned" },
    ],
  },

});

/** Module status values */
export const MODULE_STATUS = Object.freeze({
  ACTIVE:     "active",      // live and usable
  FOUNDATION: "foundation",  // schema/structure ready, logic pending
  PLANNED:    "planned",     // defined, not yet built
  DEPRECATED: "deprecated",  // legacy, will be removed
});

/**
 * Get all active modules across all domains.
 */
export function getActiveModules() {
  return Object.values(DOMAINS).flatMap(d =>
    d.modules.filter(m => m.status === MODULE_STATUS.ACTIVE).map(m => ({ ...m, domain: d.id }))
  );
}

/**
 * Get all modules for a given domain.
 */
export function getDomainModules(domainId) {
  return DOMAINS[domainId]?.modules || [];
}
