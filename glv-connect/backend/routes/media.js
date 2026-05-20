const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const r2 = require("../storage/r2");
const classifier = require("../ai/classifier");
const fs = require("fs");

// sharp is lazy-loaded to avoid crashing the server if native bindings fail
let _sharp = null;
function getSharp() {
  if (!_sharp) _sharp = require("sharp");
  return _sharp;
}

const router = express.Router();
router.use(authenticate);

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "CORPORATE_ADMIN", "DIRECTIVO"]);
function requireAdmin(req, res, next) {
  if (!ADMIN_ROLES.has(req.user?.role) && req.user?.username !== "mvalencia")
    return res.status(403).json({ error: "Acceso restringido" });
  next();
}

/**
 * validateUploadSecurity(buffer, mimetype, originalname)
 * Checks magic bytes, blocks executables, and scans SVGs for XSS patterns.
 * @returns {{ ok: boolean, reason: string|null }}
 */
function validateUploadSecurity(buffer, mimetype, originalname) {
  if (!buffer || buffer.length < 4) return { ok: true, reason: null };

  const b0 = buffer[0], b1 = buffer[1], b2 = buffer[2], b3 = buffer[3];

  // Block Windows executables (MZ) and Linux ELF binaries
  if (b0 === 0x4D && b1 === 0x5A) return { ok: false, reason: "Executable file detected (MZ header)" };
  if (b0 === 0x7F && b1 === 0x45 && b2 === 0x4C && b3 === 0x46) return { ok: false, reason: "Executable file detected (ELF header)" };

  const ext = path.extname(originalname).toLowerCase();

  if (mimetype === "image/svg+xml" || ext === ".svg") {
    // Scan first 4096 bytes for dangerous SVG patterns
    const sample = buffer.slice(0, 4096).toString("utf8");
    if (/<script/i.test(sample))     return { ok: false, reason: "SVG contains <script> tag" };
    if (/javascript:/i.test(sample)) return { ok: false, reason: "SVG contains javascript: URI" };
    if (/on\w+\s*=/i.test(sample))   return { ok: false, reason: "SVG contains inline event handler" };
    return { ok: true, reason: null };
  }

  if (mimetype === "image/jpeg" || ext === ".jpg" || ext === ".jpeg") {
    if (!(b0 === 0xFF && b1 === 0xD8 && b2 === 0xFF)) return { ok: false, reason: "File does not match JPEG magic bytes" };
  } else if (mimetype === "image/png" || ext === ".png") {
    if (!(b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47)) return { ok: false, reason: "File does not match PNG magic bytes" };
  } else if (mimetype === "image/gif" || ext === ".gif") {
    if (!(b0 === 0x47 && b1 === 0x49 && b2 === 0x46 && b3 === 0x38)) return { ok: false, reason: "File does not match GIF magic bytes" };
  } else if (mimetype === "image/webp" || ext === ".webp") {
    // RIFF....WEBP: bytes 0-3 = RIFF, bytes 8-11 = WEBP
    if (buffer.length >= 12) {
      const riff = buffer.slice(0, 4).toString("ascii");
      const webp = buffer.slice(8, 12).toString("ascii");
      if (riff !== "RIFF" || webp !== "WEBP") return { ok: false, reason: "File does not match WebP magic bytes" };
    }
  } else if (mimetype === "application/pdf" || ext === ".pdf") {
    if (!(b0 === 0x25 && b1 === 0x50 && b2 === 0x44 && b3 === 0x46)) return { ok: false, reason: "File does not match PDF magic bytes" };
  }

  return { ok: true, reason: null };
}

// multer: memory storage, 20MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg","image/png","image/webp","image/gif","application/pdf","image/svg+xml"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Tipo de archivo no permitido"));
  },
});

