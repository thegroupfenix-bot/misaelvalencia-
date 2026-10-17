"use strict";
const jwt = require("jsonwebtoken");

let _db = null;
function db() {
  if (!_db) _db = require("../db/database");
  return _db;
}

/**
 * authenticate — verifies JWT, then enriches req.user from DB.
 *
 * JWT payload is kept slim ({id, username, role}); all additional user
 * fields are fetched fresh from the database on every request. This ensures:
 *  - Deactivated users are blocked immediately (no stale token reuse)
 *  - No PII travels in the JWT
 *  - Downstream routes always get fresh, accurate user data
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.sub;
    if (!userId) return res.status(401).json({ error: "Token inválido" });

    const user = db()
      .prepare("SELECT id, username, role, name, email, department, position, preferred_lang, first_login, profile_completed, active FROM users WHERE id = ? AND active = 1")
      .get(userId);

    if (!user) return res.status(401).json({ error: "Usuario no encontrado o inactivo" });

    req.user = {
      id:                user.id,
      username:          user.username,
      role:              user.role,
      name:              user.name,
      email:             user.email,
      department:        user.department,
      position:          user.position,
      preferred_lang:    user.preferred_lang || "es",
      first_login:       user.first_login,
      profile_completed: user.profile_completed,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

module.exports = { authenticate };
