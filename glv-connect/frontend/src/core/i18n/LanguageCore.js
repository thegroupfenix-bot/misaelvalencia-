/**
 * LanguageCore.js — GLV GOS Core Domain — Internationalization Foundation V1.0
 *
 * Centralized translation resolver for ES / EN / PT-BR.
 * Category-aware labels, PDF + UI compatible, no duplicate label keys.
 *
 * STATUS: FOUNDATION — core translation map defined.
 * Additional namespaces to be added per module rollout.
 */

// ─── Supported languages ────────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = Object.freeze({
  ES:    "es",
  EN:    "en",
  PT_BR: "pt-br",
});

export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES.ES;

// ─── Translation map ─────────────────────────────────────────────────────────────
// Organized by namespace. Each key maps to { es, en, "pt-br" }.

const TRANSLATIONS = Object.freeze({

  // ── Common ──────────────────────────────────────────────────────────────────
  "common.date":          { es: "Fecha",            en: "Date",           "pt-br": "Data" },
  "common.reference":     { es: "Referencia",       en: "Reference",      "pt-br": "Referência" },
  "common.status":        { es: "Estado",           en: "Status",         "pt-br": "Status" },
  "common.country":       { es: "País",             en: "Country",        "pt-br": "País" },
  "common.currency":      { es: "Moneda",           en: "Currency",       "pt-br": "Moeda" },
  "common.amount":        { es: "Monto",            en: "Amount",         "pt-br": "Valor" },
  "common.description":   { es: "Descripción",      en: "Description",    "pt-br": "Descrição" },
  "common.notes":         { es: "Notas",            en: "Notes",          "pt-br": "Notas" },
  "common.total":         { es: "Total",            en: "Total",          "pt-br": "Total" },
  "common.unit":          { es: "Unidad",           en: "Unit",           "pt-br": "Unidade" },
  "common.quantity":      { es: "Cantidad",         en: "Quantity",       "pt-br": "Quantidade" },
  "common.price":         { es: "Precio",           en: "Price",          "pt-br": "Preço" },
  "common.weight":        { es: "Peso",             en: "Weight",         "pt-br": "Peso" },
  "common.volume":        { es: "Volumen",          en: "Volume",         "pt-br": "Volume" },
  "common.origin":        { es: "Origen",           en: "Origin",         "pt-br": "Origem" },
  "common.destination":   { es: "Destino",          en: "Destination",    "pt-br": "Destino" },
  "common.period":        { es: "Período",          en: "Period",         "pt-br": "Período" },

  // ── Documents ────────────────────────────────────────────────────────────────
  "doc.sco":              { es: "Oferta Comercial",            en: "Sales Confirmation",          "pt-br": "Oferta Comercial" },
  "doc.fco":              { es: "Confirmación Formal",         en: "Formal Confirmation",         "pt-br": "Confirmação Formal" },
  "doc.spa":              { es: "Contrato de Compraventa",     en: "Sales & Purchase Agreement",  "pt-br": "Contrato de Compra e Venda" },
  "doc.invoice":          { es: "Factura Comercial",          en: "Commercial Invoice",          "pt-br": "Fatura Comercial" },
  "doc.packingList":      { es: "Lista de Empaque",           en: "Packing List",                "pt-br": "Romaneio de Embalagem" },
  "doc.bl":               { es: "Conocimiento de Embarque",   en: "Bill of Lading",              "pt-br": "Conhecimento de Embarque" },
  "doc.certificate":      { es: "Certificado",                en: "Certificate",                 "pt-br": "Certificado" },

  // ── Categories ───────────────────────────────────────────────────────────────
  "category.OILS":         { es: "Aceites Vegetales",         en: "Vegetable Oils",              "pt-br": "Óleos Vegetais" },
  "category.GRAINS":       { es: "Granos y Cereales",         en: "Grains & Cereals",            "pt-br": "Grãos e Cereais" },
  "category.LIVE_ANIMALS": { es: "Animales Vivos",            en: "Live Animals",                "pt-br": "Animais Vivos" },
  "category.FROZEN":       { es: "Productos Congelados",      en: "Frozen Products",             "pt-br": "Produtos Congelados" },
  "category.FOOD":         { es: "Alimentos Procesados",      en: "Processed Foods",             "pt-br": "Alimentos Processados" },

  // ── Workflow states ───────────────────────────────────────────────────────────
  "workflow.DRAFT":               { es: "Borrador",                en: "Draft",                "pt-br": "Rascunho" },
  "workflow.QUOTED":              { es: "Cotizado",                en: "Quoted",               "pt-br": "Cotado" },
  "workflow.APPROVED":            { es: "Aprobado",               en: "Approved",             "pt-br": "Aprovado" },
  "workflow.CONTRACTED":          { es: "Contratado",              en: "Contracted",           "pt-br": "Contratado" },
  "workflow.PAYMENT_PENDING":     { es: "Pago Pendiente",          en: "Payment Pending",      "pt-br": "Pagamento Pendente" },
  "workflow.PAYMENT_CONFIRMED":   { es: "Pago Confirmado",         en: "Payment Confirmed",    "pt-br": "Pagamento Confirmado" },
  "workflow.PRODUCTION":          { es: "En Producción",           en: "In Production",        "pt-br": "Em Produção" },
  "workflow.INSPECTION":          { es: "En Inspección",           en: "Under Inspection",     "pt-br": "Em Inspeção" },
  "workflow.READY_FOR_LOADING":   { es: "Listo para Embarque",     en: "Ready for Loading",    "pt-br": "Pronto para Embarque" },
  "workflow.LOADED":              { es: "Embarcado",               en: "Loaded",               "pt-br": "Embarcado" },
  "workflow.SHIPPED":             { es: "En Tránsito",             en: "Shipped",              "pt-br": "Em Trânsito" },
  "workflow.DELIVERED":           { es: "Entregado",               en: "Delivered",            "pt-br": "Entregue" },
  "workflow.CLOSED":              { es: "Cerrado",                 en: "Closed",               "pt-br": "Fechado" },

  // ── PDF sections ─────────────────────────────────────────────────────────────
  "pdf.commercialDetail":  { es: "Detalle Comercial",    en: "Commercial Detail",     "pt-br": "Detalhe Comercial" },
  "pdf.logisticsDetail":   { es: "Detalle Logístico",    en: "Logistics Detail",      "pt-br": "Detalhe Logístico" },
  "pdf.paymentTerms":      { es: "Términos de Pago",     en: "Payment Terms",         "pt-br": "Condições de Pagamento" },
  "pdf.qualityCerts":      { es: "Certificaciones",      en: "Certifications",        "pt-br": "Certificações" },
  "pdf.productionTimeline":{ es: "Cronograma",           en: "Timeline",              "pt-br": "Cronograma" },
  "pdf.coverLabel":        { es: "Oferta de Exportación","en": "Export Offer",        "pt-br": "Oferta de Exportação" },
  "pdf.generatedBy":       { es: "Generado por",         en: "Generated by",          "pt-br": "Gerado por" },
  "pdf.page":              { es: "Página",               en: "Page",                  "pt-br": "Página" },
  "pdf.confidential":      { es: "Confidencial",         en: "Confidential",          "pt-br": "Confidencial" },

  // ── Operations ────────────────────────────────────────────────────────────────
  "ops.container":         { es: "Contenedor",           en: "Container",             "pt-br": "Contêiner" },
  "ops.incoterm":          { es: "Incoterm",             en: "Incoterm",              "pt-br": "Incoterm" },
  "ops.portOfLoading":     { es: "Puerto de Embarque",   en: "Port of Loading",       "pt-br": "Porto de Embarque" },
  "ops.portOfDestination": { es: "Puerto de Destino",    en: "Port of Destination",   "pt-br": "Porto de Destino" },
  "ops.loadingDate":       { es: "Fecha de Embarque",    en: "Loading Date",          "pt-br": "Data de Embarque" },
  "ops.deliveryDate":      { es: "Fecha de Entrega",     en: "Delivery Date",         "pt-br": "Data de Entrega" },
  "ops.transitTime":       { es: "Tiempo en Tránsito",   en: "Transit Time",          "pt-br": "Tempo de Trânsito" },

});

