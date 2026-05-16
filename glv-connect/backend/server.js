require("dotenv").config();

// Provide a fallback secret so the app doesn't crash on Railway if JWT_SECRET is not set yet.
// Change this in Railway env vars for production security.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "glv-connect-dev-secret-change-in-production-2026";
  console.warn("WARNING: JWT_SECRET not set — using insecure default. Set it in Railway environment variables.");
}

require("./db/database"); // run migrations + seed on startup

const express = require("express");
const cors = require("cors");
const path = require("path");

const authRouter      = require("./routes/auth");
const documentsRouter = require("./routes/documents");
const auditRouter     = require("./routes/audit");
const usersRouter     = require("./routes/users");
const profileRouter   = require("./routes/profile");
const imagesRouter    = require("./routes/images");

const app = express();

app.use(cors({ origin: "*", credentials: false }));
app.use(express.json());
app.set("trust proxy", 1);

// API routes
app.use("/auth",      authRouter);
app.use("/documents", documentsRouter);
app.use("/audit",     auditRouter);
app.use("/users",     usersRouter);
app.use("/profile",   profileRouter);
app.use("/images",    imagesRouter);
app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Serve React frontend
const DIST = path.join(__dirname, "public");
app.use(express.static(DIST));
app.get("*", (_req, res) => res.sendFile(path.join(DIST, "index.html")));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`GLV-Connect API en puerto ${PORT}`));
