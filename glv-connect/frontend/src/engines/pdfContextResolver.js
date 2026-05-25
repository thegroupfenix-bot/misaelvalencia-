/**
 * pdfContextResolver.js — Isolated PDF Context Builder for GLV Engine V4.
 *
 * Each PDF generation call receives a FRESH, ISOLATED context object.
 * NO reused memory. NO stale state. NO previous document contamination.
 * NO previous country/media/port contamination.
 *
 * This is the single entry point for all data that flows into GlvPDF.jsx.
 * Any field not present in the returned context is intentionally absent.
 */

import { getCategoryEngine, getPDFTextKey } from "./categoryEngine.js";
import { resolveTotalKgDisplay } from "./commercialFormulaEngine.js";
import { getContainerLabel } from "./containerEngine.js";

/**
 * Build a fully resolved, stale-free PDF context from a document + CD rows.
 *
 * @param {object}   doc     — raw document object (from DB or state)
 * @param {object[]} cdRows  — commercial detail rows for this document
 * @returns {PDFContext}     — immutable snapshot for this render
 */
export function resolvePDFContext(doc, cdRows = []) {
  // Isolation: work only with what this specific document provides
  const lang      = doc.language || doc.lang || "es";
  const docType   = doc.type || "SCO";
  const isSCO     = docType === "SCO";
  const isFCO     = docType === "FCO";

  // ── Category resolution ──────────────────────────────────────────────────
  const firstRow       = cdRows.find(r => r.category) || {};
  const category       = firstRow.category || null;
  const engine         = category ? getCategoryEngine(category) : null;
  const pdfTextKey     = engine?.pdfTextKey || "food";
  const isLiveAnimal   = engine?.isLiveAnimal === true;
  const isFrozen       = engine?.isFrozen === true;
  const isFruit        = engine?.isFruit === true;
  const isGrain        = engine?.isGrain === true;
  const isLiquid       = engine?.isLiquid === true;

  // ── Price — engineUnitPrice is the SOLE source, no fallback to PRICE_TABLE ──
  const engineUnitPrice = parseFloat(
    firstRow.unitPrice ||
    firstRow.incotermPrices?.CFR ||
    firstRow.incotermPrices?.CIF ||
    firstRow.incotermPrices?.FOB ||
    0
  );
  const currency = firstRow.currency || doc.currency || "USD";

  // ── Quantity resolution ──────────────────────────────────────────────────
  const engineUnitType = firstRow.unitType || "";
  const isMT           = engineUnitType.includes("MT") || engineUnitType.includes("Tonelada");
  const engineHeads    = parseFloat(firstRow.specs?.headCount || doc.headcount || 0);
  const engineAvgW     = parseFloat(firstRow.specs?.avgWeight  || doc.avgWeight  || 0);
  const engineQty      = isLiveAnimal ? 0 : parseFloat(firstRow.quantity || 0);

  const totalKgDisplay = isLiveAnimal
    ? engineHeads * engineAvgW
    : resolveTotalKgDisplay(engineQty, engineUnitType, {
        containerCapacityMT: parseFloat(firstRow.containerCapacity || 27),
      });

  // ── Shipment value ───────────────────────────────────────────────────────
  const shipmentValue =
    cdRows.reduce((s, r) => s + (r.summary?.shipmentValue || 0), 0) ||
    (() => {
      const baseQty = isLiveAnimal ? engineHeads * engineAvgW : totalKgDisplay;
      return baseQty > 0 && engineUnitPrice > 0 ? baseQty * engineUnitPrice : 0;
    })();

  // ── Logistics ────────────────────────────────────────────────────────────
  const containerType      = firstRow.containerType || engine?.defaultContainer || "";
  const containerLabel     = getContainerLabel(containerType);
  const cargoType          = firstRow.cargoType || engine?.defaultCargoType || "";
  const incoterms          = (firstRow.incoterms || ["CFR"]).join(", ");
  const origin             = firstRow.origin || doc.origin || "";
  const destination        = doc.destination || doc.destinationCountry || "";
  const destinationPort    = doc.destinationPort || doc.destination_port || "";

  // ── Contract ─────────────────────────────────────────────────────────────
  const deliveryFrequency  = firstRow.deliveryFrequency || "ONE_SHIPMENT";
  const numShipments       = parseInt(firstRow.numShipments || 1, 10);
  const contractDuration   = parseInt(firstRow.contractDuration || 12, 10);

  // ── Payment ──────────────────────────────────────────────────────────────
  const paymentOption      = doc.paymentOption || doc.payment_option || doc.paymentMethod || "SBLC";
  const docTrigger         = doc.docTrigger || doc.doc_trigger || "DOC-A";
  const hasGuarantee       = doc.hasGuarantee || doc.has_guarantee || false;
  const guaranteeType      = doc.guaranteeType || doc.guarantee_type || "";
  const bankName           = doc.guaranteeBank || doc.guarantee_bank || "";

  // ── Document metadata ────────────────────────────────────────────────────
  const validityDays       = doc.validityDays || doc.validity_days || 15;
  const productCategory    = doc.product || "";

  return Object.freeze({
    // Identity
    lang,
    docType,
    isSCO,
    isFCO,
    docId:            doc.id || "",
    docDate:          doc.date || "",
    validityDays,
    // Category engine
    category,
    pdfTextKey,
    isLiveAnimal,
    isFrozen,
    isFruit,
    isGrain,
    isLiquid,
    engine,
    // Price — single source
    engineUnitPrice,
    currency,
    // Quantities
    engineUnitType,
    isMT,
    engineHeads,
    engineAvgW,
    engineQty,
    totalKgDisplay,
    // Value
    shipmentValue,
    // Logistics
    containerType,
    containerLabel,
    cargoType,
    incoterms,
    origin,
    destination,
    destinationPort,
    // Contract
    deliveryFrequency,
    numShipments,
    contractDuration,
    // Payment
    paymentOption,
    docTrigger,
    hasGuarantee,
    guaranteeType,
    bankName,
    // Product
    productCategory,
    productName:      doc.productName || doc.product_name || "",
    exporter:         doc.exporter    || "GLV Global Food Services LLC (Miami, FL)",
    domain:           doc.domain      || "glvglobalfoodservices.com",
  });
}
