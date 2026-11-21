# Ejecución: Portal de Clientes GLV

## Alcance añadido

- Al activar un KYC como `ACTIVE_CLIENT`, GOS crea o vincula la cuenta `CLIENT`.
- El usuario de acceso es el código GLV del cliente.
- El correo recibe un enlace de un solo uso, válido por una hora, para definir su contraseña.
- El portal permite actualizar correo, teléfono, WhatsApp y dirección.
- El portal exige un certificado comercial antes de enviar una solicitud de cambio de razón social.
- Las solicitudes quedan con estado `PENDING`, documento asociado y auditoría.

## Verificación requerida antes de integrar

1. Ejecutar `cd glv-connect/backend && npm test`.
2. Configurar en Railway `JWT_SECRET`, `PII_ENCRYPTION_KEY`, SMTP, `CLIENT_ORIGIN` y `ALLOWED_ORIGINS`.
3. Activar un cliente de prueba desde GOS Leads/KYC.
4. Confirmar que recibe el correo de activación, define contraseña y entra con su código GLV.
5. Confirmar que actualiza datos de contacto y que la solicitud de razón social adjunta el certificado.
6. Validar que la cuenta CLIENT no muestra los módulos operativos internos.

## Resultado de esta ejecución

Cambios preparados en PR 167. No se hizo merge ni despliegue.

# Recuperación de altas públicas hacia GOS

## Estado

PR 167 creado el 21 de noviembre de 2026 para recuperar el ingreso de clientes públicos a GOS Leads y KYC.

El formulario público conserva su flujo actual con Apps Script durante esta etapa. El PR incorpora la ruta de GOS que registra y controla cada alta verificada.

## Cambios incluidos

- POST /registration/request-code crea un código temporal enviado por correo.
- POST /registration/verify-code crea un cliente en GOS con estado UNASSIGNED y PRE_REGISTRATION.
- Cada alta crea un expediente en kyc_submissions, una entrada en audit_log y una tarea de revisión para Compliance.
- POST /registration/resend-code conserva el código vigente si el correo falla y evita duplicados por reenvío concurrente.
- Los códigos GLV se generan en el servidor y los datos pendientes se cifran cuando existe PII_ENCRYPTION_KEY.

## Pruebas requeridas antes de integrar

- cd glv-connect/backend && npm test
- Confirmar REGISTRATION_CODE_SECRET, SMTP y los dominios públicos de GLV en ALLOWED_ORIGINS.
- Validar una alta ficticia completa con correo controlado.
- Conectar el formulario público al endpoint de GOS mediante un cambio posterior y verificar que cada alta aparezca una vez en Leads y KYC.

## Registro anterior

# Evidencia de ejecución automática

## Estado

Ejecución completada para el PR #163 (rama `fix/gos-audit-screen-white-page`). Sin merge ni despliegue.

- SHA base de la revisión: `44d3bb0d826054a520e9845c84f4849ae7f6f3e2` (el SHA del commit de esta ejecución es el commit siguiente de la rama).
- Instrucción atendida: comentario del propietario en el PR #163 (revisión, prueba automatizada, informe).

## Hallazgos de la revisión

1. `GET /audit` devuelve `{ rows, total, limit, offset }` (`glv-connect/backend/routes/audit.js`). `AuditLog` ahora lee `rows` y acepta listas antiguas: **confirmado**.
2. Respuesta inválida o fallo de red: la vista muestra `role="alert"` con botón «Reintentar»; no lanza excepción de render: **confirmado**.
3. Mejora añadida: la lógica se extrajo a `glv-connect/frontend/src/utils/auditResponse.js` (`normalizeAuditResponse`, `loadAuditState`) para poder probarla sin navegador.
4. Flujo inicio de sesión → dashboard → auditoría (revisión de código):
   - `AuthProvider.login` guarda `user`; `Portal` abre `dashboard` por defecto.
   - **Riesgo encontrado y corregido:** `Dashboard` hacía `docs.filter(...)` sobre lo que devolviera `/documents`, `/operations` o `/tasks`; una respuesta no-lista dejaba la app en blanco. Ahora cada respuesta se valida con `Array.isArray` y cae a `[]`.
   - `AuditLog` solo se monta con `hasAuditAccess`; el backend exige nivel ≥ 55 (`requireLevel(55)`).
   - **Pendiente (no cambiado):** no existe un `ErrorBoundary` global en `Portal`; un error de render en otra vista sigue pudiendo dejar la pantalla en blanco. Se recomienda como acción correctiva separada.

## Archivos modificados

- `glv-connect/frontend/src/App.jsx` (AuditLog usa `loadAuditState`; Dashboard valida listas)
- `glv-connect/frontend/src/utils/auditResponse.js` (nuevo)
- `glv-connect/backend/tests/audit-shape.test.js` (nuevo: contrato de `GET /audit`, requiere supertest y SQLite)
- `glv-connect/backend/tests/audit-view-recovery.test.js` (nuevo: normalización, error y reintento; sin BD)
- `docs/automation/latest-execution-report.md`

## Comandos y resultados

| Comando | Resultado |
|---|---|
| `cd glv-connect/frontend && npm ci && npm run build` | Correcto (solo aviso de tamaño de chunk) |
| `cd glv-connect/backend && node --test tests/audit-view-recovery.test.js` (Node 24) | 13/13 correctas |
| `cd glv-connect/backend && node --test tests/audit-shape.test.js` (Node 22.23.5) | 2/2 correctas |
| `npm run test:pwa` (raíz) | 1/1 correcta |
| `cd glv-connect/backend && npm test` (Node 22) | Resultado inestable: 6–9 archivos fallan por intermitencia, también sin estos cambios (línea base con los cambios retirados: 9 fallos) |

## Límites de prueba

- No hay prueba de renderizado (DOM/React Testing Library) ni de navegador: el frontend no tiene framework de pruebas. Se prueba la lógica pura que decide qué muestra la vista; el JSX de error/reintento se verificó por lectura y por build.
- `better-sqlite3@9` no compila con Node 24 en este entorno; la prueba de API se ejecutó con Node 22.
- La suite completa del backend es inestable en este entorno (`Unable to deserialize cloned data...` del ejecutor de Node cuando el servidor imprime logs, más fallos previos en otros módulos). No se atribuyen a este PR; no se investigaron.
- No se probó contra el backend desplegado ni con datos reales.

## Estado ISO 9001 / BASC

- **Evidencia:** pruebas automatizadas nuevas y este informe con comandos y resultados. Falta evidencia de prueba manual en un entorno con sesión real.
- **Trazabilidad:** `/audit` expone `ts`, `username`, `action`, `doc_id`, `ip`; la vista ahora muestra total y no oculta fallos. El registro de auditoría sigue limitado a lo que el backend inserta; no se auditó su completitud.
- **Control documental:** cambio acotado a una rama con PR; este informe se versiona en el repositorio. Pendiente aprobación y revisión humana antes del merge.
- **Acciones correctivas:** (1) causa raíz tratada: contrato `{ rows, total }` mal consumido; (2) añadidas validaciones en Dashboard; (3) abierta: `ErrorBoundary` global y estabilizar la suite backend.
- **Responsabilidades:** aprobación del merge y despliegue: propietario del repositorio. Corrección de las acciones abiertas: por asignar por el propietario.
- No se afirma cumplimiento ni certificación ISO 9001/BASC: este informe solo aporta evidencia técnica parcial.
