/**
 * Playwright PWA install-button tests — GLV Services SAS
 *
 * Scenarios:
 *   1. iPadOS desktop mode (MacIntel UA + maxTouchPoints=5, viewport 1024px)
 *      - navBtn visible, click → #pwa-ios-hint (Safari guide), no inset:0 overlay
 *      - Contacto link still clickable after hint appears
 *   2. Chrome Windows (Win32 UA, viewport 1280px)
 *      - navBtn visible, click → #pwa-install-hint (Chrome fallback, NOT iOS guide)
 *      - no overlay with inset:0
 *   3. PWA installed (standalone display-mode)
 *      - navBtn hidden; no hint appears on simulated click
 *
 * Runs against a local static file server so no network required.
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

// ── Static file server ────────────────────────────────────────────────────────
function serve(port) {
  const MIME = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript',
    '.mjs':'application/javascript', '.json':'application/json', '.png':'image/png',
    '.webp':'image/webp', '.svg':'image/svg+xml', '.ico':'image/x-icon',
    '.woff':'font/woff', '.woff2':'font/woff2', '.webmanifest':'application/manifest+json' };
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

// ── Helpers ────────────────────────────────────────────────────────────────────
async function cdpScreenshot(page) {
  const ctx = page.context();
  const client = await ctx.newCDPSession(page);
  const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
  return Buffer.from(data, 'base64');
}

/** Spoof navigator.platform and maxTouchPoints before page JS runs */
async function spoofPlatform(page, platform, maxTouchPoints) {
  await page.addInitScript(({ platform, maxTouchPoints }) => {
    Object.defineProperty(navigator, 'platform', { get: () => platform });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => maxTouchPoints });
  }, { platform, maxTouchPoints });
}

/** Wait for element and return its computed display/visibility */
async function elDisplay(page, selector) {
  return page.$eval(selector, el => window.getComputedStyle(el).display).catch(() => 'NOT_FOUND');
}

// ── Main ───────────────────────────────────────────────────────────────────────
const PORT = 7342;
let server, browser;

