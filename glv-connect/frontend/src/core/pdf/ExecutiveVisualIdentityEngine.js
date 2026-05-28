/**
 * ExecutiveVisualIdentityEngine.js — GLV GOS Executive PDF V2 — Visual Identity V1.0
 *
 * Single source of truth for all visual identity rules in executive PDFs.
 * Covers: color palette, typography hierarchy, spacing standards,
 * section separators, corporate visual rhythm, table presentation rules,
 * executive badge system.
 *
 * STATUS: ACTIVE — Executive PDF V2
 * No JSX. No @react-pdf imports. Pure data — consumed by GlvPDF.jsx renderers.
 */

// ─── Color palette ──────────────────────────────────────────────────────────────

export const EXECUTIVE_COLORS = Object.freeze({

  // Primary brand
  PRIMARY_DARK:     "#1B2A4A",   // GLV deep navy — hero headers, cover bg
  PRIMARY_MEDIUM:   "#243656",   // section headers, table heads
  PRIMARY_LIGHT:    "#2D4A7A",   // secondary headers, highlights

  // Accent
  ACCENT_GOLD:      "#C9A84C",   // enterprise gold — dividers, badges, emphasis
  ACCENT_GOLD_LIGHT:"#E8C97A",   // light gold — secondary accents
  ACCENT_BLUE:      "#2D6BC4",   // action blue — links, call-outs

  // Surface
  SURFACE:          "#FFFFFF",   // primary white — main content areas
  SURFACE_ALT:      "#F8FAFC",   // off-white — alternating rows, summary panels
  SURFACE_TERTIARY: "#F1F5F9",   // light grey — section backgrounds
  SURFACE_DARK:     "#0F172A",   // near-black — used sparingly for contrast

  // Text
  TEXT_LIGHT:       "#FFFFFF",   // on dark backgrounds
  TEXT_PRIMARY:     "#0F172A",   // primary body text
  TEXT_SECONDARY:   "#334155",   // secondary text, subheadings
  TEXT_MUTED:       "#64748B",   // labels, captions, metadata
  TEXT_DISABLED:    "#94A3B8",   // placeholder, disabled states

  // Borders
  BORDER_LIGHT:     "#E2E8F0",   // subtle dividers
  BORDER_MEDIUM:    "#CBD5E1",   // table borders, section lines
  BORDER_STRONG:    "#94A3B8",   // strong separators

  // Status
  STATUS_GREEN:     "#059669",   // confirmed, approved
  STATUS_AMBER:     "#D97706",   // pending, warning
  STATUS_RED:       "#DC2626",   // rejected, error
  STATUS_BLUE:      "#2563EB",   // informational

  // Category accents
  CATEGORY_OILS:    "#C9A84C",
  CATEGORY_GRAINS:  "#B8860B",
  CATEGORY_ANIMALS: "#6B8E6B",
  CATEGORY_FROZEN:  "#4A90C4",
  CATEGORY_FOOD:    "#C9A84C",

});

// ─── Typography scale ───────────────────────────────────────────────────────────

export const EXECUTIVE_TYPOGRAPHY = Object.freeze({

  HEADER: Object.freeze({
    platformName:  { size: 18, weight: 700, letterSpacing: 2, family: "Helvetica-Bold" },
    platformSub:   { size: 9,  weight: 400, letterSpacing: 1.5, family: "Helvetica" },
    entityName:    { size: 11, weight: 600, letterSpacing: 0.5, family: "Helvetica-Bold" },
    documentRef:   { size: 9,  weight: 400, family: "Helvetica" },
  }),

  TITLE: Object.freeze({
    mainTitle:     { size: 24, weight: 700, letterSpacing: 0.5, family: "Helvetica-Bold" },
    subTitle:      { size: 14, weight: 400, letterSpacing: 0.3, family: "Helvetica" },
    refBadge:      { size: 10, weight: 600, family: "Helvetica-Bold" },
  }),

  SECTION: Object.freeze({
    heading:       { size: 12, weight: 700, letterSpacing: 1.2, family: "Helvetica-Bold", transform: "uppercase" },
    subheading:    { size: 10, weight: 600, family: "Helvetica-Bold" },
    body:          { size: 9.5, weight: 400, lineHeight: 1.5, family: "Helvetica" },
    caption:       { size: 8,  weight: 400, lineHeight: 1.4, family: "Helvetica" },
  }),

  TABLE: Object.freeze({
    header:        { size: 9,  weight: 700, letterSpacing: 0.8, family: "Helvetica-Bold", transform: "uppercase" },
    body:          { size: 9,  weight: 400, lineHeight: 1.4, family: "Helvetica" },
    total:         { size: 10, weight: 700, family: "Helvetica-Bold" },
    subtext:       { size: 7.5,weight: 400, family: "Helvetica" },
  }),

  BADGE: Object.freeze({
    label:         { size: 7.5, weight: 700, letterSpacing: 0.6, family: "Helvetica-Bold", transform: "uppercase" },
  }),

  FOOTER: Object.freeze({
    text:          { size: 7.5, weight: 400, family: "Helvetica" },
    ref:           { size: 7,   weight: 600, family: "Helvetica-Bold" },
  }),

  TIMELINE: Object.freeze({
    state:         { size: 7.5, weight: 700, family: "Helvetica-Bold" },
    label:         { size: 7,   weight: 400, family: "Helvetica" },
  }),

});

