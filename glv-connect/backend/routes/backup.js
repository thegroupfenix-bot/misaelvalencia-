"use strict";

const express  = require("express");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/rbac");
const backup   = require("../services/backup");
const r2       = require("../storage/r2");

const router = express.Router();
router.use(authenticate);
router.use(requireAdmin);

/**
 * POST /backup/run — trigger a manual backup immediately
 */
router.post("/run", async (_req, res) => {
  if (!r2.isConfigured()) {
    return res.status(503).json({ ok: false, error: "R2 not configured — cannot store backup" });
  }
  try {
    const result = await backup.runBackup();
    res.json(result);
  } catch (err) {
    console.error("[backup/run] Error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /backup/list — list all backups stored in R2
 */
router.get("/list", async (_req, res) => {
  try {
    const backups = await backup.listBackups();
    // Normalize shape: key, size, uploaded
    const list = backups.map(b => ({
      key:      b.key,
      size:     b.size,
      uploaded: b.uploaded,
    }));
    res.json(list);
  } catch (err) {
    console.error("[backup/list] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /backup/stats — high-level backup statistics
 */
router.get("/stats", async (_req, res) => {
  try {
    const stats = await backup.getBackupStats();
    res.json({ ...stats, last_backup: backup.lastBackupResult });
  } catch (err) {
    console.error("[backup/stats] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /backup/restore/:encodedKey — NOT IMPLEMENTED
 * The encoded key should be base64url-encoded to safely pass slashes in the URL.
 */
router.post("/restore/:encodedKey", (_req, res) => {
  res.status(501).json({
    ok: false,
    error: "Restore not implemented yet.",
    instructions: [
      "1. Download the backup file from R2 using the key.",
      "2. Decompress the .sqlite.gz file: gunzip glvconnect-*.sqlite.gz",
      "3. Stop the application.",
      "4. Replace the database file at the DB_PATH location with the decompressed file.",
      "5. Restart the application.",
    ],
    encoded_key: _req.params.encodedKey,
    decoded_key: Buffer.from(_req.params.encodedKey, "base64url").toString("utf8"),
  });
});

/**
 * DELETE /backup/:encodedKey — delete a specific backup from R2
 * The key must be base64url-encoded to safely carry slashes in the URL segment.
 */
router.delete("/:encodedKey", async (req, res) => {
  let key;
  try {
    key = Buffer.from(req.params.encodedKey, "base64url").toString("utf8");
  } catch {
    return res.status(400).json({ error: "Invalid encoded key" });
  }

  if (!key.startsWith("backups/")) {
    return res.status(400).json({ error: "Key must start with backups/ — refusing to delete non-backup objects" });
  }

  try {
    await r2.deleteObject(key);
    res.json({ ok: true, deleted_key: key });
  } catch (err) {
    console.error(`[backup/delete] Error deleting ${key}:`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
