# GLV Forms — instalación privada y puerta de publicación

Estado: código preparado para revisión local. **No está desplegado ni conectado a producción.**
Propietaria de Apps Script/Sheets y emisora: `serviciosglvsas@gmail.com`.
Nunca poner contraseñas, tokens OAuth, ID de hoja ni secreto de firma en HTML, JavaScript público o GitHub.

## Momento exacto de intervención de la propietaria

La intervención se necesita ahora, al crear/autorizar el proyecto en Google. El acceso conectado actualmente no corresponde a la cuenta solicitada. No sirve crear la hoja con otra cuenta y compartirla.

1. Abrir https://script.google.com/ con **serviciosglvsas@gmail.com**. Comprobar el correo en el avatar. Crear proyecto independiente `GLV — Formularios privados`.
2. Copiar `Code.gs`; crear archivo HTML `Bridge` con `Bridge.html`. En Configuración del proyecto, activar la visualización del manifiesto y copiar `appsscript.json`. No cambiar propietario ni compartir el proyecto.
3. Opcional: para seleccionar una hoja existente, establecer `GLV_SHEET_ID` en las **propiedades del script**, no en el código. Debe pertenecer a la cuenta y no tener lectores/editores compartidos. Si no se establece, `setup_` crea una hoja nueva.
4. Ejecutar **`setup_` desde el editor**. En este punto Google pide autorización para crear/usar Sheets, verificar privacidad en Drive y enviar correo. La propietaria revisa y autoriza directamente en Google. No introducir credenciales en este repositorio ni en el chat. `setup_` no envía correos ni borra pestañas; crea las cinco pestañas solicitadas. Puede quedar la pestaña vacía predeterminada de Google; no se utiliza.
5. En propiedades del script comprobar que existen `GLV_SHEET_ID`, `GLV_SIGNING_SECRET` y `GLV_MODE=TEST`. El secreto se genera automáticamente y permanece privado. Para prueba local agregar `GLV_TEST_ORIGIN=http://127.0.0.1:8799`.
6. Implementar → Nueva implementación → Aplicación web. Ejecutar como **Yo (serviciosglvsas@gmail.com)**; acceso **Cualquier persona** para permitir formularios públicos. La hoja sigue privada; solo queda público el receptor, que no expone lectura de registros. La propietaria autoriza este despliegue y copia la URL **`https://script.google.com/macros/s/.../exec`**. No usar `/dev`.
7. Entregar únicamente esa URL pública del Web App al agente. Entonces se coloca en `assets/js/glv-forms-config.js`. No entregar el secreto ni credenciales. Todavía no publicar el sitio.

Las funciones administrativas terminadas en `_` solo se ejecutan desde el editor; no son RPC públicos. El único RPC de formulario es `submitForm`. El servicio usa un iframe de HTML Service y `google.script.run`, con postMessage limitado al origen y canal de esa sesión. Esto permite confirmar respuestas sin `fetch` opaco ni asumir CORS de ContentService. Se debe validar el puente real una vez desplegado; las pruebas simuladas no lo sustituyen.

## Prueba real autorizada, antes del PR y merge

- Preparar formulario local con nombre **PRUEBA TÉCNICA GLV**, empresa **PRUEBA TÉCNICA**, email **serviciosglvsas@gmail.com**, otros campos obligatorios claramente ficticios y sin operación comercial. Usar botón de correo para no abrir conversaciones con agentes.
- `TEST` rechaza correos de solicitantes distintos de la propietaria y empresas que no contengan `PRUEBA TÉCNICA`.
- Esperar al menos 3 segundos desde carga del puente; enviar una vez. Verificar fila privada, datos completos, número y tres entradas de envío.
- Reintentar la misma solicitud sin cambiar datos: mismo número, misma fila, cero correos adicionales. No borrar la memoria local del navegador entre intentos.
- Comprobar realmente el correo de contabilidad; en Gmail comprobar **dos mensajes**, uno interno y uno de confirmación. Comparar número en los tres mensajes y en pantalla. El mismo destinatario interno/solicitante recibe dos mensajes con asuntos distintos; no se fusionan en uno.
- Confirmar que la notificación interna contiene datos completos y la confirmación solamente número, nombre/empresa, tipo, fecha y aviso autorizado. No documentos ni detalles KYC.
- `SENT` significa aceptado por MailApp, **no prueba de recepción**. Registrar evidencia de los tres buzones antes de publicar; revisar spam. Los permisos del proyecto no conceden lectura de Gmail. La propietaria puede verificar los mensajes directamente o conectar los buzones adecuados.
- Solo tras comprobar recepción, cambiar `GLV_MODE=LIVE` en las propiedades privadas. `GLV_TEST_ORIGIN` deja de aceptarse en modo LIVE. Ejecutar pruebas locales y diff check; crear PR, esperar Actions en verde, fusionar y comprobar despliegue automático. No despliegue manual en Hostinger.

