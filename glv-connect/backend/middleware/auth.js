const jwt = require("jsonwebtoken");
const db  = require("../db/database");

const COOKIE_NAME = "glv_token";

function authenticate(req, res, next) {
  // Cookie-only authentication — Bearer/Authorization header is intentionally NOT accepted.
  // The portal migrated to httpOnly session cookies; accepting Bearer tokens from JS
  // would re-open the XSS attack surface that cookie auth was meant to close.
  const token = req.cookies?.[COOKIE_NAME];
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