// ─── Spacing standards ──────────────────────────────────────────────────────────

export const EXECUTIVE_SPACING = Object.freeze({

  // Page margins
  PAGE_MARGIN_TOP:     36,
  PAGE_MARGIN_BOTTOM:  48,   // extra bottom for footer
  PAGE_MARGIN_LEFT:    40,
  PAGE_MARGIN_RIGHT:   40,

  // Section rhythm
  SECTION_GAP_LARGE:   28,
  SECTION_GAP_MEDIUM:  18,
  SECTION_GAP_SMALL:   10,
  SECTION_GAP_MICRO:   5,

  // Component internal
  PANEL_PADDING_V:     14,
  PANEL_PADDING_H:     16,
  BADGE_PADDING_V:     5,
  BADGE_PADDING_H:     10,
  TABLE_CELL_PADDING_V:6,
  TABLE_CELL_PADDING_H:10,

  // Cover zones
  HERO_HEADER_HEIGHT:  64,
  TITLE_ZONE_HEIGHT:   80,
  PRODUCT_HERO_HEIGHT: 180,
  SUMMARY_ROW_HEIGHT:  22,
  TRUST_BADGE_HEIGHT:  36,

  // Decorative
  GOLD_RULE_HEIGHT:    2,
  SECTION_RULE_HEIGHT: 0.5,
  SEPARATOR_MARGIN:    8,

  // Timeline
  TIMELINE_NODE_SIZE:  10,
  TIMELINE_CONNECTOR:  32,
  TIMELINE_ROW_HEIGHT: 40,

  // Footer
  FOOTER_HEIGHT:       32,

});

// ─── Section separator specs ────────────────────────────────────────────────────

export const SECTION_SEPARATORS = Object.freeze({

  GOLD_FULL: Object.freeze({
    type:       "line",
    color:      "#C9A84C",
    thickness:  2,
    marginTop:  EXECUTIVE_SPACING.SECTION_GAP_MEDIUM,
    marginBottom:EXECUTIVE_SPACING.SECTION_GAP_MEDIUM,
    width:      "100%",
  }),

  GOLD_SHORT: Object.freeze({
    type:       "line",
    color:      "#C9A84C",
    thickness:  2,
    marginTop:  EXECUTIVE_SPACING.SECTION_GAP_SMALL,
    marginBottom:EXECUTIVE_SPACING.SECTION_GAP_SMALL,
    width:      80,
  }),

  SUBTLE_RULE: Object.freeze({
    type:       "line",
    color:      "#E2E8F0",
    thickness:  0.5,
    marginTop:  EXECUTIVE_SPACING.SECTION_GAP_SMALL,
    marginBottom:EXECUTIVE_SPACING.SECTION_GAP_SMALL,
    width:      "100%",
  }),

  DARK_DIVIDER: Object.freeze({
    type:       "line",
    color:      "#243656",
    thickness:  1,
    marginTop:  EXECUTIVE_SPACING.SECTION_GAP_MEDIUM,
    marginBottom:EXECUTIVE_SPACING.SECTION_GAP_MEDIUM,
    width:      "100%",
  }),

  SPACER: Object.freeze({
    type:       "spacer",
    height:     EXECUTIVE_SPACING.SECTION_GAP_MEDIUM,
  }),

});

// ─── Table presentation rules ───────────────────────────────────────────────────

export const TABLE_RULES = Object.freeze({

  ENTERPRISE_TABLE: Object.freeze({
    style:            "enterprise",
    headerBackground: "#1B2A4A",
    headerText:       "#FFFFFF",
    rowEven:          "#FFFFFF",
    rowOdd:           "#F8FAFC",
    rowHover:         null,
    borderColor:      "#E2E8F0",
    borderWidth:      0.5,
    totalBackground:  "#F1F5F9",
    totalText:        "#0F172A",
    totalBorder:      "#C9A84C",
    totalBorderWidth: 1.5,
    cellPaddingV:     EXECUTIVE_SPACING.TABLE_CELL_PADDING_V,
    cellPaddingH:     EXECUTIVE_SPACING.TABLE_CELL_PADDING_H,
    typography:       EXECUTIVE_TYPOGRAPHY.TABLE,
  }),

  SUMMARY_PANEL: Object.freeze({
    style:            "summary-panel",
    labelBackground:  "#F1F5F9",
    labelText:        "#334155",
    valueBackground:  "#FFFFFF",
    valueText:        "#0F172A",
    borderColor:      "#E2E8F0",
    borderWidth:      0.5,
    accentLeft:       "#C9A84C",
    accentLeftWidth:  3,
    cellPaddingV:     EXECUTIVE_SPACING.TABLE_CELL_PADDING_V,
    cellPaddingH:     EXECUTIVE_SPACING.TABLE_CELL_PADDING_H,
  }),

});