## Persistencia, reintentos y límites

- `ScriptLock` cubre búsqueda de idempotencia, asignación, escritura y envío. Año en America/Bogota. Contador reservado en propiedades y contrastado con hoja; puede haber saltos si falla la escritura, nunca reutilización intencional.
- Formatos `GLV-CL-AAAA-000001`, `GLV-PRV-AAAA-000001`, `GLV-COT-AAAA-000001`. Los tres subtipos de proveedor comparten secuencia PRV; las cotizaciones comparten COT. No se renumeran registros históricos externos.
- Reintento: UUID persistido en navegador junto a huella SHA-256, sin guardar datos KYC. Servidor compara huella y no acepta modificar una solicitud conservando su UUID. Borrar almacenamiento/cambiar dispositivo pierde esa identidad de reintento; no se puede identificar con certeza la misma solicitud solo por email.
- Cuota: consultar MailApp antes de cada correo. Cada solicitud necesita tres destinatarios; la cuota depende de la cuenta Google. Sin cuota no hay éxito; un reintento conserva el registro y envía solo lo pendiente.
- Si el envío arroja excepción o el proceso se interrumpe durante `SENDING`, queda `UNKNOWN`/`SENDING`. No se reenvía automáticamente porque pudo haberse entregado. Revisar buzón y registro; la propietaria marca `SENT` si está comprobado o `PENDING` solo si se ha comprobado que no salió. Luego reintentar. MailApp y Sheets no tienen una transacción conjunta ni garantía de correo exactamente una vez.
- Antispam: honeypot, desafío firmado de 3 segundos a 24 horas, cinco registros nuevos por email/hora y 25 globales/hora. Origen del navegador validado en postMessage y origen/ruta permitidos en servidor. Apps Script no proporciona IP ni encabezado Origin fiable: no se inventa validación por IP. Un cliente no navegador puede imitar el origen; esto es protección básica, no CAPTCHA/WAF. Mantener supervisión de cuota y abuso.
- No editar/borrar manualmente filas ni contadores de producción; son parte de la integridad de la secuencia e idempotencia. Mantener copia privada y política de retención conforme al manejo de datos de GLV.

## Alcance del sitio

- Clientes; proveedores productos, logística y generales; cotización general (incluye avícola/fertilizantes), ovinos, huevos, catálogo; solicitud del Home.
- Se eliminan transportes Web3Forms en esas cuatro páginas. No hay éxito antes de confirmación del servicio ni mailto simultáneo.
- Las vías explícitas WhatsApp de Cotización conservan su acción solo después de confirmar el registro. No se usan durante la prueba técnica por email.
- El nuevo submit KYC no llama a Railway ni guarda datos personales en localStorage. Se conserva el panel existente y recibe el número y fecha confirmados. Las funciones ERP/GOS heredadas no se modifican ni se ejecutan desde el nuevo envío. No se modifica GLV Connect, Railway ni el sistema GOS.
- Colaboradores (postulaciones laborales) queda fuera de esta implementación de clientes/proveedores/cotizaciones: no tiene categoría ni prefijo autorizado en esta arquitectura. No afirmar que ya usa el servicio nuevo.
- Solo se agregan mensajes operativos en cinco idiomas; contenido comercial, estilos, menús y rutas no se cambian. Se alinean únicamente las muestras operativas GLV-CLI/GLV-SVC/GLV-OTR con los formatos CL/PRV solicitados.

## Validación local

`node --test tests/glv-forms.test.cjs`

Pruebas con servicios Google simulados: nueve variantes, tres correos, privacidad, idempotencia, secuencia compartida y restaurada, cuota y fallo parcial, propietario, campos, origen, honeypot, tiempo, límites, bloqueo, fórmulas de Sheets y sintaxis HTML. No envían correos. La prueba Google real y la recepción siguen pendientes.

Fuentes oficiales: [Web Apps](https://developers.google.com/apps-script/guides/web), [HTML Service RPC](https://developers.google.com/apps-script/guides/html/communication), [LockService](https://developers.google.com/apps-script/reference/lock/lock-service), [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app).
