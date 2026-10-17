# Auditoría Técnica y Funcional Integral — GLV GOS
**Fecha:** 2026-10-17  
**Alcance:** Repositorio `thegroupfenix-bot/misaelvalencia-` rama `main`  
**Propósito:** Estado real de GLV GOS antes de construir el sistema corporativo completo de GLV Services S.A.S., GLV Global Food Services LLC y demás entidades del grupo.  
**Clasificación:** CONFIDENCIAL — no contiene secretos, tokens ni contraseñas.

---

## 1. Resumen Ejecutivo

GLV GOS es un portal corporativo interno construido sobre Node.js + Express + SQLite + React 18 desplegado en Railway. El sistema tiene una base funcional sólida para la gestión comercial (documentos SCO/FCO/SPA, operaciones de exportación, CRM/KYC de clientes, gestión de medios R2), pero presenta brechas críticas antes de poder considerarse un sistema corporativo completo para múltiples entidades legales.

**Lo que funciona hoy:**
- Autenticación JWT con roles, acceso por nivel, RBAC
- Generación de documentos comerciales (SCO, FCO, SPA) con motor de precios
- Pipeline KYC de clientes con flujo de aprobación
- Módulo de operaciones de exportación (ciclo de vida DRAFT→COMPLETED)
- DAM (Digital Asset Management) con R2 / Cloudflare
- Backups automáticos diarios a R2
- Motor PDF para documentos comerciales ejecutivos
- Portal web público (`index.html` + páginas de productos)

**Lo que NO existe:**
- Sistema contable real (facturas, cuentas por cobrar/pagar, pagos, bancos, conciliación, impuestos, libro diario, centros de costo, presupuestos, tasas de cambio, cierres de periodo)
- Integración DIAN — ninguna factura electrónica colombiana
- Tests automatizados (cero pruebas en frontend ni backend)
- Recuperación de backup por API (manual)
- Soporte multi-entidad legal en la base de datos (una sola instancia sin particionamiento por entidad)
- Código permanente único de cliente generado automáticamente al activar (glv_code es editable, no autogenerado)
- Multi-factor authentication
- Bloqueo por intentos fallidos de login
- Revocación de tokens JWT

---

## 2. Inventario de Archivos y Estructura

### Backend (`glv-connect/backend/`)
```
server.js                    — Entry point, CORS, healthcheck, SPA fallback
db/database.js               — Migraciones SQLite, semilla inicial
middleware/auth.js           — Verificación JWT Bearer
middleware/rbac.js           — requireLevel, requireRole, requireAdmin, requireDirector
middleware/rateLimiter.js    — Rate limiter en memoria
routes/auth.js               — Login, /me, cambio de contraseña
routes/admin.js              — CRUD usuarios (SUPER_ADMIN/CORPORATE_ADMIN)
routes/users.js              — Listado y activación (DIRECTIVO)
routes/clients.js            — CRM completo + KYC pipeline
routes/documents.js          — Documentos SCO/FCO/SPA
routes/operations.js         — Operaciones de exportación
routes/finance.js            — Dashboard financiero (agregaciones)
routes/tasks.js              — Gestión de tareas
routes/price-center.js       — Catálogo de productos y precios
routes/media.js              — DAM / Digital Asset Management
routes/audit.js              — Log de auditoría
routes/backup.js             — Control de backups R2
routes/profile.js            — Perfil de agente
routes/images.js             — Librería de imágenes (Google Drive legacy)
services/backup.js           — Scheduler de backup diario
services/mediaBinding.js     — Binding automático medios↔documentos
storage/r2.js                — Adaptador Cloudflare R2
utils/email.js               — Notificaciones SMTP
utils/piiCrypto.js           — AES-256-GCM para datos PII
ai/classifier.js             — Clasificación automática de medios (Claude API)
```

### Frontend (`glv-connect/frontend/src/`)
```
App.jsx                      — Shell principal, routing por estado, control de acceso
api.js                       — Cliente HTTP centralizado (axios/fetch)
components/CommercialEngine.jsx  — Motor de cotización (frontend-only)
components/FinanceView.jsx   — Dashboard financiero
components/ClientDetailPage.jsx  — Expediente 360° cliente
components/GosLeadsPanel.jsx — Pipeline KYC
components/AdminUsers.jsx    — Gestión de usuarios
components/MediaCenter.jsx   — DAM visual
components/TasksView.jsx     — Gestión de tareas
components/GlvPDF.jsx        — Generador PDF ejecutivo
core/finance/                — Registros estáticos (frontend-only, sin API)
financial/reconciliation/    — Stub de conciliación (sin implementar)
engines/                     — Motores de cálculo por categoría (frontend-only)
agents/                      — Validadores de auditoría y PDF (frontend-only)
```

---

## 3. Infraestructura

### 3.1 Railway

| Parámetro | Valor | Estado |
|-----------|-------|--------|
| Builder | Dockerfile (root `railway.toml`) | ✅ Configurado |
| Start command | `node server.js` | ✅ |
| Puerto | 8080 (env `PORT`) | ✅ |
| Healthcheck | `GET /health` (timeout 120s) | ✅ |
| Restart policy | ON_FAILURE, max 5 reintentos | ✅ |
| SQLite persistencia | Volumen Railway `/data/` | ✅ Requerido |
| `NODE_ENV` | Debe ser `production` | ✅ Configurado recientemente |
| `JWT_SECRET` | Variable de entorno propia | ✅ Configurado recientemente |
| `CLIENT_ORIGIN` | Usado como fallback de ALLOWED_ORIGINS | ✅ Ya configurado |
| `ALLOWED_ORIGINS` | Opcional (CLIENT_ORIGIN funciona de respaldo) | ⚠️ Opcional pero recomendado |

