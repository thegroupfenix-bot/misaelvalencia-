/**
 * ExecutiveTimelineEngine.js — GLV GOS Executive PDF V2 — Timeline Engine V1.0
 *
 * Produces executive-grade visual operation timeline data for PDF rendering.
 * Maps the 10-stage export lifecycle into a display-ready component spec.
 *
 * Timeline stages:
 *   DRAFT → QUOTED → APPROVED → CONTRACTED → PAYMENT
 *   → PRODUCTION → INSPECTION → LOADING → SHIPPED → DELIVERED
 *
 * STATUS: ACTIVE — Executive PDF V2
 * No JSX. No @react-pdf. Pure data — consumed by GlvPDF.jsx.
 */

import { BADGE_STYLES, EXECUTIVE_COLORS, EXECUTIVE_TYPOGRAPHY, EXECUTIVE_SPACING } from "./ExecutiveVisualIdentityEngine.js";

// ─── Timeline stage definitions ─────────────────────────────────────────────────

export const TIMELINE_STAGES = Object.freeze([

  {
    id:     "DRAFT",
    order:  1,
    labels: { es: "Borrador",              en: "Draft",               "pt-br": "Rascunho" },
    icon:   "file-text",
  },
  {
    id:     "QUOTED",
    order:  2,
    labels: { es: "Cotizado",              en: "Quoted",              "pt-br": "Cotado" },
    icon:   "send",
  },
  {
    id:     "APPROVED",
    order:  3,
    labels: { es: "Aprobado",              en: "Approved",            "pt-br": "Aprovado" },
    icon:   "check-circle",
  },
  {
    id:     "CONTRACTED",
    order:  4,
    labels: { es: "Contratado",            en: "Contracted",          "pt-br": "Contratado" },
    icon:   "file-contract",
  },
  {
    id:     "PAYMENT",
    order:  5,
    labels: { es: "Pago",                  en: "Payment",             "pt-br": "Pagamento" },
    icon:   "credit-card",
  },
  {
    id:     "PRODUCTION",
    order:  6,
    labels: { es: "Producción",            en: "Production",          "pt-br": "Produção" },
    icon:   "settings",
  },
  {
    id:     "INSPECTION",
    order:  7,
    labels: { es: "Inspección",            en: "Inspection",          "pt-br": "Inspeção" },
    icon:   "search",
  },
  {
    id:     "LOADING",
    order:  8,
    labels: { es: "Embarque",              en: "Loading",             "pt-br": "Embarque" },
    icon:   "package",
  },
  {
    id:     "SHIPPED",
    order:  9,
    labels: { es: "Tránsito",              en: "Shipped",             "pt-br": "Em Trânsito" },
    icon:   "ship",
  },
  {
    id:     "DELIVERED",
    order:  10,
    labels: { es: "Entregado",             en: "Delivered",           "pt-br": "Entregue" },
    icon:   "map-pin",
  },

]);

// ─── Workflow state → timeline stage map ────────────────────────────────────────
// Maps WorkflowStateEngine states to visual timeline positions.

const STATE_TO_TIMELINE = Object.freeze({
  DRAFT:               "DRAFT",
  QUOTED:              "QUOTED",
  APPROVED:            "APPROVED",
  CONTRACTED:          "CONTRACTED",
  PAYMENT_PENDING:     "PAYMENT",
  PAYMENT_CONFIRMED:   "PAYMENT",
  PRODUCTION:          "PRODUCTION",
  INSPECTION:          "INSPECTION",
  READY_FOR_LOADING:   "LOADING",
  LOADED:              "LOADING",
  SHIPPED:             "SHIPPED",
  DELIVERED:           "DELIVERED",
  CLOSED:              "DELIVERED",
});

// ─── Status helpers ─────────────────────────────────────────────────────────────

function getStageStatus(stage, currentTimelineId, currentOrder) {
  if (stage.id === currentTimelineId)   return "current";
  if (stage.order < currentOrder)       return "completed";
  return "pending";
}

function getBadgeStyle(status) {
  if (status === "current")   return BADGE_STYLES.WORKFLOW_CURRENT;
  if (status === "completed") return BADGE_STYLES.WORKFLOW_DONE;
  return BADGE_STYLES.WORKFLOW_PENDING;
}

// ─── Timeline builder ───────────────────────────────────────────────────────────

/**
 * Build the full executive timeline data for a given workflow state.
 *
 * @param {string} workflowState  — WorkflowStateEngine state (e.g. "QUOTED")
 * @param {string} [lang]         — "es" | "en" | "pt-br"
 * @returns {object}               — timeline render data
 */
