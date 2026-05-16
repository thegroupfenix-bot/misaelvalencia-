const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "glvconnect.sqlite");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    role        TEXT    NOT NULL CHECK(role IN ('AGENTE','DIRECTIVO')),
    name        TEXT    NOT NULL,
    email       TEXT    NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id            TEXT    PRIMARY KEY,
    type          TEXT    NOT NULL CHECK(type IN ('SCO','FCO','SPA')),
    status        TEXT    NOT NULL,
    client        TEXT    NOT NULL,
    client_country      TEXT,
    client_representative TEXT,
    client_email  TEXT,
    client_phone  TEXT,
    agent         TEXT    NOT NULL,
    date          TEXT    NOT NULL,
    destination   TEXT    NOT NULL,
    product       TEXT    NOT NULL,
    headcount     REAL,
    avg_weight    REAL,
    price_per_kg  REAL,
    origin        TEXT,
    total_value   REAL,
    payment_method TEXT,
    exporter      TEXT,
    domain        TEXT,
    gacc_note     TEXT,
    parent_id     TEXT    REFERENCES documents(id),
    observations  TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ts        TEXT    NOT NULL DEFAULT (datetime('now')),
    username  TEXT    NOT NULL,
    action    TEXT    NOT NULL,
    doc_id    TEXT,
    ip        TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_profiles (
    user_id       INTEGER PRIMARY KEY REFERENCES users(id),
    cargo         TEXT,
    phone         TEXT,
    country       TEXT,
    languages     TEXT,
    signature_b64 TEXT,
    photo_b64     TEXT,
    reg_number    TEXT,
    completed     INTEGER NOT NULL DEFAULT 0,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS image_library (
    key        TEXT PRIMARY KEY,
    file_id    TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Add new columns to documents table (ALTER TABLE ADD COLUMN is safe to retry with try/catch)
const docAlterColumns = [
  "ALTER TABLE documents ADD COLUMN custom_product_name TEXT",
  "ALTER TABLE documents ADD COLUMN custom_product_desc TEXT",
  "ALTER TABLE documents ADD COLUMN custom_unit TEXT",
  "ALTER TABLE documents ADD COLUMN payment_option TEXT",
  "ALTER TABLE documents ADD COLUMN doc_trigger TEXT",
  "ALTER TABLE documents ADD COLUMN has_guarantee INTEGER DEFAULT 0",
  "ALTER TABLE documents ADD COLUMN guarantee_type TEXT",
  "ALTER TABLE documents ADD COLUMN guarantee_bank TEXT",
  "ALTER TABLE documents ADD COLUMN validity_days INTEGER DEFAULT 15",
  "ALTER TABLE documents ADD COLUMN client_id_doc_b64 TEXT",
  "ALTER TABLE documents ADD COLUMN fco_confirmed INTEGER DEFAULT 0",
];
for (const sql of docAlterColumns) {
  try { db.exec(sql); } catch (e) {}
}

function seedUsers() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count > 0) return;

  const users = [
    { username: "agent.rodriguez", password: "agent123",  role: "AGENTE",    name: "Carlos Rodríguez",           email: "c.rodriguez@glvservicesexp.com" },
    { username: "agent.silva",     password: "agent456",  role: "AGENTE",    name: "Ana Silva",                  email: "a.silva@glvservicesexp.com" },
    { username: "agent.park",      password: "agent789",  role: "AGENTE",    name: "Ji-hoon Park",               email: "j.park@glvservicesexp.com" },
    { username: "agent.osei",      password: "agentabc",  role: "AGENTE",    name: "Kwame Osei",                 email: "k.osei@glvservicesexp.com" },
    { username: "agent.lima",      password: "agentdef",  role: "AGENTE",    name: "Valentina Lima",             email: "v.lima@glvservicesexp.com" },
    { username: "mvalencia",       password: "dir2026!",  role: "DIRECTIVO", name: "Misael Valencia Barahona",   email: "mvalencia@glvglobalfoodservices.com" },
    { username: "juridico",        password: "legal2026!",role: "DIRECTIVO", name: "Departamento Jurídico",      email: "juridico@glvservicesexp.com" },
    { username: "contabilidad",    password: "conta2026!",role: "DIRECTIVO", name: "Departamento Financiero",    email: "contabilidad@glvservicesexp.com" },
  ];

  const insert = db.prepare(
    "INSERT INTO users (username, password, role, name, email) VALUES (?, ?, ?, ?, ?)"
  );

  const seedAll = db.transaction(() => {
    for (const u of users) {
      const hash = bcrypt.hashSync(u.password, 10);
      insert.run(u.username, hash, u.role, u.name, u.email);
    }
  });
  seedAll();

  const seedDocs = db.prepare(`
    INSERT OR IGNORE INTO documents
      (id, type, status, client, agent, date, destination, product, headcount, avg_weight, price_per_kg, origin, total_value, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedAudit = db.prepare(
    "INSERT INTO audit_log (ts, username, action, doc_id, ip) VALUES (?, ?, ?, ?, ?)"
  );

  db.transaction(() => {
    seedDocs.run("SCO-GLV-2026-001","SCO","Emitido","Al-Masraf Trading LLC","agent.rodriguez","2026-04-10","UAE","Ovinos (Animales Vivos)",70000,45,5.70,"Brazil",17955000,null);
    seedDocs.run("FCO-GLV-2026-001","FCO","Firmado","Al-Masraf Trading LLC","agent.rodriguez","2026-04-18","UAE","Ovinos (Animales Vivos)",70000,45,5.70,"Brazil",17955000,"SCO-GLV-2026-001");
    seedDocs.run("SCO-GLV-2026-002","SCO","Emitido","Global Grain Partners","agent.silva","2026-04-22","Saudi Arabia (East)","Granos (Soya / Maíz)",null,null,null,"Brazil",3200000,null);
    seedDocs.run("SPA-GLV-2026-001","SPA","Activo","Al-Masraf Trading LLC","mvalencia","2026-05-01","UAE","Ovinos (Animales Vivos)",70000,45,5.70,"Brazil",17955000,"FCO-GLV-2026-001");

    seedAudit.run("2026-04-10 09:15","agent.rodriguez","SCO generado","SCO-GLV-2026-001","186.84.12.44");
    seedAudit.run("2026-04-18 14:32","agent.rodriguez","FCO generado","FCO-GLV-2026-001","186.84.12.44");
    seedAudit.run("2026-04-22 11:08","agent.silva","SCO generado","SCO-GLV-2026-002","200.21.88.10");
    seedAudit.run("2026-05-01 16:45","mvalencia","SPA generado","SPA-GLV-2026-001","192.168.1.5");
  })();
}

seedUsers();

module.exports = db;