**Nota:** Se detectó en la sesión actual que Railway arrojaba "Not Found" porque el servidor hacía `process.exit(1)` cuando `JWT_SECRET` no estaba configurado. Esto fue corregido y desplegado (PR #132, fusionado).

### 3.2 Dockerfile

```
Stage 1: node:20 — build frontend Vite (VITE_API_URL="")
Stage 2: node:20 — instala backend, copia frontend dist → backend/public/
```

El frontend compilado queda embebido en el servidor Node.js. La URL base del API es relativa (`""`), lo que significa que el frontend llama al mismo dominio Railway. Correcto para producción.

**Existe una URL hardcodeada en `api.js`:**
```js
const BASE = import.meta.env.VITE_API_URL || "https://misaelvalencia-production.up.railway.app"
```
Esto es un fallback seguro para desarrollo local, pero debe mantenerse sincronizado si el dominio Railway cambia.

### 3.3 SQLite y persistencia

- Motor: `better-sqlite3 v9.4.3` (síncrono, WAL mode recomendado)
- Archivo: `/data/glvconnect.sqlite` (Railway Volume) o `DB_PATH` env
- Migraciones: `safeAlter` additive — no versionadas, no transaccionales entre sí
- Sin WAL explícito configurado en `database.js` — Railway puede interrumpir escrituras en restart
- **Riesgo para producción financiera multiusuario:** SQLite tiene concurrencia limitada; múltiples escritores simultáneos degradan el rendimiento

### 3.4 Estado de la URL pública

URL activa: `https://misaelvalencia-production.up.railway.app`  
Healthcheck: `GET /health` devuelve `{ok: true, ts, build, db: {media_assets, users}}`  
El portal responde correctamente tras la corrección del hotfix (PR #132).

---

## 4. Autenticación y Usuarios

### 4.1 Roles y niveles de acceso

| Rol | Nivel | Descripción |
|-----|-------|-------------|
| SUPER_ADMIN | 100 | Control total |
| CORPORATE_ADMIN | 90 | Administración corporativa |
| CFO | 80 | Director financiero |
| DIRECTOR | 75 | Director ejecutivo |
| DIRECTIVO | 75 | Directivo (equivalente a DIRECTOR) |
| COMMERCIAL_DIRECTOR | 70 | Director comercial |
| COMPLIANCE | 65 | Cumplimiento y KYC |
| ACCOUNTING | 60 | Contabilidad |
| TREASURY | 60 | Tesorería |
| AUDIT | 55 | Auditoría |
| TAX_REVIEWER | 50 | Revisor fiscal |
| COUNTRY_ACCOUNTANT | 50 | Contador país |
| LOGISTICS | 45 | Logística |
| AGENTE | 40 | Agente comercial |
| MEDIA_MANAGER | 35 | Gestor de medios |
| CLIENT | 20 | Cliente externo |
| SUPPLIER | 20 | Proveedor externo |

### 4.2 Protección de rutas — backend

| Ruta | Método | Nivel requerido |
|------|--------|----------------|
| `/auth/login` | POST | Público |
| `/clients/kyc` | POST | Público (rate-limited) |
| `/auth/me` | GET | Autenticado |
| `/documents/` | GET/POST | Level 40+ |
| `/clients/` | GET | Autenticado |
| `/clients/leads` | GET | Level 65+ |
| `/clients/:id/kyc-status` | PATCH | Level 65+ |
| `/clients/:id/archive` | PATCH | Level 75+ |
| `/clients/:id` | DELETE | Level 100 |
| `/audit/` | GET | Multi-rol (ver §4.4) |
| `/finance/` | GET | Level 50+ |
| `/admin/users` | GET/POST | Level 90+ |
| `/backup/run` | POST | Level 90+ |
| `/media/upload` | POST | Autenticado + rol media |

### 4.3 Contraseñas y sesiones

| Característica | Estado | Notas |
|---------------|--------|-------|
| Hash bcrypt | ✅ Implementado | `bcryptjs` |
| Longitud mínima login | ✅ 8 caracteres | `auth.js` |
| Longitud mínima reset admin | ⚠️ 6 caracteres | `admin.js` — discrepancia |
| Primer acceso (first_login) | ✅ Fuerza cambio de contraseña | Frontend bloquea navegación |
| Cambio de contraseña | ✅ Implementado | Verifica contraseña actual (excepto first_login) |
| Recuperación por correo | ❌ No implementado | No existe flujo de reset por email |
| Vencimiento de sesión | ✅ JWT 8h | `JWT_EXPIRES_IN=8h` |
| Cierre de sesión | ⚠️ Parcial | Frontend borra localStorage; token sigue válido en servidor |
| Revocación de token | ❌ No implementado | No hay blocklist de tokens |
| Bloqueo por intentos fallidos | ❌ No implementado | Sin contador de intentos |
| Rate limit en login | ❌ No implementado | `apiLimiter` exportado pero no aplicado en `/auth/login` |
| MFA | ❌ No implementado | |
| Token en localStorage | ⚠️ Riesgo XSS | Recomendado: HttpOnly cookie |

### 4.4 Registro de accesos y auditoría

- `audit_log` registra: login, generación SCO/FCO/SPA, cambios de estado, eliminaciones
- **NO registra:** activación/desactivación de usuarios (`users.js`), cambios de perfil, cambios de tareas, cambios de estado de operaciones
- `GET /audit/` en `main` actual: sin límite máximo — un request con `limit=999999` carga todo el log en memoria
- PR #107 (rama S1.2) corrige esto con `MAX_LIMIT=500` y paginación — pendiente de merge

### 4.5 Elevación de privilegios

- Un usuario NO puede editar su propio rol desde el frontend o la API (solo SUPER_ADMIN puede cambiar roles en `PATCH /admin/users/:id`)
- Un usuario NO puede borrar entradas de auditoría (no existe endpoint DELETE en `/audit/`)
- El middleware `requireRole("DIRECTIVO")` en `users.js` solo permite al rol exacto "DIRECTIVO" — excluye DIRECTOR, CFO, COMMERCIAL_DIRECTOR — **brecha de RBAC menor**

### 4.6 Secretos de Railway (verificación sin exponer valores)

| Variable | Presente | Uso |
|----------|----------|-----|
| `JWT_SECRET` | ✅ | Firma JWT |
| `CLIENT_ORIGIN` | ✅ | CORS (fallback de ALLOWED_ORIGINS) |
| `PII_ENCRYPTION_KEY` | ✅ | AES-256-GCM para documentos PII |
| `NODE_ENV` | ✅ Reciente | Activa modo producción |
| `DB_PATH` | ✅ | Ruta SQLite |
| `R2_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | ✅ | R2 storage |
| `R2_BUCKET_NAME` / `R2_ENDPOINT` / `R2_PUBLIC_DOMAIN` | ✅ | R2 config |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | ✅ | Correo SMTP |
| `MAIL_TO` | ✅ | Destinatario notificaciones |
| `JWT_EXPIRES_IN` | ✅ | Duración token |

---

## 5. Clientes y KYC

### 5.1 Flujo de registro y aprobación

```
Web pública (/clients/kyc POST — público)
    ↓
PRE_REGISTRATION (kyc_submissions + clients)
    ↓ COMPLIANCE PATCH /kyc-status
UNDER_REVIEW
    ↓ COMPLIANCE
COMPLIANCE_APPROVED
    ↓ COMPLIANCE/COMMERCIAL_DIRECTOR
COMMERCIAL_APPROVED
    ↓ Aprobación final
ACTIVE_CLIENT
    ↗ (cualquier estado) → REJECTED
```

### 5.2 Código GLV permanente (glv_code)

**Estado actual:** `glv_code` es un campo libre en la tabla `clients`. Se asigna desde el formulario web público o se edita manualmente. **No existe generación automática, no existe restricción UNIQUE, no existe consecutivo.**

**Diseño requerido para el sistema corporativo:**

```sql
-- Tabla de consecutivos por entidad
CREATE TABLE glv_code_sequences (
    entity_code  TEXT PRIMARY KEY,  -- 'GLV-CO', 'GLV-US', 'GLV-BR', etc.
    last_seq     INTEGER NOT NULL DEFAULT 0,
    updated_at   TEXT
);

-- En clients: columna única
ALTER TABLE clients ADD COLUMN glv_code_permanent TEXT UNIQUE;

-- Lógica de generación al activar (COMMERCIAL_APPROVED → ACTIVE_CLIENT):
-- Formato: {ENTITY}-CLI-{YYYY}-{SEQ:05d}
-- Ejemplo: GLV-CO-CLI-2026-00001
-- Atómico con SQLite transaction: UPDATE sequence + INSERT/UPDATE client en una transacción
-- Campos requeridos: glv_code_permanent, issued_at, issued_by, activated_by
```

**Campos de bitácora necesarios (no existen actualmente):**
- `glv_code_permanent` — código definitivo único (UNIQUE constraint)
- `issued_at` — timestamp de emisión
- `issued_by` — usuario que ejecutó la activación
- `activation_entity` — entidad GLV que activa (para multi-entidad)
- `code_issued_at` en `audit_log` con `action = 'GLV_CODE_ISSUED'`

### 5.3 Datos cifrados

- `kyc_data` en tabla `clients`: cifrado AES-256-GCM si `PII_ENCRYPTION_KEY` está configurado ✅
- `raw_data` en tabla `kyc_submissions`: **almacenado en texto plano** — contiene datos del formulario público incluyendo potencialmente PII ⚠️
- `client_id_doc_b64` en `documents`: cifrado si `PII_ENCRYPTION_KEY` configurado ✅

### 5.4 Notificaciones y confirmaciones

| Notificación | Estado | Detalle |
|-------------|--------|---------|
| Email confirmación al cliente al activar | ❌ No implementado | |
| Notificación interna a `contabilidad@glvservicesexp.com` | ⚠️ Solo para documentos | No para activación KYC |
| Notificación a `serviciosglvsas@gmail.com` | ❌ No implementado | Ningún evento |
| Tarea automática para COMPLIANCE al registrar | ✅ Implementado | `POST /clients/kyc` crea tarea |

### 5.5 Vista de cliente único

- `GET /clients/:id` — cualquier usuario autenticado puede ver cualquier cliente, incluyendo PII
- No existe restricción de agente asignado para acceso a expediente (brecha)

---

## 6. Módulo Financiero

### 6.1 Distinción crítica: tablero vs sistema financiero

| Concepto | Estado en GLV GOS | Sistema financiero real |
|----------|------------------|------------------------|
| Resumen de operaciones | ✅ Implementado | Libro mayor |
| Valor de contratos | ✅ Implementado | Factura fiscal |
| Cuentas por cobrar | ❌ No existe tabla | Módulo CxC |
| Cuentas por pagar | ❌ No existe tabla | Módulo CxP |
| Pagos recibidos | ❌ No existe tabla | Módulo Pagos |
| Facturas emitidas | ❌ No existe tabla | Módulo Facturación |
| Bancos y extractos | ❌ No existe tabla | Módulo Bancos |
| Conciliación bancaria | ❌ No existe tabla (stub frontend) | Módulo Conciliación |
| Impuestos (IVA, ICA, retenciones) | ❌ No existe | Módulo Tributario |
| Libro diario / asientos | ❌ No existe | Contabilidad |
| Centros de costo | ❌ No existe | Contabilidad |
| Presupuestos | ❌ No existe | Presupuestación |
| Tasas de cambio | ❌ No existe tabla live | Solo enum estático frontend |
| Cierres de periodo | ❌ No existe | Contabilidad |
| Notas crédito/débito | ❌ No existe | Facturación |

**El módulo Finance actual es un dashboard BI** que agrega `documents.total_value` y `operations.contract_value` — valores estimados de documentos comerciales, **no registros contables**.

### 6.2 Integración DIAN

**No existe. Declaración expresa:**
- No hay integración con DIAN ni con proveedor tecnológico habilitado (Siigo, World Office, Alegra, etc.)
- No existe tabla de facturas electrónicas
- No existe manejo de CUFE, CUDE, XML UBL 2.1, firma digital, QR
- No existe ambiente de pruebas DIAN configurado

**Acción requerida antes de cualquier implementación de facturación:**
1. GLV debe elegir proveedor tecnológico habilitado DIAN
2. Obtener certificado digital (firma electrónica) de la DIAN
3. Completar proceso de habilitación en el portal DIAN
4. Recibir credenciales y ambiente de pruebas del proveedor
5. Solo entonces iniciar desarrollo de la API de facturación

### 6.3 Modelo financiero corporativo requerido

Para operaciones internacionales multimoneda con múltiples entidades GLV, el sistema necesita:

**Entidades del modelo:**
- `legal_entities` — GLV Services S.A.S. (CO), GLV Global Food Services LLC (US), otras
- `fiscal_years`, `accounting_periods` — cierres por entidad
- `chart_of_accounts` — plan de cuentas por entidad
- `journal_entries`, `journal_lines` — asientos contables con trazabilidad por: entidad, operación, cliente, proveedor, moneda, tasa, documento soporte, usuario
- `invoices` — facturas emitidas por entidad; consecutivos propios por entidad
- `invoice_lines` — ítems de factura vinculados a `operations`
- `credit_notes`, `debit_notes`
- `accounts_receivable`, `accounts_payable` — con vencimientos
- `payments` — recibos de caja, egresos, anticipos
- `bank_accounts`, `bank_statements`, `bank_transactions`
- `reconciliations` — conciliaciones bancarias
- `exchange_rates` — tasas históricas por fecha (USD, COP, EUR, CNY, SAR, AED)
- `cost_centers` — por operación/producto/destino
- `budgets`, `budget_lines`
- `tax_transactions` — IVA, retenciones, ICA

**Principio de trazabilidad por asiento:**
Cada `journal_line` debe referenciar: `entity_id`, `operation_id`, `client_id`, `currency`, `exchange_rate_id`, `document_ref`, `user_id`, `cost_center_id`.

### 6.4 Alcance técnico — API de facturación (diseño, sin implementar)

**Endpoints requeridos (OpenAPI a documentar antes de implementar):**

```
POST /billing/invoices                    — Crear factura comercial
POST /billing/invoices/proforma           — Proforma invoice (exportación)
POST /billing/invoices/electronic         — Factura electrónica vía proveedor DIAN
GET  /billing/invoices/:id                — Consultar factura
GET  /billing/invoices/:id/status         — Estado de envío/aceptación DIAN
POST /billing/invoices/:id/credit-note   — Nota crédito
POST /billing/invoices/:id/debit-note    — Nota débito
GET  /billing/sequences/:entity/:type    — Próximo consecutivo por entidad
POST /billing/webhooks/dian              — Receptor de eventos DIAN (aceptación/rechazo)
GET  /billing/audit-log                  — Bitácora de solicitudes y respuestas
```

**Requisitos de diseño:**
- Idempotencia: clave única por `entity_id + consecutive + fiscal_year`
- Consecutivos por entidad y tipo de documento (no global)
- Bitácora completa de requests/responses al proveedor DIAN
- Permisos: crear factura level 60+, anular level 75+, consultar level 50+
- Webhooks firmados (HMAC) para recibir confirmación DIAN
- **NO publicar facturas DIAN hasta tener:** proveedor elegido + credenciales + certificado digital + pruebas de habilitación aprobadas + aprobación explícita de GLV

---

## 7. Operaciones

### 7.1 Ciclo de vida

`DRAFT → NEGOTIATING → ACTIVE → PENDING_DOCS → SIGNED → SHIPPED → COMPLETED | CANCELLED`

**Brecha:** Las operaciones se crean con status `ACTIVE` por defecto — no pasan por `DRAFT`. Un AGENTE puede cambiar el estado de cualquier operación a `COMPLETED` o `CANCELLED` sin requerir nivel directivo. No hay audit log en cambios de estado.

### 7.2 Endpoints

| Endpoint | Nivel | Notas |
|----------|-------|-------|
| `GET /operations/` | Autenticado | Directivos ven todo; agentes ven los propios |
| `GET /operations/:id` | Autenticado | Sin restricción de propiedad |
| `POST /operations/` | Level 40+ | Crea operación ACTIVE |
| `PATCH /operations/:id/status` | Level 40+ | Sin verificación de propiedad |

---

## 8. Documentos Comerciales

### 8.1 Tipos y flujo

| Tipo | Descripción | Creador mínimo |
|------|-------------|----------------|
| SCO | Soft Corporate Offer | AGENTE (40) |
| FCO | Full Corporate Offer | AGENTE (40) |
| SPA | Sale Purchase Agreement | DIRECTIVO (75) |

**Estado de documentos:** `Emitido → Pendiente | Firmado | Rechazado | Cancelado | Archivado`  
Estados terminales: `Rechazado`, `Cancelado`, `Archivado`

### 8.2 Precio duplicado — fuente doble de verdad

El `PRICE_TABLE` de destinos/precios existe en:
- `backend/routes/documents.js` (líneas 11-18)
- `frontend/src/App.jsx` (línea ~50+)

Ambas deben sincronizarse manualmente. Riesgo de discrepancia entre lo que muestra el frontend y lo que calcula el backend.

### 8.3 Identificador de documentos

Generado por `genId(type)`: `{TYPE}-GLV-2026-{COUNT+2:03d}`  
El año (`2026`) está **hardcodeado**. Al cambiar de año, los IDs seguirán generándose con 2026.

---

## 9. Seguridad — Hallazgos Clasificados

### CRÍTICOS (explotar sin autenticación o escalada de privilegios)

| # | Hallazgo | Ubicación | Impacto |
|---|---------|-----------|---------|
| C1 | Sin rate limit en `/auth/login` — fuerza bruta posible | `routes/auth.js` | Alto |
| C2 | Token JWT en `localStorage` — XSS puede robar sesión | `api.js` | Alto |
| C3 | `GET /clients/:id` sin restricción de rol — cualquier usuario ve PII de clientes | `routes/clients.js` | Alto |

### ALTOS (requieren token válido)

| # | Hallazgo | Ubicación | Impacto |
|---|---------|-----------|---------|
| A1 | `middleware/auth.js` no verifica `active=0` en DB — usuarios desactivados conservan sesión hasta expirar JWT | `middleware/auth.js` | Alto |
| A2 | Sin revocación de token JWT | Sistema | Alto |
| A3 | `kyc_submissions.raw_data` en texto plano (puede contener PII del formulario público) | `db/database.js` | Alto |
| A4 | `audit.js` en main sin MAX_LIMIT — DoS por lectura masiva | `routes/audit.js` | Medio-Alto |
| A5 | `PATCH /operations/:id/status` sin verificación de propiedad — cualquier AGENTE modifica operaciones ajenas | `routes/operations.js` | Medio |
| A6 | `PATCH /tasks/:id` sin restricción de propiedad — cualquier usuario modifica cualquier tarea | `routes/tasks.js` | Medio |

### MEDIOS (requieren posición privilegiada)

| # | Hallazgo | Ubicación | Impacto |
|---|---------|-----------|---------|
| M1 | `users.js` usa `requireRole("DIRECTIVO")` en vez de `requireLevel(75)` — otros roles directivos no acceden | `routes/users.js` | Medio |
| M2 | Sin audit log en activación/desactivación de usuarios | `routes/users.js` | Medio |
| M3 | Sin audit log en cambios de estado de operaciones | `routes/operations.js` | Medio |
| M4 | Contraseña temporal mínima 6 chars en admin vs 8 en auth | `routes/admin.js` | Bajo-Medio |
| M5 | `piiCrypto.decrypt()` retorna garbage en error en vez de lanzar excepción | `utils/piiCrypto.js` | Bajo-Medio |
| M6 | `signature_b64`/`photo_b64` en DB sin límite de tamaño — payload bomb posible | `routes/profile.js` | Bajo |
| M7 | Año hardcodeado `2026` en `genId()` de documentos | `routes/documents.js:38` | Bajo |

### PENDIENTES DE MERGE (PR #107 — S1.2)

Los siguientes hallazgos ya tienen corrección implementada en rama `claude/glv-s1-2-security-high` (PR #107, draft, sin merge):
- `audit.js`: MAX_LIMIT=500, paginación, `requireLevel(55)` en vez de lista hardcodeada
- `media.js`: elimina bypass `mvalencia`, agrega `isCategoryAllowed()`
- `documents.js`: `isAdmin` usa `ROLE_LEVEL` en vez de lista hardcodeada
- Nuevo middleware `requestLogger.js` (structured JSON, nunca loggea PII)

---

## 10. Backups y Almacenamiento R2

| Aspecto | Estado |
|---------|--------|
| Backup automático diario | ✅ 02:00 server time, 30 días de retención |
| Formato backup | SQLite completo gzipeado → R2 `backups/{yyyy}/{mm}/{dd}/` |
| API restore | ❌ 501 Not Implemented — proceso manual |
| Verificación de integridad backup | ❌ Sin checksum del archivo subido |
| Notificación de fallo de backup | ❌ Solo log en consola |
| Backups y medios en mismo bucket | ⚠️ Sin aislamiento — `backups/` y `media/` conviven |
| Encriptación del archivo backup | Solo la de R2 at-rest (si configurada en CF) |
| Reconciliación R2↔DB | ✅ Auto-reconcilia al arrancar (15s después del boot) |

---

## 11. Correo y Notificaciones

| Evento | `contabilidad@` | `serviciosglvsas@` | Cliente |
|--------|-----------------|-------------------|---------|
| Documento SCO/FCO/SPA creado | ✅ | ❌ | ❌ |
| Cliente activado (ACTIVE_CLIENT) | ❌ | ❌ | ❌ |
| KYC aprobado por Compliance | ❌ | ❌ | ❌ |
| Reset de contraseña | ❌ | ❌ | N/A |
| Backup fallido | ❌ | ❌ | N/A |
| Operación completada | ❌ | ❌ | ❌ |

**Faltantes críticos:** notificación de activación de cliente a ambos correos internos y confirmación automática al cliente.

---

## 12. Tests

**Tests automatizados:** NINGUNO en frontend ni backend.

`tests/glv-forms.test.cjs` existe en la raíz pero evalúa el formulario público HTML (`services/glv-forms/`), no el sistema GLV GOS.

**Plan de pruebas de aceptación requerido:**

### A. Autenticación
- Login correcto devuelve JWT válido
- Login incorrecto 3 veces no bloquea (gap actual) — test de documentación del gap
- Primer login fuerza cambio de contraseña
- Token expirado devuelve 401
- Usuario desactivado mantiene sesión activa hasta expirar (gap documentado)

### B. Usuarios y roles
- AGENTE no puede ver `/admin/users`
- DIRECTIVO puede ver usuarios pero no crear
- SUPER_ADMIN puede crear/editar/eliminar usuarios
- Cambio de rol no aplica hasta re-login

### C. Clientes y KYC
- Registro público crea `PRE_REGISTRATION`
- COMPLIANCE puede avanzar estado; AGENTE no puede
- `glv_code` único no impuesto actualmente (gap)
- `GET /clients/:id` accesible para cualquier autenticado (gap documentado)

### D. Operaciones
- Crear operación requiere level 40+
- AGENTE puede cambiar estado de operación ajena (gap documentado)
- Estado inválido devuelve 400

### E. Documentos
- SCO/FCO generan ID secuencial
- SPA requiere DIRECTIVO o superior
- Soft delete funciona; `deleted=1` excluye de listados

### F. Finanzas
- `/finance/summary` devuelve agregados de documents+operations
- No existen endpoints de facturas fiscales (confirmar 404)

### G. API y recuperación ante fallos
- `GET /health` devuelve 200 con info DB
- Restart del servidor no pierde datos (Railway Volume)
- Backup diario ejecuta sin errores (verificar log)
- Restaurar backup: proceso manual documentado

---

## 13. Matriz de Módulos

| Módulo | Estado | Evidencia | Riesgo | Dependencia | Siguiente acción |
|--------|--------|-----------|--------|-------------|-----------------|
| Auth JWT | Implementado-Sin-Verificación | `routes/auth.js` | Alto: sin lockout, sin revocación | JWT_SECRET Railway | Agregar rate limit login, verificar active en DB |
| RBAC / Roles | Implementado+Verificado | `middleware/rbac.js` | Bajo | — | Corregir users.js a requireLevel(75) |
| Documentos SCO/FCO/SPA | Implementado+Verificado | `routes/documents.js` | Medio: año hardcodeado | CommercialEngine | Corregir genId() año dinámico |
| CRM Clientes | Implementado-Sin-Verificación | `routes/clients.js` | Alto: PII accesible a todos | PII_ENCRYPTION_KEY | Restringir GET /clients/:id |
| KYC Pipeline | Implementado-Sin-Verificación | `routes/clients.js` | Medio | COMPLIANCE role | Agregar glv_code autogenerado |
| Operaciones | Implementado-Sin-Verificación | `routes/operations.js` | Medio: sin ownership check en PATCH | — | Agregar verificación propiedad y audit log |
| Motor Comercial (CE) | Implementado+Verificado | `CommercialEngine.jsx` | Bajo | Frontend-only | No modificar |
| PDF Ejecutivo | Implementado+Verificado | `GlvPDF.jsx` + engines | Bajo | @react-pdf | Mantener |
| Dashboard Financiero | Parcial/Simulación | `routes/finance.js` | Alto: confunde comercial con contable | — | Aclarar alcance en UI, construir módulo real |
| Facturación DIAN | No implementado | — | Crítico para cumplimiento | Proveedor DIAN | Decisión GLV primero |
| Sistema contable | No implementado | — | Alto | Decisión de arquitectura | Plan de fases |
| Tareas | Implementado-Sin-Verificación | `routes/tasks.js` | Medio: sin ownership en PATCH | — | Agregar ownership check |
| Price Center | Implementado+Verificado | `routes/price-center.js` | Bajo | — | Listo |
| DAM / Media | Implementado+Verificado | `routes/media.js` | Medio: bypass mvalencia en main | R2 | Merge PR #107 |
| Auditoría Log | Parcial | `routes/audit.js` main | Medio: sin límite | — | Merge PR #107 |
| Backups R2 | Implementado-Sin-Verificación | `services/backup.js` | Alto: sin restore probado | R2 | Documentar y probar restore manual |
| Correo SMTP | Parcial | `utils/email.js` | Medio: falta KYC activación | SMTP Railway | Agregar eventos faltantes |
| PII Crypto | Implementado+Verificado | `utils/piiCrypto.js` | Bajo | PII_ENCRYPTION_KEY | Cifrar raw_data en kyc_submissions |
| Tests | No implementado | — | Alto | — | Implementar vitest + supertest |
| Linting/Types | No implementado | — | Medio | — | ESLint + TypeScript migración gradual |

---

## 14. Lista Priorizada de Correcciones

### Fase 0 — Inmediato (sin impacto en producción)
1. **Merge PR #107** (S1.2 Security HIGH) — 7 correcciones de seguridad listas y revisadas
2. **Rate limit en login** — aplicar `rateLimiter.apiLimiter` a `POST /auth/login`
3. **Restricción en `GET /clients/:id`** — agregar verificación de rol (level 65+ o agente asignado)
4. **Año dinámico en `genId()`** — reemplazar `2026` con `new Date().getFullYear()`
5. **Audit log en `PATCH /users/:id/active`** — registrar activaciones/desactivaciones
6. **`users.js` requireLevel(75)** — reemplazar `requireRole("DIRECTIVO")`

### Fase 1 — Corto plazo (1-4 semanas)
7. **Verificar `active` en auth middleware** — DB lookup en cada request para bloquear usuarios desactivados
8. **Ownership check en `PATCH /operations/:id/status`** — directivos pueden editar cualquiera; agentes solo las propias
9. **Ownership check en `PATCH /tasks/:id`** — restricción de propiedad
10. **Cifrar `kyc_submissions.raw_data`** — aplicar piiCrypto
11. **glv_code autogenerado** — tabla de consecutivos, UNIQUE constraint, bitácora
12. **Notificaciones de activación KYC** — email a contabilidad y serviciosglvsas
13. **Notificación de confirmación al cliente al activar**
14. **Límite de tamaño en `signature_b64`/`photo_b64`**

### Fase 2 — Medio plazo (1-3 meses)
15. **Tests automatizados** — vitest para backend (supertest), Playwright para flujos críticos
16. **PostgreSQL migration** — para producción financiera multiusuario
17. **Sistema financiero real** — tablas de facturas, CxC, CxP, pagos, bancos
18. **Tasas de cambio** — servicio de FX con histórico
19. **Revocación de JWT** — blocklist Redis o migración a HttpOnly cookies
20. **Bloqueo por intentos fallidos** — tabla `login_attempts` + lockout

### Fase 3 — Largo plazo (3-6 meses)
21. **Facturación electrónica DIAN** — solo tras decisión y habilitación de proveedor
22. **Multi-entidad en DB** — particionamiento por `entity_id` en operaciones y documentos
23. **Portal del cliente** (role CLIENT) — acceso limitado a sus propias operaciones/documentos
24. **MFA** — TOTP o SMS para roles directivos
25. **Migración a TypeScript** — gradual, por módulo

---

## 15. Arquitectura Objetivo por Fases

### Fase Actual (hoy)
```
[Browser] ←→ [Railway: Node.js + Express + SQLite]
                      ↕
              [Cloudflare R2: medios + backups]
```
Una sola instancia. Una sola entidad lógica. SQLite es suficiente para operación actual.

### Fase 1 — Producción Financiera
```
[Browser] ←→ [Railway: Node.js + Express]
                      ↕
              [Railway PostgreSQL (managed)]
                      ↕
              [Cloudflare R2: medios + backups]
                      ↕
              [Proveedor DIAN: facturación electrónica]
```

### Fase 2 — Multi-Entidad
```
[Browser] ←→ [Load Balancer / Cloudflare]
                      ↕
       [API Gateway — entidad header]
       ↙                    ↘
[GLV-CO Service]      [GLV-US Service]
       ↘                    ↙
    [PostgreSQL shared — partitioned by entity_id]
              ↕
    [R2 — buckets separados por entidad]
    [Proveedor DIAN (CO) / IRS (US)]
```

### Fase 3 — Plataforma Corporativa
```
[Microservicios especializados por dominio:]
auth-service | clients-service | operations-service |
billing-service | finance-service | media-service | audit-service
              ↕
    [Event bus (Redis Streams o similar)]
    [PostgreSQL por dominio o schemas separados]
    [API Gateway con rate limiting, auth centralizado]
```

---

## 16. Dependencias Externas y Decisiones GLV

### Decisiones técnicas que debe tomar GLV antes de continuar

| # | Decisión | Impacto | Urgencia |
|---|---------|---------|----------|
| D1 | **Proveedor tecnológico DIAN** (Siigo, World Office, Alegra, Factura.co, etc.) | Desbloquea toda la facturación electrónica CO | Alta |
| D2 | **PostgreSQL vs SQLite** — cuándo migrar | Define arquitectura financiera | Alta |
| D3 | **Entidades a facturar** — solo GLV Services S.A.S. o también GLV Global Food Services LLC | Diseño de multi-entidad en DB | Media |
| D4 | **Dominio propio Railway** — `gos.glvservicesexp.com` en producción | SEO + branding + certificado SSL | Media |
| D5 | **Redis / sesiones server-side** vs continuar con JWT | Desbloquea revocación de tokens | Media |
| D6 | **Bucket R2 separado** para backups vs compartir con medios | Aislamiento de seguridad | Baja |
| D7 | **MFA obligatorio** para roles directivos | Seguridad corporativa | Media |
| D8 | **Correo de activación al cliente** — qué plantilla y quién la redacta | KYC completeness | Alta |
| D9 | **Portal del cliente** (role CLIENT) — alcance y funcionalidades | Arquitectura frontend | Baja |

### Dependencias externas requeridas

| Dependencia | Para qué | Proveedor sugerido |
|-------------|---------|-------------------|
| Proveedor DIAN habilitado | Factura electrónica Colombia | Siigo, Alegra, Factura.co |
| Certificado digital DIAN | Firma electrónica | CERTICÁMARA, GSE |
| Servicio de tasas de cambio | FX multimoneda | exchangerate.host, Open Exchange Rates |
| Redis / KeyDB | Revocación JWT, rate limiting distribuido | Railway Redis add-on |
| Servicio SMS/WhatsApp | MFA, notificaciones a clientes | Twilio, Meta Cloud API |
| Servicio de correo transaccional | Volumen de emails | SendGrid, Resend (escalar desde SMTP actual) |

---

## 17. Archivos que Requerirían Cambio en la Siguiente Fase

*Solo listados — no modificados en esta auditoría.*

### Backend
```
glv-connect/backend/db/database.js        — Tablas financieras, glv_code_sequences, UNIQUE en clients.glv_code_permanent
glv-connect/backend/routes/auth.js        — Rate limit en login, verificar active en DB
glv-connect/backend/routes/clients.js     — Restricción GET /clients/:id, glv_code autogenerado, cifrar raw_data, notificaciones KYC
glv-connect/backend/routes/operations.js  — Ownership check en PATCH status, audit log en cambios de estado
glv-connect/backend/routes/tasks.js       — Ownership check en PATCH
glv-connect/backend/routes/users.js       — requireLevel(75), audit log en activación
glv-connect/backend/routes/finance.js     — Nuevos endpoints para sistema contable real
glv-connect/backend/routes/documents.js   — Año dinámico en genId(), merge PR #107
glv-connect/backend/middleware/auth.js    — DB lookup para verificar active
glv-connect/backend/utils/email.js        — Nuevos eventos: KYC activación, multi-destinatario
glv-connect/backend/services/backup.js    — Notificación de fallo, checksum de backup
glv-connect/Dockerfile                    — (futuro) PostgreSQL + Redis
```

### Frontend
```
glv-connect/frontend/src/api.js           — Nuevas llamadas para módulos financieros reales
glv-connect/frontend/src/App.jsx          — Sincronizar PRICE_TABLE con backend, eliminar duplicado
glv-connect/frontend/src/components/FinanceView.jsx  — UI para datos financieros reales cuando existan
glv-connect/frontend/src/financial/reconciliation/ReconciliationEngine.js  — Implementar real
glv-connect/frontend/src/core/finance/CurrencyRegistry.js  — Conectar a API de tasas de cambio
```

---

## 18. Resumen de Estado del Sistema

| Área | Estado General |
|------|---------------|
| Infraestructura Railway | ✅ Operativa |
| Autenticación | ⚠️ Funcional con brechas conocidas |
| RBAC / Roles | ✅ Sólido, correcciones menores pendientes |
| Documentos SCO/FCO/SPA | ✅ Funcional y en producción |
| CRM Clientes + KYC | ⚠️ Funcional, brecha de acceso PII |
| Operaciones de exportación | ⚠️ Funcional, sin ownership en PATCH |
| Motor Comercial / PDF | ✅ Maduro y funcional |
| DAM / Media R2 | ✅ Funcional (bypass en main, corregido en PR #107) |
| Dashboard Financiero | ⚠️ Parcial — BI sobre datos comerciales, NO sistema contable |
| Facturación DIAN | ❌ No existe |
| Sistema contable | ❌ No existe |
| Tests automatizados | ❌ Ninguno |
| Backups | ✅ Automáticos / ❌ Restore manual sin probar |
| Notificaciones email | ⚠️ Parcial — solo documentos |
| Seguridad general | ⚠️ 3 críticos + 6 altos a resolver |

---

*Informe generado en auditoría técnica sin modificación de código. No contiene secretos, tokens ni contraseñas. Para uso interno del equipo técnico y directivo de GLV Services.*
