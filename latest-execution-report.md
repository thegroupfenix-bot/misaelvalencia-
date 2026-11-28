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

### Control de acceso del puente, 27 de noviembre
Claude terminó el diagnóstico. La revisión del candidato reveló que el receptor KYC no exige credencial del puente y que el manifiesto versionado carece del permiso para solicitudes externas. La prueba real sigue pendiente. Se solicitó proteger el receptor dedicado y verificar rechazo sin escrituras y alta válida sin duplicados con datos ficticios. Staging ee4c73c1 sigue en b97bacf con estado SUCCESS y tres verificaciones CI aprobadas. Producción 2e4b1cde sigue en 15074c2 con estado SUCCESS. El inventario de 21 PR abiertos no cambió. [Orden de corrección](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/174#issuecomment-7222340035).

### Entrega de la orden a Claude, 27 de noviembre
GitHub devuelve el cuerpo de la orden 7222340035 con el marcador de ejecución antes de la mención. El [trabajo de Claude](https://github.com/thegroupfenix-bot/misaelvalencia-/actions/runs/46026972369) terminó, pero su respuesta 7222347342 dice que no reconoció el marcador y no implementó ni probó la corrección. La causa de la discrepancia entre el cuerpo original y lo que recibió o interpretó el ejecutor aún no está confirmada. No se repitió la orden. PR 174 permanece en b97bacf; tres workflows de validación correctos. Railway mantiene staging ee4c73c1 en b97bacf y producción 2e4b1cde en 15074c2, ambos SUCCESS. Inventario sin cambios: 21 PR abiertos. Pendiente corregir la entrega del comentario al ejecutor, proteger el puente y verificar el alta real en staging.

### Diagnóstico del marcador, 27 de noviembre
El cuerpo de la orden 7222340035 en GitHub contiene el marcador antes de la mención. El registro del trabajo 140600765372 muestra el bloque `trigger_comment` entregado a Claude: conserva la orden y la mención, pero omite el comentario HTML que contiene el marcador. Esto acota el fallo a la preparación de la entrada de Claude. El paso exacto que lo elimina no se verificó. Para corregirlo, el flujo autorizado debe validar el cuerpo original y al propietario desde el evento de GitHub, y transmitir el resultado de esa validación sin depender del texto recortado. No se alteró el control de ejecución ni se reenviaron órdenes. PR 174 sigue en b97bacf con tres validaciones CI exitosas. Railway no cambió y el inventario permanece en 21 PR abiertos.

### Confirmación en la acción de Claude, 27 de noviembre
El trabajo 140600765372 descargó `anthropics/claude-code-action@v1` en `4411a9e9b0283becf4b924f7bce360fd7756c78c`. [El código de esa versión](https://github.com/anthropics/claude-code-action/blob/4411a9e9b0283becf4b924f7bce360fd7756c78c/src/github/utils/sanitizer.ts) elimina los comentarios HTML al preparar contenido para el modelo. El `trigger_comment` en el registro conserva la orden visible y omite el marcador. La validación del propietario y del marcador debe ocurrir en el evento original antes del filtrado y mantenerse fuera del texto del comentario. No se modificaron permisos ni se repitió la orden. El PR 174 y los despliegues conservan los SHA ya registrados.

### Evidencia de CI por PR relacionado, 28 de noviembre
El inventario sigue en 21 PR abiertos. Esta comprobación cubre los relacionados con alta, comercial y operaciones. El conector muestra ejecuciones asociadas al SHA con evento de pull request. Una fila sin resultados no equivale a un fallo ni descarta pruebas por otros eventos. Ninguna de estas filas acredita que el módulo esté operativo en producción.

| PR | SHA | Estado | GitHub Actions |
|---|---|---|---|
| [178](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/178) | `d5a5c3e1b0850d1071257f6a4bc4f4b4ce46c0a3` | Borrador | [success](https://github.com/thegroupfenix-bot/misaelvalencia-/actions/runs/45711700656), [success](https://github.com/thegroupfenix-bot/misaelvalencia-/actions/runs/45711700649) |
| [165](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/165) | `ab1e4cec6b6ec0a7a3337ae2ce5979b7f0efcffe` | Borrador | [success](https://github.com/thegroupfenix-bot/misaelvalencia-/actions/runs/44904587848), [success](https://github.com/thegroupfenix-bot/misaelvalencia-/actions/runs/44904587860) |
| [142](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/142) | `42899ea9cc8f7b82b4d37e4e0d71e6e872b39933` | Borrador | Sin ejecuciones devueltas para este SHA |
| [141](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/141) | `4984a6032f26441f39b2a437e26c804416a9eb32` | Borrador | [success](https://github.com/thegroupfenix-bot/misaelvalencia-/actions/runs/43972380188), [success](https://github.com/thegroupfenix-bot/misaelvalencia-/actions/runs/43972380209) |
| [140](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/140) | `9a761a24be1f7985e13f6445c52091748c60e9b9` | Borrador | Sin ejecuciones devueltas para este SHA |
| [139](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/139) | `3c7f25ecd82d167116992052e7b09451b5ca39dc` | Borrador | Sin ejecuciones devueltas para este SHA |
| [138](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/138) | `9a812fd8896353f39c56a0914fefb5e1ea66fa1d` | Borrador | Sin ejecuciones devueltas para este SHA |
| [137](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/137) | `28ad2c00d2aeefd56b4c61a2e88e90edcaa655f8` | Borrador | Sin ejecuciones devueltas para este SHA |
| [136](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/136) | `cab31075157e7405633d06c64c358b7ec2ca19e0` | Borrador | Sin ejecuciones devueltas para este SHA |
| [135](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/135) | `7775821142d15f5b0afdf324bdc885dc7335a17a` | Borrador | Sin ejecuciones devueltas para este SHA |
| [65](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/65) | `77d6f3ddbee8f7ebf2007261b603b12688bcfd6f` | Borrador | Sin ejecuciones devueltas para este SHA |
| [50](https://github.com/thegroupfenix-bot/misaelvalencia-/pull/50) | `a666f2b090fe205a80b61988c4da38c69479855f` | Abierto | Sin ejecuciones devueltas para este SHA |

El PR 174 conserva b97bacf con tres ejecuciones exitosas. Staging ejecuta b97bacf y producción 15074c2, ambos SUCCESS en Railway. La corrección del puente y su prueba de integración siguen pendientes. Se conservaron los flujos de PWA y los seguimientos de los PR 133 y 143.
