/**
 * platformIdentity.js — GLV Global Operating System — Single Source of Truth
 *
 * ALL platform name references in UI, PDF, console, and document layer
 * must import from here. Never hardcode platform names anywhere else.
 *
 * Replaces legacy references:
 *   SAT, SCO Generator, Commercial Engine, Export Generator,
 *   Price Center, PDF Engine, App V8/V9, GLV-Connect SAT v3
 */

export const PLATFORM = Object.freeze({

  // ─── Primary identity ────────────────────────────────────────────────────────

  /** Full official platform name */
  name:         "GLV GLOBAL OPERATING SYSTEM",

  /** Short alias for UI contexts with limited space */
  short:        "GLV GOS",

  /** Internal technical alias */
  alias:        "GLV GOS",

  /** Platform type descriptor */
  type:         "Enterprise Export & Operations Infrastructure",

  /** Platform version */
  version:      "1.0",

  /** Build year */
  year:         "2026",

  // ─── Corporate group ─────────────────────────────────────────────────────────

  group:        "GLV Holding Group",

  entities: Object.freeze([
    "GLV Services SAS",
    "GLV Global Food Services LLC",
    "GLV Global Group",
    "GLV Global Foods Brasil Ltda.",
  ]),

  /** Primary operating entity for export documents */
  exportEntity: "GLV Global Food Services LLC",

  /** Miami address */
  address:      "19790 W Dixie Hwy, Unit 1115, Miami, FL 33180, USA",

  /** Primary domain */
  domain:       "glvglobalfoodservices.com",

  // ─── Contact ─────────────────────────────────────────────────────────────────

  emails: Object.freeze({
    operations:   "info@glvglobalfoodservices.com",
    accounting:   "contabilidad@glvservicesexp.com",
    compliance:   "compliance@glvglobalfoodservices.com",
  }),

  // ─── UI copy ─────────────────────────────────────────────────────────────────

  /** Browser tab title */
  pageTitle:    "GLV GOS — Global Operating System | GLV Holding Group",

  /** Login screen subtitle */
  loginSubtitle: "Enterprise Export & Operations Infrastructure",

  /** Sidebar brand line 1 */
  sidebarName:  "GLV GOS",

  /** Sidebar brand line 2 */
  sidebarSub:   "Global Operating System",

  /** Footer copyright */
  copyright:    "GLV Holding Group © 2026",

  /** Loading screen message */
  loadingMsg:   "GLV GOS — Initializing...",

  /** Restricted access notice */
  accessNotice: "Acceso restringido — GLV Holding Group © 2026",

  // ─── Console prefix ───────────────────────────────────────────────────────────

  /** Console log prefix for all platform modules */
  logPrefix:    "[GLV-GOS]",

});

/**
 * Get a formatted header string for export documents.
 * Used in PDF cover and footer.
 */
export function getPlatformDocHeader() {
  return `${PLATFORM.exportEntity} — ${PLATFORM.domain}`;
}

/**
 * Get footer copy string for PDF documents.
 */
export function getPlatformFooterCopy() {
  return `Agente: {agent} | ${PLATFORM.emails.accounting} • ${PLATFORM.emails.operations}`;
}
