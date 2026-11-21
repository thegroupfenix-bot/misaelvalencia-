# Evidencia de ejecución automática

## PR 166, protección del registro KYC

- Rama: `fix/glv-forms-csp`.
- Producción, 21 de noviembre de 2026: dos registros controlados completaron el flujo KYC. Cada uno mostró un código único GLV y entregó el correo de confirmación.
- Tiempo observado de validación: aproximadamente 15 segundos.
- No se hizo merge ni despliegue desde esta ejecución.

## Control preventivo incorporado

1. `.cpanel.yml` ya no renombra `htaccess` como `.htaccess`.
2. El despliegue conserva el archivo `.htaccess` versionado, que contiene los dos orígenes requeridos por Apps Script en `connect-src`.
3. `tests/deploy-htaccess.test.mjs` falla si un cambio futuro toca `htaccess` sin punto durante el despliegue o si omite los dos orígenes de Apps Script.
4. `npm run test:pwa` ejecuta esa protección junto con la prueba PWA existente.

## Verificación pendiente de CI

- Ejecutar `npm run test:pwa` y las validaciones del sitio sobre el SHA final de esta rama.
- Revisar el diff, los checks y realizar una prueba controlada adicional antes de aprobar merge.
- No modificar Apps Script, Railway, registros de clientes ni la CSP validada sin una prueba de regresión KYC.

---

# Historial anterior

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

