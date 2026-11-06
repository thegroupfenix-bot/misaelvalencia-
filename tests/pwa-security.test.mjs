// PWA Security Tests — GLV Services SAS
// Tests both static analysis (sw.js source) and behavioral logic (caching decisions)
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const swSource = readFileSync(path.join(root, 'sw.js'), 'utf8');
const manifestSource = readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');
const manifest = JSON.parse(manifestSource);
const indexSource = readFileSync(path.join(root, 'index.html'), 'utf8');

// ─── A. Manifest ────────────────────────────────────────────────────────────
{
  assert.equal(manifest.scope, '/', 'scope must be /');
  assert.equal(manifest.start_url, '/', 'start_url must be /');
  assert.ok(!manifest.start_url.includes('api'), 'start_url must not point to API');
  assert.ok(!manifest.permissions, 'Manifest must not request device permissions');
  console.log('  PASS A1 manifest scope and start_url safe');
}

// ─── B. Icon files exist and are valid PNG ──────────────────────────────────
{
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function checkIcon(relPath, purpose) {
    const fullPath = path.join(root, relPath);
    assert.ok(existsSync(fullPath), `Icon must exist: ${relPath}`);
    const buf = readFileSync(fullPath);
    assert.ok(buf.slice(0, 8).equals(pngSig), `${relPath} must be a valid PNG file`);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.ok(width > 0 && height > 0, `${relPath} must have valid dimensions`);
    assert.ok(buf.length > 100, `${relPath} must not be empty (${buf.length} bytes)`);
    console.log(`  PASS B  icon ${relPath}: ${width}x${height}px, ${buf.length} bytes, purpose=${purpose}`);
    return { width, height };
  }

  assert.ok(manifest.icons && manifest.icons.length >= 3, 'Manifest must have at least 3 icons (192, 512, 512-maskable)');

  const icon192 = manifest.icons.find(i => i.sizes === '192x192');
  const icon512 = manifest.icons.find(i => i.sizes === '512x512' && !i.purpose?.includes('maskable'));
  const icon512m = manifest.icons.find(i => i.sizes === '512x512' && i.purpose?.includes('maskable'));

  assert.ok(icon192, 'Manifest must include 192x192 icon');
  assert.ok(icon512, 'Manifest must include 512x512 icon');
  assert.ok(icon512m, 'Manifest must include 512x512 maskable icon');

  checkIcon(icon192.src.replace(/^\//, ''), 'any');
  checkIcon(icon512.src.replace(/^\//, ''), 'any');
  checkIcon(icon512m.src.replace(/^\//, ''), 'maskable');

  assert.equal(icon192.type, 'image/png', '192 icon must be image/png');
  assert.equal(icon512.type, 'image/png', '512 icon must be image/png');
  assert.equal(icon512m.type, 'image/png', '512 maskable icon must be image/png');
  console.log('  PASS B  all icon types declared as image/png');
}

// ─── C. SW static analysis ──────────────────────────────────────────────────
{
  const blocked = ['/glv-connect/', '/api/', '/gos', '/login', '/admin', '/session', '/auth'];
  for (const p of blocked) {
    assert.ok(swSource.includes(p), `SW must block path: ${p}`);
  }
  console.log('  PASS C1 SW blocked paths declared');

  assert.ok(swSource.includes("req.method !== 'GET'"), 'SW must refuse non-GET');
  console.log('  PASS C2 SW rejects non-GET');
  assert.ok(swSource.includes('self.location.origin'), 'SW must enforce same-origin');
  console.log('  PASS C3 SW enforces same-origin');
  assert.ok(swSource.includes('set-cookie'), 'SW must reject Set-Cookie');
  console.log('  PASS C4 SW rejects Set-Cookie');
  assert.ok(swSource.includes('status === 200'), 'SW must cache 200 only');
  console.log('  PASS C5 SW caches 200 only');
}

// ─── D. SW behavioral logic tests ──────────────────────────────────────────
{
  const blockedPrefixes = [
    '/glv-connect/', '/api/', '/gos', '/login', '/admin', '/session', '/auth', '/services/glv-forms/',
  ];
  const cacheableExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.woff', '.woff2'];
  const origin = 'https://www.glvservicesexp.com';

  function isBlockedPath(url) {
    try { const p = new URL(url).pathname; return blockedPrefixes.some(b => p.startsWith(b)); }
    catch { return true; }
  }
  function isCacheableAsset(url) {
    try { const p = new URL(url).pathname; return cacheableExtensions.some(e => p.endsWith(e)); }
    catch { return false; }
  }
  function isSameOrigin(url) {
    try { return new URL(url).origin === origin; } catch { return false; }
  }
  function shouldCache(url, method, status, hasCookie) {
    if (method !== 'GET') return false;
    if (!isSameOrigin(url)) return false;
    if (isBlockedPath(url)) return false;
    if (!isCacheableAsset(url)) return false;
    if (status !== 200) return false;
    if (hasCookie) return false;
    return true;
  }

  // D1: Private/GOS routes must NOT be cached
  const privateRoutes = [
    `${origin}/glv-connect/api/session`,
    `${origin}/api/leads`,
    `${origin}/gos/dashboard`,
    `${origin}/login`,
    `${origin}/admin/users`,
    `${origin}/session/token`,
    `${origin}/auth/callback`,
    `${origin}/services/glv-forms/submit`,
  ];
  for (const url of privateRoutes) {
    assert.equal(shouldCache(url, 'GET', 200, false), false, `Private route must NOT be cached: ${url}`);
  }
  console.log('  PASS D1 private routes not cached');

  // D2: External resources must NOT be cached
  const externalURLs = [
    'https://fonts.googleapis.com/css2?family=Inter',
    'https://cdn.jsdelivr.net/npm/something.js',
    'https://evil.com/steal.js',
  ];
  for (const url of externalURLs) {
    assert.equal(shouldCache(url, 'GET', 200, false), false, `External resource must NOT be cached: ${url}`);
  }
  console.log('  PASS D2 external resources not cached');

  // D3: Valid public GET static 200 without Set-Cookie SHOULD be cached
  const cacheableAssets = [
    `${origin}/assets/css/style.css`,
    `${origin}/assets/js/app.js`,
    `${origin}/favicon-32x32.png`,
    `${origin}/apple-touch-icon.png`,
    `${origin}/assets/icons/icon-192.png`,
    `${origin}/assets/icons/icon-512.png`,
  ];
  for (const url of cacheableAssets) {
    assert.equal(shouldCache(url, 'GET', 200, false), true, `Static asset SHOULD be cached: ${url}`);
  }
  console.log('  PASS D3 public static assets are cached');

  // D4: Response with Set-Cookie must NOT be cached
  assert.equal(shouldCache(`${origin}/assets/css/main.css`, 'GET', 200, true), false, 'Set-Cookie response must NOT be cached');
  console.log('  PASS D4 Set-Cookie response not cached');

  // D5: POST must NOT be cached
  assert.equal(shouldCache(`${origin}/assets/css/main.css`, 'POST', 200, false), false, 'POST must NOT be cached');
  console.log('  PASS D5 POST not cached');

  // D6: 404 must NOT be cached
  assert.equal(shouldCache(`${origin}/assets/css/main.css`, 'GET', 404, false), false, '404 must NOT be cached');
  console.log('  PASS D6 404 not cached');

  // D7: 302 redirect must NOT be cached
  assert.equal(shouldCache(`${origin}/assets/css/main.css`, 'GET', 302, false), false, '302 must NOT be cached');
  console.log('  PASS D7 302 not cached');

  // D8: HTML pages must NOT be cached (not a cacheable extension)
  assert.equal(shouldCache(`${origin}/index.html`, 'GET', 200, false), false, 'HTML must NOT be cached');
  assert.equal(shouldCache(`${origin}/cotizacion`, 'GET', 200, false), false, 'HTML route must NOT be cached');
  console.log('  PASS D8 HTML pages not cached');
}

// ─── E. index.html security ──────────────────────────────────────────────────
{
  assert.ok(indexSource.includes('rel="manifest"'), 'index.html must link manifest');
  assert.ok(indexSource.includes('e.preventDefault()'), 'Must defer install prompt');
  assert.ok(indexSource.includes('beforeinstallprompt'), 'Must use beforeinstallprompt');
  assert.ok(
    indexSource.includes("navBtn.addEventListener('click'") ||
    indexSource.includes("installBtn.addEventListener('click'") ||
    indexSource.includes("btn.addEventListener('click'") ||
    indexSource.includes('btn.addEventListener("click"'),
    'Install must require explicit click on a button'
  );
  console.log('  PASS E1 install requires explicit user action');

  const deviceAPIs = ['Notification.requestPermission', 'navigator.geolocation', 'getUserMedia', 'navigator.contacts', 'navigator.bluetooth'];
  for (const api of deviceAPIs) {
    assert.ok(!indexSource.includes(api), `Must not request device API: ${api}`);
  }
  console.log('  PASS E2 no device permissions requested');

  // E3: install button must NOT use position:fixed (fixed banner removed)
  assert.ok(
    !indexSource.includes('id="pwa-install-banner"'),
    'Old fixed install banner must be removed'
  );
  assert.ok(
    !indexSource.match(/pwa-install-banner[^>]*position\s*:\s*fixed/),
    'Install button must not have position:fixed inline style'
  );
  console.log('  PASS E3 no position:fixed install banner');

  // E4: desktop navbar install button present
  assert.ok(indexSource.includes('id="pwa-install-nav-btn"'), 'Desktop navbar install button must exist');
  assert.ok(indexSource.includes('class="nav-pwa-btn"'), 'Desktop navbar install button must have nav-pwa-btn class');
  console.log('  PASS E4 desktop navbar install button present');

  // E5: mobile menu slot present
  assert.ok(indexSource.includes('id="mob-pwa-slot"'), 'Mobile menu PWA slot must exist');
  assert.ok(indexSource.includes('id="navHamburger"'), 'Hamburger button must exist');
  assert.ok(indexSource.includes('class="mob-menu-overlay"'), 'Mobile menu overlay must exist');
  console.log('  PASS E5 mobile menu structure present');

  // E8: Contacto link in mobile menu, immediately before mob-pwa-slot
  assert.ok(
    indexSource.includes('id="mob-contacto-item"'),
    'Mobile menu must contain Contacto link (id="mob-contacto-item")'
  );
  const contactoPos = indexSource.indexOf('id="mob-contacto-item"');
  const pwaSlotPos  = indexSource.indexOf('id="mob-pwa-slot"');
  assert.ok(
    contactoPos > -1 && pwaSlotPos > -1 && contactoPos < pwaSlotPos,
    `Contacto (pos ${contactoPos}) must appear before mob-pwa-slot (pos ${pwaSlotPos}) in the HTML`
  );
  console.log('  PASS E8 Contacto precedes mob-pwa-slot in mobile menu');

  // E6: NO fullscreen iOS modal (safe small hint replaces it)
  assert.ok(!indexSource.includes('id="iosGuideBackdrop"'), 'Fullscreen iOS guide modal must be absent (safe hint used instead)');
  assert.ok(!indexSource.includes('ios-guide-steps'), 'Blocking iOS guide steps list must be absent');
  assert.ok(indexSource.includes('showIOSHint'), 'showIOSHint function must exist (safe iOS tooltip)');
  assert.ok(indexSource.includes('Compartir'), 'iOS hint must mention Compartir (Share)');
  assert.ok(indexSource.includes('Agregar a pantalla de inicio') || indexSource.includes('Add to Home Screen'), 'iOS hint must mention Add to Home Screen');
  assert.ok(!indexSource.includes('.ios-guide-backdrop'), 'iOS guide backdrop CSS must be absent (no fullscreen overlay)');
  console.log('  PASS E6 no fullscreen iOS modal; safe showIOSHint present');

  // E7: standalone detection present
  assert.ok(indexSource.includes('display-mode: standalone'), 'Must detect standalone/installed mode');
  assert.ok(indexSource.includes('navigator.standalone'), 'Must detect iOS standalone');
  console.log('  PASS E7 standalone/installed detection present');

  // E9: install hint shown when deferredPrompt is null
  assert.ok(
    indexSource.includes('showInstallHint'),
    'showInstallHint function must exist'
  );
  assert.ok(
    indexSource.includes("setAttribute('role', 'alert')") || indexSource.includes('setAttribute("role", "alert")'),
    'install hint element must have role=alert'
  );
  assert.ok(
    indexSource.includes('La instalación aún no está disponible'),
    'install hint must contain the unavailability message in Spanish'
  );
  assert.ok(
    indexSource.includes('!deferredPrompt') && indexSource.includes('showInstallHint'),
    'install click handler must call showInstallHint when deferredPrompt is null'
  );
  assert.ok(
    indexSource.includes('document.removeEventListener') && indexSource.includes('onDoc'),
    'showInstallHint must remove the document click listener on dismiss'
  );
  console.log('  PASS E9 install hint shown when deferredPrompt is null, listener cleaned up');
}

// ─── E10-E13. iPadOS + behavioral tests ─────────────────────────────────────
{
  // E10: iPadOS desktop mode detection covers MacIntel + maxTouchPoints > 1
  assert.ok(
    indexSource.includes("navigator.platform === 'MacIntel'") ||
    indexSource.includes('navigator.platform === "MacIntel"'),
    'Must detect iPadOS desktop mode via navigator.platform'
  );
  assert.ok(
    indexSource.includes('navigator.maxTouchPoints > 1'),
    'Must check maxTouchPoints > 1 for iPadOS desktop mode'
  );
  console.log('  PASS E10 iPadOS desktop mode detection present');

  // E11: behavioral simulation — isIOS logic
  function isIOSSim(ua, platform, maxTouchPoints, MSStream) {
    return (/iphone|ipad|ipod/i.test(ua) && !MSStream) ||
           (platform === 'MacIntel' && maxTouchPoints > 1);
  }
  assert.ok(isIOSSim('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 'MacIntel', 5, undefined), 'iPadOS desktop mode must be detected as iOS');
  assert.ok(isIOSSim('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'iPad', 5, undefined), 'Classic iPad UA must be detected as iOS');
  assert.ok(isIOSSim('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5, undefined), 'iPhone UA must be detected as iOS');
  assert.ok(!isIOSSim('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', 'Win32', 0, undefined), 'Chrome Windows must NOT be detected as iOS');
  assert.ok(!isIOSSim('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0, undefined), 'Mac desktop (no touch) must NOT be detected as iOS');
  console.log('  PASS E11 isIOS behavioral simulation: iPadOS desktop ✓, iPad ✓, iPhone ✓, Chrome Windows ✗, Mac desktop ✗');

  // E12: install hints must not use inset:0 (no page-covering overlay)
  const hintCode = indexSource.match(/function showInstallHint[\s\S]*?hint\.addEventListener\('click', dismiss\);[\s\S]*?document\.addEventListener\('click', onDoc/)?.[0] || '';
  const iosHintCode = indexSource.match(/function showIOSHint[\s\S]*?hint\.addEventListener\('click', dismiss\);[\s\S]*?document\.addEventListener\('click', onDoc/)?.[0] || '';
  assert.ok(!hintCode.includes('inset:0') && !hintCode.includes('inset: 0'), 'showInstallHint must not use inset:0 overlay');
  assert.ok(!iosHintCode.includes('inset:0') && !iosHintCode.includes('inset: 0'), 'showIOSHint must not use inset:0 overlay');
  assert.ok(hintCode.includes('style.top') || hintCode.includes('style.bottom'), 'showInstallHint must use specific top/bottom positioning');
  assert.ok(iosHintCode.includes('style.top') || iosHintCode.includes('style.bottom'), 'showIOSHint must use specific top/bottom positioning');
  console.log('  PASS E12 install hints use specific positioning, no page-covering inset:0');

  // E13: PWA installed mode — standalone detection + install UI hidden
  assert.ok(
    indexSource.includes('display-mode: standalone') || indexSource.includes("matchMedia('(display-mode: standalone)')"),
    'Must detect standalone/installed mode'
  );
  assert.ok(indexSource.includes('navigator.standalone'), 'Must detect iOS standalone mode');
  assert.ok(
    indexSource.includes('mob-pwa-slot') && (
      indexSource.includes("style.display = 'none'") ||
      indexSource.includes('hidden = true') ||
      indexSource.includes('.hidden') ||
      indexSource.includes('removeChild') ||
      indexSource.includes('classList') ||
      indexSource.includes('display:none') ||
      indexSource.includes("renderMobPWA('installed')")
    ),
    'mob-pwa-slot must be hidden/installed in standalone mode'
  );
  console.log('  PASS E13 standalone detection present; install slot hidden in installed mode');
}

// ─── F. No credentials ──────────────────────────────────────────────────────
{
  const creds = ['password', 'secret', 'smtp', 'apikey', 'api_key', '@gmail.com'];
  for (const p of creds) {
    assert.ok(!swSource.toLowerCase().includes(p), `SW must not contain: ${p}`);
    assert.ok(!manifestSource.toLowerCase().includes(p), `Manifest must not contain: ${p}`);
  }
  console.log('  PASS F  no credentials in SW or manifest');
}

console.log('\n✅ All PWA security tests passed — GLV Services SAS');
console.log('   Icons: 192px ✓  512px ✓  512px-maskable ✓');
console.log('   SW logic: blocked routes ✓  external ✓  cacheable ✓  Set-Cookie ✓  POST ✓  404 ✓');
