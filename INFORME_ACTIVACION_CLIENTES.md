# GLV-Connect — Informe de Intervención: Flujo de Activación de Clientes
**Sesión:** Claude Sonnet 4.6 | **Fecha:** 2026-11-21 | **PR:** [#160](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/160)
**Rama:** `fix/client-activation-email-verification` | **Commit:** `b49287d`

---

## 1. Problema raíz identificado

El flujo completo de activación de clientes en `https://www.glvservicesexp.com/registro-clientes` dependía de un **endpoint de Google Apps Script (GAS)**:

```
https://script.google.com/macros/s/AKfycbw_.../exec
```

Si GAS estaba caído, con cuota agotada, bloqueado por Google, o con una versión desactualizada del script, **ningún cliente podía registrarse**. No había fallback ni manejo de error funcional.

**Problemas adicionales encontrados:**
- `localStorage` almacenaba PII completo del cliente (NIT, email, teléfono, dirección, nombre)
- Código GLV generado en cliente (podía falsificarse)
- `/portal-clientes` devolvía 404 o mostraba «Próximamente»
- CORS no incluía los dominios `glvglobalfoodservices.com`
- La tabla `registration_codes` no existía — no había verificación por email

---

## 2. Arquitectura del sistema (referencia rápida)

```
Hosting estático (cPanel):
  public_html/
    registro-clientes.html   ← formulario KYC del cliente
    portal-clientes.html     ← acceso al ERP (era 404)
    index.html, otros…

API + ERP (Railway Docker):
  misaelvalencia-production.up.railway.app
    /auth/*          ← login JWT
    /registration/*  ← NUEVO: flujo de verificación por email
    /clients/*       ← CRUD de clientes (ERP interno)
    /documents/*     ← SCO, FCO, cotizaciones
    …

Base de datos:
  SQLite (better-sqlite3) en Railway Volume → /data/glvconnect.sqlite
```

**GAS sigue activo para:** cotizaciones de proveedores y otros formularios. Solo se quitó la dependencia en el registro de clientes.

---

## 3. Cambios implementados en esta sesión

### 3.1 Nueva tabla: `registration_codes`

**Archivo:** `glv-connect/backend/db/database.js`

```sql
CREATE TABLE IF NOT EXISTS registration_codes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL,
  code_hash       TEXT    NOT NULL,      -- HMAC-SHA256, nunca texto claro
  expires_at      TEXT    NOT NULL,      -- datetime ISO, 15 minutos
  attempts        INTEGER NOT NULL DEFAULT 0,   -- máx 5
  resend_count    INTEGER NOT NULL DEFAULT 0,   -- máx 3
  pending_data    TEXT    NOT NULL,      -- JSON cifrado con datos del formulario
  used            INTEGER NOT NULL DEFAULT 0,
  invalidated     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reg_codes_email ON registration_codes(email);
```

### 3.2 Nuevo router: `/registration`

**Archivo:** `glv-connect/backend/routes/registration.js` ← CREADO

| Endpoint | Función | Rate limit |
|---|---|---|
| `POST /registration/request-code` | Envía código 6 dígitos; idempotente si código válido activo | 8 req/15 min |
| `POST /registration/verify-code` | Verifica código → crea cliente atómicamente | 15 req/15 min |
| `POST /registration/resend-code` | Reenvía código (máx 3 veces) | 4 req/15 min |

**Lógica clave de `verify-code` — transacción atómica:**
```javascript
db.transaction(() => {
  // 1. Genera código GLV único (GLV-CL-YYYY-NNNNNN, guard colisión)
  glvCode = generateGlvCode();
  // 2. Chequea duplicado por email
  const dup = db.prepare("SELECT id FROM clients WHERE lower(email)=? AND kyc_status!='REJECTED'").get(email);
  if (dup) return { dup };
  // 3. Inserta cliente con PII cifrado AES-256-GCM
  db.prepare("INSERT INTO clients ...").run(...encryptedFields);
  // 4. Crea expediente KYC
  db.prepare("INSERT INTO kyc_submissions ...").run(...);
  // 5. Crea entrada de auditoría
  db.prepare("INSERT INTO audit_log ...").run(...);
  // 6. Crea tarea automática para Compliance
  db.prepare("INSERT INTO tasks ...").run(...);
  // 7. Marca código como usado (no puede reutilizarse)
  db.prepare("UPDATE registration_codes SET used=1 WHERE id=?").run(codeId);
  return { clientId, glvCode };
})();
```

**Generación de código GLV (server-side, secuencial, con guard):**
```javascript
function generateGlvCode() {
  const year = new Date().getFullYear();
  const prefix = `GLV-CL-${year}-`;
  const last = db.prepare(
    "SELECT glv_code FROM clients WHERE glv_code LIKE ? ORDER BY glv_code DESC LIMIT 1"
  ).get(prefix + "%");
  let seq = last ? parseInt(last.glv_code.split("-").pop(), 10) + 1 : 1;
  let glvCode, tries = 0;
  do {
    glvCode = prefix + String(seq).padStart(6, "0");
    if (!db.prepare("SELECT id FROM clients WHERE glv_code=?").get(glvCode)) break;
    seq++;
  } while (++tries < 100);
  return glvCode; // Ej: GLV-CL-2026-000001
}
```

**Hash de código (nunca texto claro en DB):**
```javascript
function hashCode(code, email) {
  return crypto.createHmac("sha256", process.env.REGISTRATION_CODE_SECRET)
    .update(`${email.toLowerCase()}:${code}`)
    .digest("hex");
}
```

### 3.3 Emails de verificación

**Archivo:** `glv-connect/backend/utils/email.js`

Funciones agregadas:
- `sendVerificationCode(to, code, empresa, lang)` — email HTML bilingüe (es/en) con código prominent
- `sendRegistrationConfirmation(to, glvCode, empresa, lang)` — confirmación con código GLV en grande

Ambas: **no fallan si SMTP no está configurado** (`console.warn` y retorno silencioso).

### 3.4 Montaje del router en servidor

**Archivo:** `glv-connect/backend/server.js`

```javascript
const registrationRouter = require("./routes/registration");
// ...
app.use("/registration", registrationRouter);  // después de /auth
```

### 3.5 Formulario de registro (frontend)

**Archivo:** `registro-clientes.html`

**Eliminado (código muerto con riesgo PII):**
```javascript
// ANTES — todo esto fue eliminado:
function saveClientRecord(data) { localStorage.setItem('glv_client_...', JSON.stringify(data)); }
function sendToERP(data) { ... }
function markPendingSync(id) { localStorage.setItem('glv_pending_sync', id); }
function markSynced(id) { ... }
```

**Nuevo flujo:**
```
Usuario completa formulario
    ↓
submitKYC() → POST /registration/request-code
    ↓
Backend envía email con código de 6 dígitos
    ↓
Dialog overlay aparece (countdown 15 min)
    ↓
Usuario ingresa código → POST /registration/verify-code
    ↓
Backend crea cliente atómicamente (DB + KYC + audit + tarea)
    ↓
Panel de éxito con código GLV (ej: GLV-CL-2026-000001)
Backend envía email de confirmación con código GLV
```

Funciones clave añadidas:
- `gatherFormData()` — recolecta todos los campos del formulario
- `validateKYCForm()` — valida requeridos + checkboxes legales
- `_glvShowCodeDialog(email, pendingData, empresa)` — dialog inline con countdown
- `_glvVerifyCode(email)` — llama a `/registration/verify-code`
- `_glvResendCode(email)` — llama a `/registration/resend-code`

La variable `GLV_API` apunta a: `https://misaelvalencia-production.up.railway.app`

### 3.6 Portal de clientes (nuevo)

**Archivo:** `portal-clientes.html` ← CREADO

Reemplaza el 404 / «Próximamente» anterior.

Contenido:
- Botón principal → acceso al ERP en Railway
- Explicación del código GLV (formato `GLV-CL-AAAA-NNNNNN`)
- Timeline de activación (3–7 días hábiles)
- Proceso de entrega de credenciales por agente
- Botón de soporte WhatsApp: `https://wa.me/573160865294`
- Link secundario a `/registro-clientes`

### 3.7 Variables de entorno

**Archivo:** `glv-connect/backend/.env.example`

Agregado:
```bash
# CORS incluye ambos dominios con y sin www:
# ALLOWED_ORIGINS=https://glvservicesexp.com,https://www.glvservicesexp.com,https://glvglobalfoodservices.com,https://www.glvglobalfoodservices.com

# Nuevo secreto para hashing de códigos:
# REGISTRATION_CODE_SECRET=
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Variables de entorno requeridas en Railway

**ACCIÓN: Configurar en Railway Dashboard → Service → Variables**
(Sin valores aquí — solo los nombres)

| Variable | Descripción | Cómo generarla |
|---|---|---|
| `REGISTRATION_CODE_SECRET` | HMAC secret para códigos | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ALLOWED_ORIGINS` | CORS multi-dominio | Ver `.env.example` para los 4 dominios |
| `SMTP_HOST` | Host SMTP | smtp.gmail.com o proveedor SMTP |
| `SMTP_PORT` | Puerto SMTP | 587 |
| `SMTP_USER` | Usuario SMTP | notificaciones@glvservicesexp.com |
| `SMTP_PASS` | Contraseña SMTP | App password de Gmail |
| `MAIL_FROM` | Nombre del remitente | "GLV Services <notificaciones@glvservicesexp.com>" |
| `PII_ENCRYPTION_KEY` | Clave AES-256-GCM | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

---

## 5. Seguridad — cambios aplicados

| Riesgo | Estado antes | Estado ahora |
|---|---|---|
| PII en localStorage | NIT, email, nombre, dirección | Eliminado completamente |
| Código GLV en cliente | Podía falsificarse | Generado server-side en DB transaction |
| Códigos en texto claro | GAS los recibía/guardaba | HMAC-SHA256(email:code), nunca texto claro |
| Cliente creado antes de verificar | Sí (GAS podía crear sin confirmación) | No — solo se crea al verificar código |
| Duplicados en reintento | Podía crear clientes duplicados | Guard de duplicados en transacción |
| Email expuesto en API response | Dependía del GAS | Enmascarado: `j***e@empresa.com` |
| Rate limiting en registro | No había | 3 limiters separados por endpoint |

---

## 6. Tests pendientes (para GPT o siguiente sesión)

```bash
# 1. Instalar dependencias de test si no existen
cd glv-connect/backend && npm install --save-dev jest supertest

# 2. Tests sugeridos a crear en tests/registration.test.js:
```

```javascript
// Test A: request-code crea registro y devuelve PENDING
// Test B: verify-code con código correcto crea cliente
// Test C: verify-code idempotente — email duplicado devuelve error 409
// Test D: verify-code con código incorrecto incrementa attempts
// Test E: verify-code con código expirado devuelve 410
// Test F: resend-code incrementa resend_count
// Test G: resend-code falla después de 3 reenvíos
// Test H: generateGlvCode() genera formato correcto (GLV-CL-YYYY-NNNNNN)
// Test I: generateGlvCode() no genera duplicados (loop 100 iteraciones)
// Test J: CORS bloquea origen no listado en ALLOWED_ORIGINS
// Test K: rate limiter bloquea después de N requests
// Test L: SMTP no configurado — no falla el registro (warning solo)
```

---

## 7. Pendientes críticos para siguiente sesión

### 7.1 GLV Global Food Services (repo separado — no accesible en esta sesión)

Los mismos cambios deben aplicarse al sitio `https://www.glvglobalfoodservices.com`:
- `registro-clientes.html` → misma lógica que el GLV Services
- `portal-clientes.html` → crear (misma estructura, ajustar branding y WhatsApp)
- `GLV_API` debe apuntar al mismo backend Railway
- CORS ya está preparado en `.env.example` (incluye ambos dominios)

### 7.2 Despliegue en Railway (hace el equipo, no Claude)

1. Configurar todas las variables de entorno listadas en §4
2. Verificar que el volumen en `/data` esté montado (para SQLite persistente)
3. Hacer `git push` del PR #160 después de aprobación de auditoría
4. Verificar `/health` tras el deploy
5. Prueba staging con email de test controlado antes de abrir al público

### 7.3 cPanel — subir archivos estáticos modificados

Los archivos HTML se sirven desde cPanel, **no** desde Railway.
Después de merge, subir manualmente a `public_html/`:
- `registro-clientes.html`
- `portal-clientes.html`

---

## 8. Resumen de archivos modificados

| Archivo | Tipo de cambio | Riesgo de regresión |
|---|---|---|
| `glv-connect/backend/routes/registration.js` | CREADO | Bajo — es nuevo |
| `glv-connect/backend/db/database.js` | Tabla nueva (migration) | Bajo — `CREATE IF NOT EXISTS` |
| `glv-connect/backend/utils/email.js` | Funciones añadidas | Bajo — exports compatibles |
| `glv-connect/backend/server.js` | 2 líneas añadidas | Bajo — solo montaje de router |
| `glv-connect/backend/.env.example` | Comentarios añadidos | Ninguno |
| `registro-clientes.html` | Lógica de formulario reescrita | Medio — probar formulario end-to-end |
| `portal-clientes.html` | CREADO | Ninguno |

---

## 9. Estado del PR

- **PR #160** (draft): https://github.com/thegroupfenix-bot/misaelvalencia-/pull/160
- **Base:** `claude/glv-services-workflow-JDGxj`
- **Sin merge.** Sin despliegue. Esperando auditoría.
- Todos los archivos pasaron `node --check` (validación de sintaxis)

---

## 10. Restricciones de sesión (permanentes)

```
✗ No merge a main
✗ No despliegue Railway
✗ No secretos en código
✗ No datos reales ni PII en archivos
✗ No usar cuentas personales
Al terminar: detener y esperar auditoría
```

---

*Generado por Claude Sonnet 4.6 — Sesión https://claude.ai/code/session_01XrVNmPhSRrizEKVYaXsWUq*
