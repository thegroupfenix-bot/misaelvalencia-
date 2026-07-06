const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

// Prefer /data volume (Railway persistent volume) over the container-local path.
// /data must be mounted as a Railway Volume — otherwise every redeploy wipes the DB.
// Fallback: local path for development.
const VOLUME_PATH = "/data/glvconnect.sqlite";
const LOCAL_PATH  = process.env.DB_PATH || path.join(__dirname, "glvconnect.sqlite");
const DB_PATH = fs.existsSync("/data") ? VOLUME_PATH : LOCAL_PATH;

console.log(`[DB] path: ${DB_PATH}`);
if (!fs.existsSync("/data")) {
  console.warn("[DB] WARNING: /data volume not found — database is EPHEMERAL and will be lost on redeploy.");
  console.warn("[DB] ACTION REQUIRED: Create a Railway Volume mounted at /data to persist data.");
}

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
safeAlter("ALTER TABLE documents ADD COLUMN commercial_data TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN deleted INTEGER DEFAULT 0");
safeAlter("ALTER TABLE documents ADD COLUMN deleted_at TEXT");
safeAlter("ALTER TABLE documents ADD COLUMN deleted_by TEXT");

// operations extras
safeAlter("ALTER TABLE operations ADD COLUMN counterpart_name TEXT");
safeAlter("ALTER TABLE operations ADD COLUMN product_name TEXT");
safeAlter("ALTER TABLE operations ADD COLUMN notes TEXT");

// users extras
safeAlter("ALTER TABLE users ADD COLUMN profile_completed INTEGER NOT NULL DEFAULT 0");
safeAlter("ALTER TABLE users ADD COLUMN password_changed INTEGER NOT NULL DEFAULT 0");

// Mark non-agent users as profile_completed (they don't need agent profiles)
try {
  db.prepare(`
    UPDATE users SET profile_completed = 1
    WHERE profile_completed = 0
    AND role NOT IN ('AGENTE','LOGISTICS','CLIENT','SUPPLIER')
  `).run();
} catch (_) {}

// Mark users who already changed password and have a complete agent profile
try {
  db.prepare(`
    UPDATE users SET profile_completed = 1
    WHERE first_login = 0
    AND id IN (SELECT user_id FROM agent_profiles WHERE completed = 1)
  `).run();
} catch (_) {}

// agent_profiles extras
safeAlter("ALTER TABLE agent_profiles ADD COLUMN whatsapp TEXT");

// ─── clients GOS / KYC extension (Sprint 1) ──────────────────────────────────
safeAlter("ALTER TABLE clients ADD COLUMN glv_code TEXT");
safeAlter("ALTER TABLE clients ADD COLUMN lead_status TEXT DEFAULT 'UNASSIGNED'");
safeAlter("ALTER TABLE clients ADD COLUMN kyc_status TEXT DEFAULT 'PRE_REGISTRATION'");
safeAlter("ALTER TABLE clients ADD COLUMN registration_source TEXT DEFAULT 'MANUAL'");
safeAlter("ALTER TABLE clients ADD COLUMN kyc_data TEXT");
safeAlter("ALTER TABLE clients ADD COLUMN commercial_score REAL DEFAULT 0");
safeAlter("ALTER TABLE clients ADD COLUMN compliance_flag INTEGER DEFAULT 0");
safeAlter("ALTER TABLE clients ADD COLUMN assigned_agent INTEGER");
safeAlter("ALTER TABLE clients ADD COLUMN kyc_reviewed_by INTEGER");
safeAlter("ALTER TABLE clients ADD COLUMN kyc_reviewed_at TEXT");
safeAlter("ALTER TABLE clients ADD COLUMN last_contact_at TEXT");
safeAlter("ALTER TABLE clients ADD COLUMN onboarding_notes TEXT");

// ─── audit_log client tracking (Sprint 1) ────────────────────────────────────
safeAlter("ALTER TABLE audit_log ADD COLUMN client_id INTEGER");

// ─── clients lifecycle (GOS-03) ───────────────────────────────────────────────
safeAlter("ALTER TABLE clients ADD COLUMN lifecycle_status TEXT DEFAULT 'ACTIVE'");
safeAlter("ALTER TABLE clients ADD COLUMN lifecycle_reason TEXT");
safeAlter("ALTER TABLE clients ADD COLUMN lifecycle_updated_by INTEGER");
safeAlter("ALTER TABLE clients ADD COLUMN lifecycle_updated_at TEXT");
safeAlter("ALTER TABLE clients ADD COLUMN duplicate_of INTEGER");

// ─── KYC staging table (Sprint 1) ────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS kyc_submissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_type TEXT    NOT NULL DEFAULT 'CLIENT',
    glv_code        TEXT,
    raw_data        TEXT    NOT NULL,
    submitted_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    ip_address      TEXT,
    user_agent      TEXT,
    status          TEXT    NOT NULL DEFAULT 'PENDING',
    processed_at    TEXT,
    mapped_to_id    INTEGER REFERENCES clients(id)
  );
`);

// ─── Client Documents table (GOS-04) ─────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS client_documents (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    document_type TEXT    NOT NULL DEFAULT 'OTHER',
    file_name     TEXT    NOT NULL,
    file_size     INTEGER DEFAULT 0,
    mime_type     TEXT,
    r2_key        TEXT,
    url           TEXT,
    uploaded_by   INTEGER REFERENCES users(id),
    uploaded_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    status        TEXT    NOT NULL DEFAULT 'ACTIVE',
    notes         TEXT,
    version       INTEGER NOT NULL DEFAULT 1
  );
`);

// ─── GOS-06A: Country Catalog + Client Countries ──────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS country_catalog (
    code      TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    name_es   TEXT,
    region    TEXT NOT NULL,
    subregion TEXT NOT NULL,
    latitude  REAL,
    longitude REAL,
    active    INTEGER NOT NULL DEFAULT 1
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS client_countries (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    country_code      TEXT    NOT NULL REFERENCES country_catalog(code),
    relationship_type TEXT    NOT NULL,
    notes             TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(client_id, country_code, relationship_type)
  );
  CREATE INDEX IF NOT EXISTS idx_cc_client  ON client_countries(client_id);
  CREATE INDEX IF NOT EXISTS idx_cc_country ON client_countries(country_code);
  CREATE INDEX IF NOT EXISTS idx_cc_role    ON client_countries(relationship_type);
`);

// ─── GOS-06B: Entity Classification ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS entity_types (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    code     TEXT    NOT NULL UNIQUE,
    name     TEXT    NOT NULL,
    category TEXT    NOT NULL,
    active   INTEGER NOT NULL DEFAULT 1
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS client_entity_types (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id      INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    entity_type_id INTEGER NOT NULL REFERENCES entity_types(id),
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(client_id, entity_type_id)
  );
`);

// ─── GOS-06C: Product Intelligence ───────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS product_catalog (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    subcategory TEXT,
    hs_code     TEXT,
    unit        TEXT,
    active      INTEGER NOT NULL DEFAULT 1
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS client_products (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    product_id        INTEGER NOT NULL REFERENCES product_catalog(id),
    relationship_type TEXT    NOT NULL,
    priority          TEXT    NOT NULL DEFAULT 'PRIMARY',
    notes             TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(client_id, product_id, relationship_type)
  );
`);

// ─── GOS-06D: Document Compliance Engine ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS document_categories (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    code   TEXT    NOT NULL UNIQUE,
    name   TEXT    NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS document_type_catalog (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    code                 TEXT    NOT NULL UNIQUE,
    name                 TEXT    NOT NULL,
    category_id          INTEGER NOT NULL REFERENCES document_categories(id),
    applicable_countries TEXT,
    requires_expiry      INTEGER DEFAULT 0,
    description          TEXT,
    created_by           INTEGER REFERENCES users(id),
    active               INTEGER NOT NULL DEFAULT 1
  );
`);
safeAlter("ALTER TABLE client_documents ADD COLUMN catalog_id       INTEGER REFERENCES document_type_catalog(id)");
safeAlter("ALTER TABLE client_documents ADD COLUMN issue_date       TEXT");
safeAlter("ALTER TABLE client_documents ADD COLUMN expiry_date      TEXT");
safeAlter("ALTER TABLE client_documents ADD COLUMN country_code     TEXT");
safeAlter("ALTER TABLE client_documents ADD COLUMN is_mandatory     INTEGER DEFAULT 0");
safeAlter("ALTER TABLE client_documents ADD COLUMN observations     TEXT");
safeAlter("ALTER TABLE client_documents ADD COLUMN revision         INTEGER NOT NULL DEFAULT 1");
safeAlter("ALTER TABLE client_documents ADD COLUMN previous_doc_id  INTEGER REFERENCES client_documents(id)");

// ─── GOS-06E: Client Timeline ─────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS client_timeline (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    event_type        TEXT    NOT NULL,
    event_description TEXT,
    severity          TEXT    NOT NULL DEFAULT 'INFO',
    metadata          TEXT,
    created_by        INTEGER REFERENCES users(id),
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_timeline_client ON client_timeline(client_id);
  CREATE INDEX IF NOT EXISTS idx_timeline_type   ON client_timeline(event_type);
`);

// ─── GOS-06F: Client 360 + Organizational Structure ──────────────────────────
safeAlter("ALTER TABLE clients ADD COLUMN client_stage       TEXT DEFAULT 'LEAD'");
safeAlter("ALTER TABLE clients ADD COLUMN parent_client_id   INTEGER REFERENCES clients(id)");
safeAlter("ALTER TABLE clients ADD COLUMN annual_value_potential REAL");
safeAlter("ALTER TABLE clients ADD COLUMN priority_level     TEXT DEFAULT 'MEDIUM'");
safeAlter("ALTER TABLE clients ADD COLUMN risk_score         REAL DEFAULT 0");
safeAlter("ALTER TABLE clients ADD COLUMN risk_level         TEXT DEFAULT 'LOW'");
safeAlter("ALTER TABLE clients ADD COLUMN compliance_score   REAL DEFAULT 0");

// ─── GOS-06J: Client Notes ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS client_notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    body       TEXT    NOT NULL,
    pinned     INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notes_client ON client_notes(client_id);
`);

// ─── GOS-07A: media_assets DAM metadata fields ────────────────────────────────
safeAlter("ALTER TABLE media_assets ADD COLUMN language    TEXT");
safeAlter("ALTER TABLE media_assets ADD COLUMN author_id   INTEGER REFERENCES users(id)");
safeAlter("ALTER TABLE media_assets ADD COLUMN dam_version TEXT DEFAULT '1.0'");
safeAlter("ALTER TABLE media_assets ADD COLUMN dam_status  TEXT DEFAULT 'ACTIVE'");
// dam_status: ACTIVE | ARCHIVED | DELETED
// tags_json, category, subcategory, country_origin, product_relation already exist

// ─── GOS-06G: Client Relationships ────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS client_relationships (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    source_client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    target_client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    relationship_type TEXT    NOT NULL,
    notes             TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    CHECK(source_client_id != target_client_id),
    UNIQUE(source_client_id, target_client_id, relationship_type)
  );
`);

// ─── GOS-06H: Multi Role System ───────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS user_roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT    NOT NULL,
    granted_by  INTEGER REFERENCES users(id),
    granted_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    valid_from  TEXT,
    valid_until TEXT,
    UNIQUE(user_id, role)
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS role_permissions (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    role    TEXT NOT NULL,
    module  TEXT NOT NULL,
    action  TEXT NOT NULL,
    UNIQUE(role, module, action)
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS role_groups (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS role_group_members (
    group_id INTEGER NOT NULL REFERENCES role_groups(id) ON DELETE CASCADE,
    role     TEXT    NOT NULL,
    PRIMARY KEY(group_id, role)
  );
`);

// ─── GOS-06I: Workflow Engine Foundation ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS workflow_templates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    entity_type TEXT    NOT NULL DEFAULT 'CLIENT',
    active      INTEGER NOT NULL DEFAULT 1
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS workflow_steps (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id     INTEGER NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    step_order      INTEGER NOT NULL,
    name            TEXT    NOT NULL,
    required_role   TEXT,
    required_action TEXT,
    sla_hours       INTEGER,
    is_mandatory    INTEGER DEFAULT 1
  );
`);

// ─── GOS-06 Analytics: indexes + views ───────────────────────────────────────
db.exec(`CREATE INDEX IF NOT EXISTS idx_op_client   ON operations(client_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_op_product  ON operations(product_category);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_op_origin   ON operations(origin_country);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_op_dest     ON operations(destination_country);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_op_status   ON operations(status);`);
db.exec(`
  CREATE VIEW IF NOT EXISTS v_trade_by_country_product AS
  SELECT
    o.destination_country AS country,
    cc.region, cc.subregion,
    o.product_category,
    COUNT(*)                    AS operations,
    COUNT(DISTINCT o.client_id) AS clients,
    SUM(o.shipment_value)       AS total_value,
    o.currency
  FROM operations o
  LEFT JOIN country_catalog cc ON cc.code = o.destination_country
  WHERE o.status != 'cancelled'
  GROUP BY o.destination_country, o.product_category, o.currency;
`);
db.exec(`
  CREATE VIEW IF NOT EXISTS v_kyc_pipeline AS
  SELECT kyc_status, lifecycle_status,
    COUNT(*) AS total,
    COUNT(CASE WHEN compliance_flag=1 THEN 1 END) AS flagged
  FROM clients GROUP BY kyc_status, lifecycle_status;
`);

// ─── Media Assets table ──────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS media_assets (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    filename          TEXT NOT NULL,
    original_name     TEXT NOT NULL,
    mime_type         TEXT NOT NULL,
    extension         TEXT,
    category          TEXT DEFAULT 'general',
    subcategory       TEXT,
    country_origin    TEXT,
    product_relation  TEXT,
    operation_relation TEXT,
    document_relation TEXT,
    uploaded_by       TEXT NOT NULL,
    upload_date       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    file_size         INTEGER,
    image_width       INTEGER,
    image_height      INTEGER,
    public_url        TEXT,
    thumbnail_url     TEXT,
    storage_provider  TEXT DEFAULT 'r2',
    checksum_hash     TEXT,
    r2_key            TEXT,
    thumbnail_key     TEXT,
    metadata_json     TEXT DEFAULT '{}',
    tags_json         TEXT DEFAULT '[]',
    status            TEXT DEFAULT 'active',
    visibility        TEXT DEFAULT 'internal',
    archived          INTEGER DEFAULT 0,
    audit_reference   TEXT
  );
`);

// ─── Product Master & Media Resolver (Phase 3B) ──────────────────────────────
// Resolves PDF imagery at the PRODUCT level (e.g. CATTLE vs SHEEP) instead of
// the CATEGORY level (e.g. LIVE_ANIMALS), which previously caused cross-product
// image bleed (a BOVINE operation could render OVINE imagery).
db.exec(`
  CREATE TABLE IF NOT EXISTS product_master (
    product_code TEXT PRIMARY KEY,
    category     TEXT NOT NULL,
    name_es      TEXT,
    name_en      TEXT,
    active       INTEGER NOT NULL DEFAULT 1
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS media_profiles (
    product_code        TEXT PRIMARY KEY REFERENCES product_master(product_code),
    main_asset_id        INTEGER REFERENCES media_assets(id),
    secondary_asset_ids  TEXT DEFAULT '[]',
    branding_asset_id    INTEGER REFERENCES media_assets(id),
    updated_at           TEXT DEFAULT (datetime('now')),
    updated_by           TEXT
  );
`);

