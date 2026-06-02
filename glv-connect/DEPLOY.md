# GLV-Connect — Guía de Despliegue en cPanel

## Arquitectura en producción

```
glvservicesexp.com          → public_html/  (HTML estático — ya desplegado)
connect.glvservicesexp.com  → Subdomain → Node.js App (backend API :3001)
glvservicesexp.com/connect/ → public_html/connect/ (frontend React build)
```

---

## PASO 1 — Crear subdominio para la API

1. cPanel → **Subdomains**
2. Crear: `api` → apunta a `public_html/glv-connect-api/` (o cualquier carpeta fuera de public_html)

---

## PASO 2 — Configurar la app Node.js en cPanel

1. cPanel → **Setup Node.js App**
2. Clic en **Create Application**
3. Completar:

| Campo | Valor |
|-------|-------|
| Node.js version | 18.x (o superior) |
| Application mode | Production |
| Application root | `/home/glvserv1/glv-connect/backend` |
| Application URL | `api.glvservicesexp.com` |
| Application startup file | `server.js` |

4. Clic **Create**
5. En la sección **Environment variables**, agregar:

```
JWT_SECRET        = (cadena larga aleatoria, mínimo 32 caracteres)
JWT_EXPIRES_IN    = 8h
DB_PATH           = /home/glvserv1/glv-connect/backend/db/glvconnect.sqlite
SMTP_HOST         = smtp.gmail.com
SMTP_PORT         = 587
SMTP_USER         = notificaciones@glvservicesexp.com
SMTP_PASS         = (contraseña de aplicación Gmail)
MAIL_FROM         = "GLV-Connect <notificaciones@glvservicesexp.com>"
MAIL_TO           = contabilidad@glvservicesexp.com
CLIENT_ORIGIN     = https://glvservicesexp.com
PORT              = 3001
```

6. Clic **Run NPM Install**
7. Clic **Restart**

---

## PASO 3 — Construir y desplegar el frontend

Desde la terminal SSH de cPanel:

```bash
cd ~/glv-connect/frontend
cp .env.example .env
# Editar .env: VITE_API_URL=https://api.glvservicesexp.com
npm install
npm run build
# Copiar el build al subdirectorio público
cp -R dist/ ~/public_html/connect/
```

O si prefieres un subdominio dedicado (`connect.glvservicesexp.com`):
```bash
cp -R dist/ ~/public_html/  # y apunta el subdominio a esa carpeta
```

---

## PASO 4 — .htaccess para el frontend (SPA routing)

Crear `~/public_html/connect/.htaccess`:

```apache
Options -Indexes
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

---

## PASO 5 — Verificar

```bash
# Health check de la API
curl https://api.glvservicesexp.com/health

# Respuesta esperada:
# {"ok":true,"ts":"2026-05-14T..."}
```

---

## Actualizaciones futuras

Cuando hagas push a `main`:
1. cPanel → **Git Version Control** → Actualizar desde remoto
2. cPanel → **Setup Node.js App** → Restart (para el backend)
3. Para el frontend: `cd ~/glv-connect/frontend && npm run build && cp -R dist/ ~/public_html/connect/`
