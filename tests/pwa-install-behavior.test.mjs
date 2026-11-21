// PWA install behavior tests — run the REAL inline script of index.html in a simulated DOM (node:vm)
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const pwaScript = scripts.find(s => s.includes('GLV PWA Install'));
assert.ok(pwaScript, 'PWA install script must exist in index.html');

const UA = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
  ipados: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
};

function makeEnv({ ua, platform = 'Win32', touch = 0, standalone = false }) {
  const timers = new Map(); let tid = 0;
  const docListeners = []; const winListeners = {}; const keydown = [];
  const byId = new Map();
  const body = mkEl('body');
  function mkEl(tag, id) {
    const el = {
      tag, id, style: {}, children: [], parentNode: null, listeners: {}, _classes: new Set(), attrs: {},
      classList: { add: c => el._classes.add(c), remove: c => el._classes.delete(c), contains: c => el._classes.has(c) },
      focus() { el.focused = true; },
      setAttribute(k, v) { el.attrs[k] = v; },
      addEventListener(t, f) { (el.listeners[t] ||= []).push(f); },
      getBoundingClientRect: () => ({ top: 10, bottom: 40, right: 300, left: 200, width: 100, height: 30 }),
      contains: n => n === el || el.children.some(c => c.contains && c.contains(n)),
      appendChild(c) { c.parentNode = el; el.children.push(c); if (c.id) byId.set(c.id, c); return c; },
      removeChild(c) { c.remove(); },
      remove() { if (el.parentNode) { el.parentNode.children = el.parentNode.children.filter(c => c !== el); el.parentNode = null; } if (el.id && byId.get(el.id) === el) byId.delete(el.id); },
      click() { (el.listeners.click || []).slice().forEach(f => f({ target: el })); },
    };
    let inner = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => inner,
      set(v) {
        inner = v;
        el.children.forEach(c => { if (c.id) byId.delete(c.id); }); el.children = [];
        for (const m of v.matchAll(/<button[^>]*id="([^"]+)"/g)) el.appendChild(mkEl('button', m[1]));
      },
    });
    if (id) byId.set(id, el);
    return el;
  }
  const navBtn = mkEl('button', 'pwa-install-nav-btn'); navBtn.style.display = 'none';
  const mobSlot = mkEl('div', 'mob-pwa-slot');
  mkEl('button', 'navHamburger'); mkEl('div', 'mobMenu'); mkEl('button', 'mobMenuClose');
  [navBtn, mobSlot].forEach(e => { e.parentNode = body; body.children.push(e); });
  const document = {
    body, documentElement: { clientWidth: 1024 },
    getElementById: id => byId.get(id) || null,
    createElement: t => mkEl(t),
    addEventListener(t, f, o) { docListeners.push({ t, f, o }); if (t === 'keydown') keydown.push(f); },
    removeEventListener(t, f) { const i = docListeners.findIndex(l => l.t === t && l.f === f); if (i >= 0) docListeners.splice(i, 1); },
  };
  const win = {
    innerWidth: 1024, MSStream: undefined,
    matchMedia: () => ({ matches: standalone }),
    addEventListener(t, f) { (winListeners[t] ||= []).push(f); },
    navigator: { userAgent: ua, platform, maxTouchPoints: touch, serviceWorker: { register: () => ({ catch() {} }) } },
  };
  win.window = win;
  const ctx = vm.createContext({
    window: win, document, navigator: win.navigator, console,
    setTimeout: (f, ms) => { timers.set(++tid, f); return tid; },
    clearTimeout: id => timers.delete(id),
  });
  vm.runInContext(pwaScript, ctx);
  const find = id => document.getElementById(id);
  const visible = el => !!el && el.parentNode && el.style.display !== 'none';
  return {
    navBtn, mobSlot, find, docListeners, keydown, timers, body,
    fire: (t, ev = {}) => (winListeners[t] || []).forEach(f => f(ev)),
    hasHandler: t => (winListeners[t] || []).length > 0,
    hints: () => ['pwa-install-hint', 'pwa-ios-hint'].map(find).filter(Boolean),
    mobButtons: () => mobSlot.children.filter(c => c.tag === 'button'),
    navVisible: () => visible(navBtn) && navBtn.style.display !== 'none',
    clickDocs: () => docListeners.filter(l => l.t === 'click'),
  };
}
function assertClean(e, label) {
  assert.equal(e.navVisible(), false, `${label}: desktop button hidden`);
  assert.equal(e.mobButtons().length, 0, `${label}: no mobile install buttons`);
  assert.ok(/ya está instalado/.test(e.mobSlot.innerHTML), `${label}: installed message`);
  assert.equal(e.hints().length, 0, `${label}: no hints visible`);
  assert.equal(e.timers.size, 0, `${label}: no pending hint timers`);
  assert.equal(e.clickDocs().length, 0, `${label}: no document click listeners`);
}
const fakePrompt = (outcome) => ({ prompted: 0, prompt() { this.prompted++; }, userChoice: Promise.resolve({ outcome }), preventDefault() {} });
const platforms = {
  desktop: { ua: UA.desktop },
  iphone: { ua: UA.iphone, platform: 'iPhone', touch: 5 },
  'iPadOS MacIntel': { ua: UA.ipados, platform: 'MacIntel', touch: 5 },
};

