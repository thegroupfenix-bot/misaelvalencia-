"use strict";

const fs   = require("fs");
const path = require("path");
const zlib = require("zlib");
const { promisify } = require("util");

const gzip = promisify(zlib.gzip);

const r2 = require("../storage/r2");

// Mirror the same DB path logic as database.js
const DB_PATH = fs.existsSync("/data")
  ? "/data/glvconnect.sqlite"
  : process.env.DB_PATH || path.join(__dirname, "../db/glvconnect.sqlite");

/** @type {{ ts: string, key: string, size_bytes: number, ok: boolean, error: string|null }|null} */
let lastBackupResult = null;

/**
 * runBackup() — reads the SQLite file, gzips it, uploads to R2.
 * Key format: backups/yyyy/mm/dd/glvconnect-{ISO_TS}.sqlite.gz
 * @returns {{ ok: boolean, key: string, size_bytes: number, duration_ms: number }}
 */
async function runBackup() {
  const start = Date.now();

  if (!r2.isConfigured()) {
    const err = new Error("R2 not configured — cannot store backup");
    lastBackupResult = { ts: new Date().toISOString(), key: null, size_bytes: 0, ok: false, error: err.message };
    throw err;
  }

  if (!fs.existsSync(DB_PATH)) {
    const err = new Error(`DB file not found at ${DB_PATH}`);
    lastBackupResult = { ts: new Date().toISOString(), key: null, size_bytes: 0, ok: false, error: err.message };
    throw err;
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  const dd   = String(now.getDate()).padStart(2, "0");
  // ISO timestamp safe for file keys: replace colons & dots
  const isoTs = now.toISOString().replace(/[:.]/g, "-");
  const key = `backups/${yyyy}/${mm}/${dd}/glvconnect-${isoTs}.sqlite.gz`;

  const raw = fs.readFileSync(DB_PATH);
  const compressed = await gzip(raw);

  await r2.uploadObject(key, compressed, "application/gzip");

  const duration_ms = Date.now() - start;
  lastBackupResult = {
    ts: now.toISOString(),
    key,
    size_bytes: compressed.length,
    ok: true,
    error: null,
  };

  console.log(`[backup] Uploaded ${key} (${compressed.length} bytes) in ${duration_ms}ms`);
  return { ok: true, key, size_bytes: compressed.length, duration_ms };
}

/**
 * listBackups() — list all objects under the backups/ prefix, sorted newest-first.
 * @returns {Promise<Array<{ key: string, size: number, uploaded: string }>>}
 */
async function listBackups() {
  if (!r2.isConfigured()) return [];
  const all = await r2.listObjects("backups/", 200);
  // Filter to actual .sqlite.gz files (exclude any trailing slashes / pseudo-folders)
  const backups = all.filter(o => o.key.endsWith(".sqlite.gz"));
  // Sort newest-first by key (ISO timestamp in name guarantees lexicographic = chronological)
  backups.sort((a, b) => (b.key > a.key ? 1 : -1));
  return backups;
}

/**
 * pruneOldBackups(keepLast=30) — delete all backups beyond the `keepLast` newest.
 * @param {number} keepLast
 * @returns {Promise<{ deleted: number, keys: string[] }>}
 */
async function pruneOldBackups(keepLast = 30) {
  const backups = await listBackups(); // already newest-first
  const toDelete = backups.slice(keepLast);
  const deletedKeys = [];
  for (const b of toDelete) {
    try {
      await r2.deleteObject(b.key);
      deletedKeys.push(b.key);
      console.log(`[backup] Pruned old backup: ${b.key}`);
    } catch (e) {
      console.warn(`[backup] Failed to prune ${b.key}: ${e.message}`);
    }
  }
  return { deleted: deletedKeys.length, keys: deletedKeys };
}

/**
 * getBackupStats() — summary of stored backups.
 * @returns {Promise<{ count: number, latest: string|null, oldest: string|null, total_size_bytes: number }>}
 */
async function getBackupStats() {
  try {
    const backups = await listBackups(); // newest-first
    if (!backups.length) {
      return { count: 0, latest: null, oldest: null, total_size_bytes: 0 };
    }
    const total_size_bytes = backups.reduce((acc, b) => acc + (b.size || 0), 0);
    return {
      count: backups.length,
      latest: backups[0].uploaded || backups[0].key,
      oldest: backups[backups.length - 1].uploaded || backups[backups.length - 1].key,
      total_size_bytes,
    };
  } catch (e) {
    console.warn("[backup] getBackupStats error:", e.message);
    return { count: 0, latest: null, oldest: null, total_size_bytes: 0, error: e.message };
  }
}

/**
 * scheduleDailyBackup() — recursive setTimeout targeting 02:00 local time each day.
 */
function scheduleDailyBackup() {
  function msUntilNext2am() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(2, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  function scheduleNext() {
    const delay = msUntilNext2am();
    const nextRun = new Date(Date.now() + delay);
    console.log(`[backup] Next scheduled backup at ${nextRun.toISOString()} (in ${Math.round(delay / 60000)}m)`);

    setTimeout(async () => {
      console.log("[backup] Running scheduled daily backup...");
      try {
        const result = await runBackup();
        console.log(`[backup] Scheduled backup complete: ${result.key} (${result.size_bytes} bytes)`);
        await pruneOldBackups(30);
      } catch (e) {
        console.error("[backup] Scheduled backup failed:", e.message);
      }
      scheduleNext(); // schedule the next one regardless of success/failure
    }, delay);
  }

  scheduleNext();
}

module.exports = { runBackup, listBackups, pruneOldBackups, getBackupStats, scheduleDailyBackup, get lastBackupResult() { return lastBackupResult; } };