export function buildExecutiveTimeline(workflowState = "DRAFT", lang = "es") {
  const currentTimelineId = STATE_TO_TIMELINE[workflowState] || "DRAFT";
  const currentStage      = TIMELINE_STAGES.find(s => s.id === currentTimelineId);
  const currentOrder      = currentStage?.order || 1;

  const stages = TIMELINE_STAGES.map(stage => {
    const status = getStageStatus(stage, currentTimelineId, currentOrder);
    return Object.freeze({
      id:          stage.id,
      order:       stage.order,
      label:       (stage.labels || {})[lang] || (stage.labels || {}).en,
      icon:        stage.icon,
      status,
      isCurrent:   status === "current",
      isCompleted: status === "completed",
      isPending:   status === "pending",
      badgeStyle:  getBadgeStyle(status),
      nodeColor:   status === "current"   ? EXECUTIVE_COLORS.ACCENT_GOLD
                 : status === "completed" ? EXECUTIVE_COLORS.STATUS_GREEN
                 :                          EXECUTIVE_COLORS.BORDER_MEDIUM,
      connectorColor: status === "pending" ? EXECUTIVE_COLORS.BORDER_LIGHT
                                           : EXECUTIVE_COLORS.ACCENT_GOLD,
    });
  });

  return Object.freeze({
    workflowState,
    currentTimelineId,
    currentOrder,
    totalStages:       TIMELINE_STAGES.length,
    completedCount:    stages.filter(s => s.isCompleted).length,
    progressPercent:   Math.round(((currentOrder - 1) / (TIMELINE_STAGES.length - 1)) * 100),
    stages,
    lang,
    layout: Object.freeze({
      direction:          "horizontal",
      nodeSize:           EXECUTIVE_SPACING.TIMELINE_NODE_SIZE,
      connectorWidth:     EXECUTIVE_SPACING.TIMELINE_CONNECTOR,
      rowHeight:          EXECUTIVE_SPACING.TIMELINE_ROW_HEIGHT,
      typography:         EXECUTIVE_TYPOGRAPHY.TIMELINE,
      background:         EXECUTIVE_COLORS.SURFACE_ALT,
      activeNodeColor:    EXECUTIVE_COLORS.ACCENT_GOLD,
      completedNodeColor: EXECUTIVE_COLORS.STATUS_GREEN,
      pendingNodeColor:   EXECUTIVE_COLORS.BORDER_MEDIUM,
      labelColor:         EXECUTIVE_COLORS.TEXT_MUTED,
      currentLabelColor:  EXECUTIVE_COLORS.TEXT_PRIMARY,
    }),
    _schema:  "GLV_EXECUTIVE_TIMELINE_V2",
  });
}

/**
 * Build a compact inline timeline for PDF page headers/footers.
 * Returns a condensed 4-stage view (previous, current, next, final).
 *
 * @param {string} workflowState
 * @param {string} [lang]
 * @returns {object}
 */
export function buildCompactTimeline(workflowState = "DRAFT", lang = "es") {
  const full          = buildExecutiveTimeline(workflowState, lang);
  const currentIdx    = full.stages.findIndex(s => s.isCurrent);

  const prev    = full.stages[Math.max(0, currentIdx - 1)];
  const current = full.stages[currentIdx];
  const next    = full.stages[Math.min(TIMELINE_STAGES.length - 1, currentIdx + 1)];
  const last    = full.stages[TIMELINE_STAGES.length - 1];

  const compactStages = [prev, current, next, last].filter(Boolean);
  const unique = compactStages.filter((s, idx, arr) => arr.findIndex(x => x.id === s.id) === idx);

  return Object.freeze({
    workflowState,
    currentOrder:    full.currentOrder,
    totalStages:     full.totalStages,
    progressPercent: full.progressPercent,
    stages:          unique,
    compact:         true,
    lang,
    _schema:         "GLV_COMPACT_TIMELINE_V2",
  });
}

/**
 * Get a localized progress label for the current workflow state.
 *
 * @param {string} workflowState
 * @param {string} [lang]
 * @returns {string}  — e.g. "Stage 3 of 10 — Approved"
 */
export function getTimelineProgressLabel(workflowState, lang = "es") {
  const timeline = buildExecutiveTimeline(workflowState, lang);
  const current  = timeline.stages.find(s => s.isCurrent);

  if (!current) return "";

  const templates = {
    es:    `Etapa ${timeline.currentOrder} de ${timeline.totalStages} — ${current.label}`,
    en:    `Stage ${timeline.currentOrder} of ${timeline.totalStages} — ${current.label}`,
    "pt-br": `Etapa ${timeline.currentOrder} de ${timeline.totalStages} — ${current.label}`,
  };
  return templates[lang] || templates.en;
}