// 1. appinstalled handler exists on every platform (before any early return) and cleans up
for (const [name, cfg] of Object.entries(platforms)) {
  const e = makeEnv(cfg);
  assert.ok(e.hasHandler('appinstalled'), `${name}: appinstalled registered`);
  e.fire('appinstalled');
  assertClean(e, `${name} appinstalled`);
  e.navBtn.click(); e.mobSlot.children.forEach(b => b.click());
  assert.equal(e.hints().length, 0, `${name}: clicks after install open no guide`);
  console.log(`  PASS 1 ${name}: appinstalled hides controls`);
}

// 2. guide open before appinstalled is removed with timer + listener
for (const [name, cfg] of Object.entries(platforms)) {
  const e = makeEnv(cfg);
  e.navBtn.click();
  assert.equal(e.hints().length, 1, `${name}: guide opens on click`);
  assert.ok(e.clickDocs().length === 1 && e.timers.size === 1, `${name}: timer+listener registered`);
  e.fire('appinstalled');
  assertClean(e, `${name} guide-open appinstalled`);
  console.log(`  PASS 2 ${name}: open guide cleaned on appinstalled`);
}

// 3. initial standalone: nothing shown, no guides, later events don't restore controls
for (const [name, cfg] of Object.entries(platforms)) {
  const e = makeEnv({ ...cfg, standalone: true });
  assertClean(e, `${name} standalone`);
  e.fire('beforeinstallprompt', fakePrompt('accepted'));
  e.navBtn.click();
  assertClean(e, `${name} standalone after events`);
  assert.ok(e.hasHandler('appinstalled'));
  console.log(`  PASS 3 ${name}: standalone start is clean`);
}

// 4. desktop: buttons, native prompt, hint without prompt, after reject/consume
{
  const e = makeEnv(platforms.desktop);
  assert.equal(e.navBtn.style.display, 'inline-flex', 'desktop button visible');
  assert.equal(e.mobButtons().length, 1, 'mobile menu install button present');
  assert.equal(e.mobButtons()[0].id, 'mobInstallBtn');
  // no prompt → non-blocking hint
  e.navBtn.click();
  const h = e.find('pwa-install-hint');
  assert.ok(h && h.attrs.role === 'alert' && /Chrome/.test(h.innerHTML), 'hint without prompt');
  assert.ok(!/inset\s*:\s*0/.test(h.style.cssText) && !/width\s*:\s*100/.test(h.style.cssText), 'hint not fullscreen');
  h.click(); assert.equal(e.hints().length, 0, 'hint dismissible'); assert.equal(e.timers.size, 0); assert.equal(e.clickDocs().length, 0);
  // native prompt, rejected → consumed, hint next time
  const p = fakePrompt('dismissed'); e.fire('beforeinstallprompt', p);
  e.navBtn.click(); assert.equal(p.prompted, 1, 'native prompt used'); assert.equal(e.hints().length, 0);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(e.navVisible(), true, 'button stays after rejection');
  e.navBtn.click(); assert.equal(e.hints().length, 1, 'hint after reject/consume');
  // native prompt accepted via mobile button → full cleanup
  e.fire('beforeinstallprompt', fakePrompt('accepted'));
  e.mobButtons()[0].click();
  await Promise.resolve(); await Promise.resolve();
  assertClean(e, 'desktop accepted via mobile button');
  console.log('  PASS 4 desktop: buttons, native prompt, hint, reject/consume, accept');
}

// 5. iOS: Safari instructions, non-blocking, desktop button + mobile slot
for (const name of ['iphone', 'iPadOS MacIntel']) {
  const e = makeEnv(platforms[name]);
  assert.equal(e.mobButtons()[0].id, 'mobIOSBtn', `${name}: iOS mobile button`);
  e.navBtn.click();
  const h = e.find('pwa-ios-hint');
  assert.ok(h && /Safari/.test(h.innerHTML) && /Compartir/.test(h.innerHTML) && /pantalla de inicio/.test(h.innerHTML), `${name}: Safari instructions`);
  assert.ok(!/inset\s*:\s*0/.test(h.style.cssText) && h.style.cssText.includes('max-width'), `${name}: hint small`);
  assert.equal(e.find('pwa-install-hint'), null, `${name}: never Chrome message`);
  e.fire('beforeinstallprompt', fakePrompt('accepted')); // must not matter
  console.log(`  PASS 5 ${name}: Safari guide, non-blocking`);
}

