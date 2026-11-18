# Plan maestro de ejecución GOS

Fecha de actualización: 18 de noviembre de 2026.

## Objetivo

GOS será el sistema operativo de GLV para una operación internacional completa, desde la validación comercial hasta el cierre financiero y la trazabilidad de cada decisión. El sistema conservará control de responsables, evidencias, alertas y auditoría.

## Estado real de la base actual

| Área | Estado | Uso permitido hoy |
|---|---|---|
| Comercial, KYC y cotizaciones | Operativo parcial | Gestión interna controlada |
| Logística, compras, inventario y aduanas | Operativo parcial | Ejecución interna tras pruebas de permisos y transiciones |
| Documentos SCO, FCO y SPA | Comercial | Documentos no fiscales |
| Tablero financiero | Informativo | Seguimiento comercial, no contabilidad oficial |
| Facturación, impuestos y nómina | Base pendiente | No emitir ni presentar como documento fiscal |
| Portal de cliente y alquiler a terceros | Pendiente | No comercializar como SaaS |
| PWA y experiencia móvil | Pendiente | No se considera lista para producción móvil |

## Cadena operativa obligatoria

1. Cliente, KYC y evaluación comercial.
2. Cotización, proforma y aprobación.
3. Contrato, presupuesto y apertura de operación.
4. Compra, reserva de inventario y proveedores.
5. Logística, documentos, transporte, aduana y evidencia.
6. Entrega, factura comercial, cuentas por cobrar y recaudo.
7. Costos, cuentas por pagar, conciliación y cierre.
8. Expediente auditable de operación.

Cada etapa debe registrar responsable, fecha límite, documentos requeridos, estado, alertas y bitácora. No se debe permitir avanzar cuando falte una aprobación o una evidencia marcada como obligatoria.

## Fase 0. Controles que bloquean merge y despliegue

- Corregir el listado de logística para que no use variables indefinidas y limite resultados por creador o responsable.
- Aplicar autorización por operación en cada mutación logística y de inteligencia de carga.
- Ejecutar cambio de estado, creación de tareas y auditoría en una transacción.
- Montar limitación de solicitudes en rutas sensibles, incluida recuperación de contraseña.
- Ejecutar al inicio la detección de tareas vencidas.
- Mantener reportes de inventario separados entre existencia física, reserva y liberación.
- Ejecutar pruebas desde una instalación limpia, build de frontend y flujo de acceso sin pantalla blanca.

## Fase 1. Operación integrada

- Unir la operación comercial, compras, inventario, logística, aduana, entrega y cierre bajo un identificador común.
- Generar tareas y alertas por etapa, vencimiento, incidente y documento faltante.
- Añadir centro de mando de operación con hitos, responsable, evidencia, costo, ingreso, riesgo y auditoría.
- Exponer conectores mediante adaptadores: transportadora, naviera, freight forwarder, aduana, puerto y seguimiento. Cada conector usará trabajos asíncronos, idempotencia, reintentos y registro de respuesta.

## Fase 2. Núcleo financiero comercial

- Crear entidad legal, establecimiento, perfil tributario, período, catálogo de cuentas, dimensiones y moneda funcional.
- Crear proforma y factura comercial con líneas, versión, idioma, moneda, Incoterm, origen, clasificación HS o HTS, bultos, peso, flete, seguro y vínculo a operación.
- Mantener la proforma fuera del ciclo fiscal y permitir su conversión trazable a factura comercial.
- Añadir cuentas por cobrar, cuentas por pagar, pagos, tasa de cambio fechada, conciliación y libro diario de partida doble.
- Usar importes de precisión fija o unidades menores. No usar punto flotante para cálculos financieros.
- Bloquear la modificación de períodos cerrados y corregir documentos emitidos mediante nota, nunca sobrescribiendo el original.

## Fase 3. Cumplimiento por región

| Región | Alcance inicial | Condición de activación |
|---|---|---|
| Colombia | Adaptador DIAN o proveedor autorizado, factura electrónica, notas, documento soporte y nómina electrónica | Habilitación, numeración autorizada, sandbox aprobado y responsable tributario |
| Brasil | Adaptadores independientes NF-e, NFS-e y eSocial, configurados por entidad, UF y municipio | Certificado, CNPJ, inscripciones aplicables, homologación y especialista local |
| Estados Unidos | Factura comercial propia, exportación, cuentas y reglas de sales tax configurables | Entidad legal, política por jurisdicción y revisión contable |
| Otros países | Adaptador externo de facturación, contabilidad o nómina según regulación | Matriz de país aprobada y pruebas de integración |

Ningún PDF comercial actual debe denominarse factura fiscal, NF-e, nómina electrónica o documento tributario válido.

## Fase 4. Producto de cliente y crecimiento

- Crear portal de cliente separado: Mis operaciones, Documentos aprobados, Hitos y alertas, Pagos y solicitudes.
- Ocultar márgenes, precios internos, tareas internas, datos de terceros, KYC sensible y administración.
- Agregar PWA con botón de instalación en escritorio y menú móvil. Usar beforeinstallprompt cuando exista. Cuando no exista, presentar guía breve en línea. Incluir instrucciones Safari para iPhone y iPad. Ocultar instalación en modo standalone. No usar modal ni overlay de pantalla completa para esta guía.
- Diseñar navegación móvil, objetivos táctiles de 44 px y tablas que se adapten a tarjetas o desplazamiento controlado.
- Completar traducciones por módulo, pt-BR y diseño RTL para árabe. Separar idioma de interfaz, documento y comunicación.

## Fase 5. SaaS con privacidad empresarial

Antes de alquilar módulos a empresas externas, crear Organization, LegalEntity, Membership, Role, ModuleEntitlement y Subscription. Todas las entidades operativas, financieras, documentales, inventario, tareas, evidencia y auditoría llevarán organization_id. La autorización aplicará alcance organizacional antes de cada consulta. La migración a PostgreSQL y las pruebas de aislamiento entre organizaciones son requisitos previos.

## Diseño de producto

El sistema conservará la identidad corporativa y centralizará sus componentes con tokens de color, espaciado, tipografía, formularios, tablas, estados y vacíos. Azul marino representa estructura, verde petróleo la ejecución correcta, dorado el control directivo y rojo el bloqueo. Cada pantalla debe mostrar datos, estado, siguiente acción y responsable.

## Criterios para producción

1. Pruebas automáticas ejecutables desde instalación limpia.
2. Build de frontend y pruebas de rutas autenticadas sin pantalla blanca.
3. Pruebas de permisos entre usuarios, clientes, operaciones y entidades legales.
4. Pruebas de transición, auditoría, tareas y reversión ante error.
5. Pruebas de moneda, precisión, doble partida, cierre e inmutabilidad antes de activar finanzas.
6. Pruebas de rechazo, reintento e idempotencia antes de activar un conector.
7. Revisión funcional, seguridad, financiera y comercial antes de cada merge o despliegue.

## Próximo hito

Cerrar la Fase 0, publicar la base de proforma y factura comercial no fiscal, y validar el flujo completo de una operación interna de prueba. La integración fiscal regional se habilitará después de las pruebas de la Fase 2 y las aprobaciones especializadas de la Fase 3.
