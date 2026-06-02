/**
 * MediaIsolationAuditAgent.js — GLV GOS Agents — Media Isolation Audit V1.0
 *
 * Audits document media bindings against approved registry and category rules.
 * Enforces: max 2 commercial images, category isolation, registry-only assets.
 * Never throws. Returns structured reports.
 *
 * STATUS: ACTIVE
 */

import { validateMediaCategory, getApprovedMedia } from "../core/media/MediaRegistryEngine.js";
import { auditBoundMediaForMode, getMaxSecondaryImages } from "../engines/media/MediaCategoryIsolationEngine.js";

const AGENT_ID      = "MEDIA_ISOLATION_AUDIT_AGENT";
const MAX_IMAGES    = 2;

/**
 * Run a media isolation audit on a document payload.
 *
 * @param {object} doc      — document payload
 * @param {string} docMode  — resolved document mode (from documentModeResolver)
 * @param {object} [boundMedia]  — { coverImage, primaryImage, secondaryImages }
 * @returns {object}          — structured audit report
 */
export function runMediaIsolationAudit(doc = {}, docMode, boundMedia = {}) {
  const issues   = [];
  const warnings = [];

  try {
    const category = (doc.cdRows && doc.cdRows[0] && doc.cdRows[0].category) || doc.category || null;

    // Check image count
    const secondaryImages = Array.isArray(boundMedia.secondaryImages) ? boundMedia.secondaryImages : [];
    const totalImages = (boundMedia.coverImage ? 1 : 0) +
                        (boundMedia.primaryImage ? 1 : 0) +
                        secondaryImages.length;

    if (totalImages > MAX_IMAGES) {
      issues.push(`Document has ${totalImages} images — maximum allowed is ${MAX_IMAGES}`);
    }

    const maxSecondary = docMode ? getMaxSecondaryImages(docMode) : 1;
    if (secondaryImages.length > maxSecondary) {
      issues.push(`Secondary images count (${secondaryImages.length}) exceeds limit (${maxSecondary}) for mode "${docMode}"`);
    }

    // Registry validation for each bound image
    const imagesToCheck = [
      { label: "coverImage",   url: boundMedia.coverImage },
      { label: "primaryImage", url: boundMedia.primaryImage },
      ...secondaryImages.map((url, i) => ({ label: `secondaryImages[${i}]`, url })),
    ].filter(item => item.url);

    for (const item of imagesToCheck) {
      const result = validateMediaCategory(item.url, category);
      if (!result.valid) {
        issues.push(`${item.label}: ${result.reason}`);
      }
    }

    // Run mode-based isolation check
    let modeAuditIssues = [];
    if (docMode) {
      try {
        const modeAudit = auditBoundMediaForMode(boundMedia, docMode);
        modeAuditIssues = modeAudit.issues || [];
        for (const issue of modeAuditIssues) {
          warnings.push(`[MediaCategoryIsolation] ${issue}`);
        }
      } catch (_) {
        warnings.push("Could not run mode-based media isolation check");
      }
    }

    const approvedCount = getApprovedMedia(category).length;

    return Object.freeze({
      agentId:        AGENT_ID,
      documentRef:    doc.docRef || "unknown",
      pass:           issues.length === 0,
      blockPdf:       issues.some(i => i.includes("exceeds") || i.includes("maximum")),
      issues,
      warnings,
      category,
      docMode:        docMode || null,
      totalImages,
      maxAllowed:     MAX_IMAGES,
      approvedAssetsForCategory: approvedCount,
      _ran:           new Date().toISOString(),
    });

  } catch (err) {
    return Object.freeze({
      agentId:     AGENT_ID,
      documentRef: doc?.docRef || "unknown",
      pass:        false,
      blockPdf:    false,
      issues:      [`Agent error: ${err.message}`],
      warnings:    [],
      category:    null,
      docMode:     null,
      totalImages: 0,
      maxAllowed:  MAX_IMAGES,
      approvedAssetsForCategory: 0,
      _ran:        new Date().toISOString(),
    });
  }
}
