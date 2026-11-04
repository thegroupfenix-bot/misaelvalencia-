// PWA Security Tests — GLV Services
// Verifies that the Service Worker never caches private/API/GOS routes
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swPath = path.join(__dirname, '..', 'sw.js');
const manifestPath = path.join(__dirname, '..', 'manifest.webmanifest');
const indexPath = path.join(__dirname, '..', 'index.html');

const swSource = readFileSync(swPath, 'utf8');
const manifestSource = readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestSource);
const indexSource = readFileSync(indexPath, 'utf8');

// --- Manifest security ---
{
  assert.ok(manifest.scope === '/', 'Manifest scope must be / (own domain only)');
  assert.ok(manifest.start_url === '/', 'start_url must be /');
  assert.ok(!manifest.start_url.includes('api'), 'start_url must not point to API');
  assert.ok(!manifest.start_url.includes('glv-connect'), 'start_url must not point to GOS');
  assert.ok(!manifest.permissions, 'Manifest must not request device permissions');
  console.log('  PASS manifest scope and start_url safe');
}

// --- Service Worker: blocked paths ---
const blockedPaths = [
  '/glv-connect/',
  '/api/',
  '/gos',
  '/login',
  '/admin',
  '/session',
  '/auth',
];
for (const p of blockedPaths) {
  assert.ok(
    swSource.includes(p),
    `SW must explicitly block path: ${p}`
  );
  console.log(`  PASS SW blocks ${p}`);
}

// --- Service Worker: only GET ---
assert.ok(
  swSource.includes("req.method !== 'GET'"),
  'SW must refuse non-GET requests'
);
console.log('  PASS SW rejects non-GET');

// --- Service Worker: same-origin check ---
assert.ok(
  swSource.includes("self.location.origin"),
  'SW must check same-origin'
);
console.log('  PASS SW enforces same-origin');

// --- Service Worker: no Set-Cookie caching ---
assert.ok(
  swSource.includes("set-cookie"),
  'SW must reject responses with Set-Cookie'
);
console.log('  PASS SW rejects Set-Cookie responses');

// --- Service Worker: status 200 only ---
assert.ok(
  swSource.includes("status === 200"),
  'SW must only cache 200 responses'
);
console.log('  PASS SW caches only 200 responses');

// --- Service Worker: no credentials in source ---
const credentialPatterns = ['password', 'secret', 'smtp', 'token', 'apikey', 'api_key', '@gmail.com'];
for (const p of credentialPatterns) {
  assert.ok(
    !swSource.toLowerCase().includes(p),
    `SW must not contain credential pattern: ${p}`
  );
}
console.log('  PASS SW contains no credentials');

// --- Manifest: no credentials ---
for (const p of credentialPatterns) {
  assert.ok(
    !manifestSource.toLowerCase().includes(p),
    `Manifest must not contain credential pattern: ${p}`
  );
}
console.log('  PASS manifest contains no credentials');

// --- index.html: manifest linked ---
assert.ok(
  indexSource.includes('rel="manifest"'),
  'index.html must link to manifest'
);
console.log('  PASS index.html links manifest');

// --- index.html: no auto-install (no auto prompt) ---
assert.ok(
  indexSource.includes('e.preventDefault()'),
  'Install prompt must be deferred with e.preventDefault()'
);
assert.ok(
  indexSource.includes('beforeinstallprompt'),
  'Must use beforeinstallprompt event'
);
const promptCallCount = (indexSource.match(/\.prompt\(\)/g) || []).length;
assert.ok(promptCallCount >= 1, 'Install prompt must be called at least once (in click handler)');
assert.ok(
  indexSource.includes("btn.addEventListener('click'") || indexSource.includes('btn.addEventListener("click"'),
  'Install prompt must be triggered by explicit button click'
);
console.log('  PASS install requires explicit user action');

// --- index.html: no device permissions ---
const deviceAPIs = ['Notification.requestPermission', 'navigator.geolocation', 'getUserMedia', 'navigator.contacts', 'navigator.bluetooth'];
for (const api of deviceAPIs) {
  assert.ok(
    !indexSource.includes(api),
    `index.html must not request device API: ${api}`
  );
}
console.log('  PASS no device permissions requested');

console.log('\n✅ All PWA security tests passed');
