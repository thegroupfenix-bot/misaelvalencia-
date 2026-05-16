export function validateDocForm(formData, agentProfile, docType) {
  const errors = [];

  // Perfil del agente
  if (!agentProfile?.cargo) errors.push("Perfil: Cargo no completado");
  if (!agentProfile?.phone) errors.push("Perfil: Teléfono no completado");
  if (!agentProfile?.signature_b64) errors.push("Perfil: Firma digital no cargada");

  // Campos del formulario
  if (!formData.client) errors.push("Cliente (razón social) requerido");
  if (!formData.clientRepresentative) errors.push("Representante del cliente requerido");
  if (!formData.clientEmail) errors.push("Email del cliente requerido");
  if (!formData.product) errors.push("Producto requerido");
  if (!(parseFloat(formData.pricePerKg) > 0) && !(parseFloat(formData.totalValue) > 0)) {
    errors.push("Precio o valor total debe ser mayor a 0");
  }
  if (!(parseFloat(formData.headcount) > 0) && !(parseFloat(formData.totalValue) > 0)) {
    errors.push("Volumen (cabezas) o valor total requerido");
  }
  if (!formData.destination) errors.push("Destino requerido");
  if (!formData.payment_option && !formData.paymentOption) errors.push("Sistema de pago requerido");
  if (!formData.validityDays && !formData.validity_days) errors.push("Validez requerida");

  // TT requiere doc_trigger
  const payOpt = formData.payment_option || formData.paymentOption || "";
  if (payOpt.startsWith("TT") && !formData.docTrigger && !formData.doc_trigger) {
    errors.push("Documentos de desembolso requeridos (DOC-A o DOC-B)");
  }

  // Producto personalizado
  if (formData.product === "Otro") {
    if (!formData.customProductName && !formData.custom_product_name) {
      errors.push("Nombre del producto personalizado requerido");
    }
    if (!formData.customProductDesc && !formData.custom_product_desc) {
      errors.push("Descripción del producto personalizado requerida");
    }
  }

  // FCO adicional
  if (docType === "FCO") {
    if (!formData.fcoConfirmed && !formData.fco_confirmed) {
      errors.push("FCO: Debes confirmar verificación interna");
    }
    if (!formData.clientIdDocB64 && !formData.client_id_doc_b64) {
      errors.push("FCO: Documento de identidad del cliente requerido");
    }
  }

  return errors;
}
