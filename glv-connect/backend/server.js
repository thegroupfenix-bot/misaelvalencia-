require("dotenv").config();

const BUILD_TS = new Date().toISOString(); // set once at process start — visible in /health

// Catch any unhandled async/sync crash — log it so Railway shows it in deploy logs
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.message, err.stack);
});

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Server cannot start without it.");
  console.error("Set JWT_SECRET in Railway environment variables or in your .env file.");
  process.exit(1);
}

require("./db/database"); // run migrations + seed on startup

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const authRouter        = require("./routes/auth");
const documentsRouter   = require("./routes/documents");
const auditRouter       = require("./routes/audit");
const usersRouter       = require("./routes/users");
const profileRouter     = require("./routes/profile");
const imagesRouter      = require("./routes/images");
const adminRouter       = require("./routes/admin");
const clientsRouter     = require("./routes/clients");
const operationsRouter  = require("./routes/operations");
const financeRouter     = require("./routes/finance");
const tasksRouter       = require("./routes/tasks");
const priceCenterRouter = require("./routes/price-center");
const mediaRouter       = require("./routes/media");
const backupRouter      = require("./routes/backup");

const app = express();

// Log every request so we can confirm Express is receiving traffic
app.use((req, _res, next) => {
  console.log(`→ ${req.method} ${req.path}`);
  next();
});

const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.set("trust proxy", 1);

// Health check first — before all other routes
app.get("/health", (_req, res) => {
  let dbInfo = {};
  try {
    const db = require("./db/database");
    const mediaCount = db.prepare("SELECT COUNT(*) AS c FROM media_assets WHERE status != 'deleted'").get().c;
    const userCount  = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
    dbInfo = { media_assets: mediaCount, users: userCount };
  } catch (e) { dbInfo = { error: e.message }; }
  res.json({ ok: true, ts: new Date().toISOString(), build: BUILD_TS, db: dbInfo });
});

// API routes
app.use("/auth",         authRouter);
app.use("/documents",    documentsRouter);
app.use("/audit",        auditRouter);
app.use("/users",        usersRouter);
app.use("/profile",      profileRouter);
app.use("/images",       imagesRouter);
app.use("/admin",        adminRouter);
app.use("/clients",      clientsRouter);
app.use("/operations",   operationsRouter);
app.use("/finance",      financeRouter);
app.use("/tasks",        tasksRouter);
app.use("/price-center", priceCenterRouter);
app.use("/media",        mediaRouter);
app.use("/backup",       backupRouter);

// Serve React frontend
const DIST = path.join(__dirname, "public");
const indexHtml = path.join(DIST, "index.html");

// Pre-load index.html into memory — avoids file-stream issues with Railway's proxy
const indexBuffer = fs.existsSync(indexHtml) ? fs.readFileSync(indexHtml) : null;

if (indexBuffer) {
  console.log(`Frontend cargado en memoria: ${indexBuffer.length} bytes`);
  // Static assets (JS, CSS, images) — stream from disk with index: false so / falls through
  app.use(express.static(DIST, { dotfiles: "ignore", fallthrough: true, index: false }));
  // SPA catch-all — serve from memory buffer, no file streaming
  app.get("*", (_req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": indexBuffer.length,
    });
    res.end(indexBuffer);
  });
} else {
  console.warn(`WARNING: Frontend build not found at ${DIST} — serving API only`);
  app.get("*", (_req, res) => res.status(200).json({ ok: true, api: "GLV-Connect", hint: "Frontend not built" }));
}

app.use((err, _req, res, _next) => {
  console.error("Server error:", err.message);
  if (!res.headersSent) res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 8080;
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`GLV-Connect API en puerto ${PORT}`);
  console.log(`PORT env: ${process.env.PORT ?? "(not set, defaulting to 3001)"}`);
  console.log(`Frontend: ${fs.existsSync(indexHtml) ? indexHtml : "NO ENCONTRADO"}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  console.log(`BUILD_TS: ${BUILD_TS}`);
});

// Start backup scheduler (only if R2 configured) — 5s after start
setTimeout(() => {
  const backup = require("./services/backup");
  const r2 = require("./storage/r2");
  if (r2.isConfigured()) {
    backup.scheduleDailyBackup();
    console.log("[server] Daily backup scheduler started");
  } else {
    console.log("[server] Backup scheduler skipped — R2 not configured");
  }
}, 5000);

// Auto-reconcile R2 media 15s after startup — restores orphaned assets after any DB reset
setTimeout(async () => {
  const r2 = require("./storage/r2");
  const db = require("./db/database");
  if (!r2.isConfigured()) {
    console.log("[startup-reconcile] R2 not configured — skipping auto-reconcile.");
    return;
  }
  try {
    console.log("[startup-reconcile] Starting automatic R2 media reconciliation...");
    const allObjects = await r2.listObjects("", 20000);
    const mainAssets = allObjects.filter(
      o => !o.key.startsWith("thumbnails/") && !o.key.endsWith("/")
    );
    const existingKeys = new Set(
      db.prepare("SELECT r2_key FROM media_assets WHERE r2_key IS NOT NULL AND status != 'deleted'").all().map(r => r.r2_key)
    );
    const missing = mainAssets.filter(o => !existingKeys.has(o.key));
    if (missing.length === 0) {
      console.log(`[startup-reconcile] All ${mainAssets.length} R2 objects already indexed. Nothing to restore.`);
      return;
    }
    console.log(`[startup-reconcile] Found ${missing.length} orphaned R2 objects — restoring...`);
    const MIME_MAP = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", mp4: "video/mp4", pdf: "application/pdf" };
    const insert = db.prepare(`
      INSERT INTO media_assets
        (filename, original_name, mime_type, extension, category, uploaded_by,
         file_size, public_url, r2_key, tags_json, metadata_json,
         status, storage_provider, upload_date, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const insertMany = db.transaction((rows) => {
      for (const o of rows) {
        const parts = o.key.split("/");
        const filename = parts[parts.length - 1];
        const ext = (filename.split(".").pop() || "").toLowerCase();
        const yearIdx = parts.findIndex(p => /^\d{4}$/.test(p));
        const category = yearIdx > 0
          ? parts.slice(0, yearIdx).join("/")
          : parts.slice(0, -1).join("/") || "general";
        const mime = MIME_MAP[ext] || "application/octet-stream";
        const publicUrl = r2.buildPublicUrl(o.key);
        const uploadedAt = (o.uploaded || now).slice(0, 19).replace("T", " ");
        insert.run(
          filename, filename, mime, ext, category, "reconcile",
          o.size || 0, publicUrl, o.key,
          "[]", JSON.stringify({ reconciled: true }),
          "active", "r2", uploadedAt, now
        );
      }
    });
    insertMany(missing);
    console.log(`[startup-reconcile] Done. Restored ${missing.length} assets. Total R2 objects scanned: ${mainAssets.length}.`);
  } catch (e) {
    console.warn("[startup-reconcile] Error during auto-reconcile:", e.message);
  }
}, 15000);
