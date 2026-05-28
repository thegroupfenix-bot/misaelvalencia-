/**
 * EnterpriseArchitectureMap.js — GLV GOS Core Governance — Architecture Map V1.0
 *
 * Maps all enterprise domains, modules, dependencies, and readiness status.
 * Serves as the authoritative dependency graph for GLV GOS.
 *
 * STATUS: ACTIVE — governance map.
 */

// ─── Domain constants ────────────────────────────────────────────────────────────

export const ARCHITECTURE_DOMAINS = Object.freeze({
  COMMERCIAL:    "COMMERCIAL",
  FINANCIAL:     "FINANCIAL",
  OPERATIONS:    "OPERATIONS",
  AUDIT:         "AUDIT",
  COMPLIANCE:    "COMPLIANCE",
  HR:            "HR",
  LOGISTICS:     "LOGISTICS",
  CLIENT_PORTAL: "CLIENT_PORTAL",
  BANKING:       "BANKING",
  DOCUMENTS:     "DOCUMENTS",
  ORCHESTRATION: "ORCHESTRATION",
  SYSTEM:        "SYSTEM",
});

export const MODULE_STATUS = Object.freeze({
  ACTIVE:       "ACTIVE",
  FOUNDATION:   "FOUNDATION",
  PLANNED:      "PLANNED",
  LEGACY:       "LEGACY",
  DEPRECATED:   "DEPRECATED",
});

// ─── Architecture registry ───────────────────────────────────────────────────────

