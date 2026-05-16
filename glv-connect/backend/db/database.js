const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "glvconnect.sqlite");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF"); // OFF during migrations, re-enabled below

// ─── Base tables ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ts        TEXT    NOT NULL DEFAULT (datetime('now')),
    username  TEXT    NOT NULL,
    action    TEXT    NOT NULL,
    doc_id    TEXT,
    ip        TEXT
  );
`);

// ─── Users table — v2 with 15 roles ──────────────────────────────────────────
{
  const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!cols.includes("preferred_lang")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users_v2 (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT    NOT NULL UNIQUE,
        password      TEXT    NOT NULL,
        role          TEXT    NOT NULL DEFAULT 'AGENTE',
        name          TEXT    NOT NULL,
        email         TEXT    NOT NULL,
        department    TEXT,
        position      TEXT,
        country       TEXT,
        preferred_lang TEXT   NOT NULL DEFAULT 'es',
        first_login   INTEGER NOT NULL DEFAULT 1,
        created_by    INTEGER,
        active        INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const existing = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (existing) {
      db.prepare(`
        INSERT OR IGNORE INTO users_v2 (id, username, password, role, name, email, active, created_at)
        SELECT id, username, password,
          CASE role WHEN 'DIRECTIVO' THEN 'DIRECTOR' ELSE role END,
          name, email, active, created_at
        FROM users
      `).run();
      db.exec("DROP TABLE users; ALTER TABLE users_v2 RENAME TO users;");
    } else {
      db.exec("ALTER TABLE users_v2 RENAME TO users;");
    }
    console.log("✓ Users table migrated to v2 (15 roles, extended profile)");
  }
}

// ─── Documents table ──────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id                  TEXT    PRIMARY KEY,
    type                TEXT    NOT NULL CHECK(type IN ('SCO','FCO','SPA')),
    status              TEXT    NOT NULL,
    client              TEXT    NOT NULL,
    client_country      TEXT,
    client_representative TEXT,
    client_email        TEXT,
    client_phone        TEXT,
    agent               TEXT    NOT NULL,
    date                TEXT    NOT NULL,
    destination         TEXT    NOT NULL,
    product             TEXT    NOT NULL,
    product_category    TEXT,
    product_specs       TEXT,
    headcount           REAL,
    avg_weight          REAL,
    price_per_kg        REAL,
    origin              TEXT,
    total_value         REAL,
    payment_method      TEXT,
    exporter            TEXT,
    domain              TEXT,
    gacc_note           TEXT,
    parent_id           TEXT    REFERENCES documents(id),
    observations        TEXT,
    operation_id        TEXT    REFERENCES operations(id),
    lang                TEXT    NOT NULL DEFAULT 'es',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Agent profiles ───────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_profiles (
    user_id       INTEGER PRIMARY KEY REFERENCES users(id),
    cargo         TEXT,
    phone         TEXT,
    whatsapp      TEXT,
    country       TEXT,
    languages     TEXT,
    signature_b64 TEXT,
    photo_b64     TEXT,
    reg_number    TEXT,
    completed     INTEGER NOT NULL DEFAULT 0,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Image library ────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS image_library (
    key        TEXT PRIMARY KEY,
    file_id    TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Clients / Counterparties ─────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    type          TEXT    NOT NULL DEFAULT 'buyer',
    name          TEXT    NOT NULL,
    company       TEXT,
    country       TEXT,
    representative TEXT,
    email         TEXT,
    phone         TEXT,
    whatsapp      TEXT,
    address       TEXT,
    tax_id        TEXT,
    preferred_lang TEXT   DEFAULT 'en',
    active        INTEGER NOT NULL DEFAULT 1,
    created_by    INTEGER REFERENCES users(id),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Operations ────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS operations (
    id                TEXT    PRIMARY KEY,
    type              TEXT    NOT NULL DEFAULT 'export',
    status            TEXT    NOT NULL DEFAULT 'active',
    product_category  TEXT    NOT NULL,
    product_detail    TEXT,
    commercial_data   TEXT,
    origin_country    TEXT,
    destination_country TEXT,
    incoterm          TEXT    DEFAULT 'CFR',
    currency          TEXT    NOT NULL DEFAULT 'USD',
    shipment_qty      REAL,
    unit_type         TEXT,
    unit_price        REAL,
    shipment_value    REAL,
    monthly_value     REAL,
    contract_value    REAL,
    delivery_frequency TEXT,
    num_shipments     INTEGER,
    contract_duration TEXT,
    client_id         INTEGER REFERENCES clients(id),
    assigned_agent    INTEGER REFERENCES users(id),
    created_by        INTEGER REFERENCES users(id),
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Tasks (Phase 8 — ISO/Compliance) ────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT,
    status      TEXT    NOT NULL DEFAULT 'pending',
    priority    TEXT    NOT NULL DEFAULT 'medium',
    assigned_to INTEGER REFERENCES users(id),
    created_by  INTEGER REFERENCES users(id),
    deadline    TEXT,
    evidence    TEXT,
    approved_by INTEGER REFERENCES users(id),
    operation_id TEXT   REFERENCES operations(id),
    doc_id      TEXT    REFERENCES documents(id),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

db.pragma("foreign_keys = ON");

// ─── ALTER TABLE: add new columns safely ──────────────────────────────────────
const safeAlter = (sql) => { try { db.exec(sql); } catch (_) {} };

// documents extras
safeAlter("ALTER TABLE documents ADD COLUMN custom_product_name TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN custom_product_desc TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN custom_unit TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN payment_option TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN doc_trigger TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN has_guarantee INTEGER DEFAULT 0");
safeAlter("ALTER TABLE documents ADD COLUMN guarantee_type TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN guarantee_bank TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN validity_days INTEGER DEFAULT 15");
safeAlter("ALTER TABLE documents ADD COLUMN client_id_doc_b64 TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN fco_confirmed INTEGER DEFAULT 0");
safeAlter("ALTER TABLE documents ADD COLUMN product_category TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN product_specs TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN operation_id TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN lang TEXT DEFAULT 'es'");

// operations extras
safeAlter("ALTER TABLE operations ADD COLUMN counterpart_name TEXT");
safeAlter("ALTER TABLE operations ADD COLUMN product_name TEXT");
safeAlter("ALTER TABLE operations ADD COLUMN notes TEXT");

// agent_profiles extras
safeAlter("ALTER TABLE agent_profiles ADD COLUMN whatsapp TEXT");

// ─── Seed default users ───────────────────────────────────────────────────────
function seedUsers() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count > 0) return;

  const users = [
    { username: "agent.rodriguez", password: "agent123",  role: "AGENTE",       name: "Carlos Rodríguez",         email: "c.rodriguez@glvservicesexp.com",    department: "Comercial", position: "Agente Internacional Sr." },
    { username: "agent.silva",     password: "agent456",  role: "AGENTE",       name: "Ana Silva",                email: "a.silva@glvservicesexp.com",        department: "Comercial", position: "Agente Internacional" },
    { username: "agent.park",      password: "agent789",  role: "AGENTE",       name: "Ji-hoon Park",             email: "j.park@glvservicesexp.com",         department: "Comercial", position: "Agente Asia-Pacífico" },
    { username: "agent.osei",      password: "agentabc",  role: "AGENTE",       name: "Kwame Osei",               email: "k.osei@glvservicesexp.com",         department: "Comercial", position: "Agente Región África" },
    { username: "agent.lima",      password: "agentdef",  role: "AGENTE",       name: "Valentina Lima",           email: "v.lima@glvservicesexp.com",         department: "Comercial", position: "Agente LATAM" },
    { username: "mvalencia",       password: "dir2026!",  role: "SUPER_ADMIN",  name: "Misael Valencia Barahona", email: "mvalencia@glvglobalfoodservices.com", department: "Dirección", position: "CEO / Super Admin", first_login: 0 },
    { username: "juridico",        password: "legal2026!",role: "COMPLIANCE",   name: "Departamento Jurídico",    email: "juridico@glvservicesexp.com",       department: "Legal" },
    { username: "contabilidad",    password: "conta2026!",role: "ACCOUNTING",   name: "Departamento Financiero",  email: "contabilidad@glvservicesexp.com",   department: "Finanzas" },
  ];

  const insert = db.prepare(
    "INSERT INTO users (username, password, role, name, email, department, position, first_login, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)"
  );

  const seedAll = db.transaction(() => {
    for (const u of users) {
      const hash = bcrypt.hashSync(u.password, 10);
      insert.run(u.username, hash, u.role, u.name, u.email, u.department || null, u.position || null, u.first_login !== undefined ? u.first_login : 1);
    }
  });
  seedAll();

  // Seed sample documents
  const seedDocs = db.prepare(`
    INSERT OR IGNORE INTO documents
      (id, type, status, client, agent, date, destination, product, headcount, avg_weight, price_per_kg, origin, total_value, parent_id, product_category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedAudit = db.prepare(
    "INSERT INTO audit_log (ts, username, action, doc_id, ip) VALUES (?, ?, ?, ?, ?)"
  );

  db.transaction(() => {
    seedDocs.run("SCO-GLV-2026-001","SCO","Emitido","Al-Masraf Trading LLC","agent.rodriguez","2026-04-10","UAE","Ovinos (Animales Vivos)",70000,45,5.70,"Brazil",17955000,null,"LIVE_ANIMALS");
    seedDocs.run("FCO-GLV-2026-001","FCO","Firmado","Al-Masraf Trading LLC","agent.rodriguez","2026-04-18","UAE","Ovinos (Animales Vivos)",70000,45,5.70,"Brazil",17955000,"SCO-GLV-2026-001","LIVE_ANIMALS");
    seedDocs.run("SCO-GLV-2026-002","SCO","Emitido","Global Grain Partners","agent.silva","2026-04-22","Saudi Arabia (East)","Soja en Grano",null,null,null,"Brazil",3200000,null,"COMMODITIES");
    seedDocs.run("SPA-GLV-2026-001","SPA","Activo","Al-Masraf Trading LLC","mvalencia","2026-05-01","UAE","Ovinos (Animales Vivos)",70000,45,5.70,"Brazil",17955000,"FCO-GLV-2026-001","LIVE_ANIMALS");

    seedAudit.run("2026-04-10 09:15","agent.rodriguez","SCO generado","SCO-GLV-2026-001","186.84.12.44");
    seedAudit.run("2026-04-18 14:32","agent.rodriguez","FCO generado","FCO-GLV-2026-001","186.84.12.44");
    seedAudit.run("2026-04-22 11:08","agent.silva","SCO generado","SCO-GLV-2026-002","200.21.88.10");
    seedAudit.run("2026-05-01 16:45","mvalencia","SPA generado","SPA-GLV-2026-001","192.168.1.5");
  })();
}

seedUsers();

module.exports = db;
