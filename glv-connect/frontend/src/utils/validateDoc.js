const AGENT_PROFILE_ROLES = new Set(["AGENTE", "LOGISTICS", "CLIENT", "SUPPLIER"]);

export function validateDocForm(formData, agentProfile, docType, userRole) {
  const errors = [];

  // ─── Perfil del agente (solo para roles agentes, no admins/directores) ───────
  const requiresProfile = !userRole || AGENT_PROFILE_ROLES.has(userRole);
  if (requiresProfile) {
    if (!agentProfile?.cargo) errors.push("Perfil: Cargo no completado");
    if (!agentProfile?.phone) errors.push("Perfil: Teléfono no completado");
    if (!agentProfile?.signature_b64) errors.push("Perfil: Firma digital no cargada");
  }

  // ─── Cliente ─────────────────────────────────────────────────────────────────
  if (!formData.client) errors.push("Cliente (razón social) requerido");
  if (!formData.clientRepresentative) errors.push("Representante del cliente requerido");
  if (!formData.clientEmail) errors.push("Email del cliente requerido");

  // ─── Producto ────────────────────────────────────────────────────────────────
  const hasProduct = formData.product ||
    formData.commercialData?.rows?.[0]?.category ||
    formData.commercialData?.category;
  if (!hasProduct) errors.push("Producto requerido");

  // ─── Valor / precio ─────────────────────────────────────────────────────────
  // Accept: pricePerKg, totalValue, or a non-zero commercial contractValue
  const commercialValue = formData.commercialData?.summary?.contractValue ||
    formData.commercialData?.rows?.reduce((s, r) => s + (r.summary?.contractValue || 0), 0) || 0;
  const hasValue =
    parseFloat(formData.pricePerKg) > 0 ||
    parseFloat(formData.totalValue) > 0 ||
    commercialValue > 0;
  if (!hasValue) errors.push("Precio o valor total debe ser mayor a 0 — ingrese precios en el Programa Comercial");

  // ─── Volumen ─────────────────────────────────────────────────────────────────
  const hasVolume =
    parseFloat(formData.headcount) > 0 ||
    parseFloat(formData.totalValue) > 0 ||
    commercialValue > 0 ||
    parseFloat(formData.commercialData?.rows?.[0]?.quantity) > 0;
  if (!hasVolume) errors.push("Volumen o valor total requerido — ingrese cantidades en el Programa Comercial");

  // ─── Destino ─────────────────────────────────────────────────────────────────
  const hasDestination = formData.destination ||
    formData.commercialData?.destination;
  if (!hasDestination) errors.push("Destino requerido — seleccione país en el Programa Comercial");

  // ─── Pago ────────────────────────────────────────────────────────────────────
  const payOpt = formData.payment_option || formData.paymentOption || "";
  if (!payOpt) errors.push("Sistema de pago requerido — seleccione al menos el Bloque 1 en Condiciones de Pago");

  // TT requiere doc_trigger
  if (payOpt.includes("TT") && !payOpt.includes("100%") &&
      !formData.docTrigger && !formData.doc_trigger) {
    errors.push("Documentos de desembolso requeridos (DOC-A o DOC-B)");
  }

  // ─── Validez ─────────────────────────────────────────────────────────────────
  if (!formData.validityDays && !formData.validity_days) errors.push("Validez requerida");

  // ─── Producto personalizado ──────────────────────────────────────────────────
  if (formData.product === "Otro") {
    if (!formData.customProductName && !formData.custom_product_name)
      errors.push("Nombre del producto personalizado requerido");
    if (!formData.customProductDesc && !formData.custom_product_desc)
      errors.push("Descripción del producto personalizado requerida");
  }

  // ─── FCO adicional ────────────────────────────────────────────────────────────
  if (docType === "FCO") {
    if (!formData.fcoConfirmed && !formData.fco_confirmed)
      errors.push("FCO: Debes confirmar verificación interna");
    if (!formData.clientIdDocB64 && !formData.client_id_doc_b64)
      errors.push("FCO: Documento de identidad del cliente requerido");
  }

  return errors;
}
