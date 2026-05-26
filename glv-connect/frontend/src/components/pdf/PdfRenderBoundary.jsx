/**
 * PdfRenderBoundary.jsx — V9.1 PDF Generation Error Boundary
 *
 * React class error boundary that wraps PDF generation UI.
 * Catches render crashes inside @react-pdf/renderer without
 * crashing the host app.
 *
 * Never surfaces internal financial data in error messages.
 * Shows a safe retry UI with reference code for support.
 */

import { Component } from "react";

export default class PdfRenderBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorRef: null, errorMsg: null };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorRef: `PDF-${Date.now().toString(36).toUpperCase()}`,
      errorMsg: error?.message || "Unknown render error",
    };
  }

  componentDidCatch(error, info) {
    // Log category-level info only — never log financial fields
    const stack = info?.componentStack?.split("\n")[1]?.trim() || "";
    console.group("[PDF_SUPERVISOR] Render crash caught");
    console.error("Error:", error?.message);
    console.error("Component:", stack);
    console.error("Ref:", this.state.errorRef);
    console.groupEnd();
  }

  handleReset = () => {
    this.setState({ hasError: false, errorRef: null, errorMsg: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        border: "1.5px solid #fca5a5",
        borderRadius: 10,
        padding: "20px 24px",
        background: "#fff5f5",
        textAlign: "center",
        margin: "12px 0",
      }}>
        <div style={{ fontSize: 26, marginBottom: 8 }}>⚠</div>
        <p style={{ fontWeight: 700, color: "#991b1b", fontSize: 14, margin: "0 0 6px" }}>
          PDF Generation Error
        </p>
        <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 4px" }}>
          The commercial document could not be rendered.
        </p>
        <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 14px" }}>
          Verify all required fields are filled and try again.
        </p>
        {this.props.isAdmin && this.state.errorMsg && (
          <p style={{
            fontSize: 11, color: "#7c3aed", background: "#f5f3ff",
            borderRadius: 6, padding: "6px 12px", margin: "0 0 12px",
            fontFamily: "monospace", textAlign: "left",
          }}>
            <strong>[PDF_SUPERVISOR]</strong> {this.state.errorMsg}
          </p>
        )}
        <p style={{ color: "#9ca3af", fontSize: 10, margin: "0 0 16px", fontFamily: "monospace" }}>
          Ref: {this.state.errorRef}
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          style={{
            padding: "8px 20px", borderRadius: 8,
            background: "#1B2A4A", color: "#fff",
            border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
          Retry PDF
        </button>
      </div>
    );
  }
}