export const ARCHITECTURE_MAP = Object.freeze({

  // ── ORCHESTRATION ────────────────────────────────────────────────────────────
  EnterpriseOrchestrator: {
    id:           "EnterpriseOrchestrator",
    domain:       ARCHITECTURE_DOMAINS.ORCHESTRATION,
    path:         "core/orchestration/EnterpriseOrchestrator.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: ["OperationChainEngine", "WorkflowStateEngine", "MasterEntityRegistry", "DocumentRelationEngine", "AuditTrailEngine", "LanguageCore", "RoleAccessEngine", "OperationRegistry"],
    countryScope: "global",
    auditScope:   true,
    apiReady:     true,
    description:  "Central coordination layer — connects all enterprise engines",
  },

  OperationRegistry: {
    id:           "OperationRegistry",
    domain:       ARCHITECTURE_DOMAINS.OPERATIONS,
    path:         "core/operations/OperationRegistry.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: [],
    countryScope: "global",
    auditScope:   true,
    apiReady:     true,
    description:  "Single source of truth for all operations — adapter-ready for DB",
  },

  // ── OPERATIONS ───────────────────────────────────────────────────────────────
  OperationChainEngine: {
    id:           "OperationChainEngine",
    domain:       ARCHITECTURE_DOMAINS.OPERATIONS,
    path:         "core/operations/OperationChainEngine.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: [],
    countryScope: "global",
    auditScope:   true,
    apiReady:     true,
    description:  "Multi-entity operation chain management (9 chain roles)",
  },

  WorkflowStateEngine: {
    id:           "WorkflowStateEngine",
    domain:       ARCHITECTURE_DOMAINS.OPERATIONS,
    path:         "core/workflows/WorkflowStateEngine.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: [],
    countryScope: "global",
    auditScope:   true,
    apiReady:     true,
    description:  "13-state workflow machine with transition rules",
  },

  // ── DOCUMENTS ────────────────────────────────────────────────────────────────
  DocumentRelationEngine: {
    id:           "DocumentRelationEngine",
    domain:       ARCHITECTURE_DOMAINS.DOCUMENTS,
    path:         "core/documents/DocumentRelationEngine.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: [],
    countryScope: "global",
    auditScope:   true,
    apiReady:     true,
    description:  "Links 12 document types to operations via chain validation",
  },

  EnterpriseDocumentFlow: {
    id:           "EnterpriseDocumentFlow",
    domain:       ARCHITECTURE_DOMAINS.DOCUMENTS,
    path:         "core/documents/EnterpriseDocumentFlow.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: ["DocumentRelationEngine", "WorkflowStateEngine"],
    countryScope: "global",
    auditScope:   true,
    apiReady:     false,
    description:  "Document lifecycle flow: SCO→FCO→SPA→Invoice→PL→BL→Delivery",
  },

  // ── AUDIT ────────────────────────────────────────────────────────────────────
  AuditTrailEngine: {
    id:           "AuditTrailEngine",
    domain:       ARCHITECTURE_DOMAINS.AUDIT,
    path:         "core/audit/AuditTrailEngine.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: [],
    countryScope: "global",
    auditScope:   true,
    apiReady:     true,
    description:  "22 audit action types, in-memory audit queue",
  },

  AuditTimelineEngine: {
    id:           "AuditTimelineEngine",
    domain:       ARCHITECTURE_DOMAINS.AUDIT,
    path:         "core/audit/AuditTimelineEngine.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: ["AuditTrailEngine"],
    countryScope: "global",
    auditScope:   true,
    apiReady:     false,
    description:  "Operational event timelines — client-portal ready",
  },

  // ── COMMERCIAL ───────────────────────────────────────────────────────────────
  GlvPDF: {
    id:           "GlvPDF",
    domain:       ARCHITECTURE_DOMAINS.COMMERCIAL,
    path:         "components/GlvPDF.jsx",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: ["documentModeResolver", "MediaCategoryIsolationEngine", "safeCurrencyResolver", "pdfPayloadSanitizer"],
    countryScope: "global",
    auditScope:   true,
    apiReady:     false,
    description:  "Primary PDF renderer — 8 document modes, category isolation, VAL-049 guard",
  },

  PdfOrchestrationBridge: {
    id:           "PdfOrchestrationBridge",
    domain:       ARCHITECTURE_DOMAINS.COMMERCIAL,
    path:         "core/pdf/PdfOrchestrationBridge.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: ["OperationRegistry", "OperationChainEngine", "EnterpriseOrchestrator", "LanguageCore"],
    countryScope: "global",
    auditScope:   true,
    apiReady:     false,
    description:  "Attaches orchestration metadata to PDF payloads",
  },

  PdfExecutiveLayoutEngine: {
    id:           "PdfExecutiveLayoutEngine",
    domain:       ARCHITECTURE_DOMAINS.COMMERCIAL,
    path:         "core/pdf/PdfExecutiveLayoutEngine.js",
    status:       MODULE_STATUS.FOUNDATION,
    dependencies: ["OperationChainEngine"],
    countryScope: "global",
    auditScope:   false,
    apiReady:     false,
    description:  "Executive layout block data builders (7 zones) — no JSX",
  },

  ExecutivePdfPresentationMap: {
    id:           "ExecutivePdfPresentationMap",
    domain:       ARCHITECTURE_DOMAINS.COMMERCIAL,
    path:         "core/pdf/ExecutivePdfPresentationMap.js",
    status:       MODULE_STATUS.FOUNDATION,
    dependencies: [],
    countryScope: "global",
    auditScope:   false,
    apiReady:     false,
    description:  "10-zone executive PDF architecture specification",
  },

  // ── FINANCIAL ────────────────────────────────────────────────────────────────
  BankExportEngine: {
    id:           "BankExportEngine",
    domain:       ARCHITECTURE_DOMAINS.BANKING,
    path:         "financial/bankExports/BankExportEngine.js",
    status:       MODULE_STATUS.FOUNDATION,
    dependencies: [],
    countryScope: ["BRAZIL", "ARGENTINA", "CHILE", "COLOMBIA"],
    auditScope:   true,
    apiReady:     false,
    description:  "FEBRABAN_240/150, INTERBANKING, ABIF, ACH_COLOMBIA export formats",
  },

  PayrollLayoutEngine: {
    id:           "PayrollLayoutEngine",
    domain:       ARCHITECTURE_DOMAINS.HR,
    path:         "financial/payrollLayouts/PayrollLayoutEngine.js",
    status:       MODULE_STATUS.FOUNDATION,
    dependencies: [],
    countryScope: ["BRAZIL", "ARGENTINA", "CHILE", "URUGUAY", "COLOMBIA"],
    auditScope:   true,
    apiReady:     false,
    description:  "eSocial, AFIP, Previred, BPS, PILA payroll export layouts",
  },

  ReconciliationEngine: {
    id:           "ReconciliationEngine",
    domain:       ARCHITECTURE_DOMAINS.FINANCIAL,
    path:         "financial/reconciliation/ReconciliationEngine.js",
    status:       MODULE_STATUS.FOUNDATION,
    dependencies: [],
    countryScope: "global",
    auditScope:   true,
    apiReady:     false,
    description:  "Bank statement import + reconciliation matching engine",
  },

  // ── COMPLIANCE ───────────────────────────────────────────────────────────────
  EnterpriseRoleFlowEngine: {
    id:           "EnterpriseRoleFlowEngine",
    domain:       ARCHITECTURE_DOMAINS.COMPLIANCE,
    path:         "core/rbac/EnterpriseRoleFlowEngine.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: ["WorkflowStateEngine"],
    countryScope: "global",
    auditScope:   true,
    apiReady:     true,
    description:  "Role-workflow permission matrix — 12 roles × 22 actions × 13 states",
  },

  RoleAccessEngine: {
    id:           "RoleAccessEngine",
    domain:       ARCHITECTURE_DOMAINS.COMPLIANCE,
    path:         "core/rbac/RoleAccessEngine.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: [],
    countryScope: "global",
    auditScope:   true,
    apiReady:     true,
    description:  "11-role RBAC with PERMISSION_MATRIX and legacy role map",
  },

  // ── GEO / COUNTRY ────────────────────────────────────────────────────────────
  CountryContextEngine: {
    id:           "CountryContextEngine",
    domain:       ARCHITECTURE_DOMAINS.OPERATIONS,
    path:         "core/geo/CountryContextEngine.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: [],
    countryScope: ["BRAZIL", "ARGENTINA", "CHILE", "URUGUAY", "COLOMBIA", "DOMINICAN_REPUBLIC", "TRINIDAD_TOBAGO", "USA", "ITALY", "UAE"],
    auditScope:   false,
    apiReady:     true,
    description:  "10-country registry with bank, payroll, compliance, and timezone config",
  },

  // ── I18N ─────────────────────────────────────────────────────────────────────
  LanguageCore: {
    id:           "LanguageCore",
    domain:       ARCHITECTURE_DOMAINS.SYSTEM,
    path:         "core/i18n/LanguageCore.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: [],
    countryScope: "global",
    auditScope:   false,
    apiReady:     true,
    description:  "ES/EN/PT-BR translation resolver — 60+ keys across 6 namespaces",
  },

  // ── ENTITIES ─────────────────────────────────────────────────────────────────
  MasterEntityRegistry: {
    id:           "MasterEntityRegistry",
    domain:       ARCHITECTURE_DOMAINS.COMMERCIAL,
    path:         "core/entities/MasterEntityRegistry.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: [],
    countryScope: "global",
    auditScope:   true,
    apiReady:     true,
    description:  "6 GLV entities registry — no confidential values in client code",
  },

  // ── SYSTEM ───────────────────────────────────────────────────────────────────
  SystemHealthMonitor: {
    id:           "SystemHealthMonitor",
    domain:       ARCHITECTURE_DOMAINS.SYSTEM,
    path:         "core/system/SystemHealthMonitor.js",
    status:       MODULE_STATUS.ACTIVE,
    dependencies: ["OperationRegistry", "AuditTrailEngine"],
    countryScope: "global",
    auditScope:   false,
    apiReady:     false,
    description:  "Platform health checks and system snapshot",
  },

});

