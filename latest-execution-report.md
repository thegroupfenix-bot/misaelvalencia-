# Alta de clientes GOS, 26 de noviembre de 2026

El objetivo de las 18:00 de Colombia venció sin confirmación del alta en producción.

## Evidencia
- [PR 174](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/174), borrador abierto. Candidato exacto b97bacfeb7ddb015ca0591586ea468ac50295673.
- GitHub Actions en verde para [web](https://github.com/thegroupfenix-bot/misaelvalencia-/actions/runs/45537809866), [formularios](https://github.com/thegroupfenix-bot/misaelvalencia-/actions/runs/45537810187) y [GOS](https://github.com/thegroupfenix-bot/misaelvalencia-/actions/runs/45537809937). En GOS confirmé los trabajos de compilación frontend y pruebas backend.
- Claude entregó 6 de 6 escenarios locales con correo capturado. La prueba local no demuestra entrega desde Apps Script.
- Railway confirmó staging dedicado SUCCESS, c71a537d-3527-406a-8e0a-03492c16f174, SHA exacto del candidato. El despliegue 8ffcbb91, SHA 0d94484, corresponde al staging anterior. Producción SUCCESS, 2e4b1cde-3e32-4826-a525-f36d0d17585f, SHA 15074c2dc22b3d80528e3cf96c69a34e191dd135. Railway indica reversión disponible. Respaldo y restauración aún por verificar.
- Cambios revisados: rutas de registro y clientes, pruebas de registro, puente e idempotencia KYC y generador en Apps Script. El primer despliegue dedicado tomó main. Fijar el SHA permitió verificar el candidato sin modificar producción.

## Pendiente
Confirmar autorización e inicialización del proyecto separado de Apps Script. Después, ejecutar con base aislada y correo de prueba el registro web, recepción y confirmación del código, visibilidad en Leads/KYC, reintento sin duplicados, tarea, evento, roles y PWA. Comprobar respaldo y restauración antes de integrar. Después de desplegar, verificar SHA y recorrido en producción.

## Inventario
[PR abiertos](https://github.com/thegroupfenix-bot/misaelvalencia-/pulls?q=is%3Apr+is%3Aopen). Alta 165/174. Cotizaciones 178, implementación y pruebas pendientes según el borrador. Leads y avisos 143/142. Comercial 135/136/50. Logística y carga 137 a 141. Tareas 65. Seguridad 107/133/147. PWA 106/146. Otros 1/2. El PR 138 anuncia pruebas en su título. La ejecución de esos otros PR y su uso efectivo en producción quedan sin verificar. Sin cambios a automatizaciones PWA ni a PR 133/143.

## Verificación del 27 de noviembre
El arranque del despliegue dedicado c71a537d registra JWT temporal, ausencia de volumen en /data y credencial de arranque de desarrollo. El almacenamiento actual es efímero. El estado SUCCESS acredita arranque, pero no persistencia de registros ni sesiones. La consulta al registro HTTP no devolvió entradas y no demuestra recorridos de integración. Antes de probar persistencia, falta configurar y verificar almacenamiento aislado y autenticación estable de staging por canales autorizados. Sigue pendiente iniciar Apps Script y ejecutar el recorrido real. Producción conserva 15074c2.

Se montó un volumen aislado en /data y se configuró una clave de sesión estable en el servicio dedicado. Railway confirmó SUCCESS para ee4c73c1-f569-40dc-8bf2-375e68a8692f con el SHA exacto b97bacfeb7ddb015ca0591586ea468ac50295673. Al ejecutar initializeGLV, Google mostró que el proyecto requiere autorización. La prueba real del alta y el despliegue productivo siguen pendientes.

### Conectividad del puente, 27 de noviembre
Volumen /data y variable de sesión presentes en staging. Railway mantiene SUCCESS para ee4c73c1 con b97bacf y producción en 15074c2. Apps Script requiere un origen HTTPS autorizado para el puente. La configuración del servicio dedicado no muestra red pública, y Railway no devuelve entradas HTTP para el despliegue. Sigue pendiente demostrar el acceso por una ruta autorizada, confirmar el permiso de inicialización en Google y ejecutar el recorrido. [Encargo acotado a Claude](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/174#issuecomment-7220477330).
