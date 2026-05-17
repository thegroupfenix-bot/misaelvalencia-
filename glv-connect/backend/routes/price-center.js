const express = require("express");
const db = require("../db/database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

const parseArr = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
const parseObj = (v) => { try { return JSON.parse(v || "{}"); } catch { return {}; } };

function getPriceStatus(updatedAt) {
  if (!updatedAt) return "red";
  const diff = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 1) return "green";
  if (diff <= 3) return "yellow";
  return "red";
}

function formatProduct(p) {
  return {
    ...p,
    origin_countries: parseArr(p.origin_countries),
    incoterms:        parseArr(p.incoterms),
    images:           parseArr(p.images),
    certifications:   parseArr(p.certifications),
    ports:            parseArr(p.ports),
    market_segments:  parseArr(p.market_segments),
    specs:            parseObj(p.specs),
    price_status:     getPriceStatus(p.price_updated_at),
  };
}

// GET /price-center/categories
router.get("/categories", (req, res) => {
  const cats = db.prepare("SELECT * FROM pc_categories WHERE active = 1 ORDER BY sort_order").all();
  res.json(cats);
});

// GET /price-center/products
router.get("/products", (req, res) => {
  const { category, search, availability } = req.query;
  let sql = "SELECT * FROM pc_products WHERE active = 1";
  const params = [];
  if (category)     { sql += " AND category_slug = ?"; params.push(category); }
  if (availability) { sql += " AND availability = ?";  params.push(availability); }
  if (search) {
    sql += " AND (name_es LIKE ? OR name_en LIKE ? OR commercial_name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += " ORDER BY category_slug, name_es";
  res.json(db.prepare(sql).all(...params).map(formatProduct));
});

// GET /price-center/products/:id
router.get("/products/:id", (req, res) => {
  const p = db.prepare("SELECT * FROM pc_products WHERE id = ? AND active = 1").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Producto no encontrado" });
  res.json(formatProduct(p));
});

// GET /price-center/breeds
router.get("/breeds", (req, res) => {
  const { species } = req.query;
  let sql = "SELECT * FROM pc_breeds WHERE active = 1";
  const params = [];
  if (species) { sql += " AND species = ?"; params.push(species.toUpperCase()); }
  sql += " ORDER BY species, name";
  res.json(db.prepare(sql).all(...params).map(b => ({ ...b, origin_countries: parseArr(b.origin_countries) })));
});

// ─── Admin-only CRUD ──────────────────────────────────────────────────────────
const ADMINS = new Set(["SUPER_ADMIN", "CORPORATE_ADMIN"]);
function requireAdmin(req, res, next) {
  if (!ADMINS.has(req.user?.role)) return res.status(403).json({ error: "Acceso restringido" });
  next();
}

// POST /price-center/products
router.post("/products", requireAdmin, (req, res) => {
  const b = req.body;
  if (!b.category_slug || !b.name_es) return res.status(400).json({ error: "category_slug y name_es requeridos" });
  const result = db.prepare(`
    INSERT INTO pc_products (category_slug, name_es, name_en, commercial_name, subcategory,
      origin_countries, fob_price, cif_price, incoterms, moq, packaging, units_per_box,
      net_weight, gross_weight, shelf_life, hs_code, container_capacity, image_url, images,
      certifications, availability, export_notes, price_updated_at, supplier_name, ports,
      reefer_required, frozen_required, cargo_type, pallet_config, loading_config, market_segments, specs)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),?,?,?,?,?,?,?,?,?)
  `).run(
    b.category_slug, b.name_es, b.name_en||null, b.commercial_name||null, b.subcategory||null,
    JSON.stringify(b.origin_countries||[]), b.fob_price||null, b.cif_price||null,
    JSON.stringify(b.incoterms||["FOB","CFR","CIF"]), b.moq||null, b.packaging||null,
    b.units_per_box||null, b.net_weight||null, b.gross_weight||null, b.shelf_life||null,
    b.hs_code||null, b.container_capacity||null, b.image_url||null,
    JSON.stringify(b.images||[]), JSON.stringify(b.certifications||[]),
    b.availability||"available", b.export_notes||null, b.supplier_name||null,
    JSON.stringify(b.ports||[]), b.reefer_required?1:0, b.frozen_required?1:0,
    b.cargo_type||"Dry Cargo", b.pallet_config||null, b.loading_config||null,
    JSON.stringify(b.market_segments||[]), JSON.stringify(b.specs||{})
  );
  res.status(201).json(formatProduct(db.prepare("SELECT * FROM pc_products WHERE id=?").get(result.lastInsertRowid)));
});

// PATCH /price-center/products/:id
router.patch("/products/:id", requireAdmin, (req, res) => {
  const b = req.body;
  const sets = []; const params = [];
  const scalarFields = ["category_slug","name_es","name_en","commercial_name","fob_price","cif_price","moq",
    "packaging","shelf_life","hs_code","container_capacity","image_url","availability","export_notes",
    "supplier_name","reefer_required","frozen_required","cargo_type","pallet_config","loading_config"];
  const jsonFields = ["origin_countries","incoterms","images","certifications","ports","market_segments","specs"];
  for (const f of scalarFields) if (b[f] !== undefined) { sets.push(`${f} = ?`); params.push(b[f]); }
  for (const f of jsonFields)   if (b[f] !== undefined) { sets.push(`${f} = ?`); params.push(JSON.stringify(b[f])); }
  if (b.fob_price !== undefined || b.cif_price !== undefined) sets.push("price_updated_at = datetime('now')");
  sets.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE pc_products SET ${sets.join(",")} WHERE id = ?`).run(...params);
  res.json(formatProduct(db.prepare("SELECT * FROM pc_products WHERE id=?").get(req.params.id)));
});

// DELETE /price-center/products/:id
router.delete("/products/:id", requireAdmin, (req, res) => {
  db.prepare("UPDATE pc_products SET active = 0 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// POST /price-center/categories
router.post("/categories", requireAdmin, (req, res) => {
  const { slug, name_es, name_en, icon, color, parent_slug, sort_order } = req.body;
  if (!slug || !name_es || !name_en) return res.status(400).json({ error: "slug, name_es, name_en requeridos" });
  db.prepare("INSERT INTO pc_categories (slug,name_es,name_en,icon,color,parent_slug,sort_order) VALUES (?,?,?,?,?,?,?)")
    .run(slug, name_es, name_en, icon||"ti-package", color||"#1B2A4A", parent_slug||null, sort_order||0);
  res.status(201).json({ ok: true });
});

// PATCH /price-center/categories/:id
router.patch("/categories/:id", requireAdmin, (req, res) => {
  const { name_es, name_en, icon, color, sort_order, active } = req.body;
  const sets = []; const p = [];
  if (name_es !== undefined)    { sets.push("name_es=?"); p.push(name_es); }
  if (name_en !== undefined)    { sets.push("name_en=?"); p.push(name_en); }
  if (icon !== undefined)       { sets.push("icon=?");    p.push(icon); }
  if (color !== undefined)      { sets.push("color=?");   p.push(color); }
  if (sort_order !== undefined) { sets.push("sort_order=?"); p.push(sort_order); }
  if (active !== undefined)     { sets.push("active=?");  p.push(active); }
  if (!sets.length) return res.status(400).json({ error: "Nada que actualizar" });
  p.push(req.params.id);
  db.prepare(`UPDATE pc_categories SET ${sets.join(",")} WHERE id=?`).run(...p);
  res.json({ ok: true });
});

// POST /price-center/breeds
router.post("/breeds", requireAdmin, (req, res) => {
  const { species, name, name_en, origin_countries, avg_weight_kg, weight_range, cargo_type, notes } = req.body;
  if (!species || !name) return res.status(400).json({ error: "species y name requeridos" });
  const r = db.prepare("INSERT INTO pc_breeds (species,name,name_en,origin_countries,avg_weight_kg,weight_range,cargo_type,notes) VALUES (?,?,?,?,?,?,?,?)")
    .run(species.toUpperCase(), name, name_en||null, JSON.stringify(origin_countries||[]), avg_weight_kg||null, weight_range||null, cargo_type||"Live Animals", notes||null);
  res.status(201).json({ id: r.lastInsertRowid, ok: true });
});

module.exports = router;
