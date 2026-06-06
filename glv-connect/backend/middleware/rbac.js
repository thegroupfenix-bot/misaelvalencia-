const ROLE_LEVEL = {
  SUPER_ADMIN: 100, CORPORATE_ADMIN: 90, CFO: 80, DIRECTOR: 75, DIRECTIVO: 75,
  COMMERCIAL_DIRECTOR: 70, COMPLIANCE: 65, ACCOUNTING: 60, TREASURY: 60,
  AUDIT: 55, TAX_REVIEWER: 50, COUNTRY_ACCOUNTANT: 50, LOGISTICS: 45,
  AGENTE: 40, MEDIA_MANAGER: 35, CLIENT: 20, SUPPLIER: 20,
};

const ADMINS    = new Set(["SUPER_ADMIN","CORPORATE_ADMIN"]);
const DIRECTORS = new Set(["SUPER_ADMIN","CORPORATE_ADMIN","DIRECTOR","DIRECTIVO","CFO","COMMERCIAL_DIRECTOR"]);
const DOC_ROLES = new Set(["SUPER_ADMIN","CORPORATE_ADMIN","DIRECTOR","DIRECTIVO","COMMERCIAL_DIRECTOR","AGENTE"]);
const ALL_ROLES = Object.keys(ROLE_LEVEL);

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Acceso denegado — rol insuficiente" });
    }
    next();
  };
}

function requireLevel(minLevel) {
  return (req, res, next) => {
    const level = ROLE_LEVEL[req.user?.role] || 0;
    if (level < minLevel) return res.status(403).json({ error: "Permisos insuficientes" });
    next();
  };
}

function requireAdmin(req, res, next) {
  if (!ADMINS.has(req.user?.role)) return res.status(403).json({ error: "Solo administradores" });
  next();
}

function requireDirector(req, res, next) {
  if (!DIRECTORS.has(req.user?.role)) return res.status(403).json({ error: "Acceso restringido a directivos" });
  next();
}

// requirePermission checks role_permissions table first, SUPER_ADMIN bypasses all.
let _db = null;
function _getDb() { if (!_db) _db = require("../db/database"); return _db; }

function requirePermission(module, action) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: "No autenticado" });
    if (role === "SUPER_ADMIN") return next();
    try {
      const perm = _getDb().prepare(
        "SELECT 1 FROM role_permissions WHERE role=? AND module=? AND action=?"
      ).get(role, module, action);
      if (perm) return next();
    } catch { /* table not ready yet — fall through to level check */ }
    return res.status(403).json({ error: `Permiso requerido: ${module}.${action}` });
  };
}

module.exports = { requireRole, requireLevel, requireAdmin, requireDirector, requirePermission, ROLE_LEVEL, ALL_ROLES, ADMINS, DIRECTORS, DOC_ROLES };
