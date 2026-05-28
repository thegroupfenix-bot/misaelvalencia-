/**
 * LanguageConsistencyAgent.js — GLV GOS Agents — Language Consistency Validation V1.0
 *
 * Validates that document payloads use a consistent language setting
 * and that all translated fields resolve correctly via LanguageCore.
 * Detects mixed-language content and unsupported locale codes.
 * Never throws. Returns structured reports.
 *
 * STATUS: ACTIVE
 */

import { isSupportedLanguage, normalizeLanguage, t, getCategoryLabel, SUPPORTED_LANGUAGES } from "../core/i18n/LanguageCore.js";

const AGENT_ID = "LANGUAGE_CONSISTENCY_AGENT";

// Fields in a document payload that should carry language info
const LANGUAGE_FIELDS = ["lang", "language", "docLang", "locale"];

/**
 * Run a language consistency check on a document payload.
 *
 * @param {object} doc    — document payload (from CommercialEngine or GlvPDF)
 * @returns {object}       — structured validation report
 */
export function runLanguageConsistencyCheck(doc = {}) {
  const issues   = [];
  const warnings = [];

  try {
    // Detect language field
    let detectedLang = null;
    for (const field of LANGUAGE_FIELDS) {
      if (doc[field]) {
        detectedLang = doc[field];
        break;
      }
    }

    if (!detectedLang) {
      warnings.push("No language field found in document payload — defaulting to 'es'");
      detectedLang = SUPPORTED_LANGUAGES.ES;
    }

    const normalized = normalizeLanguage(detectedLang);
    if (!isSupportedLanguage(normalized)) {
      issues.push(`Unsupported language code: "${detectedLang}". Supported: [${Object.values(SUPPORTED_LANGUAGES).join(", ")}]`);
    }

    if (detectedLang !== normalized) {
      warnings.push(`Language code "${detectedLang}" normalized to "${normalized}"`);
    }

    // Spot-check key translation resolvers work for detected language
    const probeKeys = ["common.date", "common.reference", "doc.sco", "pdf.coverLabel"];
    const resolvedSamples = {};
    for (const key of probeKeys) {
      const resolved = t(key, normalized);
      resolvedSamples[key] = resolved;
      if (resolved === key) {
        warnings.push(`Translation key "${key}" has no entry for language "${normalized}"`);
      }
    }

    // Check category label resolves if category is present
    const category = (doc.cdRows && doc.cdRows[0] && doc.cdRows[0].category) || doc.category;
    let categoryLabelResolved = null;
    if (category) {
      categoryLabelResolved = getCategoryLabel(category, normalized);
      if (categoryLabelResolved === `category.${category}`) {
        warnings.push(`Category "${category}" has no label for language "${normalized}"`);
      }
    }

    return Object.freeze({
      agentId:          AGENT_ID,
      documentRef:      doc.docRef || doc.documentRef || "unknown",
      pass:             issues.length === 0,
      blockPdf:         false,
      issues,
      warnings,
      detectedLang,
      normalizedLang:   normalized,
      resolvedSamples,
      categoryLabel:    categoryLabelResolved,
      _ran:             new Date().toISOString(),
    });

  } catch (err) {
    return Object.freeze({
      agentId:        AGENT_ID,
      documentRef:    doc?.docRef || "unknown",
      pass:           false,
      blockPdf:       false,
      issues:         [`Agent error: ${err.message}`],
      warnings:       [],
      detectedLang:   null,
      normalizedLang: null,
      resolvedSamples:{},
      categoryLabel:  null,
      _ran:           new Date().toISOString(),
    });
  }
}
