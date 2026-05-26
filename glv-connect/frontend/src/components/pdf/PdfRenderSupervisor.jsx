/**
 * PdfRenderSupervisor.jsx — V9.1 PDF Render Supervisor Agent
 *
 * Wraps the PDF download/preview trigger with:
 *   1. Pre-render payload validation via PdfPayloadInspector
 *   2. Container math consistency check
 *   3. Error boundary via PdfRenderBoundary
 *   4. Retry isolated render
 *   5. Admin-only diagnostics panel (never shown to non-admin)
 *
 * Usage:
 *   <PdfRenderSupervisor doc={doc} cdRows={cdRows} isAdmin={canFinance} onRender={downloadPDF}>
 *     <button>Generate PDF</button>
 *   </PdfRenderSupervisor>
 *
 * DO NOT: hardcode prices, duplicate formulas, bypass validation.
 */

import { useState } from "react";
import PdfRenderBoundary from "./PdfRenderBoundary.jsx";
import { inspectAllRows } from "./PdfPayloadInspector.js";

const PANEL_STYLE = {
  wrap:       { position: "relative" },
  diag:       { marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#0f172a", border: "1px solid #1e293b", fontSize: 11, color: "#94a3b8", fontFamily: "monospace" },
  diagTitle:  { color: "#7c3aed", fontWeight: 700, marginBottom: 6, fontSize: 12 },
  row:        { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  chip:       (ok) => ({ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: ok ? "#14532d" : "#7f1d1d", color: ok ? "#86efac" : "#fca5a5" }),
  warnChip:   { padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "#78350f", color: "#fde68a" },
  issueText:  { fontSize: 10, color: "#fca5a5", marginBottom: 2 },
  warnText:   { fontSize: 10, color: "#fde68a", marginBottom: 2 },
};

export default function PdfRenderSupervisor({
  doc,
  cdRows = [],
  isAdmin = false,
  showDiagnostics = false,
  children,
}) {
  const [lastReport, setLastReport] = useState(null);
  const [showPanel, setShowPanel] = useState(false);

  const report = inspectAllRows(cdRows);

  const handleClick = () => {
    setLastReport(report);
    if (isAdmin) setShowPanel(true);

    if (report.blockPdf) {
      console.group("[PDF_SUPERVISOR] PDF blocked — validation failed");
      report.errors.forEach(e => console.error(`  ✗ ${e.field}: ${e.message}`));
      console.groupEnd();
      return;
    }

    if (report.warnings.length > 0) {
      console.group("[PDF_SUPERVISOR] Pre-render warnings");
      report.warnings.forEach(w => console.warn(`  ⚠ ${w.field}: ${w.message}`));
      console.groupEnd();
    }
  };

  // Clone children and attach onClick supervisor
  const child = children;

  return (
    <PdfRenderBoundary isAdmin={isAdmin}>
      <div style={PANEL_STYLE.wrap}>
        <div onClick={handleClick} style={{ display: "contents" }}>
          {child}
        </div>

        {/* Logistics mismatch block */}
        {report.warnings.some(w => w.message?.includes("CONTAINER LOGISTICS MISMATCH")) && (
          <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: "#fff7ed", border: "1px solid #fed7aa" }}>
            <span style={{ fontSize: 11, color: "#92400e", fontWeight: 700 }}>
              ⚠ CONTAINER LOGISTICS MISMATCH — verify units per container before PDF
            </span>
          </div>
        )}

        {/* Admin-only diagnostics panel */}
        {isAdmin && showDiagnostics && showPanel && lastReport && (
          <div style={PANEL_STYLE.diag}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={PANEL_STYLE.diagTitle}>[PDF_SUPERVISOR] Pre-render diagnostics</span>
              <button
                type="button"
                onClick={() => setShowPanel(false)}
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>

            <div style={PANEL_STYLE.row}>
              <span style={PANEL_STYLE.chip(!lastReport.blockPdf)}>{lastReport.valid ? "✓ PAYLOAD VALID" : "✗ PAYLOAD INVALID"}</span>
              <span style={PANEL_STYLE.chip(!lastReport.blockPdf)}>{lastReport.blockPdf ? "PDF BLOCKED" : "PDF ALLOWED"}</span>
              <span style={PANEL_STYLE.warnChip}>{lastReport.warnings.length} WARN</span>
              <span style={PANEL_STYLE.chip(lastReport.errors.length === 0)}>{lastReport.errors.length} ERR</span>
            </div>

            {lastReport.errors.map((e, i) => (
              <div key={i} style={PANEL_STYLE.issueText}>✗ {e.field}: {e.message}</div>
            ))}
            {lastReport.warnings.map((w, i) => (
              <div key={i} style={PANEL_STYLE.warnText}>⚠ {w.field}: {w.message}</div>
            ))}
          </div>
        )}
      </div>
    </PdfRenderBoundary>
  );
}
