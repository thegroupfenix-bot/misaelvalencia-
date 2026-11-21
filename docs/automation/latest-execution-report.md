# Informe de ejecución — PR #160

**SHA probado (base):** f47fda1 en `fix/client-activation-email-verification`. El SHA del commit de corrección queda en el historial de la rama (un commit no puede contener su propio SHA).

## Cambio
- `index.html` (script PWA): `appinstalled` se registra antes de cualquier retorno por iOS/standalone. Nueva limpieza centralizada `markInstalled()` + `removeHint()`: anula `deferredPrompt`, oculta botón de escritorio, renderiza el slot móvil como «instalado», elimina `pwa-install-hint`/`pwa-ios-hint` con su temporizador y listener de documento. Se usa en la detección inicial de standalone, en `appinstalled` y al aceptar el prompt nativo. Tras instalación, `showInstallHint`/`showIOSHint`, `renderMobPWA` (no-installed) y `beforeinstallprompt` quedan inertes.
- `registro-clientes.html` y endpoints `/registration/*`: sin cambios (panel en línea conservado).

## Archivos
- `index.html`
- `tests/pwa-install-behavior.test.mjs` (nuevo; ejecuta el script real de index.html en DOM simulado con `node:vm`)
- `package.json` (`test:pwa` incluye el nuevo archivo)
- `docs/automation/latest-execution-report.md`

## Comandos y resultados
- `npm run test:pwa` → 2/2 archivos pasan (pwa-security A–G + pwa-install-behavior 1–6).
- `node tests/glv-forms.test.cjs` → 24/24 pasan (ver nota de alcance).
- Con el `index.html` anterior, el nuevo test de comportamiento falla (comprobado).

## Casos cubiertos (comportamiento real)
Escritorio, iPhone e iPadOS (MacIntel + touch): `appinstalled`; guía abierta antes de `appinstalled` (sin temporizador ni listener residual); standalone inicial (más eventos posteriores sin reactivar controles); botón de escritorio y botón del menú móvil; prompt nativo disponible, rechazado/consumido y aceptado; guía no bloqueante sin prompt; instrucciones Safari (Compartir / pantalla de inicio); ausencia de modal/overlay de instalación en `index.html`, `registro-clientes.html`, `portal-clientes.html` (se excluye el menú de navegación preexistente `mobMenuOverlay`, que no es guía de instalación).

## No ejecutado / limitaciones
- DOM simulado, no navegador real (Chrome/Safari/iOS reales no probados; `beforeinstallprompt`/`appinstalled` simulados).
- `glv-forms.test.cjs` no valida SMTP ni el router Express `/registration`; no hay prueba integral del alta de clientes. Tampoco se ejecutó backend ni SMTP.
- `.github/AI_AUTOMATION_PROTOCOL.md` no existe en el repositorio; no pudo leerse.
- Sin merge, despliegue, cambios de secretos ni contacto con clientes.