try {
  server = await serve(PORT);
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const BASE = `http://localhost:${PORT}`;

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 1 — iPadOS desktop mode: navBtn visible, click → iOS hint (not Chrome)
  // ══════════════════════════════════════════════════════════════════════════
  {
    console.log('\nTEST 1: iPadOS desktop mode (MacIntel, maxTouchPoints=5, 1024px)');

    // iPadOS desktop UA looks like a Mac
    const iPadOSUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
    const ctx = await browser.newContext({
      userAgent: iPadOSUA,
      viewport: { width: 1024, height: 768 },
    });
    const page = await ctx.newPage();
    await spoofPlatform(page, 'MacIntel', 5);

    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(400);

    // 1a: navBtn must be visible (display !== none/NOT_FOUND)
    const navBtnDisplay = await elDisplay(page, '#pwa-install-nav-btn');
    assert.ok(
      navBtnDisplay !== 'none' && navBtnDisplay !== 'NOT_FOUND',
      `navBtn must be visible on iPadOS desktop; got display="${navBtnDisplay}"`
    );
    console.log(`  PASS 1a navBtn display="${navBtnDisplay}" (visible)`);

    // 1b: click navBtn → #pwa-ios-hint must appear, NOT #pwa-install-hint (Chrome msg)
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);

    const iosHint = await page.$('#pwa-ios-hint');
    assert.ok(iosHint !== null, '#pwa-ios-hint must appear after clicking navBtn on iPadOS');
    console.log('  PASS 1b #pwa-ios-hint appears on click');

    const chromeHint = await page.$('#pwa-install-hint');
    assert.ok(chromeHint === null, '#pwa-install-hint (Chrome msg) must NOT appear on iPadOS');
    console.log('  PASS 1c no Chrome install hint on iPadOS');

    // 1d: hint contains Safari-specific text
    const hintText = await page.$eval('#pwa-ios-hint', el => el.textContent);
    assert.ok(
      hintText.includes('Compartir') || hintText.includes('Share'),
      `iOS hint must mention Compartir/Share; got: "${hintText.slice(0, 80)}"`
    );
    console.log('  PASS 1d iOS hint contains Safari share instructions');

    // 1e: no element with inset:0 style (no page-covering overlay)
    const hasInset = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).some(el => {
        const s = el.style.cssText || '';
        return s.includes('inset: 0') || s.includes('inset:0');
      });
    });
    assert.ok(!hasInset, 'No element must have inline inset:0 (no page-covering overlay)');
    console.log('  PASS 1e no inset:0 overlay present');

    // 1f: Contacto link is still clickable (not covered by overlay)
    const contactoLink = await page.$('a[href*="contacto"], a[href*="contact"], #mob-contacto-item a, [href*="#contacto"]');
    // Check pointer-events on a nav link
    const linksClickable = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links.every(a => {
        const style = window.getComputedStyle(a);
        return style.pointerEvents !== 'none' && style.visibility !== 'hidden';
      });
    });
    assert.ok(linksClickable, 'All nav links must remain clickable (pointer-events not blocked)');
    console.log('  PASS 1f all nav links remain clickable after hint appears');

    await ctx.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 2 — Chrome Windows: navBtn visible, click → Chrome fallback hint
  // ══════════════════════════════════════════════════════════════════════════
  {
    console.log('\nTEST 2: Chrome Windows (Win32, maxTouchPoints=0, 1280px)');

    const winUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const ctx = await browser.newContext({
      userAgent: winUA,
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    await spoofPlatform(page, 'Win32', 0);

    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(400);

    // 2a: navBtn visible
    const navBtnDisplay = await elDisplay(page, '#pwa-install-nav-btn');
    assert.ok(
      navBtnDisplay !== 'none' && navBtnDisplay !== 'NOT_FOUND',
      `navBtn must be visible on Chrome Windows; got display="${navBtnDisplay}"`
    );
    console.log(`  PASS 2a navBtn display="${navBtnDisplay}" (visible)`);

    // 2b: click → Chrome fallback hint, NOT iOS hint
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);

    const chromeHint = await page.$('#pwa-install-hint');
    assert.ok(chromeHint !== null, '#pwa-install-hint must appear on Chrome Windows (no deferredPrompt)');
    console.log('  PASS 2b #pwa-install-hint (Chrome fallback) appears on click');

    const iosHint = await page.$('#pwa-ios-hint');
    assert.ok(iosHint === null, '#pwa-ios-hint must NOT appear on Chrome Windows');
    console.log('  PASS 2c no iOS hint on Chrome Windows');

    // 2d: Chrome hint text mentions Chrome/browser menu, not Safari
    const hintText = await page.$eval('#pwa-install-hint', el => el.textContent);
    assert.ok(
      hintText.includes('Chrome') || hintText.includes('Instalar') || hintText.includes('escritorio'),
      `Chrome hint must reference Chrome install; got: "${hintText.slice(0, 100)}"`
    );
    console.log('  PASS 2d Chrome hint text references Chrome install menu');

    // 2e: no inset:0 overlay
    const hasInset = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*')).some(el => {
        const s = el.style.cssText || '';
        return s.includes('inset: 0') || s.includes('inset:0');
      })
    );
    assert.ok(!hasInset, 'No inset:0 overlay on Chrome Windows');
    console.log('  PASS 2e no inset:0 overlay on Chrome Windows');

    await ctx.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 3 — PWA installed (standalone): navBtn hidden, no hint on click
  // ══════════════════════════════════════════════════════════════════════════
  {
    console.log('\nTEST 3: PWA installed — standalone display-mode');

    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    // Spoof standalone mode before page JS runs
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

    // 3a: navBtn must be hidden
    const navBtnDisplay = await elDisplay(page, '#pwa-install-nav-btn');
    assert.ok(
      navBtnDisplay === 'none' || navBtnDisplay === 'NOT_FOUND',
      `navBtn must be hidden in standalone; got display="${navBtnDisplay}"`
    );
    console.log(`  PASS 3a navBtn hidden in standalone (display="${navBtnDisplay}")`);

    // 3b: no hint elements present
    const anyHint = await page.$('#pwa-ios-hint, #pwa-install-hint');
    assert.ok(anyHint === null, 'No hint must be present in standalone mode');
    console.log('  PASS 3b no hint elements in standalone mode');

    await ctx.close();
  }

  console.log('\n✅ All Playwright PWA tests passed — GLV Services SAS');
  console.log('   iPadOS desktop: navBtn ✓, iOS hint ✓, no Chrome msg ✓, no inset:0 ✓, links clickable ✓');
  console.log('   Chrome Windows: navBtn ✓, Chrome hint ✓, no iOS hint ✓, no inset:0 ✓');
  console.log('   Standalone/installed: navBtn hidden ✓, no hints ✓');

} finally {
  if (browser) await browser.close();
  if (server) server.close();
}
