# Informe de ejecución — PR #160

**SHA base:** 478792d en `fix/client-activation-email-verification`. El SHA del commit queda en el historial de la rama.

## Bloque: alta de clientes (GOS) — router `/registration`
### Cambios (solo lo necesario para el flujo)
- `glv-connect/backend/utils/email.js`: `sendVerificationCode` ahora lanza `SMTP_NOT_CONFIGURED` si no hay SMTP (antes retornaba en silencio y registraba el código en logs; el código ya no se escribe en logs).
- `glv-connect/backend/routes/registration.js`:
  - `request-code` y `resend-code` esperan la confirmación del envío. Si falla: HTTP 503 `{retryable:true}`; en `request-code` el código recién creado se invalida, así que un nuevo intento genera y envía un código nuevo (antes quedaba un código «pendiente» nunca entregado y el reintento devolvía PENDING sin enviar nada).
  - Se usa `mailer.<fn>` (acceso por propiedad) para poder simular el correo en pruebas.
- El formulario (`registro-clientes.html`) no se modificó: ya muestra `res.d.error` ante `!ok` y rehabilita el botón, por lo que el 503 es recuperable. Navegación y PWA sin cambios.
- Nueva prueba `glv-connect/backend/tests/registration.test.js` (Supertest + SQLite temporal + correo simulado, datos ficticios) y script `npm test` en el backend; `supertest` como devDependency.

### Casos cubiertos
1. Fallo de envío → 503 retryable, ningún código activo ni cliente; reintento → 200 y correo simulado enviado.
2. Código incorrecto → 400; código correcto → 201 con `GLV-CL-AAAA-NNNNNN`; reintento de verificación → no 201; 1 solo cliente, 1 `audit_log` `CLIENT_REGISTERED`, 1 `kyc_submissions`, código marcado usado.

## Comandos y resultados
- `cd glv-connect/backend && node --test tests/registration.test.js` → 2/2 pasan.
- No se re-ejecutaron `npm run test:pwa` ni `glv-forms.test.cjs` (no se tocó HTML ni PWA).

## Pendientes / limitaciones
- `better-sqlite3@^9.4.3` no compila en Node 24 (sin prebuild). Las pruebas se ejecutaron con `better-sqlite3@12` instalado con `--no-save`; `package.json` no se cambió. Pendiente decidir subir la versión o fijar Node 20/22 en CI.
- Sin SMTP real; solo correo simulado. Producción requiere SMTP configurado: sin él, `request-code` devuelve 503 (comportamiento intencional).
- No cubierto: `resend-code` con fallo de envío (implementado, sin prueba), límites de intentos/expiración, CORS, 409 de cliente activo.
- `.github/AI_AUTOMATION_PROTOCOL.md` no existe en el repositorio.
- Sin merge, despliegue, cambios de secretos ni contacto con clientes.
