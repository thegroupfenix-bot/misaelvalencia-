/**
 * TaskEvidenceEngine.js
 * Manages evidence attachment, validation, retrieval, and removal for tasks.
 * TASK_RESPONSIBILITY_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

import { updateTask } from './TaskEngine.js';

// ---------------------------------------------------------------------------
// Evidence Types (frozen enum)
// ---------------------------------------------------------------------------
export const EVIDENCE_TYPES = Object.freeze({
  IMAGE: 'image',
  PDF: 'pdf',
  VIDEO: 'video',
  GEO_REFERENCE: 'geoReference',
  COMMENT: 'comment',
  DOCUMENT_REFERENCE: 'documentReference',
});

// ---------------------------------------------------------------------------
// Required fields per evidence type
// ---------------------------------------------------------------------------
const EVIDENCE_REQUIRED_FIELDS = Object.freeze({
  [EVIDENCE_TYPES.IMAGE]: ['url', 'filename'],
  [EVIDENCE_TYPES.PDF]: ['url', 'filename'],
  [EVIDENCE_TYPES.VIDEO]: ['url', 'filename'],
  [EVIDENCE_TYPES.GEO_REFERENCE]: ['latitude', 'longitude'],
  [EVIDENCE_TYPES.COMMENT]: ['text'],
  [EVIDENCE_TYPES.DOCUMENT_REFERENCE]: ['documentId', 'documentType'],
});

// ---------------------------------------------------------------------------
// Internal — generate an evidence ID
// ---------------------------------------------------------------------------
function generateEvidenceId() {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// validateEvidence(evidenceItem)
// Returns an error string if invalid, null if valid.
// ---------------------------------------------------------------------------
export function validateEvidence(evidenceItem) {
  if (!evidenceItem || typeof evidenceItem !== 'object') {
    return 'Evidence item must be a non-null object';
  }

  const { type } = evidenceItem;

  if (!type) {
    return 'Evidence item must have a "type" field';
  }

  const allowedTypes = Object.values(EVIDENCE_TYPES);
  if (!allowedTypes.includes(type)) {
    return `Evidence type "${type}" is not valid. Allowed: ${allowedTypes.join(', ')}`;
  }

  const required = EVIDENCE_REQUIRED_FIELDS[type] || [];
  for (const field of required) {
    const value = evidenceItem[field];
    if (value === undefined || value === null || value === '') {
      return `Evidence of type "${type}" is missing required field: "${field}"`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// attachEvidence(task, evidenceItem)
// Validates the item, stamps it with id + attachedAt, returns updated task.
// ---------------------------------------------------------------------------
export function attachEvidence(task, evidenceItem) {
  const validationError = validateEvidence(evidenceItem);
  if (validationError) {
    throw new Error(`attachEvidence: ${validationError}`);
  }

  const stamped = Object.freeze({
    ...evidenceItem,
    evidenceId: evidenceItem.evidenceId || generateEvidenceId(),
    attachedAt: new Date().toISOString(),
  });

  return updateTask(task, {
    evidence: [...(task.evidence || []), stamped],
  });
}

// ---------------------------------------------------------------------------
// getEvidenceByType(task, type)
// Returns all evidence items matching the given type.
// ---------------------------------------------------------------------------
export function getEvidenceByType(task, type) {
  const allowedTypes = Object.values(EVIDENCE_TYPES);
  if (!allowedTypes.includes(type)) {
    throw new Error(`getEvidenceByType: unknown evidence type "${type}"`);
  }

  return (task.evidence || []).filter((e) => e.type === type);
}

// ---------------------------------------------------------------------------
// removeEvidence(task, evidenceId)
// Returns an updated task without the specified evidence item.
// Throws if the evidenceId is not found.
// ---------------------------------------------------------------------------
export function removeEvidence(task, evidenceId) {
  if (!evidenceId || typeof evidenceId !== 'string') {
    throw new Error('removeEvidence: evidenceId must be a non-empty string');
  }

  const existing = (task.evidence || []);
  const idx = existing.findIndex((e) => e.evidenceId === evidenceId);

  if (idx === -1) {
    throw new Error(`removeEvidence: no evidence found with id "${evidenceId}"`);
  }

  const filtered = existing.filter((e) => e.evidenceId !== evidenceId);

  return updateTask(task, {
    evidence: filtered,
  });
}
