# GLV-Connect — System Recovery & Production Operations Guide
**Platform:** GLV SAT v3 | **Stable baseline:** `stable-production-v1` @ `fbe516d`

---

## 1. Architecture

```
Repository:   thegroupfenix-bot/misaelvalencia-
Production:   Railway (auto-deploy from main)
Frontend:     React 18 + Vite — built during Railway deploy, served as static files
Backend:      Node.js 20 + Express — Railway service
Database:     SQLite (better-sqlite3) — persisted in Railway volume
Media/CDN:    Cloudflare R2 (S3-compatible object storage)
```

### Directory structure
```
glv-connect/
├── backend/          ← Railway Root Directory (set this in Railway settings)
│   ├── server.js     ← entry point: node server.js
│   ├── nixpacks.toml ← full build pipeline (frontend + backend)
│   ├── railway.toml  ← Railway deploy config (healthcheck, restart policy)
│   ├── public/       ← frontend build output (created during deploy, NOT in git)
│   └── db/
│       └── glvconnect.sqlite ← production database (NOT in git)
└── frontend/
    └── src/          ← React source — built by nixpacks.toml, NOT deployed separately
```

---

## 2. Railway Configuration

### Required settings (Railway dashboard → Service → Settings)

| Setting | Value |
|---|---|
| **Root Directory** | `glv-connect/backend` |
| **Builder** | Nixpacks (auto-detected from `nixpacks.toml`) |
| **Start Command** | `node server.js` (set in `railway.toml`) |
| **Health Check Path** | `/health` |
| **Health Check Timeout** | 30s |
| **Restart Policy** | On Failure, max 5 retries |

### Required environment variables (Railway dashboard → Service → Variables)

```
PORT                = (set by Railway automatically)
JWT_SECRET          = (long random string, min 32 chars — NEVER expose)
JWT_EXPIRES_IN      = 8h
DB_PATH             = ./db/glvconnect.sqlite
SMTP_HOST           = smtp.gmail.com
SMTP_PORT           = 587
SMTP_USER           = notificaciones@glvservicesexp.com
SMTP_PASS           = (Gmail app password)
MAIL_FROM           = "GLV-Connect <notificaciones@glvservicesexp.com>"
MAIL_TO             = contabilidad@glvservicesexp.com
CLIENT_ORIGIN       = https://misaelvalencia-production.up.railway.app
R2_ACCESS_KEY_ID    = (Cloudflare R2 key)
R2_SECRET_ACCESS_KEY= (Cloudflare R2 secret)
R2_BUCKET           = (R2 bucket name)
R2_ENDPOINT         = (R2 endpoint URL)
R2_PUBLIC_URL       = (R2 public URL prefix)
VITE_API_URL        = https://misaelvalencia-production.up.railway.app
```

---

## 3. Deployment Process (Normal)

Every push to `main` triggers an automatic Railway redeploy.

**Build sequence (defined in `nixpacks.toml`):**
```
1. npm install                              (backend dependencies)
2. npm rebuild better-sqlite3              (native SQLite for current Node)
3. cd ../frontend && npm ci && npm run build  (Vite frontend build)
4. mkdir -p public && cp -r ../frontend/dist/. public/  (copy to backend/public/)
5. node server.js                          (start production server)
```

**To trigger a manual redeploy:**
- Railway dashboard → Service → Deployments → Redeploy latest

---

## 4. Rollback Procedure

### Option A — GitHub rollback (recommended)

1. Go to: https://github.com/thegroupfenix-bot/misaelvalencia-
2. Navigate to the `stable-production-v1` branch
3. Open a PR: `stable-production-v1` → `main`
4. Title: `hotfix: rollback to stable-production-v1`
5. Merge PR → Railway auto-deploys

### Option B — Railway rollback (instant, no code change)

1. Railway dashboard → Service → Deployments
2. Find the last known-good deployment
3. Click "Redeploy" on that specific deployment
4. Railway will serve the previous image immediately

### Option C — Git force-reset (emergency only)

```bash
git fetch origin
git checkout main
git reset --hard stable-production-v1
git push origin main --force
```
⚠️ This rewrites main history. Use only in critical emergencies.

---

## 5. Stable Branch Policy

### `stable-production-v1`
- **Frozen at:** commit `fbe516d` (all PRs #39–#42 merged)
- **Purpose:** emergency recovery baseline
- **Rule:** NEVER commit directly to this branch
- **Use:** source for rollback PRs only

### Active development branches
```
feature/*    new capabilities
fix/*        bug fixes
staging/*    pre-production validation
hotfix/*     emergency production patches
```

All branches must target `main` via PR. No direct pushes to `main`.

---

## 6. Manual Merge Process

**No PR may be auto-merged.** Every merge requires:

1. CI checks pass (GitHub Actions `validate-pr.yml`):
   - Critical file guard
   - Frontend build succeeds
   - Backend dependencies install
2. Manual validation by account owner (checklist in PR template)
3. Manual merge via GitHub PR interface

**To merge a PR:**
1. Open the PR on GitHub
2. Complete the pre-merge checklist in the PR description
3. Verify all CI checks are green
4. Click "Merge pull request" manually
5. Confirm merge
6. Monitor Railway deploy log

---

## 7. SQLite Database Backup

### Manual backup via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Copy database from production volume
railway run --service <service-name> \
  cp /app/db/glvconnect.sqlite /tmp/backup-$(date +%Y%m%d).sqlite

# Download (via railway shell or volume mount)
railway shell
```

### Automated backup (recommended setup)

The backend exposes `POST /backup/create` (admin only) which creates a timestamped SQLite copy. Schedule via:
1. Railway Cron Service (if available)
2. External cron calling the backup endpoint with admin token

### Restore from backup

```bash
railway shell
cp /tmp/backup-YYYYMMDD.sqlite /app/db/glvconnect.sqlite
# Restart the service to reload the database
```

---

## 8. Critical File Reference

Modifications to these files require full validation before merge:

| File | What it controls | Risk |
|---|---|---|
| `CommercialEngine.jsx` | Form state, pricing engine, headcount/weight | Commercial totals |
| `GlvPDF.jsx` | PDF rendering, all document sections | Document accuracy |
| `calculations.js` | Shipment/contract math | Financial calculations |
| `App.jsx` | Destination/port state, form flow | State contamination |
| `mediaAutoBinding.js` | Image binding pipeline | PDF media |
| `server.js` | API routing, static file serving | Full service |
| `database.js` | Schema migrations, seed data | Data integrity |
| `documents.js` | Document CRUD, filters | Data persistence |
| `nixpacks.toml` | Railway build pipeline | Deploy success |
| `railway.toml` | Health check, restart policy | Deploy stability |

---

## 9. Health Check

**Endpoint:** `GET /health`

**Expected response:**
```json
{ "ok": true, "ts": "2026-05-22T...", "build": "2026-05-22T...", "db": { ... } }
```

If `/health` returns non-200 or `ok: false`, check:
1. Railway deploy logs for startup errors
2. SQLite file path (`DB_PATH` env var)
3. `JWT_SECRET` is set
4. `node_modules` rebuilt correctly (`better-sqlite3` native)

---

## 10. Emergency Contacts & Repositories

- **Production URL:** https://misaelvalencia-production.up.railway.app
- **Repository:** https://github.com/thegroupfenix-bot/misaelvalencia-
- **Stable baseline:** https://github.com/thegroupfenix-bot/misaelvalencia-/tree/stable-production-v1
- **Railway dashboard:** https://railway.app (login required)
