"use strict";

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

// Validates that the key is exactly 64 lowercase/uppercase hex characters (32 bytes).
// A 64-char string of non-hex characters (e.g. "zzzz...") would pass a length-only
// check but produce a 0-filled or truncated key — so we require a valid hex pattern.
const HEX_64_RE = /^[0-9a-f]{64}$/i;

function getKey() {
  const hex = process.env.PII_ENCRYPTION_KEY;
  if (!hex || !HEX_64_RE.test(hex)) {
    throw new Error(
      "PII_ENCRYPTION_KEY must be a 64-char hexadecimal string (32 bytes). " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString("base64") + "." + encrypted.toString("base64") + "." + tag.toString("base64");
}

function decrypt(ciphertext) {
  if (!ciphertext) return ciphertext;
  if (!ciphertext.includes(".")) return ciphertext;
  const parts = ciphertext.split(".");
  if (parts.length !== 3) return ciphertext;
  try {
    const key = getKey();
    const iv = Buffer.from(parts[0], "base64");
    const encrypted = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    return ciphertext;
  }
}

function isConfigured() {
  const hex = process.env.PII_ENCRYPTION_KEY;
  return !!(hex && HEX_64_RE.test(hex));
}

module.exports = { encrypt, decrypt, isConfigured };
