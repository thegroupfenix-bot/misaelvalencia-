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

## Bloque: guía de instalación dentro de la pantalla (menú móvil)
**SHA base:** 0769333 (el commit queda en el historial de la rama).
- `index.html`: nueva `placeHint()` compartida por `showInstallHint` y `showIOSHint`. Coloca la guía debajo del ancla si cabe; si no, encima; ajusta ancho (`min(max, ancho visible − 16)`) y posición horizontal, y limita `top` a la ventana. Se conservan cierre (clic/temporizador/clic exterior), limpieza en `appinstalled`/standalone, prompt nativo, ambos controles y el panel de registro en línea.
- `tests/pwa-install-behavior.test.mjs`: sección 8 (ventana móvil 360×420, botón al final del menú, 4 posiciones de ancla, Chrome sin prompt + Safari iPhone/iPadOS, ventana mínima 300×200): toda la guía queda dentro del viewport; encima cuando no cabe debajo; cierre y `appinstalled` limpian.
- `tests/pwa-security.test.mjs` (E12): exige `placeHint` en lugar de buscar `style.top` dentro de cada función.
- `tests/playwright-pwa.test.mjs`: import `playwright` sin ruta absoluta.

### Resultados
- `npm run test:pwa` → 2/2 archivos pasan.
- La sección 8 falla con el `index.html` anterior (comprobado).
- `node --check tests/playwright-pwa.test.mjs` → OK.

### No ejecutado
- `tests/playwright-pwa.test.mjs` no se ejecutó (sin navegador/servidor; requiere `playwright` instalado como dependencia).
- DOM simulado (`node:vm`): el alto de la guía se fija en 96 px; no se probó en navegador real ni con teclado virtual/`visualViewport`.

## Bloque: reenvío de código (`resend-code`) sobre 8e3f544
- Defecto: si SMTP fallaba, `resend-code` ya había invalidado el código anterior y dejado activo el reemplazo no enviado, con el contador incrementado.
- Corrección (`glv-connect/backend/routes/registration.js`): primero se envía el correo; solo con envío confirmado se activa el reemplazo en una transacción que invalida el anterior con condición (`used=0 AND invalidated=0 AND resend_count=<leído>`) e inserta el nuevo. Si falla el envío: 503 `retryable:true` sin tocar código ni contador. Reenvíos concurrentes del mismo correo: un `Set` en proceso devuelve 409 al segundo, y la condición del UPDATE protege además la transición (409 si el estado cambió).
- Prueba nueva en `glv-connect/backend/tests/registration.test.js` (Supertest, SQLite temporal, correo simulado, datos ficticios): 503 recuperable, código anterior vigente (misma fila, hash y `resend_count=0`, sin reemplazo), dos reenvíos concurrentes → 200 + 409, 2 filas en total con una sola activa, el código anterior da 400 y el nuevo 201 con un solo cliente.
- Comando: `cd glv-connect/backend && node --test tests/registration.test.js` → 3/3 pasan (Node 24, `better-sqlite3@12` con `--no-save`; ver pendiente anterior).
- Limitaciones: el candado de concurrencia es por proceso (válido para una sola instancia; con varias instancias solo actúa la condición del UPDATE, que evita doble activación pero no doble correo). No se ejecutó `npm run test:pwa` (no se tocó HTML). Sin envío real de correo.
