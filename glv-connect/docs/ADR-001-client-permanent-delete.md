# ADR-001 — Eliminación permanente de clientes (CLIENTS / KYC)

**Estado:** Aprobado  
**Fecha:** 2026-06-09  
**Módulo:** Clientes / KYC  
**Implementado en:** `glv-connect/backend/routes/clients.js`

---

## Decisión

SUPER_ADMIN puede eliminar permanentemente un cliente únicamente cuando su `lead_status = ARCHIVED`.

El flujo obligatorio es:

```
ACTIVE → ARCHIVE → PERMANENT DELETE
```

No existe ruta directa de ACTIVE a PERMANENT DELETE.

---

## Reglas de negocio

### Bloqueos duros — nunca pueden superarse

| Condición | HTTP | Motivo |
|---|---|---|
| `lead_status != ARCHIVED` | 400 | Cliente activo — archivar primero |
| `operations > 0` | 409 | Operaciones reales vinculadas |
| `client_documents > 0` | 409 | Documentos activos vinculados |

### Permiso con limpieza controlada

| Condición | Acción | Audit action |
|---|---|---|
| `tasks > 0` (sin operations ni documents) | Borra tasks → borra cliente | `CLIENT_FORCE_DELETE` |
| `kyc_submissions.mapped_to_id = client.id` | `UPDATE kyc_submissions SET mapped_to_id = NULL` | `CLIENT_UNLINK_KYC` |
| Todo en cero | Borra cliente directamente | `CLIENT_PERMANENT_DELETE` |

### Trazabilidad preservada

- `kyc_submissions` nunca se eliminan — solo se desvinculan (`mapped_to_id = NULL`)
- `audit_log` registra cada acción con `username`, `action`, `doc_id` (glv_code), `client_id`, `ip`, `ts`
- Historial KYC queda intacto y consultable

---

## Casos de uso permitidos

- Clientes de prueba generados desde WEB_KYC sin actividad operativa
- Registros erróneos creados por error de usuario
- Duplicados identificados y archivados previamente
- Clientes archivados sin operaciones, documentos ni actividad real

---

## Implementación técnica

**Archivo:** `glv-connect/backend/routes/clients.js`  
**Función:** `canDeleteClient(clientId)` + `router.delete("/:id", ...)`  
**Acceso:** `requireLevel(100)` — exclusivo SUPER_ADMIN

**Secuencia de ejecución en DELETE /clients/:id:**

```
1. Verificar cliente existe                        → 404 si no
2. Verificar lead_status == ARCHIVED               → 400 si activo
3. canDeleteClient() → contar operations + docs + tasks
4. if (operations > 0 || documents > 0)            → 409 bloqueo duro
5. if (tasks > 0)                                  → DELETE tasks (JOIN operations)
6. UPDATE kyc_submissions SET mapped_to_id = NULL  → siempre antes del DELETE
7. if (kyc unlinked > 0)                           → audit CLIENT_UNLINK_KYC
8. DELETE FROM clients WHERE id = ?
9. audit CLIENT_FORCE_DELETE | CLIENT_PERMANENT_DELETE
10. Response: { ok, deleted_id, glv_code, force, kyc_unlinked }
```

---

## Historial de cambios

| Commit | Descripción |
|---|---|
| `077db26` | canDeleteClient() — integridad referencial inicial (incluía kyc_submissions como bloqueo) |
| `6bb8b18` | Fix tasks JOIN — tasks no tiene client_id directo |
| `92a0433` | Elimina kyc_submissions como bloqueo de canDeleteClient |
| `eb42317` | Mensaje 409 incluye contadores reales |
| `f958275` | FORCE DELETE cuando solo tasks bloquean |
| `d64698a` | Unlink kyc_submissions antes del DELETE — libera FK, preserva historial |

---

## Regla de no modificación

Esta decisión se considera comportamiento esperado del sistema.  
No debe modificarse sin aprobación explícita del equipo.
