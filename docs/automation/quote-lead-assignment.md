# Cotización web y asignación manual

Requisito autorizado por el propietario el 25 de noviembre de 2026.

La cotización recibida desde la web entra a GOS sin agente asignado. Un usuario interno autorizado revisa la solicitud, pulsa Asignar agente, elige un agente activo y confirma. Guardar esa asignación incorpora el lead a la bandeja del agente y genera un aviso a su correo corporativo registrado con los datos comerciales y de contacto aportados y un enlace autenticado.

La llegada del lead no envía correo a agentes. La preferencia indicada en el formulario público no autoriza asignaciones. Conservar confirmaciones al solicitante y avisos internos existentes. No confundir solicitud de cotización con aprobación KYC.

## Criterios de aceptación

- Persistencia de solicitud y origen/UTM disponible, con clave idempotente y sin duplicación por reintento.
- Revisión y asignación manual con permisos comprobados en servidor.
- Agente activo y correo de destino obtenido de su registro interno.
- Asignación, auditoría y aviso pendiente guardados transaccionalmente.
- Fallo SMTP visible y recuperable, sin perder asignación ni duplicar avisos al repetir la operación.
- Agente con acceso a sus leads y denegación de acceso a los ajenos.
- Datos del correo escapados, sin contraseñas ni documentos KYC.
- Pruebas con datos ficticios y correo capturado para llegada, asignación, reintentos, fallo SMTP, reasignación y permisos.
- Evidencia en docs/automation/latest-execution-report.md. Distinguir pruebas simuladas de integración real.

## Entrega

Implementación en esta rama y PR en borrador. Revisar primero estructuras, rutas y pruebas existentes para reutilizarlas. Entregar incrementos acotados. No modificar el candidato de alta del PR 174. Sin merge ni despliegue durante este encargo.
