const jwt = require("jsonwebtoken");
const db  = require("../db/database");

const COOKIE_NAME = "glv_token";

function authenticate(req, res, next) {
  // httpOnly cookie first, then Authorization Bearer fallback
  let token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    const hdr = req.headers.authorization || "";
    if (hdr.startsWith("Bearer ")) token = hdr.slice(7);
  }
  if (!token) return res.status(401).json({ error: "No autenticado" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }

  // Verify user is still active in DB
  try {
    const user = db.prepare(
      "SELECT id, username, role, active, name, email FROM users WHERE id = ?"
    ).get(payload.id);
    if (!user || !user.active) {
      return res.status(401).json({ error: "Usuario inactivo o no encontrado" });
    }
    req.user = { ...payload, role: user.role, name: user.name, email: user.email };
  } catch (_) {
    req.user = payload;
  }
  next();
}

module.exports = { authenticate, COOKIE_NAME };
