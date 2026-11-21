# Informe de ejecución — PR #160

**SHA probado (base):** 0099feb en `fix/client-activation-email-verification`. El SHA del commit de corrección queda en el historial de la rama (un commit no puede contener su propio SHA).

## Cambio
- `index.html`: se eliminan `.mob-menu-overlay` / `#mobMenuOverlay` (position:fixed, inset:0, fondo rgba(0,0,0,.5), role=dialog, aria-modal=true) y el bloqueo de `document.body.style.overflow`. Se sustituyen por un menú desplegable `#mobMenu` (`role="region"`), dentro de `<nav>`, `position:absolute` bajo la barra, ancho acotado (`min(320px, 100vw-1.2rem)`), sin fondo de cobertura, no modal. Hamburguesa con `aria-controls="mobMenu"` y `aria-expanded`; alterna abrir/cerrar; cierre con botón ✕, Escape (devuelve foco a la hamburguesa) y clic exterior (listener de documento solo mientras está abierto). Se conservan enlaces, botón de instalación en `#mob-pwa-slot` y `markInstalled`/`removeHint`.
- `tests/pwa-security.test.mjs` (E5): exige `#mobMenu`, ausencia de overlay, aria-controls/aria-expanded y ausencia de bloqueo de scroll.
- `tests/pwa-install-behavior.test.mjs`: se retira el `replace` que excluía el menú; la sección 6 revisa HTML y reglas CSS reales de `index.html`, `registro-clientes.html` y `portal-clientes.html` (sin dialog/aria-modal/role=dialog/overlay, ninguna regla fixed+inset:0 ni fixed con fondo oscuro, sin scroll lock). Nueva sección 7: abrir/cerrar menú (hamburguesa, ✕, Escape, clic exterior), botón PWA accesible en el menú, prompt nativo (escritorio) o guía Safari (iPhone/iPadOS MacIntel), y limpieza tras `appinstalled`.
- `tests/playwright-pwa.test.mjs`: selectores actualizados a `#mobMenu` y sin whitelist de overlays (no ejecutado, ver limitaciones).

## Comandos y resultados
- `npm run test:pwa` → 2/2 archivos pasan.
- `node tests/glv-forms.test.cjs` → 24/24 pasan (sin cambios en ese código).

## Limitaciones
- DOM simulado (`node:vm`), no navegador real; el CSS se analiza por reglas, no se calcula layout.
- `tests/playwright-pwa.test.mjs` solo se verificó sintácticamente (`node --check`); no se ejecutó (sin navegador/servidor).
- `glv-forms.test.cjs` no cubre SMTP ni el router `/registration`; sin prueba integral del alta de clientes.
- `.github/AI_AUTOMATION_PROTOCOL.md` no existe en el repositorio.
- Sin merge, despliegue, cambios de secretos ni contacto con clientes.
