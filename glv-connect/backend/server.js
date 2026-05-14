require("dotenv").config();
require("./db/database"); // run migrations + seed on startup

const express = require("express");
const cors = require("cors");

const authRouter      = require("./routes/auth");
const documentsRouter = require("./routes/documents");
const auditRouter     = require("./routes/audit");
const usersRouter     = require("./routes/users");

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json());

// trust proxy so req.ip returns the real client IP behind nginx/LiteSpeed
app.set("trust proxy", 1);

app.use("/auth",      authRouter);
app.use("/documents", documentsRouter);
app.use("/audit",     auditRouter);
app.use("/users",     usersRouter);

app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`GLV-Connect API en puerto ${PORT}`));