// ─── Map resolver functions ─────────────────────────────────────────────────────

/**
 * Get all modules in a domain.
 *
 * @param {string} domain  — ARCHITECTURE_DOMAINS value
 * @returns {object[]}
 */
export function getModulesByDomain(domain) {
  return Object.values(ARCHITECTURE_MAP).filter(m => m.domain === domain);
}

/**
 * Get modules by status.
 *
 * @param {string} status  — MODULE_STATUS value
 * @returns {object[]}
 */
export function getModulesByStatus(status) {
  return Object.values(ARCHITECTURE_MAP).filter(m => m.status === status);
}

/**
 * Get dependency graph for a module (direct deps only).
 *
 * @param {string} moduleId
 * @returns {{ module: object, dependencies: object[] }}
 */
export function getModuleDependencies(moduleId) {
  const mod = ARCHITECTURE_MAP[moduleId];
  if (!mod) return { module: null, dependencies: [] };

  const deps = (mod.dependencies || [])
    .map(id => ARCHITECTURE_MAP[id])
    .filter(Boolean);

  return { module: mod, dependencies: deps };
}

/**
 * Get all API-ready modules.
 *
 * @returns {object[]}
 */
export function getApiReadyModules() {
  return Object.values(ARCHITECTURE_MAP).filter(m => m.apiReady);
}

/**
 * Get all audit-scoped modules.
 *
 * @returns {object[]}
 */
export function getAuditScopedModules() {
  return Object.values(ARCHITECTURE_MAP).filter(m => m.auditScope);
}

/**
 * Generate a governance status summary.
 *
 * @returns {object}
 */
export function generateGovernanceSummary() {
  const all      = Object.values(ARCHITECTURE_MAP);
  const byStatus = {};
  const byDomain = {};

  for (const mod of all) {
    byStatus[mod.status] = (byStatus[mod.status] || 0) + 1;
    byDomain[mod.domain] = (byDomain[mod.domain] || 0) + 1;
  }

  return Object.freeze({
    totalModules:  all.length,
    byStatus,
    byDomain,
    apiReady:      all.filter(m => m.apiReady).length,
    auditScoped:   all.filter(m => m.auditScope).length,
    _generated:    new Date().toISOString(),
  });
}
