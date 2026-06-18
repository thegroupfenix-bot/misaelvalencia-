/**
 * ExecutiveClosingEngine.js — GLV GOS — Phase 6A.2 Engine 5
 *
 * Document-type-aware closing content (SCO/FCO/SPA).
 * Next steps, acceptance workflow, commercial validity, contact structure.
 */

const CLOSING_CONTENT = Object.freeze({
  SCO: {
    en: {
      title: "NEXT STEPS",
      steps: [
        { n: "1", t: "Review", d: "Review this Soft Corporate Offer in detail. All prices, volumes, and conditions are indicative and subject to confirmation." },
        { n: "2", t: "Inquiry", d: "Contact your GLV account representative for questions, clarifications, or specific requirement adjustments." },
        { n: "3", t: "Confirmation", d: "Upon buyer interest, GLV issues a Full Corporate Offer (FCO) with firm, binding terms and updated pricing." },
        { n: "4", t: "FCO Acceptance", d: "Buyer acceptance of the FCO activates the SPA (Sales Purchase Agreement) process with detailed legal clauses." },
      ],
      validity: "This SCO is indicative and non-binding. Prices and conditions are subject to change without notice until a binding FCO is issued.",
    },
    es: {
      title: "PRÓXIMOS PASOS",
      steps: [
        { n: "1", t: "Revisión", d: "Revisar esta Oferta Corporativa Indicativa en detalle. Todos los precios, volúmenes y condiciones son indicativos y sujetos a confirmación." },
        { n: "2", t: "Consulta", d: "Contactar a su representante de cuenta GLV para preguntas, aclaraciones o ajustes de requisitos específicos." },
        { n: "3", t: "Confirmación", d: "Ante el interés del comprador, GLV emite una Oferta Corporativa Formal (FCO) con términos firmes, vinculantes y precios actualizados." },
        { n: "4", t: "Aceptación FCO", d: "La aceptación del FCO por el comprador activa el proceso de SPA (Sales Purchase Agreement) con cláusulas legales detalladas." },
      ],
      validity: "Este SCO es indicativo y no vinculante. Precios y condiciones están sujetos a cambio sin previo aviso hasta la emisión de un FCO vinculante.",
    },
  },
  FCO: {
    en: {
      title: "ACCEPTANCE WORKFLOW",
      steps: [
        { n: "1", t: "Review", d: "Review this Full Corporate Offer carefully. All terms, prices, and conditions are firm and legally binding for the stated validity period." },
        { n: "2", t: "Acceptance", d: "Sign and return this FCO to confirm buyer acceptance. Acceptance triggers the SPA drafting process." },
        { n: "3", t: "SPA Process", d: "GLV legal team prepares the Sales Purchase Agreement with 43 active legal clauses covering all commercial and regulatory aspects." },
        { n: "4", t: "Execution", d: "Upon SPA signing and advance payment, GLV initiates the operational program: sourcing, inspection, logistics, and documentation." },
      ],
      validity: "This FCO is firm and binding. Buyer acceptance within the stated validity period constitutes a commercial commitment.",
    },
    es: {
      title: "FLUJO DE ACEPTACIÓN",
      steps: [
        { n: "1", t: "Revisión", d: "Revisar esta Oferta Corporativa Formal cuidadosamente. Todos los términos, precios y condiciones son firmes y legalmente vinculantes durante el período de validez indicado." },
        { n: "2", t: "Aceptación", d: "Firmar y devolver este FCO para confirmar la aceptación del comprador. La aceptación activa el proceso de elaboración del SPA." },
        { n: "3", t: "Proceso SPA", d: "El equipo legal de GLV prepara el Sales Purchase Agreement con 43 cláusulas legales activas cubriendo todos los aspectos comerciales y regulatorios." },
        { n: "4", t: "Ejecución", d: "Tras la firma del SPA y pago del anticipo, GLV inicia el programa operativo: sourcing, inspección, logística y documentación." },
      ],
      validity: "Este FCO es firme y vinculante. La aceptación del comprador dentro del período de validez indicado constituye un compromiso comercial.",
    },
  },
  SPA: {
    en: {
      title: "CONTRACT EXECUTION",
      steps: [
        { n: "1", t: "SPA Review", d: "Both parties review the Sales Purchase Agreement with all 43 active legal clauses, including arbitration, force majeure, and penalties." },
        { n: "2", t: "Signing", d: "Dual signature execution of the SPA. Counter-signed copies distributed to all parties within 48 hours." },
        { n: "3", t: "Advance Payment", d: "Buyer remits the agreed advance payment percentage. GLV confirms receipt and activates the operational program." },
        { n: "4", t: "Operations", d: "GLV executes the full supply program: sourcing, quality inspection, logistics, documentation, and delivery per SPA terms." },
      ],
      validity: "The SPA is the definitive legal instrument governing all aspects of the commercial operation. All prior offers and negotiations are superseded.",
    },
    es: {
      title: "EJECUCIÓN DEL CONTRATO",
      steps: [
        { n: "1", t: "Revisión SPA", d: "Ambas partes revisan el Sales Purchase Agreement con las 43 cláusulas legales activas, incluyendo arbitraje, fuerza mayor y penalidades." },
        { n: "2", t: "Firma", d: "Ejecución de firma dual del SPA. Copias contrafirmadas distribuidas a todas las partes en 48 horas." },
        { n: "3", t: "Pago Anticipado", d: "El comprador remite el porcentaje de anticipo acordado. GLV confirma recepción y activa el programa operativo." },
        { n: "4", t: "Operaciones", d: "GLV ejecuta el programa de suministro completo: sourcing, inspección de calidad, logística, documentación y entrega según términos del SPA." },
      ],
      validity: "El SPA es el instrumento legal definitivo que gobierna todos los aspectos de la operación comercial. Todas las ofertas y negociaciones previas quedan superadas.",
    },
  },
});

const CONTACT_BLOCK = Object.freeze({
  en: {
    title: "CONTACT",
    entity: "GLV Global Food Services LLC",
    location: "Miami, FL — United States",
    web: "glvglobalfoodservices.com",
    emails: ["info@glvglobalfoodservices.com", "contabilidad@glvservicesexp.com"],
  },
  es: {
    title: "CONTACTO",
    entity: "GLV Global Food Services LLC",
    location: "Miami, FL — Estados Unidos",
    web: "glvglobalfoodservices.com",
    emails: ["info@glvglobalfoodservices.com", "contabilidad@glvservicesexp.com"],
  },
});

export function buildExecutiveClosing({ documentType, validityDays, date, lang = "en" }) {
  const l = lang === "es" ? "es" : "en";
  const docType = (documentType || "SCO").toUpperCase();
  const closing = CLOSING_CONTENT[docType]?.[l] || CLOSING_CONTENT.SCO[l];
  const contact = CONTACT_BLOCK[l];

  return {
    title: closing.title,
    steps: closing.steps,
    validity: closing.validity,
    contact,
    documentType: docType,
  };
}
