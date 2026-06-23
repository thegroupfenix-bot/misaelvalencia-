"use strict";

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey() {
  const hex = process.env.PII_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("PII_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
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
  return !!(hex && hex.length === 64);
}

module.exports = { encrypt, decrypt, isConfigured };