// ─── Badge system ───────────────────────────────────────────────────────────────

export const BADGE_STYLES = Object.freeze({

  TRUST: Object.freeze({
    background:   "#1B2A4A",
    border:       "#C9A84C",
    borderWidth:  1,
    text:         "#FFFFFF",
    accent:       "#C9A84C",
    borderRadius: 2,
    padding:      { v: EXECUTIVE_SPACING.BADGE_PADDING_V, h: EXECUTIVE_SPACING.BADGE_PADDING_H },
    typography:   EXECUTIVE_TYPOGRAPHY.BADGE,
  }),

  STATUS_ACTIVE: Object.freeze({
    background:   "#059669",
    border:       "#047857",
    borderWidth:  0,
    text:         "#FFFFFF",
    borderRadius: 2,
    padding:      { v: 3, h: 8 },
    typography:   EXECUTIVE_TYPOGRAPHY.BADGE,
  }),

  STATUS_PENDING: Object.freeze({
    background:   "#D97706",
    border:       "#B45309",
    borderWidth:  0,
    text:         "#FFFFFF",
    borderRadius: 2,
    padding:      { v: 3, h: 8 },
    typography:   EXECUTIVE_TYPOGRAPHY.BADGE,
  }),

  CATEGORY_LABEL: Object.freeze({
    background:   "#F1F5F9",
    border:       "#C9A84C",
    borderWidth:  1,
    text:         "#0F172A",
    borderRadius: 2,
    padding:      { v: 3, h: 8 },
    typography:   EXECUTIVE_TYPOGRAPHY.BADGE,
  }),

  WORKFLOW_CURRENT: Object.freeze({
    background:   "#C9A84C",
    border:       "#B8860B",
    borderWidth:  0,
    text:         "#1B2A4A",
    borderRadius: 10,
    padding:      { v: 3, h: 8 },
    typography:   EXECUTIVE_TYPOGRAPHY.BADGE,
  }),

  WORKFLOW_DONE: Object.freeze({
    background:   "#059669",
    border:       "#047857",
    borderWidth:  0,
    text:         "#FFFFFF",
    borderRadius: 10,
    padding:      { v: 3, h: 8 },
    typography:   EXECUTIVE_TYPOGRAPHY.BADGE,
  }),

  WORKFLOW_PENDING: Object.freeze({
    background:   "#F1F5F9",
    border:       "#CBD5E1",
    borderWidth:  0.5,
    text:         "#94A3B8",
    borderRadius: 10,
    padding:      { v: 3, h: 8 },
    typography:   EXECUTIVE_TYPOGRAPHY.BADGE,
  }),

});

// ─── Visual rhythm helpers ──────────────────────────────────────────────────────

/**
 * Get the accent color for a product category.
 *
 * @param {string} category
 * @returns {string}
 */
export function getCategoryAccentColor(category) {
  const map = {
    OILS:        EXECUTIVE_COLORS.CATEGORY_OILS,
    GRAINS:      EXECUTIVE_COLORS.CATEGORY_GRAINS,
    LIVE_ANIMALS:EXECUTIVE_COLORS.CATEGORY_ANIMALS,
    FROZEN:      EXECUTIVE_COLORS.CATEGORY_FROZEN,
    FOOD:        EXECUTIVE_COLORS.CATEGORY_FOOD,
  };
  return map[category] || EXECUTIVE_COLORS.ACCENT_GOLD;
}

/**
 * Get the full theme object for a given section type.
 *
 * @param {"header"|"section"|"table"|"footer"|"cover"} type
 * @returns {object}
 */
export function getSectionTheme(type) {
  const themes = {
    header:  { background: EXECUTIVE_COLORS.PRIMARY_DARK, text: EXECUTIVE_COLORS.TEXT_LIGHT, accent: EXECUTIVE_COLORS.ACCENT_GOLD },
    section: { background: EXECUTIVE_COLORS.SURFACE, text: EXECUTIVE_COLORS.TEXT_PRIMARY, accent: EXECUTIVE_COLORS.ACCENT_GOLD },
    table:   { ...TABLE_RULES.ENTERPRISE_TABLE },
    footer:  { background: EXECUTIVE_COLORS.PRIMARY_DARK, text: EXECUTIVE_COLORS.TEXT_LIGHT, accent: EXECUTIVE_COLORS.ACCENT_GOLD },
    cover:   { background: EXECUTIVE_COLORS.PRIMARY_DARK, text: EXECUTIVE_COLORS.TEXT_LIGHT, accent: EXECUTIVE_COLORS.ACCENT_GOLD },
    panel:   { background: EXECUTIVE_COLORS.SURFACE_ALT, text: EXECUTIVE_COLORS.TEXT_SECONDARY, accent: EXECUTIVE_COLORS.ACCENT_GOLD },
  };
  return Object.freeze(themes[type] || themes.section);
}