// ─── Resolver ────────────────────────────────────────────────────────────────────

/**
 * Resolve a translation key to a string for the given language.
 * Falls back to EN, then to the raw key if no translation found.
 *
 * @param {string} key   — dot-namespaced key, e.g. "common.date"
 * @param {string} [lang] — "es" | "en" | "pt-br"
 * @returns {string}
 */
export function t(key, lang = DEFAULT_LANGUAGE) {
  const entry = TRANSLATIONS[key];
  if (!entry) return key;
  return entry[lang] || entry[SUPPORTED_LANGUAGES.EN] || key;
}

/**
 * Resolve a category key to a localized label.
 *
 * @param {string} category  — e.g. "OILS", "GRAINS"
 * @param {string} [lang]
 * @returns {string}
 */
export function getCategoryLabel(category, lang = DEFAULT_LANGUAGE) {
  return t(`category.${category}`, lang);
}

/**
 * Resolve a workflow state to a localized label.
 *
 * @param {string} state  — e.g. "DRAFT", "SHIPPED"
 * @param {string} [lang]
 * @returns {string}
 */
export function getWorkflowStateLabel(state, lang = DEFAULT_LANGUAGE) {
  return t(`workflow.${state}`, lang);
}

/**
 * Check if a language code is supported.
 *
 * @param {string} lang
 * @returns {boolean}
 */
export function isSupportedLanguage(lang) {
  return Object.values(SUPPORTED_LANGUAGES).includes(lang);
}

/**
 * Normalize a language code to a supported value.
 * Returns DEFAULT_LANGUAGE if unrecognized.
 *
 * @param {string} lang
 * @returns {string}
 */
export function normalizeLanguage(lang) {
  if (!lang) return DEFAULT_LANGUAGE;
  const lower = lang.toLowerCase();
  return isSupportedLanguage(lower) ? lower : DEFAULT_LANGUAGE;
}
