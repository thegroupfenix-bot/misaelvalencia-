export function generatePaymentText({
  productCategory,
  paymentOption,
  docTrigger,
  totalValue,
  currency = "USD",
  guaranteeType,
  bankName,
}) {
  const livestock = ["Ovino", "Bovino", "animal", "vivo"].some(
    k => productCategory?.toLowerCase().includes(k.toLowerCase())
  );
  const fmt = (v) =>
    `${currency} ${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  if (livestock) {
    const opts = {
      "PAGO-AV-1": {
        text: `- 70% del valor total (${fmt((totalValue || 0) * 0.7)}) pagadero como anticipo obligatorio antes del inicio del período de cuarentena, mediante transferencia bancaria internacional.\n\n- 30% del saldo restante (${fmt((totalValue || 0) * 0.3)}) cubierto mediante Stand-By Letter of Credit (SBLC) irrevocable con validez de 90 días, pagadero automáticamente contra:\n  • Booking de buque reservado y confirmado\n  • Animales activos en período de cuarentena oficial\n  • Certificado SGS de peso vivo y cantidad certificada\n  • Certificado médico/zoosanitario oficial`,
      },
      "PAGO-AV-2": {
        text: `- 100% del valor total (${fmt(totalValue || 0)}) cubierto por SBLC irrevocable confirmado banco a banco (MT199), pagadero contra:\n  • Certificado SGS de peso confirmado\n  • Certificado Halal\n  • Certificado zoosanitario oficial\n  • Booking confirmado`,
      },
      "PAGO-AV-3": {
        text: `- 50% del valor total (${fmt((totalValue || 0) * 0.5)}) pagadero como anticipo contra firma de contrato.\n\n- 50% del saldo restante (${fmt((totalValue || 0) * 0.5)}) cubierto por SBLC, con los mismos hitos de la opción prioritaria.`,
      },
    };
    const opt = opts[paymentOption] || opts["PAGO-AV-1"];
    return `CONDICIONES DE PAGO — RÉGIMEN ANIMALES VIVOS\n\nLa presente oferta contempla la siguiente estructura de pago para operaciones con animales vivos:\n\n${opt.text}\n\nEsta estructura protege la integridad operativa de ambas partes y es la modalidad estándar de GLV Global Food Services LLC para exportación de animales vivos.`;
  }

  // TT
  const match = (paymentOption || "TT 30/70").match(/(\d+)\/(\d+)/);
  const pct1 = match ? parseInt(match[1]) : 30;
  const pct2 = match ? parseInt(match[2]) : 70;
  const val = totalValue || 0;

  const docLines =
    docTrigger === "DOC-B"
      ? "  • Confirmación de booking del buque\n  • Certificado SGS de alineamiento / inspección\n  • Contenedores confirmados y cargados\n  • Certificado sanitario de exportación"
      : "  • Bill of Lading\n  • Factura comercial\n  • Packing list\n  • Certificado de origen";

  let text = `CONDICIONES DE PAGO\n\nLa presente oferta contempla la siguiente estructura de pago mediante transferencia bancaria internacional (T/T — Wire Transfer):\n\n- ${pct1}% del valor total (${fmt(val * pct1 / 100)}) pagadero como anticipo previo al inicio de operaciones.\n\n- ${pct2}% del saldo restante (${fmt(val * pct2 / 100)}), pagadero contra presentación de:\n${docLines}`;

  if (guaranteeType) {
    text += `\n\nGARANTÍA ADICIONAL: El saldo está cubierto por ${guaranteeType}${bankName ? ` emitida por ${bankName}` : ""}.`;
    if (guaranteeType === "SBLC") {
      text += "\nBeneficiario designado: Active Value International General Trading L.L.C — Dubai, UAE (si aplica)";
    }
  }

  return text;
}