// ─── Price Center tables ──────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS pc_categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT NOT NULL UNIQUE,
    name_es    TEXT NOT NULL,
    name_en    TEXT NOT NULL,
    icon       TEXT DEFAULT 'ti-package',
    color      TEXT DEFAULT '#1B2A4A',
    parent_slug TEXT,
    sort_order INTEGER DEFAULT 0,
    active     INTEGER DEFAULT 1
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pc_products (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    category_slug     TEXT NOT NULL,
    name_es           TEXT NOT NULL,
    name_en           TEXT,
    commercial_name   TEXT,
    subcategory       TEXT,
    origin_countries  TEXT DEFAULT '[]',
    fob_price         REAL,
    cif_price         REAL,
    incoterms         TEXT DEFAULT '["FOB","CFR","CIF"]',
    moq               TEXT,
    packaging         TEXT,
    units_per_box     INTEGER,
    net_weight        REAL,
    gross_weight      REAL,
    shelf_life        TEXT,
    hs_code           TEXT,
    container_capacity REAL,
    image_url         TEXT,
    images            TEXT DEFAULT '[]',
    certifications    TEXT DEFAULT '[]',
    availability      TEXT DEFAULT 'available',
    export_notes      TEXT,
    price_updated_at  TEXT DEFAULT (datetime('now')),
    supplier_name     TEXT,
    ports             TEXT DEFAULT '[]',
    reefer_required   INTEGER DEFAULT 0,
    frozen_required   INTEGER DEFAULT 0,
    cargo_type        TEXT DEFAULT 'Dry Cargo',
    pallet_config     TEXT,
    loading_config    TEXT,
    market_segments   TEXT DEFAULT '[]',
    specs             TEXT DEFAULT '{}',
    active            INTEGER DEFAULT 1,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pc_breeds (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    species          TEXT NOT NULL,
    name             TEXT NOT NULL,
    name_en          TEXT,
    origin_countries TEXT DEFAULT '[]',
    avg_weight_kg    REAL,
    weight_range     TEXT,
    cargo_type       TEXT DEFAULT 'Live Animals',
    notes            TEXT,
    active           INTEGER DEFAULT 1
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pc_price_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL,
    field       TEXT NOT NULL,
    old_value   REAL,
    new_value   REAL,
    changed_by  TEXT NOT NULL,
    reason      TEXT,
    ts          TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── COMMERCIAL INTELLIGENCE FOUNDATION V2 — FASE 0 ─────────────────────────
// Additive-only tables. No existing tables, routes, or logic are modified.
// Existing code (product_master, pc_products, media_profiles, PaymentTermsRegistry,
// ProductIntelligenceRegistry) continues to function unchanged.
// New architecture layer reads from these tables; migration is progressive and opt-in.

// 1. Global Product Registry — unified source of truth for all products
db.exec(`
  CREATE TABLE IF NOT EXISTS gpr_products (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code      TEXT    NOT NULL UNIQUE,
    category_code     TEXT    NOT NULL,
    subcategory_code  TEXT,
    name_es           TEXT    NOT NULL,
    name_en           TEXT    NOT NULL,
    name_fr           TEXT,
    name_zh           TEXT,
    name_ar           TEXT,
    hs_code           TEXT,
    calc_mode         TEXT    NOT NULL DEFAULT 'unit',
    default_unit      TEXT,
    container_capacity REAL,
    moq_value         REAL,
    moq_unit          TEXT,
    origin_countries  TEXT    NOT NULL DEFAULT '[]',
    certifications    TEXT    NOT NULL DEFAULT '[]',
    market_segments   TEXT    NOT NULL DEFAULT '[]',
    reefer_required   INTEGER NOT NULL DEFAULT 0,
    frozen_required   INTEGER NOT NULL DEFAULT 0,
    cargo_type        TEXT    NOT NULL DEFAULT 'Dry Cargo',
    shelf_life        TEXT,
    active            INTEGER NOT NULL DEFAULT 1,
    migration_status  TEXT    NOT NULL DEFAULT 'PENDING',
    source_pm_code    TEXT    REFERENCES product_master(product_code),
    source_pc_id      INTEGER REFERENCES pc_products(id),
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_gpr_category        ON gpr_products(category_code);
  CREATE INDEX IF NOT EXISTS idx_gpr_migration       ON gpr_products(migration_status);
  CREATE INDEX IF NOT EXISTS idx_gpr_active          ON gpr_products(active);
`);

// 2. Product Specifications — flexible key-value spec store per product
db.exec(`
  CREATE TABLE IF NOT EXISTS gpr_specifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES gpr_products(id) ON DELETE CASCADE,
    spec_key    TEXT    NOT NULL,
    spec_value  TEXT    NOT NULL,
    spec_type   TEXT    NOT NULL DEFAULT 'text',
    unit        TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(product_id, spec_key)
  );
  CREATE INDEX IF NOT EXISTS idx_gpr_spec_product ON gpr_specifications(product_id);
`);

// 3. Product Intelligence Profiles — replaces hardcoded ProductIntelligenceRegistry.js
db.exec(`
  CREATE TABLE IF NOT EXISTS pi_profiles (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code          TEXT    NOT NULL UNIQUE,
    executive_description TEXT,
    certification_profile TEXT    NOT NULL DEFAULT '[]',
    compliance_badges     TEXT    NOT NULL DEFAULT '[]',
    timeline_min_days     INTEGER,
    timeline_max_days     INTEGER,
    timeline_notes        TEXT,
    logistics_mode        TEXT,
    logistics_notes       TEXT,
    market_applications   TEXT    NOT NULL DEFAULT '[]',
    intelligence_version  TEXT    NOT NULL DEFAULT '1.0',
    active                INTEGER NOT NULL DEFAULT 1,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pi_product ON pi_profiles(product_code);
  CREATE INDEX IF NOT EXISTS idx_pi_active  ON pi_profiles(active);
`);

// 4. Media Intelligence Assets — extends media_profiles with versioning, expiry, multi-language
db.exec(`
  CREATE TABLE IF NOT EXISTS mi_assets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code    TEXT    NOT NULL,
    asset_role      TEXT    NOT NULL DEFAULT 'MAIN',
    media_asset_id  INTEGER REFERENCES media_assets(id),
    language_code   TEXT    NOT NULL DEFAULT 'ALL',
    version         INTEGER NOT NULL DEFAULT 1,
    valid_from      TEXT,
    valid_until     TEXT,
    priority        INTEGER NOT NULL DEFAULT 100,
    approved_by     INTEGER REFERENCES users(id),
    approved_at     TEXT,
    status          TEXT    NOT NULL DEFAULT 'ACTIVE',
    notes           TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mi_product ON mi_assets(product_code);
  CREATE INDEX IF NOT EXISTS idx_mi_status  ON mi_assets(status);
  CREATE INDEX IF NOT EXISTS idx_mi_role    ON mi_assets(asset_role);
`);

// 5. Commercial Rules — replaces scattered PaymentTermsRegistry, PricingGovernanceRegistry
db.exec(`
  CREATE TABLE IF NOT EXISTS cr_rules (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_code       TEXT    NOT NULL UNIQUE,
    rule_type       TEXT    NOT NULL,
    category_scope  TEXT    NOT NULL DEFAULT 'ALL',
    product_scope   TEXT    NOT NULL DEFAULT 'ALL',
    min_volume      REAL,
    max_volume      REAL,
    rule_config     TEXT    NOT NULL DEFAULT '{}',
    priority        INTEGER NOT NULL DEFAULT 100,
    active          INTEGER NOT NULL DEFAULT 1,
    valid_from      TEXT,
    valid_until     TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_cr_type   ON cr_rules(rule_type);
  CREATE INDEX IF NOT EXISTS idx_cr_active ON cr_rules(active);
`);

// 6. Document Intelligence Requirements — per-category required fields, validations, PDF sections
db.exec(`
  CREATE TABLE IF NOT EXISTS di_requirements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    req_code        TEXT    NOT NULL UNIQUE,
    category_code   TEXT    NOT NULL,
    product_scope   TEXT    NOT NULL DEFAULT 'ALL',
    req_type        TEXT    NOT NULL,
    req_key         TEXT    NOT NULL,
    req_label_es    TEXT    NOT NULL,
    req_label_en    TEXT,
    is_mandatory    INTEGER NOT NULL DEFAULT 1,
    validation_rule TEXT,
    pdf_section     TEXT,
    display_order   INTEGER NOT NULL DEFAULT 100,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_di_category ON di_requirements(category_code);
  CREATE INDEX IF NOT EXISTS idx_di_type     ON di_requirements(req_type);
  CREATE INDEX IF NOT EXISTS idx_di_active   ON di_requirements(active);
`);

// ─── Seed default users ───────────────────────────────────────────────────────
function seedPriceCenter() {
  const catCount = db.prepare("SELECT COUNT(*) AS c FROM pc_categories").get().c;
  if (catCount > 0) return;

  const insertCat = db.prepare(
    "INSERT INTO pc_categories (slug, name_es, name_en, icon, color, parent_slug, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  db.transaction(() => {
    insertCat.run("fresh-fruits",       "Frutas Frescas",                "Fresh Fruits",              "ti-plant",         "#059669", null,           1);
    insertCat.run("colombia-exotic",    "Frutas Exóticas Colombianas",   "Colombian Exotic Fruits",   "ti-leaf",          "#be185d", "fresh-fruits", 2);
    insertCat.run("brazil-fruits",      "Frutas Tropicales Brasil",      "Brazil Tropical Fruits",    "ti-sun",           "#d97706", "fresh-fruits", 3);
    insertCat.run("peru-fruits",        "Frutas de Exportación Perú",    "Peru Export Fruits",        "ti-sun-2",         "#b45309", "fresh-fruits", 4);
    insertCat.run("chile-fruits",       "Frutas Premium Chile",          "Chile Premium Fruits",      "ti-snowflake",     "#0369a1", "fresh-fruits", 5);
    insertCat.run("fruit-pulps",        "Pulpas de Fruta",               "Fruit Pulps",               "ti-droplet",       "#7c3aed", null,           6);
    insertCat.run("grains-legumes",     "Granos y Legumbres",            "Grains & Legumes",          "ti-grain",         "#d97706", null,           7);
    insertCat.run("sugar-oils",         "Azúcar y Aceites",              "Sugar & Oils",              "ti-droplet-half-2","#ca8a04", null,           8);
    insertCat.run("coconut-products",   "Productos de Coco",             "Coconut Products",          "ti-plant-2",       "#15803d", null,           9);
    insertCat.run("meat-beef",          "Carne de Res",                  "Beef",                      "ti-meat",          "#2563eb", null,           10);
    insertCat.run("meat-lamb",          "Cordero y Ovino Congelado",     "Lamb & Mutton",             "ti-paw",           "#7c2d12", null,           11);
    insertCat.run("meat-pork",          "Carne de Cerdo Congelada",      "Pork",                      "ti-building",      "#f43f5e", null,           12);
    insertCat.run("meat-poultry",       "Aves de Corral",                "Poultry",                   "ti-feather",       "#ca8a04", null,           13);
    insertCat.run("canned-products",    "Productos en Conserva",         "Canned Products",           "ti-package",       "#9333ea", null,           14);
    insertCat.run("live-animals",       "Animales Vivos",                "Live Animals",              "ti-paw",           "#059669", null,           15);
  })();

  const ip = db.prepare(`
    INSERT INTO pc_products
    (category_slug, name_es, name_en, commercial_name, origin_countries, fob_price, cif_price,
     incoterms, moq, packaging, hs_code, container_capacity, certifications, availability,
     price_updated_at, ports, reefer_required, frozen_required, cargo_type, market_segments, shelf_life, export_notes, specs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    // ── Colombia Exotic Fruits ──────────────────────────────────────────────────
    ip.run("colombia-exotic","Aguacate Hass","Hass Avocado","Aguacate Hass Colombiano",'["Colombia"]',0.95,1.45,'["FOB","CFR","CIF","DDP"]',"5 MT","Caja 4kg / Caja 10kg","0804.40.00",18,'["GlobalG.A.P.","Rainforest Alliance","BPA"]','["Buenaventura","Cartagena"]',1,0,"Refrigerated Cargo",'["Premium Industrial","General B2B","Retail Distribution"]',"30 días en cadena de frío","Calibres 12, 14, 16, 20. Color Hass certificado. Empaque bajo norma NTC 1251.",'{"calibers":"12,14,16,20","brix":"min 10°","dry_matter":"min 21%"}');
    ip.run("colombia-exotic","Borojó","Borojó","Borojó Premium Colombia",'["Colombia"]',2.80,3.60,'["FOB","CFR","CIF"]',"500 KG","Bolsa 1kg IQF / Balde 5kg Pulpa","0810.90.90",15,'["INVIMA","Cert. Fitosanitario ICA"]','["Buenaventura","Turbo"]',0,0,"Refrigerated Cargo",'["General B2B","Food Service","Institutional"]',"12 meses pulpa congelada","Borojó del Chocó. Alto contenido energético. Usado en bebidas funcionales y medicina natural.",'{"presentation":"Fresco / IQF / Pulpa","region":"Chocó, Nariño"}');
    ip.run("colombia-exotic","Uchuva","Cape Gooseberry / Physalis","Uchuva Exportación Colombia",'["Colombia"]',3.20,4.20,'["FOB","CFR","CIF","DDP"]',"300 KG","Caja 250g con cáliz / Bandeja 150g","0810.90.30",12,'["GlobalG.A.P.","Orgánico EU","BRC"]','["Bogotá (Aéreo)","Buenaventura"]',1,0,"Refrigerated Cargo",'["Premium Industrial","Retail Distribution","Food Service"]',"15 días fresco / 12 meses IQF","Con o sin cáliz. Calibre M, L, XL. Principal destino: Europa, Canadá.",'{"caliber":"M, L, XL","presentation":"con_caliz / sin_caliz"}');
    ip.run("colombia-exotic","Gulupa","Purple Granadilla","Gulupa Premium Export",'["Colombia"]',3.80,4.80,'["FOB","CFR","CIF"]',"300 KG","Caja 4kg / Caja 10kg","0810.90.40",12,'["GlobalG.A.P.","Orgánico EU"]','["Bogotá (Aéreo)","Buenaventura"]',1,0,"Refrigerated Cargo",'["Premium Industrial","Retail Distribution"]',"21 días fresco","Gulupa colombiana de exportación. Alta demanda en Europa. Grado A y Extra.",'{"grades":"A, Extra","brix":"min 14°"}');
    ip.run("colombia-exotic","Pitahaya Amarilla","Yellow Dragon Fruit","Pitahaya Amarilla Colombia",'["Colombia"]',5.20,6.80,'["FOB","CFR","CIF","DDP"]',"200 KG","Caja 3kg / Caja 5kg","0810.90.50",12,'["GlobalG.A.P.","Orgánico","ICA Fitosanitario"]','["Bogotá (Aéreo)","Buenaventura"]',1,0,"Refrigerated Cargo",'["Premium Industrial","Retail Distribution","Food Service"]',"14 días fresco","Selenicerus megalanthus. Producto premium de exportación. Principal competidor Ecuador.",'{"pulp_color":"Blanca","rind":"Amarilla","brix":"min 15°"}');
    ip.run("colombia-exotic","Pitahaya Roja","Red Dragon Fruit","Pitahaya Roja Colombia",'["Colombia","Vietnam"]',4.50,5.80,'["FOB","CFR","CIF"]',"300 KG","Caja 5kg / Caja 10kg","0810.90.51",12,'["GlobalG.A.P.","ICA"]','["Bogotá (Aéreo)","Buenaventura"]',1,0,"Refrigerated Cargo",'["General B2B","Retail Distribution"]',"10 días fresco","Hylocereus undatus. Alta demanda en Asia y Europa. Color rojo intenso.",'{"pulp_color":"Blanca con puntos negros","brix":"min 11°"}');
    ip.run("colombia-exotic","Maracuyá","Passion Fruit","Maracuyá Colombia Exportación",'["Colombia","Brasil","Ecuador"]',1.40,2.00,'["FOB","CFR","CIF"]',"1 MT","Caja 10kg / Bolsa IQF","0810.90.10",15,'["INVIMA","ICA Fitosanitario","BPA"]','["Buenaventura","Cartagena","Barranquilla"]',0,0,"Refrigerated Cargo",'["General B2B","Food Service","Institutional"]',"30 días fresco / 12 meses pulpa","Colombia mayor exportador regional. Destinos: UE, EE.UU., Oriente Medio.",'{"brix":"min 12°","presentation":"Fresco / Pulpa IQF"}');
    ip.run("colombia-exotic","Lulo","Lulo / Naranjilla","Lulo Colombiano Exportación",'["Colombia"]',2.20,3.00,'["FOB","CFR","CIF"]',"300 KG","Caja 5kg / Bolsa IQF","0810.90.20",15,'["ICA Fitosanitario","INVIMA"]','["Bogotá (Aéreo)","Buenaventura"]',1,0,"Refrigerated Cargo",'["Premium Industrial","Food Service"]',"7 días fresco / 12 meses IQF","Solanum quitoense. Uso principal en jugos naturales y refrescos.",'{"brix":"min 7°","acidez":"alta"}');
    ip.run("colombia-exotic","Guanábana","Soursop","Guanábana Colombia",'["Colombia","Brasil","México"]',2.50,3.30,'["FOB","CFR","CIF"]',"500 KG","Caja 5kg / Pulpa IQF","0810.90.60",15,'["ICA","INVIMA"]','["Buenaventura","Cartagena"]',1,0,"Refrigerated Cargo",'["General B2B","Food Service","Institutional"]',"7 días fresco / 12 meses pulpa","Alta demanda en mercados Halal y naturales. Propiedades medicinales reconocidas.",'{"presentation":"Fresco / Pulpa congelada"}');
    ip.run("colombia-exotic","Feijoa","Feijoa / Guavasteen","Feijoa Colombia",'["Colombia"]',1.80,2.50,'["FOB","CFR","CIF"]',"300 KG","Caja 5kg","0810.90.70",15,'["ICA","BPA"]','["Bogotá (Aéreo)"]',1,0,"Refrigerated Cargo",'["Premium Industrial","Retail Distribution"]',"14 días fresco","Acca sellowiana. Cultivo andino colombiano. Sabor único entre fresa y guayaba.",'{"region":"Cundinamarca, Boyacá"}');
    ip.run("colombia-exotic","Curuba","Curuba / Banana Passion Fruit","Curuba Colombia",'["Colombia"]',2.00,2.80,'["FOB","CFR","CIF"]',"200 KG","Caja 5kg / Pulpa","0810.90.80",15,'["ICA"]','["Bogotá (Aéreo)"]',1,0,"Refrigerated Cargo",'["Premium Industrial","Food Service"]',"10 días fresco","Passiflora tripartita. Alto contenido vitamínico. Uso en jugos y repostería.",'{}');
    ip.run("colombia-exotic","Mango Tommy Atkins","Mango","Mango Colombia Exportación",'["Colombia","Brasil","Perú"]',0.80,1.20,'["FOB","CFR","CIF","DDP"]',"2 MT","Caja 4kg / Caja 8kg","0804.50.00",18,'["GlobalG.A.P.","ICA Fitosanitario"]','["Buenaventura","Cartagena","Barranquilla"]',1,0,"Refrigerated Cargo",'["General B2B","Retail Distribution","Food Service"]',"21 días en cadena de frío","Variedad Tommy Atkins y Keitt. Temporada noviembre-marzo Colombia.",'{"varieties":"Tommy Atkins, Keitt, Kent","brix":"min 10°"}');
    ip.run("colombia-exotic","Chontaduro","Chontaduro / Peach Palm","Chontaduro Colombiano",'["Colombia","Brasil"]',1.60,2.20,'["FOB","CFR","CIF"]',"300 KG","Caja 5kg / Cocido al vacío","0802.90.10",15,'["ICA","INVIMA"]','["Buenaventura","Turbo"]',1,0,"Refrigerated Cargo",'["General B2B","Food Service"]',"7 días fresco / 30 días cocido","Bactris gasipaes. Alto valor proteico. Principal demanda en Colombia, Brasil y mercados latinos.",'{"presentation":"Fresco / Cocido vacuum"}');
    ip.run("colombia-exotic","Granadilla","Granadilla / Sweet Passion Fruit","Granadilla Colombiana",'["Colombia","Ecuador"]',1.90,2.60,'["FOB","CFR","CIF"]',"300 KG","Caja 5kg","0810.90.15",12,'["GlobalG.A.P.","ICA"]','["Bogotá (Aéreo)","Buenaventura"]',1,0,"Refrigerated Cargo",'["Premium Industrial","Retail Distribution"]',"21 días fresco","Passiflora ligularis. Principal destino Alemania y Países Bajos.",'{"brix":"min 13°"}');
    ip.run("colombia-exotic","Banano Cavendish","Cavendish Banana","Banano Exportación Colombia",'["Colombia","Ecuador","Costa Rica"]',0.28,0.45,'["FOB","CFR","CIF","DDP"]',"20 MT","Caja 18.14kg estándar","0803.90.10",20,'["GlobalG.A.P.","Rainforest Alliance","Fairtrade","GLOBALG.A.P."]','["Santa Marta","Barranquilla","Buenaventura"]',1,0,"Refrigerated Cargo",'["General B2B","Retail Distribution","Institutional"]',"21 días en tránsito","Calibre 13+. Dorado o verde según destino.",'{"caliber":"13+","crown":"8cm min","color":"verde exportacion"}');
    ip.run("colombia-exotic","Limón Tahití","Tahiti Lime","Limón Tahití Colombia",'["Colombia","Brasil","México"]',0.55,0.85,'["FOB","CFR","CIF"]',"2 MT","Malla 5kg / Caja 20kg","0805.50.20",18,'["GlobalG.A.P.","ICA"]','["Buenaventura","Cartagena"]',0,0,"Refrigerated Cargo",'["General B2B","Food Service","Retail Distribution"]',"30 días fresco","Citrus latifolia. Sin semilla. Principal destino EE.UU., UE.",'{"juiciness":"min 42%","brix":"min 7°"}');

    // ── Brazil Fruits ──────────────────────────────────────────────────────────
    ip.run("brazil-fruits","Açaí","Açaí Berry","Açaí Premium Brasil",'["Brazil"]',3.50,4.80,'["FOB","CFR","CIF"]',"1 MT","Bolsa IQF 1kg / Balde 10kg","0810.90.95",15,'["MAPA","SIF"]','["Belém","Santarém","Manaus"]',0,1,"Frozen Cargo",'["Premium Industrial","Food Service","Retail Distribution"]',"18 meses congelado","Euterpe oleracea. Pulpa congelada grado A. Alta demanda global en segmento health.",'{"solidos":"min 8%","ph":"3.5-4.0"}');
    ip.run("brazil-fruits","Papaya","Papaya","Papaya Formosa / Solo Brasil",'["Brazil"]',0.60,0.95,'["FOB","CFR","CIF"]',"3 MT","Caja 8kg / Caja 15kg","0807.20.00",18,'["MAPA","GlobalG.A.P."]','["Santos","Vitória","Recife"]',1,0,"Refrigerated Cargo",'["General B2B","Food Service"]',"14 días fresco","Variedades Formosa y Solo. Temporada todo el año.",'{"varieties":"Formosa, Solo","brix":"min 11°"}');
    ip.run("brazil-fruits","Coco Verde","Fresh Coconut","Coco Verde Brasil",'["Brazil"]',0.45,0.75,'["FOB","CFR","CIF"]',"5 MT","Unitario / Palet","0801.11.00",null,'["MAPA"]','["Santos","Fortaleza","Recife"]',1,0,"Refrigerated Cargo",'["General B2B","Food Service","Retail Distribution"]',"45 días fresco","500ml agua mínimo. Variedades Anão Verde y Anão Amarelo.",'{"agua_ml":"min 500","presentation":"verde_fresco"}');

    // ── Peru Fruits ────────────────────────────────────────────────────────────
    ip.run("peru-fruits","Aguacate Hass Perú","Hass Avocado Peru","Aguacate Hass Perú",'["Peru"]',0.88,1.38,'["FOB","CFR","CIF","DDP"]',"5 MT","Caja 4kg / Caja 10kg","0804.40.00",18,'["GlobalG.A.P.","Rainforest Alliance"]','["Paita","Callao","Salaverry"]',1,0,"Refrigerated Cargo",'["Premium Industrial","General B2B","Retail Distribution"]',"30 días en cadena de frío","Principal exportador mundial. Temporada febrero-mayo.",'{"calibers":"12,14,16,20","dry_matter":"min 21%"}');
    ip.run("peru-fruits","Arándano Perú","Blueberry Peru","Blueberry Premium Perú",'["Peru"]',2.80,3.80,'["FOB","CFR","CIF","DDP"]',"1 MT","Caja 1.8kg / Flat","0810.40.00",12,'["GlobalG.A.P.","BRC","SQF"]','["Paita","Callao"]',1,0,"Refrigerated Cargo",'["Premium Industrial","Retail Distribution"]',"21 días fresco","Variedades Biloxi y Ventura. Temporada agosto-enero. Alta demanda Asia.",'{"brix":"min 10°","caliber":"12mm+"}');
    ip.run("peru-fruits","Uva Red Globe","Red Globe Grape","Uva Red Globe Perú",'["Peru","Chile"]',2.20,3.20,'["FOB","CFR","CIF","DDP"]',"2 MT","Caja 8.2kg","0806.10.00",18,'["GlobalG.A.P.","USDA"]','["Paita","Callao","Ilo"]',1,0,"Refrigerated Cargo",'["Premium Industrial","General B2B","Retail Distribution"]',"30 días fresco","Uva de mesa sin semilla. Principales destinos: China, EE.UU., UE.",'{"berry_size":"22mm+","color":"rojo intenso"}');

    // ── Chile Premium Fruits ───────────────────────────────────────────────────
    ip.run("chile-fruits","Cereza Premium Chile","Premium Cherry","Cereza Bing / Sweet Premium Chile",'["Chile"]',5.80,7.20,'["FOB","CFR","CIF","DDP"]',"1 MT","Caja 5kg / Caja 8.2kg","0809.20.00",15,'["GlobalG.A.P.","USDA","SAG"]','["San Antonio","Valparaíso","San Vicente"]',1,0,"Refrigerated Cargo",'["Premium Industrial","Retail Distribution"]',"30 días en frío","Variedades Bing, Lapins, Regina. Temporada noviembre-enero. Principal destino: China.",'{"caliber":"26mm+","color":"rojo/negro","brix":"min 16°"}');
    ip.run("chile-fruits","Arándano Chile","Blueberry Chile","Blueberry Premium Chile",'["Chile"]',2.50,3.50,'["FOB","CFR","CIF","DDP"]',"1 MT","Caja 1.8kg / Flat","0810.40.00",12,'["GlobalG.A.P.","BRC","Primus"]','["San Antonio","Valparaíso"]',1,0,"Refrigerated Cargo",'["Premium Industrial","Retail Distribution"]',"21 días fresco","Temporada octubre-marzo. Variedades Biloxi y Duke.",'{"caliber":"12mm+","brix":"min 11°"}');

    // ── Fruit Pulps ────────────────────────────────────────────────────────────
    ip.run("fruit-pulps","Pulpa de Maracuyá IQF","Passion Fruit Pulp","Pulpa Maracuyá IQF Colombia/Brasil",'["Colombia","Brazil"]',1.80,2.40,'["FOB","CFR","CIF"]',"1 MT","Bolsa 1kg IQF / Balde 5kg","2009.89.10",15,'["INVIMA","SIF","HACCP","Halal"]','["Buenaventura","Santos"]',0,1,"Frozen Cargo",'["Food Service","Institutional","General B2B"]',"18 meses -18°C","Aséptica o IQF. Brix min 12°. Alta demanda industria de bebidas.",'{"brix":"min 12°","ph":"2.8-3.5","solidos":"min 8%"}');
    ip.run("fruit-pulps","Pulpa de Açaí","Açaí Pulp","Pulpa Açaí Premium Brasil",'["Brazil"]',3.80,5.00,'["FOB","CFR","CIF"]',"1 MT","Bolsa 100g / Balde 10kg","2009.89.20",15,'["MAPA","SIF","HACCP","Orgánico"]','["Belém","Manaus"]',0,1,"Frozen Cargo",'["Premium Industrial","Retail Distribution","Food Service"]',"18 meses -18°C","Grados A1 (fino) y A2 (medio). Alta demanda EE.UU., UE, Japón.",'{"solidos":"A1:8-14%, A2:6-8%","ph":"3.5-4.0"}');
    ip.run("fruit-pulps","Pulpa de Mango","Mango Pulp","Pulpa de Mango IQF",'["Colombia","Brazil","Peru"]',0.90,1.30,'["FOB","CFR","CIF"]',"2 MT","Bolsa 1kg / Balde 5kg / IBC","2009.89.30",15,'["HACCP","BRC","Halal","Kosher"]','["Buenaventura","Santos","Callao"]',0,1,"Frozen Cargo",'["Food Service","Institutional","General B2B"]',"18 meses -18°C","Variedades Tommy Atkins y Alphonso. Brix min 13°. Alto volumen industria.",'{"brix":"min 13°","varieties":"Tommy, Alphonso, Kent"}');
    ip.run("fruit-pulps","Pulpa de Guanábana","Soursop Pulp","Pulpa Guanábana IQF",'["Colombia","Brazil"]',2.80,3.60,'["FOB","CFR","CIF"]',"500 KG","Bolsa 1kg / Balde 5kg","2009.89.40",15,'["INVIMA","SIF","HACCP"]','["Buenaventura","Santos"]',0,1,"Frozen Cargo",'["Food Service","General B2B"]',"18 meses -18°C","Annona muricata. Alta demanda mercados Halal y Asia.",'{"solidos":"min 6%","ph":"3.5-4.0"}');
    ip.run("fruit-pulps","Pulpa de Lulo","Lulo Pulp","Pulpa Lulo Colombia",'["Colombia"]',2.50,3.20,'["FOB","CFR","CIF"]',"300 KG","Bolsa 1kg / Balde 5kg","2009.89.50",15,'["INVIMA","ICA"]','["Bogotá (Aéreo)","Buenaventura"]',0,1,"Frozen Cargo",'["Food Service","Premium Industrial"]',"12 meses -18°C","Producto colombiano exclusivo. Brix 6-8°. Uso principal en cócteles y jugos.",'{"brix":"6-8°","acidez":"alta"}');
    ip.run("fruit-pulps","Pulpa de Borojó","Borojó Pulp","Pulpa Borojó Premium",'["Colombia"]',3.20,4.20,'["FOB","CFR","CIF"]',"200 KG","Bolsa 1kg / Balde 5kg","2009.89.60",15,'["ICA","INVIMA"]','["Buenaventura","Turbo"]',0,1,"Frozen Cargo",'["Premium Industrial","Food Service"]',"12 meses -18°C","Borojoa patinoi. Alto contenido energético y proteico. Demanda mercados naturales.",'{"proteina":"6g/100g","energia":"alta"}');
    ip.run("fruit-pulps","Pulpa de Fresa","Strawberry Pulp","Pulpa Fresa IQF",'["Colombia","Chile","Mexico"]',2.00,2.70,'["FOB","CFR","CIF"]',"1 MT","Bolsa 1kg / Balde 5kg","2009.89.70",15,'["HACCP","BRC","GlobalG.A.P."]','["Buenaventura","Callao","Manzanillo"]',0,1,"Frozen Cargo",'["Food Service","General B2B","Institutional"]',"18 meses -18°C","Variedades Chandler y Festival. Brix min 7°.",'{"brix":"min 7°","color":"rojo intenso"}');
    ip.run("fruit-pulps","Pulpa de Tamarindo","Tamarind Pulp","Pulpa Tamarindo",'["Colombia","India","Thailand"]',1.50,2.10,'["FOB","CFR","CIF"]',"1 MT","Bloque 1kg / Balde 5kg","2009.89.80",15,'["HACCP","Halal","Kosher"]','["Cartagena","Buenaventura"]',0,1,"Frozen Cargo",'["Food Service","General B2B"]',"18 meses -18°C","Tamarindus indica. Alta demanda industria de salsas y bebidas.",'{"acidez":"alta","solidos":"min 12%"}');
    ip.run("fruit-pulps","Pulpa de Piña","Pineapple Pulp","Pulpa Piña IQF",'["Colombia","Costa Rica","Brazil"]',0.80,1.20,'["FOB","CFR","CIF"]',"2 MT","Bolsa 1kg / Balde 5kg","2009.41.00",15,'["HACCP","USDA","Halal"]','["Buenaventura","Cartagena","Santos"]',0,1,"Frozen Cargo",'["Food Service","Institutional","General B2B"]',"18 meses -18°C","Variedades MD2 y Cayena Lisa. Brix min 12°.",'{"brix":"min 12°","varieties":"MD2, Cayena"}');
    ip.run("fruit-pulps","Pulpa de Mora","Mora Pulp (Andean Blackberry)","Pulpa Mora Colombia",'["Colombia"]',2.20,2.90,'["FOB","CFR","CIF"]',"300 KG","Bolsa 1kg / Balde 5kg","2009.89.90",15,'["ICA","INVIMA"]','["Bogotá (Aéreo)","Buenaventura"]',0,1,"Frozen Cargo",'["Food Service","Premium Industrial"]',"12 meses -18°C","Rubus glaucus. Producto andino exclusivo. Alto antioxidante.",'{"brix":"6-8°","anthocyanins":"alta"}');

    // ── Grains & Legumes ───────────────────────────────────────────────────────
    ip.run("grains-legumes","Soja GMO","Soybeans GMO","Soja en Grano GMO Brasil",'["Brazil","Argentina","Paraguay"]',350,390,'["FOB","CFR","CIF"]',"1000 MT","Granel / Big Bag 1MT","1201.90.00",27,'["MAPA","ABIOVE","CAS"]','["Santos","Paranaguá","Buenos Aires","Rosario"]',0,0,"Dry Cargo",'["General B2B","Institutional"]',"6 meses en silo seco","Proteína min 35%. Humedad max 14%. GMO. Embarque mínimo 1 contenedor.",'{"protein":"min 35%","moisture":"max 14%","gmostatus":"GMO","oil":"min 18%"}');
    ip.run("grains-legumes","Soja Non-GMO","Soybeans Non-GMO","Soja No-OGM Brasil/Argentina",'["Brazil","Argentina"]',380,425,'["FOB","CFR","CIF"]',"500 MT","Granel / Big Bag / Bolsa 50kg","1201.90.00",27,'["MAPA","IP Certificate","Non-GMO Verified"]','["Santos","Paranaguá","Buenos Aires"]',0,0,"Dry Cargo",'["Premium Industrial","Retail Distribution"]',"6 meses","IP Certified Non-GMO. Premium vs GMO approx +8-12%.",'{"protein":"min 36%","moisture":"max 13.5%","gmostatus":"Non-GMO IP","segregated":"sí"}');
    ip.run("grains-legumes","Maíz Amarillo","Yellow Corn","Maíz Amarillo No. 2 Brasil",'["Brazil","Argentina","USA","Paraguay"]',218,252,'["FOB","CFR","CIF"]',"1000 MT","Granel / Contenedor","1005.90.10",27,'["MAPA","USDA"]','["Santos","Paranaguá","Buenos Aires","New Orleans"]',0,0,"Dry Cargo",'["General B2B","Institutional"]',"3 meses seco","US No. 2 / CBOT standard. Humedad max 14.5%. Proteína min 8%.",'{"protein":"min 8%","moisture":"max 14.5%","grade":"US No.2"}');
    ip.run("grains-legumes","Arroz Blanco","White Rice","Arroz Blanco 5% India/Vietnam",'["India","Vietnam","Thailand","Pakistan"]',380,420,'["FOB","CFR","CIF"]',"100 MT","Saco 50kg / Big Bag","1006.30.10",27,'["HACCP","FSSAI","Halal"]','["Mundra","Kakinada","Ho Chi Minh","Bangkok"]',0,0,"Dry Cargo",'["General B2B","Institutional","Food Service"]',"12 meses en bodega seca","5% broken. Long grain. IR64 / IRRI-6 standard.",'{"broken":"5%","moisture":"max 14%","variety":"Long Grain"}');
    ip.run("grains-legumes","Arroz Parboiled","Parboiled Rice","Arroz Parboiled 100% Brasil",'["Brazil","India"]',390,432,'["FOB","CFR","CIF"]',"100 MT","Saco 50kg / Big Bag 1MT","1006.30.20",27,'["MAPA","SIF","HACCP","Halal"]','["Santos","Paranaguá","Mundra"]',0,0,"Dry Cargo",'["General B2B","Institutional","Food Service"]',"12 meses","Parboiled tipo II. Broken max 5%. Alta demanda Brasil, África, Oriente Medio.",'{"broken":"max 5%","moisture":"max 14%","type":"Parboiled II"}');
    ip.run("grains-legumes","Garbanzo Kabuli","Kabuli Chickpeas","Garbanzo Kabuli Argentina/Australia",'["Argentina","Australia","Canada","Turkey"]',700,750,'["FOB","CFR","CIF"]',"25 MT","Saco 50kg / Big Bag","0713.20.00",25,'["SENASA","DAFF","USDA","Halal","Kosher"]','["Buenos Aires","Port Adelaide","Montreal","Mersin"]',0,0,"Dry Cargo",'["General B2B","Food Service","Institutional"]',"12 meses seco","Calibre 8-9mm. Pureza min 98%. Humedad max 12%. Alta demanda Oriente Medio.",'{"caliber":"8-9mm","purity":"min 98%","moisture":"max 12%"}');
    ip.run("grains-legumes","Lenteja Roja","Red Lentils","Lenteja Roja Descascarada Canadá",'["Canada","Australia","Turkey"]',580,625,'["FOB","CFR","CIF"]',"25 MT","Saco 25kg / Big Bag","0713.40.00",25,'["CFIA","DAFF","Halal","Kosher"]','["Vancouver","Port Adelaide","Mersin"]',0,0,"Dry Cargo",'["General B2B","Food Service","Institutional"]',"18 meses seco","Split. Pureza min 99%. Humedad max 13%. Alta demanda Oriente Medio y Asia.",'{"type":"Split","purity":"min 99%","moisture":"max 13%"}');
    ip.run("grains-legumes","Frijol Negro","Black Beans","Frijol Negro Brasil/Bolivia",'["Brazil","Bolivia","Argentina"]',650,700,'["FOB","CFR","CIF"]',"25 MT","Saco 50kg / Big Bag","0713.33.90",25,'["MAPA","Halal"]','["Santos","Paranaguá","Buenos Aires"]',0,0,"Dry Cargo",'["General B2B","Food Service","Institutional"]',"12 meses","Humedad max 14%. Pureza min 97%. Broken max 5%.",'{"moisture":"max 14%","purity":"min 97%","broken":"max 5%"}');
    ip.run("grains-legumes","Frijol Rojo Kidney","Red Kidney Beans","Frijol Kidney América",'["Argentina","Bolivia","China","USA"]',680,730,'["FOB","CFR","CIF"]',"25 MT","Saco 50kg / Big Bag","0713.33.10",25,'["SENASA","Halal","Kosher"]','["Buenos Aires","Santos","Shanghai","New Orleans"]',0,0,"Dry Cargo",'["General B2B","Food Service","Retail Distribution"]',"12 meses","Light red o Dark red kidney. Pureza min 97%.",'{"type":"Light Red / Dark Red","purity":"min 97%"}');
    ip.run("grains-legumes","Frijol Pinto","Pinto Beans","Frijol Pinto USA/Argentina",'["USA","Argentina","Canada"]',620,668,'["FOB","CFR","CIF"]',"25 MT","Saco 50kg / Big Bag","0713.33.20",25,'["USDA","SENASA","Halal"]','["Portland","Seattle","Buenos Aires"]',0,0,"Dry Cargo",'["General B2B","Food Service"]',"12 meses","US No.1. Pureza min 98%.",'{"grade":"US No.1","purity":"min 98%"}');
    ip.run("grains-legumes","Garbanzo Verde Mung","Green Mung Beans","Frijol Mungo / Mung Bean",'["India","China","Myanmar","Australia"]',680,730,'["FOB","CFR","CIF"]',"25 MT","Saco 50kg / Big Bag","0713.31.00",25,'["FSSAI","Halal","Kosher"]','["Mundra","Kakinada","Shanghai","Melbourne"]',0,0,"Dry Cargo",'["General B2B","Food Service","Institutional"]',"18 meses","FAQ standard. Humedad max 13%.",'{"moisture":"max 13%","grade":"FAQ"}');

    // ── Sugar & Oils ───────────────────────────────────────────────────────────
    ip.run("sugar-oils","Azúcar IC-45","IC45 Sugar","Azúcar Blanco IC-45 Brasil",'["Brazil"]',380,420,'["FOB","CFR","CIF"]',"1000 MT","Bolsa PP 50kg / Big Bag / Granel","1701.99.00",27,'["MAPA","ISO","Halal","Kosher"]','["Santos","Paranaguá","Maceió"]',0,0,"Dry Cargo",'["General B2B","Food Service","Institutional"]',"24 meses seco","ICUMSA 45. Polarización min 99.8°S. Humedad max 0.04%.",'{"icumsa":"45","polarization":"min 99.8°S","moisture":"max 0.04%"}');
    ip.run("sugar-oils","Aceite de Soja","Soybean Oil","Aceite de Soja Degomado Brasil",'["Brazil","Argentina"]',850,920,'["FOB","CFR","CIF"]',"100 MT","IBC 1000L / Flexitank / Granel cisterna","1507.90.00",20,'["MAPA","ANVISA","Halal","Kosher"]','["Santos","Paranaguá","Buenos Aires"]',0,0,"ISO Tank",'["General B2B","Food Service","Institutional"]',"12 meses","Degomado. FFA max 0.1%. Humedad max 0.05%. Principal sustituto aceite palm.",'{"ffa":"max 0.1%","moisture":"max 0.05%","peroxide":"max 2"}');
    ip.run("sugar-oils","Aceite de Palma","Palm Oil","Aceite de Palma RBD Colombia/Malaysia",'["Colombia","Malaysia","Indonesia"]',780,850,'["FOB","CFR","CIF"]',"100 MT","IBC 1000L / Flexitank / Cisterna","1511.90.00",20,'["Halal","RSPO","ISO"]','["Buenaventura","Port Klang","Belawan"]',0,0,"ISO Tank",'["General B2B","Food Service","Institutional"]',"18 meses","RBD (Refined Bleached Deodorized). FFA max 0.1%. RSPO disponible.",'{"grade":"RBD","ffa":"max 0.1%","iodine":"50-55"}');
    ip.run("sugar-oils","Aceite de Girasol","Sunflower Oil","Aceite Girasol Refinado Argentina",'["Argentina","Ukraine","Russia"]',820,890,'["FOB","CFR","CIF"]',"100 MT","IBC / Flexitank","1512.19.00",20,'["SENASA","Halal","HACCP"]','["Buenos Aires","Rosario","Odessa"]',0,0,"ISO Tank",'["General B2B","Food Service"]',"12 meses","Alto oleico o estándar. FFA max 0.2%.",'{"type":"Alto Oleico / Estándar","ffa":"max 0.2%"}');

    // ── Coconut Products ───────────────────────────────────────────────────────
    ip.run("coconut-products","Agua de Coco","Coconut Water","Agua de Coco Natural Brasil",'["Brazil","Philippines","Thailand"]',1.20,1.65,'["FOB","CFR","CIF"]',"500 L","Caja 330ml×24 / Bag-in-box 10L / Granel","2202.99.00",null,'["MAPA","ANVISA","HACCP","Organic","Halal"]','["Santos","Recife","Manila","Bangkok"]',1,0,"Refrigerated Cargo",'["Retail Distribution","Food Service","General B2B"]',"12 meses aséptico","Sin azúcar añadida. HPP o aséptico. Alta demanda mercados fitness.",'{"sugar":"natural only","processing":"HPP / Aseptic"}');
    ip.run("coconut-products","Leche de Coco","Coconut Milk","Leche de Coco Premium",'["Philippines","Thailand","Malaysia"]',1.80,2.30,'["FOB","CFR","CIF"]',"500 L","Lata 400ml / Tetra Pak 1L","2106.90.10",null,'["HACCP","Halal","Kosher","BRC"]','["Manila","Bangkok","Port Klang"]',0,0,"Dry Cargo",'["Food Service","Retail Distribution","Institutional"]',"24 meses","Grasa mínima 17% (full fat) o 7% (light). Producción Thai Premium.",'{"fat":"17% full fat / 7% light","coconut_extract":"min 50%"}');
    ip.run("coconut-products","Aceite de Coco VCO","Coconut Oil VCO","Aceite de Coco Virgen Prensado en Frío",'["Philippines","Sri Lanka","Thailand"]',2.20,2.80,'["FOB","CFR","CIF"]',"500 KG","Bidón 25kg / IBC / Saco 50kg","1513.11.00",null,'["Organic","Halal","Kosher","USDA Organic"]','["Manila","Colombo","Bangkok"]',0,0,"Dry Cargo",'["Premium Industrial","Retail Distribution"]',"24 meses","VCO (Virgin Coconut Oil) cold-pressed. FFA max 0.5%.",'{"type":"VCO cold-pressed","ffa":"max 0.5%","lauric":"min 49%"}');
    ip.run("coconut-products","Harina de Coco","Coconut Flour","Harina de Coco Deshidratada",'["Philippines","Sri Lanka","India"]',1.40,1.90,'["FOB","CFR","CIF"]',"500 KG","Saco 25kg / Big Bag","1106.20.00",null,'["Organic","Halal","Gluten-Free","HACCP"]','["Manila","Colombo","Mundra"]',0,0,"Dry Cargo",'["Food Service","Retail Distribution","Premium Industrial"]',"18 meses","Humedad max 12%. Gluten-free certificado. Demanda mercados paleo y keto.",'{"moisture":"max 12%","fiber":"min 38%","fat":"max 12%"}');
    ip.run("coconut-products","Coco Deshidratado","Desiccated Coconut","Coco Rallado Deshidratado",'["Philippines","Sri Lanka","Malaysia"]',1.20,1.65,'["FOB","CFR","CIF"]',"500 KG","Saco 25kg / Big Bag","0804.99.00",null,'["HACCP","Halal","Kosher","BRC"]','["Manila","Colombo","Port Klang"]',0,0,"Dry Cargo",'["Food Service","General B2B","Institutional"]',"12 meses","Medium, Fine, Long Thread. Humedad max 3%.",'{"cuts":"Medium/Fine/Long Thread","moisture":"max 3%"}');

    // ── Beef ──────────────────────────────────────────────────────────────────
    ip.run("meat-beef","Cortes de Res Congelados","Frozen Beef Cuts","Cortes Bovinos Congelados Brasil/Uruguay",'["Brazil","Uruguay","Argentina"]',5.10,6.30,'["FOB","CFR","CIF"]',"5 MT","Cartón Cryovac 25-30kg","0202.30.00",25,'["MAPA","INAC","SENASA","Halal","SIF"]','["Santos","Montevideo","Buenos Aires","Fortaleza"]',0,1,"Frozen Cargo",'["General B2B","Food Service","Institutional"]',"24 meses -18°C","Cortes disponibles: Chuck, Brisket, Shin, Topside, Silverside, Rump. Halal disponible.",'{"temp":"-18°C","packaging":"Cryovac","halal":"disponible"}');
    ip.run("meat-beef","Carne Halal Bovino","Halal Beef","Carne Bovina Halal Uruguay/Brasil",'["Uruguay","Brazil"]',5.60,6.90,'["FOB","CFR","CIF","DDP"]',"5 MT","Cartón Cryovac / Vacuum","0202.30.00",25,'["Halal Internacional","MAPA","INAC","SIF"]','["Montevideo","Santos","Paranaguá"]',0,1,"Frozen Cargo",'["General B2B","Institutional","Food Service"]',"24 meses -18°C","Certificación Halal verificada. Alta demanda Oriente Medio, Sudeste Asiático.",'{"certification":"Halal Internacional","halal_slaughter":"sí"}');
    ip.run("meat-beef","Carcasa Bovina","Beef Carcass","Carcasa Bovina Entera Halal",'["Uruguay","Brazil","Argentina"]',4.20,5.30,'["FOB","CFR","CIF"]',"10 MT","Colgado / Caja","0201.20.00",25,'["MAPA","INAC","Halal","SENASA"]','["Montevideo","Buenos Aires","Santos"]',0,1,"Frozen Cargo",'["General B2B","Institutional"]',"18 meses -18°C","Carcasas enteras o medias. Peso promedio 200-280 kg. Clasificación EUROP.",'{"weight":"200-280kg","classification":"EUROP"}');

    // ── Lamb & Mutton ─────────────────────────────────────────────────────────
    ip.run("meat-lamb","Cortes de Cordero Congelado","Frozen Lamb Cuts","Cortes Ovinos Congelados Australia/NZ",'["Australia","New Zealand","Uruguay"]',6.20,7.60,'["FOB","CFR","CIF","DDP"]',"2 MT","Cartón Vacuum 20-25kg","0204.43.00",25,'["DAFF","MPI","INAC","Halal","Kosher"]','["Melbourne","Auckland","Montevideo","Fremantle"]',0,1,"Frozen Cargo",'["Premium Industrial","General B2B","Food Service"]',"24 meses -18°C","Leg, Shoulder, Rack, Loin. Halal y Kosher disponibles. Alta demanda Oriente Medio.",'{"cuts":"Leg, Shoulder, Rack, Loin, Shank","halal":"disponible","kosher":"disponible"}');
    ip.run("meat-lamb","Cordero Entero Congelado","Frozen Whole Lamb","Cordero Entero / Carcasa Ovina",'["Australia","New Zealand","Uruguay"]',5.80,7.20,'["FOB","CFR","CIF"]',"2 MT","Individual por pieza / Caja","0204.41.00",25,'["DAFF","MPI","INAC","Halal"]','["Melbourne","Auckland","Montevideo"]',0,1,"Frozen Cargo",'["General B2B","Institutional","Food Service"]',"24 meses -18°C","Peso 18-26 kg. Ideal para mercados Halal del Oriente Medio.",'{"weight":"18-26kg","presentation":"carcasa entera / media carcasa"}');
    ip.run("meat-lamb","Cordero Vivo Exportación","Live Sheep Export","Ovejas y Corderos Exportación en Pie",'["Australia","Brazil","Uruguay"]',5.20,null,'["FOB"]',"500 cabezas","En pie / Transporte Vivo","0104.10.00",null,'["DAFF","MAPA","INAC","SENASA"]','["Portland (AU)","Santos","Montevideo"]',0,0,"Live Animals",'["General B2B","Institutional"]',"Entrega inmediata","Precio por KG peso vivo. Sujeto a cuarentena y cert. veterinario.",'{"price_basis":"KG peso vivo","quarantine":"requerida","vet_cert":"MAPA/SENASA/INAC"}');

    // ── Pork ──────────────────────────────────────────────────────────────────
    ip.run("meat-pork","Cortes de Cerdo Congelados","Frozen Pork Cuts","Cortes Porcinos Brasil/USA",'["Brazil","USA","Spain"]',3.20,4.10,'["FOB","CFR","CIF"]',"5 MT","Cartón Master 25-30kg","0203.29.00",25,'["MAPA","USDA","HACCP","Halal"]','["Santos","Paranaguá","New Orleans","Barcelona"]',0,1,"Frozen Cargo",'["General B2B","Food Service","Institutional"]',"24 meses -18°C","Boston Butt, Ham, Belly, Shoulder, Ribs. Halal disponible.",'{"cuts":"Boston Butt, Ham, Belly, Shoulder, Ribs","halal":"disponible"}');

    // ── Poultry ───────────────────────────────────────────────────────────────
    ip.run("meat-poultry","Pollo Entero Congelado","Whole Frozen Chicken","Pollo Entero Congelado Brasil",'["Brazil","USA","Poland"]',1.35,1.72,'["FOB","CFR","CIF","DDP"]',"10 MT","Cartón 10-12kg / Master 20kg","0207.12.00",25,'["MAPA","SIF","USDA","Halal","Kosher"]','["Santos","Paranaguá","Fortaleza","New Orleans"]',0,1,"Frozen Cargo",'["General B2B","Institutional","Food Service"]',"24 meses -18°C","Clasificación A. Peso 1.2-2.2 kg. Halal disponible. Brasil principal exportador mundial.",'{"weight":"1.2-2.2kg","halal":"disponible","grade":"A"}');
    ip.run("meat-poultry","Patas de Pollo","Chicken Paws","Patas de Pollo Congeladas Brasil",'["Brazil","USA"]',1.10,1.45,'["FOB","CFR","CIF","DDP"]',"10 MT","Cartón 15kg / Master 20kg","0207.14.91",25,'["MAPA","SIF","USDA","GACC"]','["Santos","Paranaguá","New Orleans"]',0,1,"Frozen Cargo",'["General B2B","Institutional"]',"24 meses -18°C","Alta demanda China. GACC registrado. Clean paws.",'{"clean":"sí","gacc":"registrado","main_market":"China"}');
    ip.run("meat-poultry","Pechuga de Pollo","Chicken Breast","Pechuga Pollo IQF Congelada",'["Brazil","Poland","Ukraine"]',2.80,3.50,'["FOB","CFR","CIF"]',"5 MT","Bolsa IQF 10kg / Cartón","0207.14.10",25,'["MAPA","SIF","HACCP","Halal"]','["Santos","Paranaguá","Gdańsk"]',0,1,"Frozen Cargo",'["General B2B","Food Service","Institutional"]',"24 meses -18°C","Sin hueso, sin piel. IQF individual. Peso unitario 150-250g.",'{"boneless":"sí","skinless":"sí","weight":"150-250g/pieza"}');
    ip.run("meat-poultry","Cuartos Traseros","Leg Quarters","Leg Quarters Pollo Brasil/USA",'["Brazil","USA"]',1.40,1.80,'["FOB","CFR","CIF","DDP"]',"10 MT","Cartón Master 20kg","0207.14.60",25,'["MAPA","SIF","USDA","Halal","GACC"]','["Santos","Paranaguá","New Orleans"]',0,1,"Frozen Cargo",'["General B2B","Institutional"]',"24 meses -18°C","Con hueso. Alta demanda Cuba, Angola, Georgia.",'{"bone":"con hueso","halal":"disponible","gacc":"registrado"}');
    ip.run("meat-poultry","Alas de Pollo","Chicken Wings","Alas de Pollo Congeladas",'["Brazil","USA"]',2.20,2.80,'["FOB","CFR","CIF"]',"5 MT","Cartón 10-15kg","0207.14.70",25,'["MAPA","SIF","USDA","Halal"]','["Santos","Paranaguá","New Orleans"]',0,1,"Frozen Cargo",'["General B2B","Food Service","Retail Distribution"]',"24 meses -18°C","Mid-joint o completa. Alta demanda EE.UU., Vietnam.",'{"type":"mid-joint / complete","halal":"disponible"}');

    // ── Canned Products ───────────────────────────────────────────────────────
    ip.run("canned-products","Corned Beef Enlatado","Canned Corned Beef","Corned Beef Halal Brasil/Dinamarca",'["Brazil","Denmark","Argentina"]',3.80,4.60,'["FOB","CFR","CIF","DDP"]',"500 cajas","Lata 340g×12 / Lata 2.72kg×6","1602.50.31",20,'["MAPA","SIF","Halal","HACCP","BRC"]','["Santos","Copenhagen","Buenos Aires"]',0,0,"Dry Cargo",'["General B2B","Institutional","Food Service"]',"36 meses","Min 90% carne bovina. Halal disponible. Alta demanda África y Oriente Medio.",'{"beef_pct":"min 90%","can_sizes":"340g, 2.72kg","halal":"disponible"}');
    ip.run("canned-products","Pollo en Lata","Canned Chicken","Pollo Enlatado en Agua/Caldo",'["Brazil","Thailand","China"]',2.50,3.20,'["FOB","CFR","CIF"]',"500 cajas","Lata 400g×12 / Lata 1.36kg×6","1602.32.11",20,'["MAPA","HACCP","Halal","BRC"]','["Santos","Bangkok","Shanghai"]',0,0,"Dry Cargo",'["General B2B","Institutional","Food Service"]',"36 meses","Pechuga en agua o caldo. Halal disponible.",'{"presentation":"Agua / Caldo","halal":"disponible"}');

    // ── Live Animals ──────────────────────────────────────────────────────────
    ip.run("live-animals","Ovinos Dorper (Brasil)","Dorper Sheep (Brazil)","Ovinos Dorper Exportación Brasil",'["Brazil"]',5.20,null,'["FOB"]',"500 cabezas","En pie — Transporte marítimo especial","0104.10.10",null,'["MAPA","SIF","Halal","Zoosanitario"]','["Santos","Vitória","Fortaleza"]',0,0,"Live Animals",'["General B2B","Institutional"]',"Entrega según cuarentena","Peso vivo 38-55 kg. Cuarentena 30-45 días. Cert. SGS + zoosanitario MAPA requerido.",'{"weight_range":"38-55 kg/cabeza","quarantine":"30-45 días","gender":"mixto/hembras/machos"}');
    ip.run("live-animals","Ovinos Santa Inês (Brasil)","Santa Inês Sheep (Brazil)","Ovinos Santa Inês Brasil",'["Brazil"]',4.80,null,'["FOB"]',"500 cabezas","En pie — Transporte marítimo","0104.10.10",null,'["MAPA","Zoosanitario","SGS"]','["Santos","Fortaleza","Recife"]',0,0,"Live Animals",'["General B2B","Institutional"]',"Según cuarentena","Raza rústica. Peso 35-50 kg. Alta resistencia. No requiere esquila.",'{"weight_range":"35-50 kg","breed_type":"rústica","wool":"no requiere esquila"}');
    ip.run("live-animals","Bovinos Nelore (Brasil)","Nelore Cattle (Brazil)","Ganado Bovino Nelore Brasil",'["Brazil"]',3.20,null,'["FOB"]',"100 cabezas","En pie — Transporte marítimo especial","0102.29.00",null,'["MAPA","ADAPEC","Halal","SGS"]','["Santos","Vitória","Belem","Fortaleza"]',0,0,"Live Animals",'["General B2B","Institutional"]',"Según cuarentena","Peso vivo 350-500 kg. Cuarentena 21-45 días. Certificación MAPA requerida.",'{"weight_range":"350-500 kg/cabeza","breed_notes":"Zebu adaptado trópico"}');
    ip.run("live-animals","Ovinos Dorper (Australia)","Dorper Sheep (Australia)","Ovinos Dorper Premium Australia",'["Australia"]',5.80,null,'["FOB"]',"1000 cabezas","En pie — Livestock Vessel","0104.10.10",null,'["DAFF","Australian Livestock Export","Halal"]','["Portland (VIC)","Fremantle"]',0,0,"Live Animals",'["Premium Industrial","General B2B"]',"Según protocolo DAFF","Estándares ESCAS aplicados. Peso 40-60 kg. Alta calidad genética.",'{"weight_range":"40-60 kg","escas":"aplicado","genetic_quality":"superior"}');
  })();

  // ── Breed seed ──────────────────────────────────────────────────────────────────
  const breedCount = db.prepare("SELECT COUNT(*) AS c FROM pc_breeds").get().c;
  if (breedCount > 0) return;

  const ib = db.prepare(
    "INSERT INTO pc_breeds (species, name, name_en, origin_countries, avg_weight_kg, weight_range, cargo_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  db.transaction(() => {
    // SHEEP
    ib.run("SHEEP","Dorper","Dorper",'["Brazil","South Africa","Australia","New Zealand"]',47,"38-55 kg","Live Animals","Raza de doble propósito. Alta tasa de crecimiento. Sin necesidad de esquila.");
    ib.run("SHEEP","White Dorper","White Dorper",'["Brazil","South Africa"]',44,"36-52 kg","Live Animals","Variante blanca del Dorper. Excelente rendimiento cárnico.");
    ib.run("SHEEP","Santa Inês","Santa Inês",'["Brazil"]',42,"35-50 kg","Live Animals","Raza brasileña rústica. Resistente a calor. Sin esquila.");
    ib.run("SHEEP","Texel","Texel",'["Brazil","Uruguay","Argentina","Netherlands"]',80,"60-100 kg","Live Animals","Alta musculatura. Carne magra de calidad. Excelente para cruzamiento.");
    ib.run("SHEEP","Merino","Merino",'["Australia","New Zealand","Uruguay","Argentina","South Africa"]',65,"50-80 kg","Live Animals","Doble propósito lana/carne. Alta calidad de fibra.");
    ib.run("SHEEP","Corriedale","Corriedale",'["Uruguay","Argentina","New Zealand"]',70,"55-85 kg","Live Animals","Doble propósito. Alta producción lana y carne.");
    ib.run("SHEEP","Suffolk","Suffolk",'["Australia","New Zealand","USA"]',90,"70-110 kg","Live Animals","Alta tasa de crecimiento. Excelente conversión alimentaria.");
    ib.run("SHEEP","Hampshire Down","Hampshire Down",'["Australia","New Zealand"]',85,"65-100 kg","Live Animals","Buena producción cárnica. Temperamento dócil.");
    ib.run("SHEEP","Dohne Merino","Dohne Merino",'["South Africa","Australia"]',72,"55-90 kg","Live Animals","Cruza Merino x German Mutton Merino. Doble propósito mejorado.");
    ib.run("SHEEP","Île-de-France","Île-de-France",'["Brazil","France"]',95,"75-115 kg","Live Animals","Alta producción cárnica. Buen rendimiento en canal.");
    // GOATS
    ib.run("GOATS","Boer","Boer",'["South Africa","Australia","Brazil","New Zealand"]',95,"70-120 kg","Live Animals","Principal raza cárnica caprina del mundo. Rápido crecimiento.");
    ib.run("GOATS","Anglo Nubian","Anglo Nubian",'["Brazil","South Africa","USA"]',65,"50-80 kg","Live Animals","Doble propósito leche/carne. Orejas largas características.");
    ib.run("GOATS","Saanen","Saanen",'["Brazil","Chile","Switzerland"]',70,"55-85 kg","Live Animals","Alta producción láctea. Carne de calidad.");
    ib.run("GOATS","Kalahari Red","Kalahari Red",'["South Africa","Australia"]',80,"65-100 kg","Live Animals","Excelente adaptación a climas áridos. Alta producción cárnica.");
    // CATTLE
    ib.run("CATTLE","Nelore","Nelore",'["Brazil"]',450,"350-550 kg","Live Animals","Raza Zebu dominante en Brasil. Resistente a calor y parásitos.");
    ib.run("CATTLE","Angus","Aberdeen Angus",'["Brazil","Uruguay","Argentina","USA","Australia"]',520,"400-650 kg","Live Animals","Carne premium marmorizada. Alta demanda mercados premium.");
    ib.run("CATTLE","Brahman","Brahman",'["Brazil","Colombia","USA","Australia"]',480,"380-580 kg","Live Animals","Adaptado a zonas tropicales. Alta resistencia calor y humedad.");
    ib.run("CATTLE","Brangus","Brangus",'["Brazil","Argentina","USA"]',500,"400-600 kg","Live Animals","Cruza Brahman×Angus. Adaptación tropical con calidad cárnica.");
    ib.run("CATTLE","Hereford","Hereford",'["Uruguay","Argentina","Brazil","Australia"]',550,"430-680 kg","Live Animals","Excelente producción cárnica. Alta eficiencia alimentaria.");
    ib.run("CATTLE","Braford","Braford",'["Brazil","Australia"]',480,"380-580 kg","Live Animals","Cruza Brahman×Hereford. Rusticidad y calidad cárnica combinadas.");
    ib.run("CATTLE","Gyr","Gyr",'["Brazil"]',420,"330-520 kg","Live Animals","Zebu de alta producción láctea. Base para cruza Girolando.");
    ib.run("CATTLE","Girolando","Girolando",'["Brazil"]',440,"350-540 kg","Live Animals","Cruza Gyr×Holstein. Ideal zonas tropicales. Doble propósito.");
  })();

  console.log("✓ Price Center seed completed");
}

function generateBootstrapPassword() {
  return require("crypto").randomBytes(16).toString("base64url");
}

function seedUsers() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count > 0) return;

  const bootstrapPassword = process.env.SEED_ADMIN_PASSWORD || generateBootstrapPassword();
  const isGenerated = !process.env.SEED_ADMIN_PASSWORD;

  if (isGenerated) {
    console.warn("╔══════════════════════════════════════════════════════════════╗");
    console.warn("║  BOOTSTRAP: No SEED_ADMIN_PASSWORD env var found.           ║");
    console.warn("║  Generated temporary admin password (change immediately):   ║");
    console.warn(`║  User: mvalencia  Password: ${bootstrapPassword.padEnd(30)}║`);
    console.warn("║  All other seed users get forced first-login password reset.║");
    console.warn("╚══════════════════════════════════════════════════════════════╝");
  }

  const seedPassword = generateBootstrapPassword();

  const users = [
    { username: "agent.rodriguez", password: seedPassword,      role: "AGENTE",       name: "Carlos Rodríguez",         email: "c.rodriguez@glvservicesexp.com",    department: "Comercial", position: "Agente Internacional Sr." },
    { username: "agent.silva",     password: seedPassword,      role: "AGENTE",       name: "Ana Silva",                email: "a.silva@glvservicesexp.com",        department: "Comercial", position: "Agente Internacional" },
    { username: "agent.park",      password: seedPassword,      role: "AGENTE",       name: "Ji-hoon Park",             email: "j.park@glvservicesexp.com",         department: "Comercial", position: "Agente Asia-Pacífico" },
    { username: "agent.osei",      password: seedPassword,      role: "AGENTE",       name: "Kwame Osei",               email: "k.osei@glvservicesexp.com",         department: "Comercial", position: "Agente Región África" },
    { username: "agent.lima",      password: seedPassword,      role: "AGENTE",       name: "Valentina Lima",           email: "v.lima@glvservicesexp.com",         department: "Comercial", position: "Agente LATAM" },
    { username: "mvalencia",       password: bootstrapPassword, role: "SUPER_ADMIN",  name: "Misael Valencia Barahona", email: "mvalencia@glvglobalfoodservices.com", department: "Dirección", position: "CEO / Super Admin", first_login: isGenerated ? 1 : 0 },
    { username: "juridico",        password: seedPassword,      role: "COMPLIANCE",   name: "Departamento Jurídico",    email: "juridico@glvservicesexp.com",       department: "Legal" },
    { username: "contabilidad",    password: seedPassword,      role: "ACCOUNTING",   name: "Departamento Financiero",  email: "contabilidad@glvservicesexp.com",   department: "Finanzas" },
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
seedPriceCenter();
seedGos06Catalogs();
seedCommercialFoundationV2();

module.exports = db;

function seedGos06Catalogs() {
  // Entity types
  const entityTypes = [
    ["BUYER","Buyer","TRADE"],["SUPPLIER","Supplier","TRADE"],["BROKER","Broker","TRADE"],
    ["MANDATE","Mandate","TRADE"],["AGENT","Agent","TRADE"],["DISTRIBUTOR","Distributor","TRADE"],
    ["WHOLESALER","Wholesaler","TRADE"],["RETAILER","Retailer","TRADE"],["PROCESSOR","Processor","TRADE"],
    ["MANUFACTURER","Manufacturer","TRADE"],["EXPORTER","Exporter","TRADE"],["IMPORTER","Importer","TRADE"],
    ["GOVERNMENT","Government","GOVERNMENT"],["STATE_COMPANY","State Company","GOVERNMENT"],
    ["FINANCIAL_INSTITUTION","Financial Institution","FINANCE"],
    ["SHIPPING_LINE","Shipping Line","LOGISTICS"],["LOGISTICS_PROVIDER","Logistics Provider","LOGISTICS"],
    ["CUSTOMS_BROKER","Customs Broker","LOGISTICS"],["INSPECTION_COMPANY","Inspection Company","REGULATORY"],
    ["CERTIFICATION_BODY","Certification Body","REGULATORY"],
  ];
  const insET = db.prepare("INSERT OR IGNORE INTO entity_types (code,name,category) VALUES (?,?,?)");
  db.transaction(() => entityTypes.forEach(r => insET.run(...r)))();

  // Document categories
  const docCats = [
    ["GOVERNMENT","Government"],["BANKING","Banking"],["COMMERCIAL","Commercial"],
    ["REGULATORY","Regulatory"],["CUSTOMS","Customs"],["LOGISTICS","Logistics"],
    ["INSPECTION","Inspection"],["CERTIFICATION","Certification"],["CUSTOM","Custom"],
  ];
  const insDC = db.prepare("INSERT OR IGNORE INTO document_categories (code,name) VALUES (?,?)");
  db.transaction(() => docCats.forEach(r => insDC.run(...r)))();

  // Document type catalog
  const govId  = db.prepare("SELECT id FROM document_categories WHERE code='GOVERNMENT'").get()?.id;
  const bankId = db.prepare("SELECT id FROM document_categories WHERE code='BANKING'").get()?.id;
  const comId  = db.prepare("SELECT id FROM document_categories WHERE code='COMMERCIAL'").get()?.id;
  const regId  = db.prepare("SELECT id FROM document_categories WHERE code='REGULATORY'").get()?.id;
  const cusId  = db.prepare("SELECT id FROM document_categories WHERE code='CUSTOM'").get()?.id;
  const certId = db.prepare("SELECT id FROM document_categories WHERE code='CERTIFICATION'").get()?.id;
  if (govId) {
    const insDT = db.prepare("INSERT OR IGNORE INTO document_type_catalog (code,name,category_id,requires_expiry) VALUES (?,?,?,?)");
    db.transaction(() => [
      ["BUSINESS_LICENSE","Business License",govId,1],
      ["TAX_REGISTRATION","Tax Registration",govId,1],
      ["PASSPORT","Passport",govId,1],
      ["GOVERNMENT_REGISTRATION","Government Registration",govId,1],
      ["CUSTOMS_REGISTRATION","Customs Registration",govId,1],
      ["IMPORT_LICENSE","Import License",regId,1],
      ["EXPORT_LICENSE","Export License",regId,1],
      ["FDA_REGISTRATION","FDA Registration",regId,1],
      ["AQSIQ_REGISTRATION","AQSIQ Registration",regId,1],
      ["BANK_REFERENCE","Bank Reference Letter",bankId,0],
      ["BANK_CERTIFICATE","Bank Certificate",bankId,0],
      ["CHAMBER_OF_COMMERCE","Chamber of Commerce",comId,1],
      ["POWER_OF_ATTORNEY","Power of Attorney",comId,0],
      ["KYC_FORM","KYC Form",comId,0],
      ["SIGNED_CONTRACT","Signed Contract",comId,0],
      ["HALAL_CERTIFICATE","Halal Certificate",certId,1],
      ["HEALTH_CERTIFICATE","Health Certificate",certId,1],
      ["SCO","SCO",comId,0],["FCO","FCO",comId,0],["SPA","SPA",comId,0],
      ["OTHER","Other",cusId,0],
    ].forEach(r => insDT.run(...r)))();
  }

  // Product catalog seed
  const insProd = db.prepare("INSERT OR IGNORE INTO product_catalog (code,name,category,unit) VALUES (?,?,?,?)");
  db.transaction(() => [
    ["CATTLE","Cattle / Bovine","LIVESTOCK","HEAD"],
    ["SHEEP_LAMB","Sheep & Lamb","LIVESTOCK","HEAD"],
    ["GOAT","Goat","LIVESTOCK","HEAD"],
    ["CAMEL","Camel","LIVESTOCK","HEAD"],
    ["BUFFALO","Buffalo","LIVESTOCK","HEAD"],
    ["POULTRY_LIVE","Live Poultry","POULTRY","HEAD"],
    ["POULTRY_FROZEN","Frozen Poultry","POULTRY","MT"],
    ["BEEF_FROZEN","Frozen Beef","MEAT","MT"],
    ["LAMB_FROZEN","Frozen Lamb","MEAT","MT"],
    ["SOYBEAN","Soybean","GRAINS","MT"],
    ["CORN","Corn / Maize","GRAINS","MT"],
    ["WHEAT","Wheat","GRAINS","MT"],
    ["RICE","Rice","GRAINS","MT"],
    ["SORGHUM","Sorghum","GRAINS","MT"],
    ["SOYBEAN_OIL","Soybean Oil","OILS","MT"],
    ["SUNFLOWER_OIL","Sunflower Oil","OILS","MT"],
    ["PALM_OIL","Palm Oil","OILS","MT"],
    ["OLIVE_OIL","Olive Oil","OILS","MT"],
    ["MILK_POWDER","Milk Powder","DAIRY","MT"],
    ["BUTTER","Butter","DAIRY","MT"],
    ["CHEESE","Cheese","DAIRY","MT"],
    ["SUGAR","Sugar","COMMODITIES","MT"],
    ["COFFEE","Coffee","COMMODITIES","MT"],
    ["COCOA","Cocoa","COMMODITIES","MT"],
    ["FISH_FROZEN","Frozen Fish","SEAFOOD","MT"],
    ["SHRIMP","Shrimp","SEAFOOD","MT"],
  ].forEach(r => insProd.run(...r)))();

  // Product Master seed — product-level codes used by the Media Resolver.
  // These mirror the `product` keys already produced by CommercialEngine.jsx
  // (PRODUCT_CATEGORIES[category].products) so no new field is required on
  // commercial_data rows — productCode = the existing row.product value.
  const insPM = db.prepare("INSERT OR IGNORE INTO product_master (product_code,category,name_es,name_en) VALUES (?,?,?,?)");
  db.transaction(() => [
    ["CATTLE","LIVE_ANIMALS","Bovinos","Cattle (Bovine)"],
    ["SHEEP","LIVE_ANIMALS","Ovinos","Sheep (Ovine)"],
    ["GOAT","LIVE_ANIMALS","Caprinos","Goat (Caprine)"],
    ["PALM_OIL","OILS","Aceite de Palma","Palm Oil"],
    ["SOYBEAN_OIL","OILS","Aceite de Soja","Soybean Oil"],
    ["SUNFLOWER_OIL","OILS","Aceite de Girasol","Sunflower Oil"],
    ["CORN_OIL","OILS","Aceite de Maíz","Corn Oil"],
    ["SOYBEANS","COMMODITIES","Soja en Grano","Soybeans"],
    ["CORN","COMMODITIES","Maíz Amarillo","Corn"],
    ["WHEAT","COMMODITIES","Trigo","Wheat"],
    ["OATS","COMMODITIES","Avena","Oats"],
    ["RICE","COMMODITIES","Arroz","Rice"],
    ["SUGAR","COMMODITIES","Azúcar Blanca","Sugar"],
  ].forEach(r => insPM.run(...r)))();

  // MEDIA_MANAGER permissions
  const insRP = db.prepare("INSERT OR IGNORE INTO role_permissions (role,module,action) VALUES (?,?,?)");
  db.transaction(() => [
    ["MEDIA_MANAGER","media","VIEW"],
    ["MEDIA_MANAGER","media","UPLOAD"],
    ["MEDIA_MANAGER","media","EDIT"],
    ["MEDIA_MANAGER","media","DELETE"],
    ["MEDIA_MANAGER","media","RESTORE"],
    ["MEDIA_MANAGER","media","EXPORT"],
    ["MEDIA_MANAGER","media","ARCHIVE"],
  ].forEach(r => insRP.run(...r)))();

  // Role groups seed
  const insRG = db.prepare("INSERT OR IGNORE INTO role_groups (code,name) VALUES (?,?)");
  db.transaction(() => [
    ["COMPLIANCE_TEAM","Compliance Team"],["OPERATIONS_TEAM","Operations Team"],
    ["FINANCE_TEAM","Finance Team"],["MANAGEMENT_TEAM","Management Team"],
  ].forEach(r => insRG.run(...r)))();

  // Country catalog seed (core trading countries for GLV)
  const insCC = db.prepare("INSERT OR IGNORE INTO country_catalog (code,name,name_es,region,subregion,latitude,longitude) VALUES (?,?,?,?,?,?,?)");
  db.transaction(() => [
    ["AE","United Arab Emirates","Emiratos Árabes Unidos","Middle East","Gulf Region",23.42,53.85],
    ["SA","Saudi Arabia","Arabia Saudita","Middle East","Gulf Region",23.89,45.08],
    ["EG","Egypt","Egipto","Africa","North Africa",26.82,30.80],
    ["CN","China","China","Asia","East Asia",35.86,104.20],
    ["NG","Nigeria","Nigeria","Africa","West Africa",9.08,8.68],
    ["BR","Brazil","Brasil","Americas","South America",-14.24,-51.93],
    ["AR","Argentina","Argentina","Americas","South America",-38.42,-63.62],
    ["AU","Australia","Australia","Oceania","Australasia",-25.27,133.78],
    ["US","United States","Estados Unidos","Americas","North America",37.09,-95.71],
    ["MX","Mexico","México","Americas","North America",23.63,-102.55],
    ["TR","Turkey","Turquía","Europe","South Europe",38.96,35.24],
    ["MA","Morocco","Marruecos","Africa","North Africa",31.79,-7.09],
    ["SN","Senegal","Senegal","Africa","West Africa",14.50,-14.45],
    ["CI","Côte d'Ivoire","Costa de Marfil","Africa","West Africa",7.54,-5.55],
    ["GH","Ghana","Ghana","Africa","West Africa",7.95,-1.02],
    ["KE","Kenya","Kenia","Africa","East Africa",-0.02,37.91],
    ["ZA","South Africa","Sudáfrica","Africa","Southern Africa",-30.56,22.94],
    ["ET","Ethiopia","Etiopía","Africa","East Africa",9.15,40.49],
    ["TZ","Tanzania","Tanzania","Africa","East Africa",-6.37,34.89],
    ["TH","Thailand","Tailandia","Asia","Southeast Asia",15.87,100.99],
    ["IN","India","India","Asia","South Asia",20.59,78.96],
    ["PK","Pakistan","Pakistán","Asia","South Asia",30.38,69.35],
    ["ID","Indonesia","Indonesia","Asia","Southeast Asia",-0.79,113.92],
    ["MY","Malaysia","Malasia","Asia","Southeast Asia",4.21,101.98],
    ["VN","Vietnam","Vietnam","Asia","Southeast Asia",14.06,108.28],
    ["DE","Germany","Alemania","Europe","Western Europe",51.17,10.45],
    ["FR","France","Francia","Europe","Western Europe",46.23,2.21],
    ["ES","Spain","España","Europe","Southern Europe",40.46,-3.75],
    ["GB","United Kingdom","Reino Unido","Europe","Northern Europe",55.38,-3.44],
    ["NL","Netherlands","Países Bajos","Europe","Western Europe",52.13,5.29],
    ["IT","Italy","Italia","Europe","Southern Europe",41.87,12.57],
    ["RU","Russia","Rusia","Europe","Eastern Europe",61.52,105.32],
    ["UA","Ukraine","Ucrania","Europe","Eastern Europe",48.38,31.17],
    ["IQ","Iraq","Irak","Middle East","Middle East",33.22,43.68],
    ["IR","Iran","Irán","Middle East","Middle East",32.43,53.69],
    ["JO","Jordan","Jordania","Middle East","Middle East",30.59,36.24],
    ["LB","Lebanon","Líbano","Middle East","Middle East",33.85,35.86],
    ["KW","Kuwait","Kuwait","Middle East","Gulf Region",29.31,47.48],
    ["QA","Qatar","Catar","Middle East","Gulf Region",25.35,51.18],
    ["BH","Bahrain","Baréin","Middle East","Gulf Region",26.00,50.55],
    ["OM","Oman","Omán","Middle East","Gulf Region",21.47,55.97],
    ["PH","Philippines","Filipinas","Asia","Southeast Asia",12.88,121.77],
    ["CO","Colombia","Colombia","Americas","South America",4.57,-74.30],
    ["CL","Chile","Chile","Americas","South America",-35.68,-71.54],
    ["PE","Peru","Perú","Americas","South America",-9.19,-75.02],
    ["UY","Uruguay","Uruguay","Americas","South America",-32.52,-55.77],
    ["PY","Paraguay","Paraguay","Americas","South America",-23.44,-58.44],
    ["BO","Bolivia","Bolivia","Americas","South America",-16.29,-63.59],
    ["EC","Ecuador","Ecuador","Americas","South America",-1.83,-78.18],
    ["CA","Canada","Canadá","Americas","North America",56.13,-106.35],
  ].forEach(r => insCC.run(...r)))();
}

// ─── COMMERCIAL INTELLIGENCE FOUNDATION V2 — FASE 0 seed ─────────────────────
function seedCommercialFoundationV2() {
  const existingGPR = db.prepare("SELECT COUNT(*) AS c FROM gpr_products").get().c;
  if (existingGPR > 0) return;

  // ── 1. Global Product Registry seed ─────────────────────────────────────────
  const insGPR = db.prepare(`
    INSERT OR IGNORE INTO gpr_products
      (product_code, category_code, subcategory_code, name_es, name_en, name_fr, name_zh, name_ar,
       hs_code, calc_mode, default_unit, container_capacity, moq_value, moq_unit,
       origin_countries, certifications, market_segments,
       reefer_required, frozen_required, cargo_type, shelf_life, migration_status, source_pm_code)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  db.transaction(() => {
    // Live Animals
    insGPR.run("CATTLE","LIVE_ANIMALS",null,"Bovinos","Cattle (Bovine)","Bétail bovin","牛","الماشية البقرية",
      "0102.29.00","live-animals","HEAD",null,100,"HEAD",
      '["Brazil","Australia","Colombia","Uruguay","Argentina"]',
      '["MAPA","Halal","Zoosanitario","SGS"]',
      '["General B2B","Institutional"]',
      0,0,"Live Animals","Según protocolo cuarentena","PENDING","CATTLE");
    insGPR.run("SHEEP","LIVE_ANIMALS",null,"Ovinos","Sheep (Ovine)","Moutons","绵羊","الأغنام",
      "0104.10.10","live-animals","HEAD",null,500,"HEAD",
      '["Brazil","Australia","New Zealand","Uruguay"]',
      '["MAPA","DAFF","Halal","Zoosanitario"]',
      '["General B2B","Institutional"]',
      0,0,"Live Animals","Según protocolo cuarentena","PENDING","SHEEP");
    insGPR.run("GOAT","LIVE_ANIMALS",null,"Caprinos","Goat (Caprine)","Chèvres","山羊","الماعز",
      "0104.20.10","live-animals","HEAD",null,200,"HEAD",
      '["Brazil","Australia","South Africa"]',
      '["MAPA","DAFF","Halal","Zoosanitario"]',
      '["General B2B","Institutional"]',
      0,0,"Live Animals","Según protocolo cuarentena","PENDING","GOAT");

    // Oils
    insGPR.run("PALM_OIL","OILS",null,"Aceite de Palma","Palm Oil","Huile de palme","棕榈油","زيت النخيل",
      "1511.90.00","bag-weight","MT",20,100,"MT",
      '["Colombia","Malaysia","Indonesia"]',
      '["Halal","RSPO","ISO"]',
      '["General B2B","Food Service","Institutional"]',
      0,0,"ISO Tank","18 meses","PENDING","PALM_OIL");
    insGPR.run("SOYBEAN_OIL","OILS",null,"Aceite de Soja","Soybean Oil","Huile de soja","大豆油","زيت فول الصويا",
      "1507.90.00","bag-weight","MT",20,100,"MT",
      '["Brazil","Argentina"]',
      '["MAPA","ANVISA","Halal","Kosher"]',
      '["General B2B","Food Service","Institutional"]',
      0,0,"ISO Tank","12 meses","PENDING","SOYBEAN_OIL");
    insGPR.run("SUNFLOWER_OIL","OILS",null,"Aceite de Girasol","Sunflower Oil","Huile de tournesol","葵花籽油","زيت عباد الشمس",
      "1512.19.00","bag-weight","MT",20,100,"MT",
      '["Argentina","Ukraine","Russia"]',
      '["SENASA","Halal","HACCP"]',
      '["General B2B","Food Service"]',
      0,0,"ISO Tank","12 meses","PENDING","SUNFLOWER_OIL");

    // Commodities
    insGPR.run("SOYBEANS","COMMODITIES",null,"Soja en Grano","Soybeans","Soja","大豆","فول الصويا",
      "1201.90.00","bag-weight","MT",27,1000,"MT",
      '["Brazil","Argentina","Paraguay"]',
      '["MAPA","ABIOVE"]',
      '["General B2B","Institutional"]',
      0,0,"Dry Cargo","6 meses en silo","PENDING","SOYBEANS");
    insGPR.run("CORN","COMMODITIES",null,"Maíz Amarillo","Corn (Yellow Maize)","Maïs jaune","黄玉米","الذرة الصفراء",
      "1005.90.10","bag-weight","MT",27,1000,"MT",
      '["Brazil","Argentina","USA","Paraguay"]',
      '["MAPA","USDA"]',
      '["General B2B","Institutional"]',
      0,0,"Dry Cargo","3 meses seco","PENDING","CORN");
    insGPR.run("RICE","COMMODITIES",null,"Arroz Blanco","White Rice","Riz blanc","白米","الأرز الأبيض",
      "1006.30.10","bag-weight","MT",27,100,"MT",
      '["India","Vietnam","Thailand","Pakistan"]',
      '["HACCP","FSSAI","Halal"]',
      '["General B2B","Institutional","Food Service"]',
      0,0,"Dry Cargo","12 meses","PENDING","RICE");
    insGPR.run("WHEAT","COMMODITIES",null,"Trigo","Wheat","Blé","小麦","القمح",
      "1001.99.00","bag-weight","MT",27,1000,"MT",
      '["Russia","Ukraine","USA","Canada","Australia"]',
      '["HACCP","Halal"]',
      '["General B2B","Institutional"]',
      0,0,"Dry Cargo","6 meses","PENDING","WHEAT");
    insGPR.run("SUGAR","COMMODITIES",null,"Azúcar Blanca IC-45","Sugar ICUMSA-45","Sucre blanc","白糖","السكر الأبيض",
      "1701.99.00","bag-weight","MT",27,1000,"MT",
      '["Brazil"]',
      '["MAPA","ISO","Halal","Kosher"]',
      '["General B2B","Food Service","Institutional"]',
      0,0,"Dry Cargo","24 meses","PENDING",null);

    // Fruit Products (not yet in product_master — new to registry)
    insGPR.run("MANGO","FRUIT_PRODUCTS",null,"Mango Tommy Atkins","Mango","Mangue","芒果","المانجو",
      "0804.50.00","packaging-weight","MT",18,2,"MT",
      '["Colombia","Brazil","Peru"]',
      '["GlobalG.A.P.","ICA"]',
      '["General B2B","Retail Distribution","Food Service"]',
      1,0,"Refrigerated Cargo","21 días cadena de frío","PENDING",null);
    insGPR.run("PINEAPPLE","FRUIT_PRODUCTS",null,"Piña MD2","Pineapple MD2","Ananas MD2","菠萝","الأناناس",
      "0804.30.00","packaging-weight","MT",15,2,"MT",
      '["Colombia","Costa Rica","Brazil"]',
      '["GlobalG.A.P.","Halal"]',
      '["General B2B","Retail Distribution","Food Service"]',
      1,0,"Refrigerated Cargo","21 días","PENDING",null);
    insGPR.run("PASSION_FRUIT","FRUIT_PRODUCTS",null,"Maracuyá / Maracujá","Passion Fruit","Fruit de la passion","百香果","فاكهة العاطفة",
      "0810.90.10","packaging-weight","MT",15,0.3,"MT",
      '["Colombia","Brazil","Ecuador"]',
      '["INVIMA","ICA","BPA"]',
      '["General B2B","Food Service","Institutional"]',
      0,0,"Refrigerated Cargo","30 días fresco / 12 meses pulpa","PENDING",null);
  })();

  // ── 2. Product Intelligence Profiles seed ───────────────────────────────────
  const insPI = db.prepare(`
    INSERT OR IGNORE INTO pi_profiles
      (product_code, executive_description, certification_profile, compliance_badges,
       timeline_min_days, timeline_max_days, timeline_notes,
       logistics_mode, logistics_notes, market_applications)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `);

  db.transaction(() => {
    insPI.run("CATTLE",
      "Bovinos vivos para exportación internacional. Operaciones de alto valor con requerimientos zoosanitarios estrictos y protocolos de bienestar animal.",
      '["MAPA","ADAPEC","Halal","SGS Inspection","Zoosanitario MAPA"]',
      '["LIVE_EXPORT","HALAL_CERTIFIED","SGS_VERIFIED"]',
      45,90,"Incluye cuarentena pre-embarque (21-45 días) + tiempo de tránsito marítimo","SEA",
      "Buques especializados para ganado vivo (livestock vessels). Requerimientos IMSBC y OIE.",
      '["Middle East","Southeast Asia","North Africa","West Africa"]');
    insPI.run("SHEEP",
      "Ovinos vivos para exportación. Alta demanda en mercados Halal del Oriente Medio y África. Principal especie exportada por GLV.",
      '["MAPA","DAFF","Halal Internacional","SGS","INAC"]',
      '["LIVE_EXPORT","HALAL_CERTIFIED","ESCAS_COMPLIANT"]',
      30,75,"Cuarentena 30-45 días (Brasil/Australia). Certificación SGS obligatoria.","SEA",
      "Livestock vessels con capacidad 5,000-20,000 cabezas. Sistemas de ventilación y alimentación a bordo.",
      '["Middle East","North Africa","West Africa","Southeast Asia"]');
    insPI.run("GOAT",
      "Caprinos vivos para exportación. Alta valoración en mercados Halal. Creciente demanda en Oriente Medio y Sudeste Asiático.",
      '["MAPA","DAFF","Halal","Zoosanitario"]',
      '["LIVE_EXPORT","HALAL_CERTIFIED"]',
      30,60,"Cuarentena mínima 21 días. Certificación veterinaria MAPA/DAFF.","SEA",
      "Transporte combinado con ovinos en la mayoría de operaciones.",
      '["Middle East","Southeast Asia","West Africa"]');
    insPI.run("PALM_OIL",
      "Aceite de palma RBD para uso industrial y alimentario. Producto fundamental en mercados de commodities. Alta liquidez global.",
      '["RSPO","ISO 9001","Halal","HACCP","FOSFA"]',
      '["RSPO_CERTIFIED","HALAL_CERTIFIED","HACCP"]',
      15,30,"Lead time desde confirmación de pedido hasta embarque FOB.","SEA",
      "ISO Tank 20ft o Flexitank. Temperatura controlada 35-40°C para mantener fluidez.",
      '["Food Processing","Oleochemicals","Biofuel","General Industrial"]');
    insPI.run("SOYBEAN_OIL",
      "Aceite de soja degomado y refinado. Sustituto competitivo del aceite de palma. Alta demanda en mercados regulados.",
      '["MAPA","ANVISA","Halal","Kosher","FOSFA","HACCP"]',
      '["HALAL_CERTIFIED","KOSHER_CERTIFIED","HACCP"]',
      15,25,"Producción y embarque desde Brasil/Argentina. Spot o contrato.","SEA",
      "ISO Tank o Flexitank. Sin restricciones de temperatura en destinos templados.",
      '["Food Processing","Food Service","Industrial","Retail"]');
    insPI.run("SUNFLOWER_OIL",
      "Aceite de girasol refinado alto oleico y estándar. Alta demanda en Europa y Oriente Medio. Origen principal Argentina y Ucrania.",
      '["SENASA","USDA","Halal","HACCP","FOSFA"]',
      '["HALAL_CERTIFIED","HACCP"]',
      15,30,"Spot o forward. Sensible a temporada de cosecha.","SEA",
      "ISO Tank o Flexitank. Alta oleico no requiere temperatura controlada.",
      '["Food Processing","Food Service","Retail","Industrial"]');
    insPI.run("SOYBEANS",
      "Soja en grano GMO y Non-GMO. Commodity de alto volumen. Principal proteína vegetal para industria de alimentos balanceados.",
      '["MAPA","ABIOVE","CAS","HACCP","Non-GMO Verified"]',
      '["PHYTOSANITARY","GRAIN_CERTIFIED"]',
      10,20,"Disponibilidad según cosecha. Principales temporadas: Brasil mar-jul, Argentina abr-ago.","SEA",
      "Granel en bulk carriers o contenedores 20ft con flexi-bag.",
      '["Animal Feed","Crushing Industry","Food Processing","Biofuel"]');
    insPI.run("CORN",
      "Maíz amarillo No.2 CBOT standard. Commodity de alto volumen. Principal cereal para pienso animal y etanol.",
      '["MAPA","USDA","SENASA","HACCP"]',
      '["PHYTOSANITARY","GRAIN_CERTIFIED"]',
      10,20,"Disponibilidad todo el año. Cosecha Brasil feb-jul, Argentina abr-sep.","SEA",
      "Granel en bulk carriers o contenedores 20ft.",
      '["Animal Feed","Ethanol","Starch Industry","Food Processing"]');
    insPI.run("RICE",
      "Arroz blanco 5% broken. Producto de alta demanda en mercados de Africa, Oriente Medio y Asia. Multiple origins disponibles.",
      '["HACCP","FSSAI","Halal","Kosher","USDA"]',
      '["HALAL_CERTIFIED","PHYTOSANITARY"]',
      15,30,"Disponibilidad permanente desde múltiples orígenes.","SEA",
      "Sacos 50kg paletizados o Big Bags 1MT. FCL o LCL según volumen.",
      '["Institutional","Food Service","Retail","Humanitarian Aid"]');
    insPI.run("MANGO",
      "Mango Tommy Atkins y Keitt de exportación. Fruta tropical de alta demanda en mercados premium de Europa y Asia.",
      '["GlobalG.A.P.","ICA Fitosanitario","BPA","HACCP"]',
      '["GLOBALGAP_CERTIFIED","PHYTOSANITARY"]',
      7,21,"Temporada principal Colombia nov-mar. Lead time desde empaque hasta destino.","SEA",
      "Cadena de frío continua 7-12°C. Reefer containers 40ft REEFER.",
      '["Premium Retail","Food Service","Processing Industry"]');
    insPI.run("PINEAPPLE",
      "Piña MD2 Gold de exportación. Variedad de alta dulzura y bajo contenido de ácidos. Lider en mercados premium globales.",
      '["GlobalG.A.P.","HACCP","BRC","ICA"]',
      '["GLOBALGAP_CERTIFIED","PHYTOSANITARY"]',
      7,21,"Producción todo el año desde Colombia y Costa Rica.","SEA",
      "Reefer containers 40ft. Temperatura 7-10°C durante tránsito.",
      '["Premium Retail","Food Service","Processing"]');
    insPI.run("PASSION_FRUIT",
      "Maracuyá fresco y pulpa IQF. Fruta tropical de alta demanda en industria de bebidas y mercados premium. Colombia es principal exportador regional.",
      '["INVIMA","ICA Fitosanitario","BPA","HACCP"]',
      '["PHYTOSANITARY","HACCP"]',
      7,30,"Fresco: 7-14 días. Pulpa IQF: disponibilidad permanente.","SEA",
      "Fresco en reefer; pulpa IQF en frozen containers -18°C.",
      '["Beverage Industry","Food Service","Premium Retail","Industrial"]');
  })();

  // ── 3. Commercial Rules seed (from PaymentTermsRegistry.js) ─────────────────
  const insCR = db.prepare(`
    INSERT OR IGNORE INTO cr_rules
      (rule_code, rule_type, category_scope, product_scope, min_volume, max_volume, rule_config, priority)
    VALUES (?,?,?,?,?,?,?,?)
  `);

  db.transaction(() => {
    // Payment tiers — all categories except LIVE_ANIMALS
    insCR.run("PAY_TT_100","PAYMENT","ALL","ALL",null,999.99,
      JSON.stringify({
        code:"PAY-TT-100",label:"100% T/T Advance",instruments:[{type:"TT",pct:100,timing:"before_shipment"}],
        description:"Pago total por transferencia bancaria antes del embarque",
        applies_when:"volume < 1000 MT"
      }),10);
    insCR.run("PAY_5050_TT","PAYMENT","ALL","ALL",1000,12499.99,
      JSON.stringify({
        code:"PAY-5050-TT",label:"50% TT + 50% on BL",instruments:[{type:"TT",pct:50,timing:"before_shipment"},{type:"TT",pct:50,timing:"on_bl"}],
        description:"50% anticipo TT + 50% contra BL",
        applies_when:"1000 MT ≤ volume < 12500 MT"
      }),20);
    insCR.run("PAY_3070_SBLC","PAYMENT","ALL","ALL",12500,null,
      JSON.stringify({
        code:"PAY-3070-SBLC",label:"30% TT + 70% SBLC",instruments:[{type:"TT",pct:30,timing:"before_shipment"},{type:"SBLC",pct:70,timing:"on_delivery"}],
        description:"30% TT anticipo + 70% SBLC a la vista",
        applies_when:"volume ≥ 12500 MT"
      }),30);

    // Live Animals specific payment terms
    insCR.run("PAY_AV_1","PAYMENT","LIVE_ANIMALS","ALL",null,null,
      JSON.stringify({
        code:"PAGO-AV-1",label:"70% TT + 30% SBLC (Live Animals Standard)",
        instruments:[{type:"TT",pct:70,timing:"before_shipment"},{type:"SBLC",pct:30,timing:"on_arrival"}],
        description:"Estándar para exportación animales vivos",
        applies_when:"default for LIVE_ANIMALS"
      }),10);
    insCR.run("PAY_AV_2","PAYMENT","LIVE_ANIMALS","ALL",null,null,
      JSON.stringify({
        code:"PAGO-AV-2",label:"100% SBLC (Live Animals Sovereign Buyer)",
        instruments:[{type:"SBLC",pct:100,timing:"on_loading"}],
        description:"Para compradores soberanos o estatales. SBLC 100% al cargar.",
        applies_when:"sovereign or state buyer"
      }),20);
    insCR.run("PAY_AV_3","PAYMENT","LIVE_ANIMALS","ALL",null,null,
      JSON.stringify({
        code:"PAGO-AV-3",label:"50% TT + 50% on Arrival (Live Animals Trusted)",
        instruments:[{type:"TT",pct:50,timing:"before_shipment"},{type:"TT",pct:50,timing:"on_arrival"}],
        description:"Para contrapartes con historial verificado. Requiere aprobación DIRECTOR.",
        applies_when:"trusted counterparty with verified track record"
      }),30);

    // Pricing governance rules (from PricingGovernanceRegistry.js)
    insCR.run("PRICE_MARGIN_AGENTE","PRICING","ALL","ALL",null,null,
      JSON.stringify({
        code:"MARGIN-AGENTE",min_margin_pct:3,max_margin_pct:8,
        description:"Margen comercial estándar para AGENTE",
        requires_approval_above_pct:8
      }),100);
    insCR.run("PRICE_MARGIN_DIRECTOR","PRICING","ALL","ALL",null,null,
      JSON.stringify({
        code:"MARGIN-DIRECTOR",min_margin_pct:1,max_margin_pct:15,
        description:"Margen extendido para DIRECTOR y superiores",
        requires_approval_above_pct:15
      }),90);
    insCR.run("PRICE_INCOTERM_DEFAULT","INCOTERM","ALL","ALL",null,null,
      JSON.stringify({
        code:"INCOTERM-DEFAULT",default:"CFR",
        allowed:["FOB","CFR","CIF","DDP","DAP","FAS"],
        live_animals_allowed:["FOB"],
        description:"Incoterms permitidos por tipo de producto"
      }),100);
  })();

  // ── 4. Document Intelligence Requirements seed ───────────────────────────────
  const insDI = db.prepare(`
    INSERT OR IGNORE INTO di_requirements
      (req_code, category_code, product_scope, req_type, req_key,
       req_label_es, req_label_en, is_mandatory, validation_rule, pdf_section, display_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `);

  db.transaction(() => {
    // ── LIVE_ANIMALS required fields ───────────────────────────────────────────
    insDI.run("LA_HEADCOUNT","LIVE_ANIMALS","ALL","FIELD","headcount",
      "Número de Cabezas","Number of Heads",1,
      JSON.stringify({type:"integer",min:1}),"commercial_table",10);
    insDI.run("LA_AVG_WEIGHT","LIVE_ANIMALS","ALL","FIELD","avg_weight",
      "Peso Promedio (kg)","Average Weight (kg)",1,
      JSON.stringify({type:"number",min:0.1}),"commercial_table",20);
    insDI.run("LA_PRICE_KG","LIVE_ANIMALS","ALL","FIELD","price_per_kg",
      "Precio por KG (USD)","Price per KG (USD)",1,
      JSON.stringify({type:"number",min:0.01}),"commercial_table",30);
    insDI.run("LA_SPECIES","LIVE_ANIMALS","ALL","FIELD","product",
      "Especie","Species",1,
      JSON.stringify({type:"string",allowed:["CATTLE","SHEEP","GOAT"]}),"commercial_table",40);
    insDI.run("LA_VET_CERT","LIVE_ANIMALS","ALL","COMPLIANCE","vet_certificate",
      "Certificado Zoosanitario","Veterinary Certificate",1,
      JSON.stringify({type:"document",issuer:"MAPA/DAFF/SENASA"}),"compliance_section",50);
    insDI.run("LA_QUARANTINE","LIVE_ANIMALS","ALL","COMPLIANCE","quarantine_protocol",
      "Protocolo de Cuarentena","Quarantine Protocol",1,
      JSON.stringify({type:"document",min_days:21}),"compliance_section",60);
    insDI.run("LA_HALAL","LIVE_ANIMALS","ALL","COMPLIANCE","halal_certificate",
      "Certificado Halal","Halal Certificate",0,
      JSON.stringify({type:"document",issuer:"accredited_halal_body"}),"compliance_section",70);
    insDI.run("LA_PDF_LIVESTOCK","LIVE_ANIMALS","ALL","PDF_SECTION","livestock_section",
      "Sección Ganado Vivo en PDF","Livestock Section in PDF",1,
      null,"live_animals_block",80);

    // ── OILS required fields ───────────────────────────────────────────────────
    insDI.run("OIL_VOLUME","OILS","ALL","FIELD","quantity_mt",
      "Volumen (MT)","Volume (MT)",1,
      JSON.stringify({type:"number",min:20}),"commercial_table",10);
    insDI.run("OIL_PRICE_MT","OILS","ALL","FIELD","price_per_mt",
      "Precio por MT (USD)","Price per MT (USD)",1,
      JSON.stringify({type:"number",min:0.01}),"commercial_table",20);
    insDI.run("OIL_FFA","OILS","ALL","FIELD","ffa_max",
      "Acidez Libre Máx (FFA %)","Max Free Fatty Acid (FFA %)",1,
      JSON.stringify({type:"number",max:0.5}),"quality_specs",30);
    insDI.run("OIL_TRANSPORT","OILS","ALL","FIELD","transport_mode",
      "Modalidad de Transporte","Transport Mode",1,
      JSON.stringify({type:"string",allowed:["ISO Tank","Flexitank","Bulk Tanker"]}),"logistics_section",40);
    insDI.run("OIL_HALAL","OILS","ALL","COMPLIANCE","halal_certificate",
      "Certificado Halal","Halal Certificate",0,
      JSON.stringify({type:"document"}),"compliance_section",50);

    // ── COMMODITIES (grains/sugar) required fields ─────────────────────────────
    insDI.run("COM_VOLUME","COMMODITIES","ALL","FIELD","quantity_mt",
      "Volumen (MT)","Volume (MT)",1,
      JSON.stringify({type:"number",min:100}),"commercial_table",10);
    insDI.run("COM_PRICE_MT","COMMODITIES","ALL","FIELD","price_per_mt",
      "Precio por MT (USD)","Price per MT (USD)",1,
      JSON.stringify({type:"number",min:0.01}),"commercial_table",20);
    insDI.run("COM_MOISTURE","COMMODITIES","ALL","FIELD","moisture_max",
      "Humedad Máxima (%)","Max Moisture (%)",1,
      JSON.stringify({type:"number",max:15}),"quality_specs",30);
    insDI.run("COM_PHYTO","COMMODITIES","ALL","COMPLIANCE","phytosanitary_certificate",
      "Certificado Fitosanitario","Phytosanitary Certificate",1,
      JSON.stringify({type:"document",issuer:"national_agri_authority"}),"compliance_section",40);
    insDI.run("COM_SUGAR_ICUMSA","COMMODITIES","SUGAR","FIELD","icumsa_grade",
      "Grado ICUMSA","ICUMSA Grade",1,
      JSON.stringify({type:"string",allowed:["ICUMSA-45","ICUMSA-100","ICUMSA-150"]}),"quality_specs",50);
    insDI.run("COM_SOY_GMO","COMMODITIES","SOYBEANS","FIELD","gmo_status",
      "Estado OGM","GMO Status",1,
      JSON.stringify({type:"string",allowed:["GMO","Non-GMO IP"]}),"quality_specs",60);

    // ── FRUIT_PRODUCTS required fields ─────────────────────────────────────────
    insDI.run("FP_VOLUME","FRUIT_PRODUCTS","ALL","FIELD","quantity_mt",
      "Volumen (MT)","Volume (MT)",1,
      JSON.stringify({type:"number",min:0.3}),"commercial_table",10);
    insDI.run("FP_PRICE_MT","FRUIT_PRODUCTS","ALL","FIELD","price_per_mt",
      "Precio por MT (USD)","Price per MT (USD)",1,
      JSON.stringify({type:"number",min:0.01}),"commercial_table",20);
    insDI.run("FP_COLD_CHAIN","FRUIT_PRODUCTS","ALL","COMPLIANCE","cold_chain_cert",
      "Cadena de Frío Certificada","Cold Chain Certificate",1,
      JSON.stringify({type:"document"}),"logistics_section",30);
    insDI.run("FP_GLOBALGAP","FRUIT_PRODUCTS","ALL","COMPLIANCE","globalgap_certificate",
      "Certificación GlobalG.A.P.","GlobalG.A.P. Certificate",0,
      JSON.stringify({type:"document"}),"compliance_section",40);
    insDI.run("FP_PHYTO","FRUIT_PRODUCTS","ALL","COMPLIANCE","phytosanitary_certificate",
      "Certificado Fitosanitario","Phytosanitary Certificate",1,
      JSON.stringify({type:"document"}),"compliance_section",50);

    // ── ALL categories — standard commercial fields ─────────────────────────────
    insDI.run("ALL_INCOTERM","ALL","ALL","FIELD","incoterm",
      "Incoterm","Incoterm",1,
      JSON.stringify({type:"string",allowed:["FOB","CFR","CIF","DDP","DAP","FAS"]}),"header",10);
    insDI.run("ALL_CURRENCY","ALL","ALL","FIELD","currency",
      "Moneda","Currency",1,
      JSON.stringify({type:"string",allowed:["USD","EUR","AED","CNY"]}),"header",20);
    insDI.run("ALL_ORIGIN","ALL","ALL","FIELD","origin",
      "País de Origen","Country of Origin",1,
      JSON.stringify({type:"string",minLength:2}),"header",30);
    insDI.run("ALL_DESTINATION","ALL","ALL","FIELD","destination",
      "País de Destino","Destination Country",1,
      JSON.stringify({type:"string",minLength:2}),"header",40);
    insDI.run("ALL_PAYMENT","ALL","ALL","FIELD","payment_method",
      "Condiciones de Pago","Payment Terms",1,
      JSON.stringify({type:"string"}),"commercial_table",50);
  })();

  console.log("✓ Commercial Intelligence Foundation V2 (FASE 0) seed completed");
}