const MEDIA_CATEGORIES = {
  "products/fruits": ["products/fruits/colombia","products/fruits/brazil","products/fruits/peru","products/fruits/chile"],
  "products/live-animals": ["livestock/sheep","livestock/cattle","livestock/goats"],
  "products/meat": ["products/frozen","products/meat"],
  "products/grains": ["products/grains"],
  "products/oils": ["products/oils"],
  "operations": ["operations/inspection","operations/loading","operations/certificates","operations/audit"],
  "certificates": ["certificates/halal","certificates/sgs","certificates/health","certificates/origin"],
  "branding": ["branding/logos","branding/templates"],
  "corporate": ["corporate"],
};

function buildR2Key(category, filename) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const safe = category.replace(/[^a-z0-9/_-]/g, "-").replace(/\/+/g, "/");
  return `${safe}/${year}/${month}/${filename}`;
}

function sanitizeFilename(original) {
  const ext = path.extname(original).toLowerCase();
  const base = path.basename(original, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
  const uid = crypto.randomBytes(4).toString("hex");
  return `${base}-${uid}${ext}`;
}

// Rewrite any stored private S3 URL to the public domain
function fixUrl(url) {
  return r2.rewriteToPublicUrl(url);
}

function serializeAsset(r) {
  return {
    ...r,
    public_url: fixUrl(r.public_url),
    thumbnail_url: fixUrl(r.thumbnail_url),
    tags: JSON.parse(r.tags_json || "[]"),
    metadata: JSON.parse(r.metadata_json || "{}"),
  };
}

// GET /media — list assets
router.get("/", (req, res) => {
  const { category, country, product, search, archived = 0, limit = 100, offset = 0 } = req.query;
  let base = "SELECT * FROM media_assets WHERE status != 'deleted' AND archived = ?";
  const filterParams = [+archived];
  if (category)  { base += " AND category LIKE ?"; filterParams.push(`${category}%`); }
  if (country)   { base += " AND country_origin = ?"; filterParams.push(country); }
  if (product)   { base += " AND product_relation = ?"; filterParams.push(product); }
  if (search)    { base += " AND (original_name LIKE ? OR tags_json LIKE ? OR subcategory LIKE ?)"; filterParams.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  const rows = db.prepare(base + " ORDER BY upload_date DESC LIMIT ? OFFSET ?").all(...filterParams, +limit, +offset).map(serializeAsset);
  const total = db.prepare(base.replace("SELECT *", "SELECT COUNT(*) AS c")).get(...filterParams).c;
  res.json({ assets: rows, total });
});

// GET /media/categories — folder structure
router.get("/categories", (_req, res) => res.json(MEDIA_CATEGORIES));

// GET /media/debug-categories — returns distinct category values stored in DB (admin only)
// Used to diagnose filter mismatches without querying SQLite directly.
router.get("/debug-categories", requireAdmin, (_req, res) => {
  const rows = db.prepare(
    "SELECT category, COUNT(*) AS count FROM media_assets WHERE status != 'deleted' GROUP BY category ORDER BY count DESC"
  ).all();
  const sample = db.prepare(
    "SELECT id, r2_key, category, original_name FROM media_assets WHERE status != 'deleted' ORDER BY id DESC LIMIT 10"
  ).all();
  res.json({ distinct_categories: rows, recent_sample: sample });
});

// NOTE: all static-path routes MUST be declared before /:id — Express matches in order

// GET /media/health/media-center — admin health dashboard for the media centre
router.get("/health/media-center", requireAdmin, async (_req, res) => {
  const t0 = Date.now();
  try {
    // 1. DB asset stats
    const total_assets   = db.prepare("SELECT COUNT(*) AS c FROM media_assets WHERE status != 'deleted'").get().c;
    const by_category    = db.prepare("SELECT category, COUNT(*) AS count FROM media_assets WHERE status != 'deleted' GROUP BY category ORDER BY count DESC").all();
    const missing_thumbnails = db.prepare("SELECT COUNT(*) AS c FROM media_assets WHERE status != 'deleted' AND (thumbnail_url IS NULL OR thumbnail_url = '')").get().c;
    const recent_uploads = db.prepare("SELECT id, original_name, category, upload_date, storage_provider FROM media_assets WHERE status != 'deleted' ORDER BY id DESC LIMIT 5").all();

    // 2. DB file info
    const DB_PATH_LOCAL = fs.existsSync("/data") ? "/data/glvconnect.sqlite" : (process.env.DB_PATH || path.join(__dirname, "../db/glvconnect.sqlite"));
    let db_size_bytes = 0;
    try { db_size_bytes = fs.statSync(DB_PATH_LOCAL).size; } catch { /* ignore */ }

    // 3. R2 info
    const r2Info = { configured: r2.isConfigured(), mode: r2.authMode() };

    // 4. Backup stats (lazy import — backup service may not be loaded yet)
    let backupStats = null;
    try {
      const backupSvc = require("../services/backup");
      backupStats = await backupSvc.getBackupStats();
      backupStats.last_backup = backupSvc.lastBackupResult;
    } catch (e) {
      backupStats = { error: e.message };
    }

    // 5. System info
    const system = {
      uptime_seconds: Math.floor(process.uptime()),
      node_version:   process.version,
      memory_rss:     process.memoryUsage().rss,
    };

    const response_ms = Date.now() - t0;
    res.json({
      ok: true,
      timestamp:    new Date().toISOString(),
      response_ms,
      db: {
        path:        DB_PATH_LOCAL,
        size_bytes:  db_size_bytes,
        persistent:  fs.existsSync("/data"),
      },
      r2: r2Info,
      assets: {
        total_assets,
        by_category,
        missing_thumbnails,
        recent_uploads,
      },
      backups: backupStats,
      system,
    });
  } catch (err) {
    console.error("[health/media-center] Error:", err.message);
    res.status(500).json({ ok: false, error: err.message, response_ms: Date.now() - t0 });
  }
});

router.get("/r2-status", (_req, res) => {
  res.json({
    configured: r2.isConfigured(),
    auth_mode: r2.authMode(),
    bucket: r2.R2_BUCKET_NAME,
    ai_classification: classifier.isEnabled(),
  });
});

// GET /media/r2-ping  — must be BEFORE /:id
router.get("/r2-ping", requireAdmin, async (_req, res) => {
  if (!r2.isConfigured()) return res.status(503).json({ ok: false, error: "R2 not configured" });
  try {
    const result = await r2.ping();
    res.json({ ...result, ai_classification: classifier.isEnabled() });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// GET /media/r2-raw-list — diagnostic: shows raw CF API response to confirm field names
router.get("/r2-raw-list", requireAdmin, async (_req, res) => {
  if (!r2.isConfigured()) return res.status(503).json({ error: "R2 not configured" });
  const mode = r2.authMode();
  if (mode !== "token") return res.json({ mode, note: "only available in token mode" });
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.R2_API_TOKEN;
    const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${r2.R2_BUCKET_NAME}/objects`;

    // Flat listing — no delimiter
    const flatRes = await fetch(`${base}?limit=10`, { headers: { Authorization: `Bearer ${token}` } });
    const flatBody = await flatRes.json().catch(() => ({}));

    // Delimiter listing — with /
    const delimRes = await fetch(`${base}?limit=10&delimiter=%2F`, { headers: { Authorization: `Bearer ${token}` } });
    const delimBody = await delimRes.json().catch(() => ({}));

    res.json({
      flat: { status: flatRes.status, result_keys: Object.keys(flatBody.result || {}), body: flatBody },
      delimited: { status: delimRes.status, result_keys: Object.keys(delimBody.result || {}), body: delimBody },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /media/r2-traverse-test — deep traversal diagnostic
// Probes 8 specific API call variants and returns raw response shapes as JSON.
// Run from console: fetch('/media/r2-traverse-test', {headers:{Authorization:'Bearer '+localStorage.getItem('glv_token')}}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))
router.get("/r2-traverse-test", requireAdmin, async (_req, res) => {
  if (!r2.isConfigured()) return res.status(503).json({ error: "R2 not configured" });
  if (r2.authMode() !== "token") return res.json({ note: "only available in token mode" });
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.R2_API_TOKEN;
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${r2.R2_BUCKET_NAME}/objects`;

  async function probe(params) {
    const url = `${base}?${new URLSearchParams(params)}`;
    try {
      const r2res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const body = await r2res.json().catch(() => ({}));
      const result = body.result || body;
      const objects  = result?.objects  || (Array.isArray(result) ? result : []);
      const prefixes = result?.delimitedPrefixes || result?.commonPrefixes || result?.prefixes || [];
      return {
        http_status:      r2res.status,
        ok:               r2res.ok,
        body_keys:        Object.keys(body),
        result_keys:      Object.keys(result || {}),
        objects_count:    objects.length,
        prefixes_count:   prefixes.length,
        first_obj:        objects[0] || null,
        first_obj_fields: objects[0] ? Object.keys(objects[0]) : [],
        first_prefix:     prefixes[0] || null,
        is_truncated:     result?.is_truncated,
        truncated:        result?.truncated,
        cursor:           result?.cursor,
        result_info:      body?.result_info || null,
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  const results = {};
  // Baseline: confirmed working in previous session
  results.A_root_nodelim_limit10   = await probe({ limit: "10" });
  // What listObjects actually sends now (limit=1000, no delimiter)
  results.B_root_nodelim_limit1000 = await probe({ limit: "1000" });
  // Root with delimiter (old approach — shows top-level folder grouping)
  results.C_root_delim_limit10     = await probe({ limit: "10", delimiter: "/" });
  // Sub-prefix: products/ (no delimiter, small limit — expected: all live-animal files)
  results.D_products_nodelim       = await probe({ limit: "10", prefix: "products/" });
  // Sub-prefix: products/ WITH delimiter (expected: delimitedPrefixes: ["products/live-animals/"])
  results.E_products_delim         = await probe({ limit: "10", prefix: "products/", delimiter: "/" });
  // Deeper: products/live-animals/ (no delimiter — expected: all files under this path)
  results.F_live_animals_nodelim   = await probe({ limit: "10", prefix: "products/live-animals/" });
  // Leaf level: products/live-animals/2026/05/ (expected: actual image files)
  results.G_leaf_nodelim           = await probe({ limit: "10", prefix: "products/live-animals/2026/05/" });
  // Leaf with delimiter (control — should return the files, not sub-prefixes)
  results.H_leaf_delim             = await probe({ limit: "10", prefix: "products/live-animals/2026/05/", delimiter: "/" });

  res.json({ bucket: r2.R2_BUCKET_NAME, tests: results });
});

// ─── Media Auto-Binding Engine ───────────────────────────────────────────────
// NOTE: both /bind and /bind-preview are static-path routes and MUST appear
// before the /:id wildcard route below.

const { bindMedia } = require("../services/mediaBinding");

// POST /media/bind — smart media binding for SCO/FCO document generation
// Body: { category, origin, tags[], limit }  (all optional; limit defaults to 6)
router.post("/bind", (req, res) => {
  try {
    const { category, origin, tags = [], limit = 6 } = req.body || {};
    const result = bindMedia(db, { category, origin, tags: Array.isArray(tags) ? tags : [], limit: Number(limit) || 6 });
    res.json(result);
  } catch (err) {
    console.error("[POST /media/bind] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /media/bind-preview — same as POST /bind but via query params (easy testing)
// Query: ?category=LIVE_ANIMALS&origin=Brazil&limit=6
router.get("/bind-preview", (req, res) => {
  try {
    const { category, origin, limit = 6 } = req.query;
    const result = bindMedia(db, { category, origin, tags: [], limit: Number(limit) || 6 });
    res.json(result);
  } catch (err) {
    console.error("[GET /media/bind-preview] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /media/:id
router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM media_assets WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  res.json(serializeAsset(row));
});

// POST /media/upload — single or multiple files
router.post("/upload", upload.array("files", 20), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: "Sin archivos" });

  let { category = "general", subcategory, country_origin, product_relation,
        operation_relation, document_relation, tags } = req.body;
  const tagsArr = tags ? (typeof tags === "string" ? JSON.parse(tags) : tags) : [];
  const uploaded = [];

  for (const file of req.files) {
    // A) Magic bytes + SVG security validation
    const secCheck = validateUploadSecurity(file.buffer, file.mimetype, file.originalname);
    if (!secCheck.ok) {
      uploaded.push({ error: `Security validation failed: ${secCheck.reason}`, originalname: file.originalname });
      continue;
    }

    try {
      const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");

      // B) Duplicate detection — full record returned
      const existing = db.prepare("SELECT id, r2_key, public_url FROM media_assets WHERE checksum_hash = ? AND status != 'deleted'").get(checksum);
      if (existing) {
        uploaded.push({ duplicate: true, existing_id: existing.id, existing_url: fixUrl(existing.public_url), originalname: file.originalname });
        continue;
      }

      // AI classification (runs in parallel with image processing — non-blocking)
      let aiResult = null;
      const aiPromise = classifier.classifyImage(file.buffer, file.mimetype).then(r => { aiResult = r; }).catch(() => {});

      const isImage = file.mimetype.startsWith("image/");
      let thumbUrl = null;
      let thumbKey = null;
      let width = null;
      let height = null;
      let uploadBuffer = file.buffer;

      if (isImage && !r2.isConfigured()) {
        await aiPromise;
        const record = db.prepare(`
          INSERT INTO media_assets (filename,original_name,mime_type,extension,category,subcategory,
            country_origin,product_relation,operation_relation,document_relation,uploaded_by,
            file_size,checksum_hash,r2_key,tags_json,metadata_json,status,storage_provider)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(sanitizeFilename(file.originalname), file.originalname, file.mimetype,
          path.extname(file.originalname).slice(1),
          aiResult?.category || category, aiResult?.subcategory || subcategory || null,
          aiResult?.country_origin || country_origin || null,
          aiResult?.product_relation || product_relation || null,
          operation_relation||null, document_relation||null, req.user.username,
          file.size, checksum, "pending",
          JSON.stringify([...new Set([...(aiResult?.tags||[]), ...tagsArr])]),
          "{}", "pending", "r2");
        uploaded.push({ id: record.lastInsertRowid, pending: true, message: "R2 not configured" });
        continue;
      }

      if (isImage) {
        const sharp = getSharp();
        const meta = await sharp(file.buffer).metadata();
        width = meta.width; height = meta.height;
        if (file.size > 2 * 1024 * 1024) {
          uploadBuffer = await sharp(file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
        }
        const thumbBuffer = await sharp(file.buffer).resize({ width: 400, height: 300, fit: "cover" }).webp({ quality: 75 }).toBuffer();

        // Wait for AI before building the final key so we can use the smart name
        await aiPromise;

        const effectiveCategory = aiResult?.category || category;
        const smartBase = aiResult?.smart_name
          ? `${aiResult.smart_name.substring(0, 60)}-${crypto.randomBytes(4).toString("hex")}`
          : null;
        const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
        const filename = smartBase ? `${smartBase}${ext}` : sanitizeFilename(file.originalname);
        const r2Key = buildR2Key(effectiveCategory, filename);

        thumbKey = `thumbnails/${r2Key.replace(/\.[^.]+$/, ".webp")}`;
        thumbUrl = await r2.uploadObject(thumbKey, thumbBuffer, "image/webp");

        const publicUrl = await r2.uploadObject(r2Key, uploadBuffer, file.mimetype);
        const mergedTags = [...new Set([...(aiResult?.tags || []), ...tagsArr])];

        const record = db.prepare(`
          INSERT INTO media_assets (filename,original_name,mime_type,extension,category,subcategory,
            country_origin,product_relation,operation_relation,document_relation,uploaded_by,
            file_size,image_width,image_height,public_url,thumbnail_url,checksum_hash,r2_key,
            thumbnail_key,tags_json,metadata_json,status,storage_provider)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(filename, file.originalname, file.mimetype, path.extname(filename).slice(1),
          effectiveCategory,
          aiResult?.subcategory || subcategory || null,
          aiResult?.country_origin || country_origin || null,
          aiResult?.product_relation || product_relation || null,
          operation_relation||null, document_relation||null, req.user.username,
          file.size, width, height, publicUrl, thumbUrl, checksum, r2Key,
          thumbKey, JSON.stringify(mergedTags),
          JSON.stringify({ ai_classified: !!aiResult, ai_confidence: aiResult?.confidence }),
          "active", "r2");

        // D) Audit log for image upload
        try {
          db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, ?, ?, ?)")
            .run(req.user.username, `media_upload:${r2Key}`, String(record.lastInsertRowid), req.ip);
        } catch { /* audit failures must not break uploads */ }

        uploaded.push({
          id: record.lastInsertRowid,
          filename,
          public_url: fixUrl(publicUrl),
          thumbnail_url: fixUrl(thumbUrl),
          ai_classified: !!aiResult,
          ai_category: aiResult?.category,
          ai_tags: aiResult?.tags,
        });
        continue;
      }

      // Non-image (PDF, etc.)
      await aiPromise;
      const filename = sanitizeFilename(file.originalname);
      const r2Key = buildR2Key(category, filename);
      const publicUrl = await r2.uploadObject(r2Key, uploadBuffer, file.mimetype);

      const record = db.prepare(`
        INSERT INTO media_assets (filename,original_name,mime_type,extension,category,subcategory,
          country_origin,product_relation,operation_relation,document_relation,uploaded_by,
          file_size,public_url,checksum_hash,r2_key,tags_json,metadata_json,status,storage_provider)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(filename, file.originalname, file.mimetype, path.extname(filename).slice(1),
        category, subcategory||null, country_origin||null, product_relation||null,
        operation_relation||null, document_relation||null, req.user.username,
        file.size, publicUrl, checksum, r2Key,
        JSON.stringify(tagsArr), "{}", "active", "r2");

      // D) Audit log for non-image upload
      try {
        db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, ?, ?, ?)")
          .run(req.user.username, `media_upload:${r2Key}`, String(record.lastInsertRowid), req.ip);
      } catch { /* audit failures must not break uploads */ }

      uploaded.push({ id: record.lastInsertRowid, filename, public_url: fixUrl(publicUrl) });
    } catch (err) {
      console.error("Upload error:", err.message);
      uploaded.push({ error: err.message, originalname: file.originalname });
    }
  }

  res.status(201).json({ uploaded });
});

// PATCH /media/:id — update metadata/tags/relations
router.patch("/:id", (req, res) => {
  const { category, subcategory, country_origin, product_relation, operation_relation,
          document_relation, tags, visibility, archived } = req.body;
  const sets = ["updated_at = datetime('now')"]; const params = [];
  if (category !== undefined)           { sets.push("category = ?"); params.push(category); }
  if (subcategory !== undefined)        { sets.push("subcategory = ?"); params.push(subcategory); }
  if (country_origin !== undefined)     { sets.push("country_origin = ?"); params.push(country_origin); }
  if (product_relation !== undefined)   { sets.push("product_relation = ?"); params.push(product_relation); }
  if (operation_relation !== undefined) { sets.push("operation_relation = ?"); params.push(operation_relation); }
  if (document_relation !== undefined)  { sets.push("document_relation = ?"); params.push(document_relation); }
  if (tags !== undefined)               { sets.push("tags_json = ?"); params.push(JSON.stringify(tags)); }
  if (visibility !== undefined)         { sets.push("visibility = ?"); params.push(visibility); }
  if (archived !== undefined)           { sets.push("archived = ?"); params.push(archived ? 1 : 0); }
  params.push(req.params.id);
  db.prepare(`UPDATE media_assets SET ${sets.join(",")} WHERE id = ?`).run(...params);
  res.json(serializeAsset(db.prepare("SELECT * FROM media_assets WHERE id = ?").get(req.params.id)));
});

// DELETE /media/:id
router.delete("/:id", async (req, res) => {
  const row = db.prepare("SELECT r2_key, thumbnail_key FROM media_assets WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  try {
    if (row.r2_key && r2.isConfigured()) await r2.deleteObject(row.r2_key);
    if (row.thumbnail_key && r2.isConfigured()) await r2.deleteObject(row.thumbnail_key);
  } catch (e) { console.warn("R2 delete error:", e.message); }
  db.prepare("UPDATE media_assets SET status = 'deleted' WHERE id = ?").run(req.params.id);
  // D) Audit log for delete
  try {
    db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, ?, ?, ?)")
      .run(req.user.username, `media_delete:${row.r2_key}`, String(req.params.id), req.ip);
  } catch { /* audit failures must not break deletes */ }
  res.json({ ok: true });
});

// GET /media/match/:category — smart matching for SCO/FCO
router.get("/match/:category", (req, res) => {
  const { country, limit = 6 } = req.query;
  let sql = "SELECT * FROM media_assets WHERE status = 'active' AND archived = 0";
  const params = [];
  const catMap = {
    "LIVE_ANIMALS": "products/live-animals", "LIVESTOCK": "products/live-animals",
    "FROZEN_MEAT": "products/meat", "FROZEN_POULTRY": "products/meat",
    "CANNED_MEAT": "products/meat",
    "COLOMBIAN_EXOTIC_FRUITS": "products/fruits/colombia",
    "FRUIT_PRODUCTS": "products/fruits",
    "COMMODITIES": "products/grains", "BEANS": "products/grains",
    "LENTILS": "products/grains", "CHICKPEAS": "products/grains",
    "OILS": "products/oils",
  };
  const mediaCat = catMap[req.params.category] || "products";
  sql += " AND category LIKE ?"; params.push(`${mediaCat}%`);
  if (country) { sql += " AND (country_origin = ? OR country_origin IS NULL)"; params.push(country); }
  sql += " ORDER BY upload_date DESC LIMIT ?"; params.push(+limit);
  const rows = db.prepare(sql).all(...params).map(serializeAsset);
  res.json(rows);
});

// GET /media/reconcile/status — R2 object count vs DB record count
router.get("/reconcile/status", requireAdmin, async (_req, res) => {
  if (!r2.isConfigured()) return res.json({ configured: false });
  try {
    const [r2Count, dbCount] = await Promise.all([
      r2.listObjects("", 20000).then(arr =>
        arr.filter(o => !o.key.startsWith("thumbnails/") && !o.key.endsWith("/")).length
      ),
      Promise.resolve(db.prepare("SELECT COUNT(*) AS c FROM media_assets WHERE status != 'deleted'").get().c),
    ]);
    res.json({ r2_objects: r2Count, db_records: dbCount, in_sync: r2Count <= dbCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /media/reconcile — scan ALL R2 objects (full cursor pagination), restore missing DB records
router.post("/reconcile", requireAdmin, async (_req, res) => {
  if (!r2.isConfigured()) return res.status(503).json({ error: "R2 not configured" });

  const MIME_MAP = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
    pdf: "application/pdf",
  };

  function categoryFromKey(key) {
    const parts = key.split("/");
    const yearIdx = parts.findIndex(p => /^\d{4}$/.test(p));
    if (yearIdx > 0) return parts.slice(0, yearIdx).join("/");
    return parts.slice(0, -1).join("/") || "general";
  }

  try {
    console.log("[reconcile] Starting — listing all R2 objects with full cursor pagination...");
    const allObjects = await r2.listObjects("", 20000);
    console.log(`[reconcile] listObjects returned ${allObjects.length} total objects`);

    const mainAssets = allObjects.filter(o => !o.key.startsWith("thumbnails/") && !o.key.endsWith("/"));
    const thumbIndex = new Set(allObjects.filter(o => o.key.startsWith("thumbnails/")).map(o => o.key));
    console.log(`[reconcile] R2 total=${allObjects.length} main=${mainAssets.length} thumbs=${thumbIndex.size}`);

    // Sample first 3 keys for visibility in Railway logs
    mainAssets.slice(0, 3).forEach((o, i) =>
      console.log(`[reconcile] sample[${i}] key="${o.key}" size=${o.size}`)
    );

    const existingKeys = new Set(
      db.prepare("SELECT r2_key FROM media_assets WHERE r2_key IS NOT NULL AND status != 'deleted'").all().map(r => r.r2_key)
    );
    console.log(`[reconcile] DB existing r2_key count: ${existingKeys.size}`);

    const insert = db.prepare(`
      INSERT INTO media_assets
        (filename, original_name, mime_type, extension, category, uploaded_by,
         file_size, public_url, thumbnail_url, r2_key, thumbnail_key,
         tags_json, metadata_json, status, storage_provider, upload_date, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const toInsert = [];
    let skippedDuplicate = 0;
    for (const obj of mainAssets) {
      if (existingKeys.has(obj.key)) { skippedDuplicate++; continue; }
      const filename  = obj.key.split("/").pop();
      const ext       = (filename.split(".").pop() || "").toLowerCase();
      const mimeType  = MIME_MAP[ext] || "application/octet-stream";
      const category  = categoryFromKey(obj.key);
      const publicUrl = r2.buildPublicUrl(obj.key);
      const thumbKey  = `thumbnails/${obj.key.replace(/\.[^.]+$/, ".webp")}`;
      const thumbUrl  = thumbIndex.has(thumbKey) ? r2.buildPublicUrl(thumbKey) : null;
      const uploadedAt = (obj.uploaded || new Date().toISOString()).slice(0, 19).replace("T", " ");
      toInsert.push([
        filename, filename, mimeType, ext, category, "reconcile",
        obj.size || 0, publicUrl, thumbUrl, obj.key,
        thumbUrl ? thumbKey : null,
        "[]", JSON.stringify({ reconciled: true, reconciled_at: new Date().toISOString() }),
        "active", "r2", uploadedAt, new Date().toISOString().slice(0, 19).replace("T", " "),
      ]);
    }

    console.log(`[reconcile] to_insert=${toInsert.length} skipped_duplicate=${skippedDuplicate}`);

    if (toInsert.length > 0) {
      try {
        db.transaction(() => { toInsert.forEach(row => insert.run(...row)); })();
        console.log(`[reconcile] DB transaction committed — ${toInsert.length} rows inserted`);
      } catch (dbErr) {
        console.error(`[reconcile] DB transaction failed: ${dbErr.message}`);
        throw dbErr;
      }
    } else {
      console.log("[reconcile] Nothing to insert — all scanned objects already indexed or mainAssets empty");
    }

    const totalInDb = db.prepare("SELECT COUNT(*) AS c FROM media_assets WHERE status != 'deleted'").get().c;
    console.log(`[reconcile] Done. scanned=${mainAssets.length} restored=${toInsert.length} skipped=${skippedDuplicate} totalInDb=${totalInDb}`);
    // D) Audit log for reconcile
    try {
      db.prepare("INSERT INTO audit_log (username, action, doc_id, ip) VALUES (?, ?, ?, ?)")
        .run(req.user.username, `media_reconcile:restored=${toInsert.length}`, null, req.ip);
    } catch { /* audit failures must not break reconcile */ }
    res.json({
      ok: true,
      scanned: mainAssets.length,
      already_indexed: skippedDuplicate,
      restored: toInsert.length,
      total_in_db: totalInDb,
    });
  } catch (err) {
    console.error("[reconcile] Error:", err.message, err.stack);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
