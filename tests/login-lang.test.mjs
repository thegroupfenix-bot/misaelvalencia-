// Idioma de la pantalla de login de GOS. Sin dependencias; datos ficticios.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "glv-connect", "frontend", "src");
const { default: T, LANGUAGES, LOGIN_LANGUAGES, t } = await import(path.join(src, "i18n.js"));
const { getStoredLoginLang, storeLoginLang, langDir, LOGIN_LANG_KEY } = await import(path.join(src, "utils", "loginLang.js"));
const app = fs.readFileSync(path.join(src, "App.jsx"), "utf8");
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), m }; };
const KEYS = Object.keys(T.es).filter(k => k.startsWith("login_"));

test("catálogo: ES/EN/FR/ZH/AR/PT tienen todas las etiquetas de login; LANGUAGES sin cambios", () => {
  assert.deepEqual(LANGUAGES.map(l => l.code), ["es", "en", "fr", "zh", "ar"]);
  assert.deepEqual(LOGIN_LANGUAGES.map(l => l.code), ["es", "en", "fr", "zh", "ar", "pt"]);
  assert.equal(KEYS.length, 16);
  for (const c of LOGIN_LANGUAGES.map(l => l.code)) for (const k of KEYS) {
    assert.ok(typeof T[c][k] === "string" && T[c][k].length, `${c}.${k}`);
  }
  assert.equal(t("login_submit", "pt"), "Acessar o GLV GOS");
  assert.equal(t("login_err_credentials", "en"), "Incorrect credentials. Check your username and password.");
});

test("selección, recarga y valor inválido", () => {
  const st = mem();
  assert.equal(getStoredLoginLang(st), "es");
  assert.equal(storeLoginLang("pt", st), true);
  assert.equal(st.m.get(LOGIN_LANG_KEY), "pt");
  assert.equal(getStoredLoginLang(st), "pt", "recarga");
  assert.equal(storeLoginLang("xx", st), false);
  st.setItem(LOGIN_LANG_KEY, "<script>");
  assert.equal(getStoredLoginLang(st), "es");
  assert.equal(getStoredLoginLang({ getItem() { throw new Error("bloqueado"); } }), "es");
});

test("dirección: RTL solo para árabe", () => {
  for (const c of ["es", "en", "fr", "zh", "pt"]) assert.equal(langDir(c), "ltr");
  assert.equal(langDir("ar"), "rtl");
});

test("LoginScreen: etiquetas y errores por catálogo, lang/dir aplicados, misma llamada de autenticación", () => {
  const m = /function LoginScreen\(\) \{[\s\S]*?\n\}\n/.exec(app);
  assert.ok(m);
  const login = m[0];
  assert.match(login, /await login\(username, password\);/, "misma llamada de autenticación");
  assert.match(login, /setAttribute\("lang", loginLang\)/);
  assert.match(login, /setAttribute\("dir", dir\)/);
  assert.match(login, /lang=\{loginLang\} dir=\{dir\}/);
  assert.match(login, /LOGIN_LANGUAGES\.map/);
  assert.match(login, /storeLoginLang\(code\)/);
  for (const k of KEYS.filter(k => k !== "login_language")) assert.ok(login.includes(`"${k}"`), `usa ${k}`);
  for (const lit of ["Usuario", "Contraseña", "Verificando...", "Acceder a GLV GOS", "Recuperar acceso", "¿Olvidó su contraseña?", "Correo corporativo"]) {
    assert.ok(!login.includes(`"${lit}"`) && !login.includes(`>${lit}<`), `literal fijo: ${lit}`);
  }
  // Sin escrituras de perfil/sesión desde el selector.
  assert.ok(!/\bsetLang\(|updateProfile|preferred_lang|\bsetUser\(/.test(login));
});
