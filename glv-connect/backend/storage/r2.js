// Cloudflare R2 storage adapter
// Supports two auth modes (auto-detected from env vars):
//   1. "token"  — Cloudflare Account API Token (preferred)
//                 Requires: CLOUDFLARE_ACCOUNT_ID + R2_API_TOKEN
//   2. "s3"     — Classic S3-compatible credentials (fallback)
//                 Requires: R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_ENDPOINT (or CLOUDFLARE_ACCOUNT_ID)

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || null;
const R2_BUCKET_NAME        = process.env.R2_BUCKET_NAME        || "glv-connect-media";
const R2_API_TOKEN          = process.env.R2_API_TOKEN          || null; // Cloudflare API Token (preferred)
const R2_ENDPOINT           = process.env.R2_ENDPOINT           || null; // S3-compatible endpoint URL
const R2_ACCESS_KEY_ID      = process.env.R2_ACCESS_KEY_ID      || null; // S3 fallback
const R2_SECRET_ACCESS_KEY  = process.env.R2_SECRET_ACCESS_KEY  || null; // S3 fallback
const R2_PUBLIC_DOMAIN      = process.env.R2_PUBLIC_DOMAIN      || null; // Custom CDN / public bucket domain

// ─── Auth mode detection ──────────────────────────────────────────────────────

function authMode() {
  if (R2_API_TOKEN && CLOUDFLARE_ACCOUNT_ID) return "token";
  if (R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) return "s3";
  return null;
}

function isConfigured() {
  return authMode() !== null;
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

function buildPublicUrl(key) {
  if (R2_PUBLIC_DOMAIN) return `https://${R2_PUBLIC_DOMAIN}/${key}`;
  if (R2_ENDPOINT) {
    const base = R2_ENDPOINT.replace(/\/$/, "");
    // If endpoint already contains the bucket, don't add it again
    return base.includes(R2_BUCKET_NAME)
      ? `${base}/${key}`
      : `${base}/${R2_BUCKET_NAME}/${key}`;
  }
  return `https://${R2_BUCKET_NAME}.${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

// Cloudflare REST API endpoint for an R2 object
function cfObjectUrl(key) {
  // key may contain slashes — encode only path segments, not slashes
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}/objects/${encodedKey}`;
}

// ─── Lazy S3 client (only initialised when S3 mode is used) ──────────────────

let _s3Client = null;
function getS3Client() {
  if (_s3Client) return _s3Client;
  const { S3Client } = require("@aws-sdk/client-s3");
  const endpoint = R2_ENDPOINT || `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  _s3Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return _s3Client;
}

// ─── Core operations ──────────────────────────────────────────────────────────

async function uploadObject(key, buffer, contentType) {
  const mode = authMode();
  if (!mode) throw new Error("R2 not configured — set R2_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in Railway environment variables");

  if (mode === "token") {
    const res = await fetch(cfObjectUrl(key), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${R2_API_TOKEN}`,
        "Content-Type": contentType,
      },
      body: buffer,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`R2 upload failed [${res.status}]: ${text}`);
    }
    return buildPublicUrl(key);
  }

  // S3 fallback
  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  await getS3Client().send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return buildPublicUrl(key);
}

async function deleteObject(key) {
  const mode = authMode();
  if (!mode) return;

  if (mode === "token") {
    const res = await fetch(cfObjectUrl(key), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${R2_API_TOKEN}` },
    });
    // 404 = already gone — not an error
    if (!res.ok && res.status !== 404) {
      console.warn(`R2 delete warning [${res.status}] for key: ${key}`);
    }
    return;
  }

  const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
  await getS3Client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
}

async function getSignedDownloadUrl(key, expiresIn = 3600) {
  const mode = authMode();

  if (mode === "s3") {
    // S3 presigned URL support
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
    return getSignedUrl(getS3Client(), new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }), { expiresIn });
  }

  // Token mode or unconfigured — return public URL
  // (requires the bucket to have public access or a custom domain configured in R2)
  return buildPublicUrl(key);
}

module.exports = { uploadObject, deleteObject, getSignedDownloadUrl, isConfigured, authMode, R2_BUCKET_NAME };
