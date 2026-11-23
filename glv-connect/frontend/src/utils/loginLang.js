// Language choice for the GOS login screen. Stored only in this browser (localStorage);
// no profile write, no session change, no backend call.
import { LOGIN_LANGUAGES } from "../i18n.js";

export const LOGIN_LANG_KEY = "glv_login_lang";

export function getStoredLoginLang(storage = globalThis.localStorage) {
  try {
    const v = storage?.getItem(LOGIN_LANG_KEY);
    return LOGIN_LANGUAGES.some(l => l.code === v) ? v : "es";
  } catch { return "es"; }
}

export function storeLoginLang(code, storage = globalThis.localStorage) {
  if (!LOGIN_LANGUAGES.some(l => l.code === code)) return false;
  try { storage?.setItem(LOGIN_LANG_KEY, code); return true; } catch { return false; }
}

export function langDir(code) {
  return LOGIN_LANGUAGES.find(l => l.code === code)?.dir || "ltr";
}
