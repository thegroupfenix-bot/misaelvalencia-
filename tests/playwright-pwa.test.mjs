/**
 * Playwright PWA install-button tests — GLV Services SAS
 *
 * Test 6 (static): manifest, sw.js, serviceWorker.register
 * Test 1: Desktop Chrome Windows 1280px — navBtn, Chrome hint, cierre ×3, cleanup,
 *         overlay computed, WhatsApp+Portal elementFromPoint+intercepción con guía Chrome
 * Test 2: Mobile iPhone 390px — navBtn oculto, hamburguesa clic real, mob-pwa-slot,
 *         iOS hint, cierre guía, noFullWindowFixedOverlay
 * Test 3: iPadOS desktop 1024px — navBtn, iOS hint, cierre ×3, cleanup, overlay,
 *         WhatsApp+Portal elementFromPoint+intercepción con guía iOS
 * Test 4: Chrome Windows (confirmación) — Chrome hint, sin iOS
 * Test 5: PWA standalone — navBtn oculto, sin hints
 * Test 7 (new): beforeinstallprompt simulado — prompt() llamado exactamente 1 vez,
 *               sin guía Chrome cuando prompt nativo existe
 */

import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── Test 6 (static) — run before browser ──────────────────────────────────────
{
  console.log('\nTEST 6 (static): Manifest and SW linked');
  const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(indexSource.includes('rel="manifest"'), 'index.html must link the manifest');
  assert.ok(fs.existsSync(path.join(ROOT, 'manifest.webmanifest')), 'manifest.webmanifest must exist');
  assert.ok(fs.existsSync(path.join(ROOT, 'sw.js')), 'sw.js must exist');
  assert.ok(indexSource.includes('serviceWorker.register'), 'Must register service worker');
  console.log('  PASS 6a manifest linked in HTML');
  console.log('  PASS 6b manifest.webmanifest exists');
  console.log('  PASS 6c sw.js exists');
  console.log('  PASS 6d serviceWorker.register present');
}

// ── Static file server ────────────────────────────────────────────────────────
function serve(port) {
  const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.mjs': 'application/javascript', '.json': 'application/json', '.png': 'image/png',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
    '.mp4': 'video/mp4',
  };
  const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/' || p === '') p = '/index.html';
    const full = path.join(ROOT, p);
    if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    const ext = path.extname(full);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  });
  return new Promise(resolve => server.listen(port, () => resolve(server)));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function spoofPlatform(page, platform, maxTouchPoints) {
  await page.addInitScript(({ platform, maxTouchPoints }) => {
    Object.defineProperty(navigator, 'platform', { get: () => platform });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => maxTouchPoints });
  }, { platform, maxTouchPoints });
}

async function elDisplay(page, selector) {
  return page.$eval(selector, el => window.getComputedStyle(el).display).catch(() => 'NOT_FOUND');
}

/** Check no element has position:fixed + inset:0 INLINE (blocking overlay anti-pattern) */
async function noFixedInset0Inline(page) {
  return page.evaluate(() =>
    !Array.from(document.querySelectorAll('*')).some(el => {
      const s = el.style.cssText || '';
      return (s.includes('inset: 0') || s.includes('inset:0')) &&
             (s.includes('position: fixed') || s.includes('position:fixed'));
    })
  );
}

/**
 * Fail if any visible element covers ≥85% of the viewport with position:fixed.
 * Returns array of offending elements (empty = pass).
 * allowedIds: element IDs to skip (loaders, known overlays unrelated to PWA).
 */
