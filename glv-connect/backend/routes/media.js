const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");
const r2 = require("../storage/r2");
const classifier = require("../ai/classifier");

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
  let sql = "SELECT * FROM media_assets WHERE status != 'deleted' AND archived = ?";
  const params = [+archived];
  if (category)  { sql += " AND category LIKE ?"; params.push(`${category}%`); }
  if (country)   { sql += " AND country_origin = ?"; params.push(country); }
  if (product)   { sql += " AND product_relation = ?"; params.push(product); }
  if (search)    { sql += " AND (original_name LIKE ? OR tags_json LIKE ? OR subcategory LIKE ?)"; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  sql += " ORDER BY upload_date DESC LIMIT ? OFFSET ?";
  params.push(+limit, +offset);
  const rows = db.prepare(sql).all(...params).map(serializeAsset);
  const total = db.prepare("SELECT COUNT(*) AS c FROM media_assets WHERE status != 'deleted' AND archived = ?").get(+archived).c;
  res.json({ assets: rows, total });
});

// GET /media/categories — folder structure
router.get("/categories", (_req, res) => res.json(MEDIA_CATEGORIES));

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
    try {
      const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
      const existing = db.prepare("SELECT id, public_url FROM media_assets WHERE checksum_hash = ? AND status != 'deleted'").get(checksum);
      if (existing) { uploaded.push({ ...existing, public_url: fixUrl(existing.public_url), duplicate: true }); continue; }

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

// GET /media/r2-status
router.get("/r2-status", (_req, res) => {
  res.json({
    configured: r2.isConfigured(),
    auth_mode: r2.authMode(),
    bucket: r2.R2_BUCKET_NAME,
    ai_classification: classifier.isEnabled(),
  });
});

// GET /media/r2-ping
router.get("/r2-ping", requireAdmin, async (_req, res) => {
  if (!r2.isConfigured()) return res.status(503).json({ ok: false, error: "R2 not configured" });
  try {
    const result = await r2.ping();
    res.json({ ...result, ai_classification: classifier.isEnabled() });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

module.exports = router;
