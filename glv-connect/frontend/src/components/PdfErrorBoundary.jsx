/**
 * PdfErrorBoundary.jsx — V9 PDF Generation Error Boundary
 *
 * Wraps GlvPDF to catch render errors without crashing the host app.
 * Shows a safe fallback UI so users can retry or report the error.
 * Never surfaces internal financial data in the error message.
 */

import { Component } from "react";

export default class PdfErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true, errorId: `PDF-ERR-${Date.now()}` };
  }

  componentDidCatch(error, info) {
    // Log for debugging — never expose sensitive fields
    if (typeof console !== "undefined") {
      console.error("[PdfErrorBoundary] PDF render failed:", error?.message, info?.componentStack?.split("\n")[1]);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, errorId: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={{
        border: "1.5px solid #fca5a5",
        borderRadius: 10,
        padding: "20px 24px",
        background: "#fff5f5",
        textAlign: "center",
        margin: "12px 0",
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⚠</div>
        <p style={{ fontWeight: 700, color: "#991b1b", fontSize: 14, margin: "0 0 6px" }}>
          PDF Generation Error
        </p>
        <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 14px" }}>
          The commercial document could not be rendered. Please verify all required fields and try again.
        </p>
        <p style={{ color: "#9ca3af", fontSize: 10, margin: "0 0 16px", fontFamily: "monospace" }}>
          Ref: {this.state.errorId}
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          style={{
            padding: "8px 20px", borderRadius: 8,
            background: "#1B2A4A", color: "#fff",
            border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
          Retry
        </button>
      </div>
    );
  }
}