async function noFullWindowFixedOverlay(page, allowedIds = []) {
  return page.evaluate((allowedIds) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const threshold = 0.85;
    const bad = [];
    for (const el of document.querySelectorAll('*')) {
      if (allowedIds.includes(el.id)) continue;
      const cs = window.getComputedStyle(el);
      if (cs.position !== 'fixed') continue;
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const op = parseFloat(cs.opacity);
      if (!isNaN(op) && op < 0.05) continue;
      const r = el.getBoundingClientRect();
      if (r.width >= vw * threshold && r.height >= vh * threshold) {
        bad.push({
          id: el.id || '(no id)',
          cls: (el.className || '').toString().slice(0, 60),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    return bad;
  }, allowedIds);
}

/** Verify key desktop nav links are not blocked (CSS check + elementFromPoint for Cotizar) */
async function desktopLinksAccessible(page) {
  return page.evaluate(() => {
    const selectors = ['a.nav-cta[href="/cotizacion"]'];
    return selectors.every(sel => {
      const el = document.querySelector(sel);
      if (!el) return true;
      const s = window.getComputedStyle(el);
      if (s.pointerEvents === 'none' || s.visibility === 'hidden') return false;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return true;
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      if (!top) return true;
      return el.contains(top) || top.contains(el) || top === el;
    });
  });
}

/** Check elementFromPoint for a selector; returns {ok, detail} */
async function checkElementFromPoint(page, selector) {
  return page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return { ok: true, reason: 'selector not found' };
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return { ok: true, reason: 'zero size, not in viewport' };
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) {
      return { ok: true, reason: 'center outside viewport' };
    }
    const top = document.elementFromPoint(cx, cy);
    if (!top) return { ok: false, reason: 'no element at point' };
    const ok = el === top || el.contains(top) || top.closest(selector) !== null;
    return { ok, topTag: top.tagName, topId: top.id, topHref: top.getAttribute?.('href') };
  }, selector);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const PORT = 7343;
let server, browser;

try {
  server = await serve(PORT);
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const BASE = `http://localhost:${PORT}`;

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 1 — Desktop Chrome Windows 1280px
  // ══════════════════════════════════════════════════════════════════════════
  {
    console.log('\nTEST 1: Desktop Chrome Windows 1280px — hint, cierre ×3, cleanup, overlay, WhatsApp+Portal');
    const winUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const ctx = await browser.newContext({ userAgent: winUA, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await spoofPlatform(page, 'Win32', 0);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(400);

    // 1a — navBtn visible en escritorio
    const navDisplay = await elDisplay(page, '#pwa-install-nav-btn');
    assert.ok(navDisplay !== 'none' && navDisplay !== 'NOT_FOUND',
      `navBtn must be visible on desktop; got "${navDisplay}"`);
    console.log(`  PASS 1a navBtn display="${navDisplay}"`);

    // 1b — overlay móvil cerrado en escritorio
    const overlayOpen = await page.$eval('#mobMenuOverlay', el => el.classList.contains('open')).catch(() => false);
    assert.ok(!overlayOpen, 'Mobile overlay must not be open on desktop load');
    console.log('  PASS 1b mobile overlay is closed on desktop');

    // 1c — Chrome hint al clic
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    const chromeHint = await page.$('#pwa-install-hint');
    assert.ok(chromeHint !== null, '#pwa-install-hint must appear on Chrome Windows');
    console.log('  PASS 1c #pwa-install-hint appears on click');

    // 1d — sin iOS hint en Windows
    const iosHint = await page.$('#pwa-ios-hint');
    assert.ok(iosHint === null, '#pwa-ios-hint must NOT appear on Chrome Windows');
    console.log('  PASS 1d no iOS hint on Windows');

    // 1e — sin inset:0 inline
    assert.ok(await noFixedInset0Inline(page), 'No inline position:fixed+inset:0 allowed');
    console.log('  PASS 1e no inline position:fixed+inset:0');

    // 1f — cierre por clic externo
    await page.click('h1', { force: true });
    await page.waitForTimeout(300);
    assert.ok(await page.$('#pwa-install-hint') === null, 'Hint must close on external click');
    console.log('  PASS 1f hint closes on external click');

    // 1g — cierre por toque en la guía (click DENTRO del hint)
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    assert.ok(await page.$('#pwa-install-hint') !== null, 'Hint must reappear');
    await page.click('#pwa-install-hint');
    await page.waitForTimeout(300);
    assert.ok(await page.$('#pwa-install-hint') === null, 'Hint must close when tapped');
    console.log('  PASS 1g hint closes on tap/click inside the guide');

    // 1h — cierre por timeout simulado
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const h = document.getElementById('pwa-install-hint');
      if (h && h._t) { clearTimeout(h._t); h._t = setTimeout(() => h.click(), 50); }
    });
    await page.waitForTimeout(300);
    assert.ok(await page.$('#pwa-install-hint') === null, 'Hint must close on timeout');
    console.log('  PASS 1h hint closes on timeout');

    // 1i — cleanup de listener: re-clic → exactamente 1 hint en DOM
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    await page.click('h1', { force: true });
    await page.waitForTimeout(200);
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    const hintCount = await page.evaluate(() => document.querySelectorAll('#pwa-install-hint').length);
    assert.equal(hintCount, 1, `Listener cleanup: exactly 1 hint after reopen; found ${hintCount}`);
    await page.click('h1', { force: true });
    await page.waitForTimeout(200);
    console.log('  PASS 1i listener cleanup — exactly 1 hint on reopen');

    // 1j — links Cotizar accesibles por CSS + elementFromPoint
    assert.ok(await desktopLinksAccessible(page), 'Desktop nav links must not be blocked');
    console.log('  PASS 1j Cotizar link accessible (CSS + elementFromPoint)');

    // 1k — WhatsApp accesible por CSS
    const waOk = await page.evaluate(() => {
      const wa = document.querySelector('a.wa-btn[href*="wa.me"], a[href*="wa.me"]');
      if (!wa) return true;
      const s = window.getComputedStyle(wa);
      return s.pointerEvents !== 'none' && s.visibility !== 'hidden';
    });
    assert.ok(waOk, 'WhatsApp link must not be blocked by CSS');
    console.log('  PASS 1k WhatsApp link accessible by CSS');

    // 1l — noFullWindowFixedOverlay con guía Chrome activa
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    assert.ok(await page.$('#pwa-install-hint') !== null, 'Chrome hint must be active for overlay test');
    const badOverlay1l = await noFullWindowFixedOverlay(page, []);
    assert.equal(badOverlay1l.length, 0,
      `No full-window fixed overlay allowed with Chrome guide; found: ${JSON.stringify(badOverlay1l)}`);
    console.log('  PASS 1l noFullWindowFixedOverlay — no pantalla completa con guía Chrome activa');

    // 1m — WhatsApp elementFromPoint (no bloqueado)
    const waEfp = await checkElementFromPoint(page, 'a.wa-btn[href*="wa.me"], a[href*="wa.me"]');
    assert.ok(waEfp.ok, `WhatsApp must be topmost via elementFromPoint; got ${JSON.stringify(waEfp)}`);
    console.log('  PASS 1m WhatsApp elementFromPoint — no bloqueado');

    // 1n — WhatsApp clic real → nueva pestaña (guía Chrome activa)
    const [waPage1n] = await Promise.all([
      ctx.waitForEvent('page'),
      page.click('a.wa-btn[href*="wa.me"], a[href*="wa.me"]'),
    ]);
    await waPage1n.close();
    console.log('  PASS 1n WhatsApp clic real → nueva pestaña con guía Chrome activa');

    // Cerrar hint si quedó abierto
    await page.evaluate(() => { const h = document.getElementById('pwa-install-hint'); if (h) h.click(); });
    await page.waitForTimeout(100);

    // 1o — Portal elementFromPoint (no bloqueado)
    const portalEfp = await checkElementFromPoint(page, 'a.nav-cta[target="_blank"]:not([href="/cotizacion"])');
    assert.ok(portalEfp.ok, `Portal Clientes must be topmost via elementFromPoint; got ${JSON.stringify(portalEfp)}`);
    console.log('  PASS 1o Portal Clientes elementFromPoint — no bloqueado');

    // 1p — Portal clic real → nueva pestaña (reabrir guía Chrome primero)
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    assert.ok(await page.$('#pwa-install-hint') !== null, 'Chrome hint must be active for Portal tab test');
    const [portalPage1p] = await Promise.all([
      ctx.waitForEvent('page'),
      page.click('a.nav-cta[target="_blank"]:not([href="/cotizacion"])'),
    ]);
    await portalPage1p.close();
    console.log('  PASS 1p Portal Clientes clic real → nueva pestaña con guía Chrome activa');

    await ctx.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 2 — Mobile iPhone 390px: navBtn oculto, hamburguesa clic real, iOS hint,
  //          overlay check con whitelist mobMenuOverlay
  // ══════════════════════════════════════════════════════════════════════════
  {
    console.log('\nTEST 2: Mobile iPhone 390px — hamburguesa clic real, iOS hint, overlay check');
    const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const ctx = await browser.newContext({ userAgent: iphoneUA, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await spoofPlatform(page, 'iPhone', 5);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(400);

    // 2a — navBtn oculto en móvil (CSS !important)
    const navDisplay = await elDisplay(page, '#pwa-install-nav-btn');
    assert.ok(navDisplay === 'none' || navDisplay === 'NOT_FOUND',
      `navBtn must be hidden on mobile; got "${navDisplay}"`);
    console.log(`  PASS 2a navBtn hidden on mobile (display="${navDisplay}")`);

    // 2b — abrir hamburguesa mediante clic real (NO classList.add)
    const hamBtn = await page.$('#navHamburger');
    assert.ok(hamBtn !== null, '#navHamburger must exist');
    await page.click('#navHamburger');
    await page.waitForTimeout(300);
    const overlayOpen = await page.$eval('#mobMenuOverlay', el => el.classList.contains('open')).catch(() => false);
    assert.ok(overlayOpen, 'Hamburger click must open #mobMenuOverlay with class open');
    console.log('  PASS 2b hamburguesa abre overlay por clic real (mobMenuOverlay.open=true)');

    // 2c — mob-pwa-slot tiene exactamente 1 botón visible
    const mobBtnCount = await page.$$eval('#mob-pwa-slot button', btns =>
      btns.filter(b => window.getComputedStyle(b).display !== 'none').length
    );
    assert.equal(mobBtnCount, 1, `mob-pwa-slot must have exactly 1 visible button; got ${mobBtnCount}`);
    console.log(`  PASS 2c mob-pwa-slot has exactly 1 install button`);

    // 2d — clic en botón móvil → iOS hint
    await page.click('#mob-pwa-slot button');
    await page.waitForTimeout(200);
    const iosHint = await page.$('#pwa-ios-hint');
    assert.ok(iosHint !== null, '#pwa-ios-hint must appear on iPhone mobile menu click');
    console.log('  PASS 2d iOS hint appears on mobile menu click');

    // 2d-vp — hint tiene dimensiones > 0 y está dentro del viewport
    const hintInViewport = await page.evaluate(() => {
      const h = document.getElementById('pwa-ios-hint');
      if (!h) return { ok: false, reason: 'no hint' };
      const r = h.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (r.width <= 0 || r.height <= 0) return { ok: false, reason: 'zero size', w: r.width, h: r.height };
      const inViewport = r.top >= -1 && r.left >= -1 && r.bottom <= vh + 1 && r.right <= vw + 1;
      return { ok: inViewport, w: Math.round(r.width), h: Math.round(r.height),
               top: Math.round(r.top), left: Math.round(r.left),
               bottom: Math.round(r.bottom), right: Math.round(r.right), vw, vh };
    });
    assert.ok(hintInViewport.ok,
      `iOS hint debe ser visible dentro del viewport; got ${JSON.stringify(hintInViewport)}`);
    assert.ok(hintInViewport.w > 0, `iOS hint debe tener ancho > 0; got ${hintInViewport.w}`);
    assert.ok(hintInViewport.h > 0, `iOS hint debe tener alto > 0; got ${hintInViewport.h}`);
    console.log(`  PASS 2d-vp iOS hint en viewport: w=${hintInViewport.w} h=${hintInViewport.h} top=${hintInViewport.top} left=${hintInViewport.left}`);

    // 2e — cierre por toque en la guía (clic real si accesible, programático como fallback)
    const hintVisible = hintInViewport.ok && hintInViewport.w > 0 && hintInViewport.h > 0;
    if (hintVisible) {
      await page.click('#pwa-ios-hint');
    } else {
      await page.evaluate(() => { const h = document.getElementById('pwa-ios-hint'); if (h) h.click(); });
    }
    await page.waitForTimeout(300);
    assert.ok(await page.$('#pwa-ios-hint') === null, 'iOS hint must close when tapped');
    console.log('  PASS 2e iOS hint closes on tap inside the guide');

    // 2f — sin inset:0 inline
    assert.ok(await noFixedInset0Inline(page), 'No inline position:fixed+inset:0 on mobile');
    console.log('  PASS 2f no inline position:fixed+inset:0');

    // 2g — noFullWindowFixedOverlay (whitelist mobMenuOverlay porque está abierto)
    const badOverlay2g = await noFullWindowFixedOverlay(page, ['mobMenuOverlay']);
    assert.equal(badOverlay2g.length, 0,
      `No full-window fixed overlay allowed on mobile (excluding mobMenuOverlay); found: ${JSON.stringify(badOverlay2g)}`);
    console.log('  PASS 2g noFullWindowFixedOverlay — solo mobMenuOverlay permitido en móvil');

    // 2h — WhatsApp accesible después de cerrar guía iOS (elementFromPoint, con check fuera de viewport)
    const waEfp2h = await checkElementFromPoint(page, 'a.wa-btn');
    assert.ok(waEfp2h.ok, `WhatsApp debe ser accesible después de guía iOS; ${JSON.stringify(waEfp2h)}`);
    console.log('  PASS 2h WhatsApp accesible (elementFromPoint) después de cerrar guía iOS');

    // 2i — Contacto y Cotizar clicables en menú hamburguesa (re-abrir con clic real)
    await page.click('#navHamburger');
    await page.waitForTimeout(300);
    const mobLinksOk = await page.evaluate(() => {
      const checks = [
        { label: 'Cotizar', sel: '#mobMenuOverlay a[href="/cotizacion"]:not([aria-label="Contacto"])' },
        { label: 'Contacto', sel: '#mob-contacto-item a' },
      ];
      return checks.map(({ label, sel }) => {
        const el = document.querySelector(sel);
        if (!el) return { label, ok: false, reason: 'not found' };
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return { label, ok: false, reason: 'hidden' };
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return { label, ok: true, reason: 'zero size (in container)' };
        const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        const isTopmost = top && (el === top || el.contains(top) || top.closest(sel) !== null);
        return { label, ok: isTopmost, topTag: top?.tagName };
      });
    });
    for (const r of mobLinksOk) {
      assert.ok(r.ok, `${r.label} debe ser clicable en menú hamburguesa: ${JSON.stringify(r)}`);
    }
    console.log('  PASS 2i Contacto y Cotizar clicables en menú hamburguesa (después de guía iOS)');

    // 2j — Portal Clientes existe en DOM
    const portalExists = await page.evaluate(() => !!document.querySelector('a.nav-cta[target="_blank"]'));
    assert.ok(portalExists, 'Portal Clientes (a.nav-cta[target="_blank"]) debe existir en DOM');
    console.log('  PASS 2j Portal Clientes existe en DOM');

    await ctx.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 3 — iPadOS desktop mode (MacIntel, maxTouchPoints=5, 1024px)
  //          + overlay check + WhatsApp/Portal con guía iOS activa
  // ══════════════════════════════════════════════════════════════════════════
  {
    console.log('\nTEST 3: iPadOS desktop mode (MacIntel, maxTouchPoints=5, 1024px) — overlay, WhatsApp+Portal');
    const iPadOSUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
    const ctx = await browser.newContext({ userAgent: iPadOSUA, viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    await spoofPlatform(page, 'MacIntel', 5);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(400);

    // 3a — navBtn visible
    const navDisplay = await elDisplay(page, '#pwa-install-nav-btn');
    assert.ok(navDisplay !== 'none' && navDisplay !== 'NOT_FOUND',
      `navBtn must be visible on iPadOS desktop; got "${navDisplay}"`);
    console.log(`  PASS 3a navBtn display="${navDisplay}"`);

    // 3b — iOS hint al clic
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    const iosHint = await page.$('#pwa-ios-hint');
    assert.ok(iosHint !== null, '#pwa-ios-hint must appear on iPadOS click');
    console.log('  PASS 3b #pwa-ios-hint appears on iPadOS click');

    // 3c — sin Chrome hint
    const chromeHint = await page.$('#pwa-install-hint');
    assert.ok(chromeHint === null, '#pwa-install-hint must NOT appear on iPadOS');
    console.log('  PASS 3c no Chrome hint on iPadOS');

    // 3d — texto Safari en la guía
    const hintText = await page.$eval('#pwa-ios-hint', el => el.textContent);
    assert.ok(hintText.includes('Compartir') || hintText.includes('Share'),
      `iOS hint must mention Compartir; got "${hintText.slice(0, 80)}"`);
    console.log('  PASS 3d iOS hint has Safari instructions');

    // 3e — sin inset:0 inline
    assert.ok(await noFixedInset0Inline(page), 'No inline position:fixed+inset:0 on iPadOS');
    console.log('  PASS 3e no inline position:fixed+inset:0');

    // 3f — links accesibles con iOS hint activo (CSS + elementFromPoint)
    assert.ok(await desktopLinksAccessible(page), 'Desktop links must remain accessible with hint active');
    console.log('  PASS 3f Cotizar link accessible with hint active');

    // 3g — cierre por clic externo
    await page.click('h1', { force: true });
    await page.waitForTimeout(300);
    assert.ok(await page.$('#pwa-ios-hint') === null, 'iOS hint must close on external click');
    console.log('  PASS 3g iOS hint closes on external click');

    // 3h — cierre por toque en la guía
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    assert.ok(await page.$('#pwa-ios-hint') !== null, 'iOS hint must reappear');
    await page.click('#pwa-ios-hint');
    await page.waitForTimeout(300);
    assert.ok(await page.$('#pwa-ios-hint') === null, 'iOS hint must close when tapped');
    console.log('  PASS 3h iOS hint closes on tap inside the guide');

    // 3i — cierre por timeout simulado
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const h = document.getElementById('pwa-ios-hint');
      if (h && h._t) { clearTimeout(h._t); h._t = setTimeout(() => h.click(), 50); }
    });
    await page.waitForTimeout(300);
    assert.ok(await page.$('#pwa-ios-hint') === null, 'iOS hint must close on timeout');
    console.log('  PASS 3i iOS hint closes on timeout');

    // 3j — cleanup de listener (re-clic → 1 hint en DOM)
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    await page.click('h1', { force: true });
    await page.waitForTimeout(200);
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    const iosCount = await page.evaluate(() => document.querySelectorAll('#pwa-ios-hint').length);
    assert.equal(iosCount, 1, `Listener cleanup: exactly 1 iOS hint after reopen; found ${iosCount}`);
    await page.click('h1', { force: true });
    await page.waitForTimeout(200);
    console.log('  PASS 3j listener cleanup — exactly 1 iOS hint on reopen');

    // 3k — noFullWindowFixedOverlay con guía iOS activa
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    assert.ok(await page.$('#pwa-ios-hint') !== null, 'iOS hint must be active for overlay test');
    const badOverlay3k = await noFullWindowFixedOverlay(page, []);
    assert.equal(badOverlay3k.length, 0,
      `No full-window fixed overlay allowed with iOS guide active; found: ${JSON.stringify(badOverlay3k)}`);
    console.log('  PASS 3k noFullWindowFixedOverlay — no pantalla completa con guía iOS activa');

    // 3l — WhatsApp elementFromPoint (no bloqueado, con guía iOS activa)
    const waEfp3l = await checkElementFromPoint(page, 'a.wa-btn[href*="wa.me"], a[href*="wa.me"]');
    assert.ok(waEfp3l.ok, `WhatsApp must be topmost via elementFromPoint; got ${JSON.stringify(waEfp3l)}`);
    console.log('  PASS 3l WhatsApp elementFromPoint — no bloqueado con guía iOS activa');

    // 3m — WhatsApp clic real → nueva pestaña (guía iOS activa)
    const [waPage3m] = await Promise.all([
      ctx.waitForEvent('page'),
      page.click('a.wa-btn[href*="wa.me"], a[href*="wa.me"]'),
    ]);
    await waPage3m.close();
    console.log('  PASS 3m WhatsApp clic real → nueva pestaña con guía iOS activa');

    // Cerrar hint si quedó abierto
    await page.evaluate(() => { const h = document.getElementById('pwa-ios-hint'); if (h) h.click(); });
    await page.waitForTimeout(100);

    // 3n — Portal elementFromPoint (no bloqueado)
    const portalEfp3n = await checkElementFromPoint(page, 'a.nav-cta[target="_blank"]:not([href="/cotizacion"])');
    assert.ok(portalEfp3n.ok, `Portal Clientes must be topmost via elementFromPoint; got ${JSON.stringify(portalEfp3n)}`);
    console.log('  PASS 3n Portal Clientes elementFromPoint — no bloqueado con guía iOS');

    // 3o — Portal clic real → nueva pestaña (reabrir guía iOS primero)
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    assert.ok(await page.$('#pwa-ios-hint') !== null, 'iOS hint must be active for Portal tab test');
    const [portalPage3o] = await Promise.all([
      ctx.waitForEvent('page'),
      page.click('a.nav-cta[target="_blank"]:not([href="/cotizacion"])'),
    ]);
    await portalPage3o.close();
    console.log('  PASS 3o Portal Clientes clic real → nueva pestaña con guía iOS activa');

    await ctx.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 4 — Chrome Windows: Chrome hint, no iOS hint (confirmación)
  // ══════════════════════════════════════════════════════════════════════════
  {
    console.log('\nTEST 4: Chrome Windows — Chrome hint confirmed, no iOS hint');
    const winUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const ctx = await browser.newContext({ userAgent: winUA, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await spoofPlatform(page, 'Win32', 0);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(400);

    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);

    const chromeHint = await page.$('#pwa-install-hint');
    assert.ok(chromeHint !== null, '#pwa-install-hint must appear on Chrome Windows');
    console.log('  PASS 4a Chrome hint appears');

    const iosHint = await page.$('#pwa-ios-hint');
    assert.ok(iosHint === null, '#pwa-ios-hint must NOT appear on Chrome Windows');
    console.log('  PASS 4b no iOS hint on Windows');

    const hintText = await page.$eval('#pwa-install-hint', el => el.textContent);
    assert.ok(hintText.includes('Chrome') || hintText.includes('Instalar') || hintText.includes('escritorio'),
      `Chrome hint must reference Chrome/install; got "${hintText.slice(0, 100)}"`);
    console.log('  PASS 4c Chrome hint text references Chrome menu');

    assert.ok(await noFixedInset0Inline(page), 'No inline position:fixed+inset:0 on Chrome Windows');
    console.log('  PASS 4d no inline position:fixed+inset:0');

    await ctx.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 5 — PWA standalone: navBtn oculto, sin hints
  // ══════════════════════════════════════════════════════════════════════════
  {
    console.log('\nTEST 5: PWA standalone/installed');
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query) => ({
          matches: query === '(display-mode: standalone)',
          media: query, onchange: null,
          addListener: () => {}, removeListener: () => {},
          addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
        }),
      });
      Object.defineProperty(navigator, 'standalone', { get: () => true });
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(400);

    const navDisplay = await elDisplay(page, '#pwa-install-nav-btn');
    assert.ok(navDisplay === 'none' || navDisplay === 'NOT_FOUND',
      `navBtn must be hidden in standalone; got "${navDisplay}"`);
    console.log(`  PASS 5a navBtn hidden in standalone (display="${navDisplay}")`);

    const anyHint = await page.$('#pwa-ios-hint, #pwa-install-hint');
    assert.ok(anyHint === null, 'No hints in standalone mode');
    console.log('  PASS 5b no hints in standalone mode');

    await ctx.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 7 — beforeinstallprompt simulado:
  //   deferredPrompt.prompt() debe llamarse exactamente 1 vez,
  //   no debe mostrarse guía Chrome cuando existe prompt nativo
  // ══════════════════════════════════════════════════════════════════════════
  {
    console.log('\nTEST 7: beforeinstallprompt simulado — prompt() exactamente 1 vez, sin guía Chrome');
    const winUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const ctx = await browser.newContext({ userAgent: winUA, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await spoofPlatform(page, 'Win32', 0);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(400);

    // Inyectar evento beforeinstallprompt simulado con contador de prompt()
    await page.evaluate(() => {
      window._pwaPromptCallCount = 0;
      const ev = new Event('beforeinstallprompt');
      ev.preventDefault = () => {};
      ev.prompt = () => {
        window._pwaPromptCallCount++;
        return Promise.resolve({ outcome: 'accepted' });
      };
      ev.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(ev);
    });
    await page.waitForTimeout(200);

    // Clic en el botón de instalación — debe llamar prompt() nativo
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(400);

    // 7a — deferredPrompt.prompt() llamado exactamente 1 vez
    const callCount = await page.evaluate(() => window._pwaPromptCallCount || 0);
    assert.equal(callCount, 1,
      `deferredPrompt.prompt() must be called exactly once; called ${callCount} times`);
    console.log(`  PASS 7a deferredPrompt.prompt() called exactly once (count=${callCount})`);

    // 7b — sin guía Chrome cuando prompt nativo existe (no showInstallHint)
    const chromeHintAfter = await page.$('#pwa-install-hint');
    assert.ok(chromeHintAfter === null,
      '#pwa-install-hint must NOT appear when native beforeinstallprompt was available');
    console.log('  PASS 7b no Chrome guide shown when native prompt exists');

    await ctx.close();
  }

  console.log('\n✅ All Playwright PWA tests passed — GLV Services SAS');
  console.log('   Test 1: Desktop 1280px — navBtn ✓, Chrome hint ✓, cierre ×3 ✓, cleanup ✓, overlay ✓, WhatsApp+Portal elementFromPoint+nueva pestaña ✓');
  console.log('   Test 2: Mobile iPhone 390px — navBtn oculto ✓, hamburguesa clic real ✓, iOS hint en viewport ✓, cierre guía ✓, overlay whitelist ✓, WhatsApp/Contacto/Cotizar/Portal ✓');
  console.log('   Test 3: iPadOS 1024px — navBtn ✓, iOS hint ✓, cierre ×3 ✓, cleanup ✓, overlay ✓, WhatsApp+Portal elementFromPoint+nueva pestaña ✓');
  console.log('   Test 4: Chrome Windows — Chrome hint ✓, no iOS ✓, no inset:0 ✓');
  console.log('   Test 5: Standalone — navBtn hidden ✓, no hints ✓');
  console.log('   Test 6: Manifest + SW — all files linked ✓');
  console.log('   Test 7: beforeinstallprompt — prompt() ×1 ✓, no Chrome guide con prompt nativo ✓');

} finally {
  if (browser) await browser.close();
  if (server) server.close();
}
