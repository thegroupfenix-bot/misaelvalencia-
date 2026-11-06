/**
 * Playwright PWA install-button tests — GLV Services SAS
 *
 * Test 1: Desktop Chrome Windows 1280px — exactly 1 navBtn visible, Chrome hint on click
 * Test 2: Mobile iPhone 390px — navBtn hidden, mob-pwa-slot has 1 iOS button
 * Test 3: iPadOS desktop 1024px (MacIntel+touch) — navBtn visible, iOS hint on click
 * Test 4: Chrome Windows (duplicate scenario, confirms Chrome hint, no iOS hint)
 * Test 5: PWA standalone — navBtn hidden, no hints
 * Test 6: Manifest + SW linked (static check)
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

async function hasInset0(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('*')).some(el => {
      const s = el.style.cssText || '';
      return s.includes('inset: 0') || s.includes('inset:0');
    })
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const PORT = 7343;
let server, browser;

try {
  server = await serve(PORT);
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const BASE = `http://localhost:${PORT}`;

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 1 — Desktop Chrome Windows 1280px: navBtn visible, exactly 1 install btn
  // ══════════════════════════════════════════════════════════════════════════
  {
    console.log('\nTEST 1: Desktop Chrome Windows 1280px');
    const winUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const ctx = await browser.newContext({ userAgent: winUA, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await spoofPlatform(page, 'Win32', 0);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(400);

    // 1a: navBtn visible (display !== none)
    const navDisplay = await elDisplay(page, '#pwa-install-nav-btn');
    assert.ok(navDisplay !== 'none' && navDisplay !== 'NOT_FOUND',
      `navBtn must be visible on desktop; got "${navDisplay}"`);
    console.log(`  PASS 1a navBtn display="${navDisplay}"`);

    // 1b: overlay is closed (not 'open')
    const overlayOpen = await page.$eval('#mobMenuOverlay', el => el.classList.contains('open')).catch(() => false);
    assert.ok(!overlayOpen, 'Mobile overlay must not be open on desktop load');
    console.log('  PASS 1b mobile overlay is closed on desktop');

    // 1c: click navBtn → Chrome hint (no deferredPrompt)
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    const chromeHint = await page.$('#pwa-install-hint');
    assert.ok(chromeHint !== null, '#pwa-install-hint must appear on Chrome Windows');
    console.log('  PASS 1c #pwa-install-hint appears on click');

    // 1d: no iOS hint
    const iosHint = await page.$('#pwa-ios-hint');
    assert.ok(iosHint === null, '#pwa-ios-hint must NOT appear on Chrome Windows');
    console.log('  PASS 1d no iOS hint on Windows');

    // 1e: no inset:0 overlay
    assert.ok(!(await hasInset0(page)), 'No inset:0 overlay allowed');
    console.log('  PASS 1e no inset:0 overlay');

    await ctx.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 2 — Mobile iPhone 390px: navBtn hidden, mob-pwa-slot has 1 iOS button
  // ══════════════════════════════════════════════════════════════════════════
  {
    console.log('\nTEST 2: Mobile iPhone 390px');
    const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const ctx = await browser.newContext({ userAgent: iphoneUA, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await spoofPlatform(page, 'iPhone', 5);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(400);

    // 2a: navBtn must be hidden (CSS display:none at ≤768px)
    const navDisplay = await elDisplay(page, '#pwa-install-nav-btn');
    assert.ok(navDisplay === 'none' || navDisplay === 'NOT_FOUND',
      `navBtn must be hidden on mobile; got "${navDisplay}"`);
    console.log(`  PASS 2a navBtn hidden on mobile (display="${navDisplay}")`);

    // 2b: open overlay and check mob-pwa-slot has exactly 1 button
    await page.evaluate(() => {
      const o = document.getElementById('mobMenuOverlay');
      if (o) o.classList.add('open');
    });
    await page.waitForTimeout(150);

    const mobBtnCount = await page.$$eval('#mob-pwa-slot button', btns =>
      btns.filter(b => window.getComputedStyle(b).display !== 'none').length
    );
    assert.equal(mobBtnCount, 1, `mob-pwa-slot must have exactly 1 visible button; got ${mobBtnCount}`);
    console.log(`  PASS 2b mob-pwa-slot has exactly 1 install button`);

    // 2c: click that button → iOS hint appears
    await page.click('#mob-pwa-slot button');
    await page.waitForTimeout(200);
    const iosHint = await page.$('#pwa-ios-hint');
    assert.ok(iosHint !== null, '#pwa-ios-hint must appear on iPhone mobile menu click');
    console.log('  PASS 2c iOS hint appears on mobile menu click');

    // 2d: no inset:0
    assert.ok(!(await hasInset0(page)), 'No inset:0 overlay allowed on mobile');
    console.log('  PASS 2d no inset:0 overlay');

    await ctx.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 3 — iPadOS desktop mode (MacIntel, maxTouchPoints=5, 1024px)
  // ══════════════════════════════════════════════════════════════════════════
  {
    console.log('\nTEST 3: iPadOS desktop mode (MacIntel, maxTouchPoints=5, 1024px)');
    const iPadOSUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
    const ctx = await browser.newContext({ userAgent: iPadOSUA, viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    await spoofPlatform(page, 'MacIntel', 5);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(400);

    // 3a: navBtn visible
    const navDisplay = await elDisplay(page, '#pwa-install-nav-btn');
    assert.ok(navDisplay !== 'none' && navDisplay !== 'NOT_FOUND',
      `navBtn must be visible on iPadOS desktop; got "${navDisplay}"`);
    console.log(`  PASS 3a navBtn display="${navDisplay}"`);

    // 3b: click → iOS hint
    await page.click('#pwa-install-nav-btn');
    await page.waitForTimeout(200);
    const iosHint = await page.$('#pwa-ios-hint');
    assert.ok(iosHint !== null, '#pwa-ios-hint must appear on iPadOS click');
    console.log('  PASS 3b #pwa-ios-hint appears on iPadOS click');

    // 3c: no Chrome hint
    const chromeHint = await page.$('#pwa-install-hint');
    assert.ok(chromeHint === null, '#pwa-install-hint must NOT appear on iPadOS');
    console.log('  PASS 3c no Chrome hint on iPadOS');

    // 3d: hint text mentions Safari/Compartir
    const hintText = await page.$eval('#pwa-ios-hint', el => el.textContent);
    assert.ok(hintText.includes('Compartir') || hintText.includes('Share'),
      `iOS hint must mention Compartir; got "${hintText.slice(0, 80)}"`);
    console.log('  PASS 3d iOS hint has Safari instructions');

    // 3e: no inset:0
    assert.ok(!(await hasInset0(page)), 'No inset:0 overlay on iPadOS');
    console.log('  PASS 3e no inset:0 overlay');

    // 3f: all links remain clickable
    const linksOk = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).every(a => {
        const s = window.getComputedStyle(a);
        return s.pointerEvents !== 'none' && s.visibility !== 'hidden';
      })
    );
    assert.ok(linksOk, 'All links must remain clickable after hint appears');
    console.log('  PASS 3f all links clickable after hint');

    await ctx.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 4 — Chrome Windows: Chrome hint, no iOS hint (explicit confirmation)
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

    assert.ok(!(await hasInset0(page)), 'No inset:0 overlay on Chrome Windows');
    console.log('  PASS 4d no inset:0 overlay');

    await ctx.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 5 — PWA standalone: navBtn hidden, no hints
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

  console.log('\n✅ All Playwright PWA tests passed — GLV Services SAS');
  console.log('   Test 1: Desktop 1280px — navBtn ✓, Chrome hint ✓, no iOS hint ✓, no inset:0 ✓');
  console.log('   Test 2: Mobile iPhone 390px — navBtn hidden ✓, mob-pwa-slot 1 btn ✓, iOS hint ✓');
  console.log('   Test 3: iPadOS desktop 1024px — navBtn ✓, iOS hint ✓, no Chrome ✓, links ✓');
  console.log('   Test 4: Chrome Windows — Chrome hint ✓, no iOS ✓, no inset:0 ✓');
  console.log('   Test 5: Standalone — navBtn hidden ✓, no hints ✓');
  console.log('   Test 6: Manifest + SW — all files linked ✓');

} finally {
  if (browser) await browser.close();
  if (server) server.close();
}
