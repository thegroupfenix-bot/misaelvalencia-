/**
 * EnterprisePdfAuditAgent.js — GLV GOS Agents — Enterprise PDF Audit V1.0
 *
 * Comprehensive pre-render audit for enterprise PDF documents.
 * Orchestrates: payload sanity, currency safety, category isolation,
 * language consistency, media isolation, and OILS V5/V6 guard checks.
 * Never throws. Returns a consolidated audit report.
 *
 * STATUS: ACTIVE
 */

import { runLanguageConsistencyCheck }  from "./LanguageConsistencyAgent.js";
import { runMediaIsolationAudit }       from "./MediaIsolationAuditAgent.js";
import { validateOilsV5CategoryGuard }  from "../engines/validationSupervisor.js";
import { detectStaleFields }            from "../utils/pdfPayloadSanitizer.js";
import { resolveDocumentMode }          from "../engines/documentModeResolver.js";

const AGENT_ID = "ENTERPRISE_PDF_AUDIT_AGENT";

/**
 * Run a full enterprise PDF audit before rendering.
 *
 * @param {object} doc         — raw document payload (pre-sanitization)
 * @param {object} [boundMedia] — { coverImage, primaryImage, secondaryImages }
 * @returns {object}            — consolidated audit report
 */
export function runEnterprisePdfAudit(doc = {}, boundMedia = {}) {
  const allIssues   = [];
  const allWarnings = [];
  const subReports  = {};

  try {
    const cdRows     = doc.cdRows || [];
    const firstCdRow = cdRows[0] || {};

    // ── Document mode resolution ─────────────────────────────────────────────
    let docMode = null;
    try {
      docMode = resolveDocumentMode(firstCdRow, doc);
    } catch (_) {
      allWarnings.push("Could not resolve document mode");
    }

    // ── Stale field detection ────────────────────────────────────────────────
    try {
      const staleResult = detectStaleFields(doc, cdRows);
      if (staleResult.hasStaleFields) {
        allWarnings.push(`Stale fields detected: [${staleResult.staleFields.join(", ")}] — sanitizer will strip before render`);
      }
    } catch (_) {
      allWarnings.push("Stale field detection unavailable");
    }

    // ── OILS V5/V6 category guard (VAL-049) ──────────────────────────────────
    try {
      const val049 = validateOilsV5CategoryGuard(cdRows);
      subReports["VAL-049"] = val049;
      if (!val049.pass) {
        for (const issue of (val049.issues || [])) {
          allIssues.push(`[VAL-049] ${issue}`);
        }
      }
    } catch (_) {
      allWarnings.push("VAL-049 check unavailable");
    }

    // ── Language consistency ─────────────────────────────────────────────────
    try {
      const langReport = runLanguageConsistencyCheck(doc);
      subReports.language = langReport;
      if (!langReport.pass) {
        for (const issue of langReport.issues) {
          allIssues.push(`[LANG] ${issue}`);
        }
      }
      for (const warn of langReport.warnings) {
        allWarnings.push(`[LANG] ${warn}`);
      }
    } catch (_) {
      allWarnings.push("Language consistency check unavailable");
    }

    // ── Media isolation ──────────────────────────────────────────────────────
    try {
      const mediaReport = runMediaIsolationAudit(doc, docMode, boundMedia);
      subReports.media = mediaReport;
      if (!mediaReport.pass) {
        for (const issue of mediaReport.issues) {
          (mediaReport.blockPdf ? allIssues : allWarnings).push(`[MEDIA] ${issue}`);
        }
      }
      for (const warn of mediaReport.warnings) {
        allWarnings.push(`[MEDIA] ${warn}`);
      }
    } catch (_) {
      allWarnings.push("Media isolation audit unavailable");
    }

    // ── Required document fields ─────────────────────────────────────────────
    if (!doc.docRef && !doc.documentRef) {
      allIssues.push("documentRef is missing from payload");
    }
    if (!firstCdRow.category) {
      allWarnings.push("No category found in first CD row — document mode may be imprecise");
    }

    const blockRender = allIssues.length > 0;

    return Object.freeze({
      agentId:     AGENT_ID,
      documentRef: doc.docRef || doc.documentRef || "unknown",
      pass:        !blockRender,
      blockRender,
      issueCount:  allIssues.length,
      warnCount:   allWarnings.length,
      issues:      allIssues,
      warnings:    allWarnings,
      docMode,
      subReports,
      _ran:        new Date().toISOString(),
    });

  } catch (err) {
    return Object.freeze({
      agentId:     AGENT_ID,
      documentRef: doc?.docRef || "unknown",
      pass:        false,
      blockRender: true,
      issueCount:  1,
      warnCount:   0,
      issues:      [`Agent error: ${err.message}`],
      warnings:    [],
      docMode:     null,
      subReports:  {},
      _ran:        new Date().toISOString(),
    });
  }
}