// 6. no fullscreen install modal/overlay in each modified HTML
for (const f of ['index.html', 'registro-clientes.html', 'portal-clientes.html']) {
  const src = readFileSync(path.join(root, f), 'utf8');
  const inline = [...src.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  // no exceptions: no modal/overlay markers anywhere in the page
  assert.ok(!/<dialog|showModal\(|aria-modal\s*=\s*["']?true|role\s*=\s*["']?(?:alert)?dialog|iosGuideBackdrop|pwa-install-banner|mob-menu-overlay|mobMenuOverlay/i.test(src), `${f}: no modal/overlay`);
  const css = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = rule[2];
    assert.ok(!(/inset\s*:\s*0\s*;/.test(body) && /position\s*:\s*fixed/.test(body)), `${f}: fixed inset:0 rule "${rule[1].trim()}"`);
    assert.ok(!(/position\s*:\s*fixed/.test(body) && /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.[4-9]\d*\)/.test(body) && /background/.test(body)), `${f}: fixed dark backdrop rule "${rule[1].trim()}"`);
  }
  assert.ok(!/document\.body\.style\.overflow\s*=\s*['"]hidden/.test(inline), `${f}: no body scroll lock`);
  const installJs = inline.match(/function show(?:Install|IOS)Hint[\s\S]*?hint\.addEventListener\('click', dismiss\)/g) || [];
  for (const c of installJs) assert.ok(!/inset\s*:\s*0|100vw|100vh|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.[5-9]\)\s*;?[^']*z-index/.test(c), `${f}: hint not overlay`);
  console.log(`  PASS 6 ${f}: no fullscreen install modal/overlay`);
}

// 7. mobile menu: open/close (hamburger toggle, close button, Escape, outside click), PWA button access, no scroll lock
function menuEnv(cfg) {
  const e = makeEnv(cfg);
  const menu = e.find('mobMenu'), ham = e.find('navHamburger'), close = e.find('mobMenuClose');
  const key = k => e.keydown.forEach(f => f({ key: k }));
  return { e, menu, ham, close, key, isOpen: () => menu._classes.has('open'), outsideClick: () => e.docListeners.filter(l => l.t === 'click').forEach(l => l.f({ target: e.body })) };
}
for (const [name, cfg] of Object.entries(platforms)) {
  const m = menuEnv(cfg);
  assert.equal(m.isOpen(), false, `${name}: closed initially`);
  m.ham.click();
  assert.ok(m.isOpen() && m.ham.attrs['aria-expanded'] === 'true', `${name}: hamburger opens`);
  assert.equal(m.e.body.style.overflow, undefined, `${name}: no scroll lock`);
  assert.ok(m.e.mobButtons().length === 1, `${name}: PWA button reachable in open menu`);
  m.ham.click(); assert.ok(!m.isOpen() && m.ham.attrs['aria-expanded'] === 'false', `${name}: hamburger toggles closed`);
  m.ham.click(); m.close.click(); assert.ok(!m.isOpen(), `${name}: close button`);
  m.ham.click(); m.key('Escape'); assert.ok(!m.isOpen() && m.ham.attrs['aria-expanded'] === 'false', `${name}: Escape`);
  m.ham.click(); m.outsideClick(); assert.ok(!m.isOpen(), `${name}: outside click`);
  assert.equal(m.e.clickDocs().length, 0, `${name}: outside-click listener removed when closed`);
  // PWA button inside menu: iOS guide / native prompt / hint
  m.ham.click();
  const btn = m.e.mobButtons()[0];
  if (name === 'desktop') {
    const p = fakePrompt('dismissed'); m.e.fire('beforeinstallprompt', p); btn.click();
    assert.equal(p.prompted, 1, 'desktop: native prompt from mobile menu');
    await Promise.resolve(); await Promise.resolve(); assert.ok(!m.isOpen(), 'desktop: menu closes after prompt choice');
  } else { btn.click(); assert.ok(m.e.find('pwa-ios-hint'), `${name}: iOS guide from menu`); assert.ok(!m.isOpen(), `${name}: menu closes for guide`); }
  // installed cleanup still holds with menu used
  m.e.fire('appinstalled'); assertClean(m.e, `${name} menu+appinstalled`);
  m.ham.click(); assert.equal(m.e.mobButtons().length, 0, `${name}: no install button after install (menu open)`);
  console.log(`  PASS 7 ${name}: menu open/close, PWA access, cleanup`);
}
console.log('\n✅ PWA install behavior tests passed');
