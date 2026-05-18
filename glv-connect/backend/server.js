require("dotenv").config();

// Catch any unhandled async/sync crash — log it so Railway shows it in deploy logs
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.message, err.stack);
});

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "glv-connect-dev-secret-change-in-production-2026";
  console.warn("WARNING: JWT_SECRET not set — using insecure default. Set it in Railway environment variables.");
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

const app = express();

// Log every request so we can confirm Express is receiving traffic
app.use((req, _res, next) => {
  console.log(`→ ${req.method} ${req.path}`);
  next();
});

app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.set("trust proxy", 1);

// Health check first — before all other routes
app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

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

const PORT = process.env.PORT || 3001;
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`GLV-Connect API en puerto ${PORT}`);
  console.log(`PORT env: ${process.env.PORT ?? "(not set, defaulting to 3001)"}`);
  console.log(`Frontend: ${fs.existsSync(indexHtml) ? indexHtml : "NO ENCONTRADO"}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "development"}`);
});
