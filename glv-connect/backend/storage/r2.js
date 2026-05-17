const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const R2_ENDPOINT = process.env.R2_ENDPOINT || null;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || null;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || null;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "glv-connect-media";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || null;

let s3Client = null;

function getClient() {
  if (s3Client) return s3Client;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials not configured. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in Railway environment variables.");
  }
  const endpoint = R2_ENDPOINT || `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  s3Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return s3Client;
}

function isConfigured() {
  return !!(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && (R2_ENDPOINT || CLOUDFLARE_ACCOUNT_ID));
}

async function uploadObject(key, buffer, contentType, metadata = {}) {
  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata,
  }));
  // R2 public URL (requires public access enabled on bucket or custom domain)
  // Falls back to account-based URL format
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (publicDomain) {
    return `https://${publicDomain}/${key}`;
  }
  return `https://${R2_BUCKET_NAME}.${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

async function deleteObject(key) {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
}

async function getSignedDownloadUrl(key, expiresIn = 3600) {
  const client = getClient();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }), { expiresIn });
}

module.exports = { uploadObject, deleteObject, getSignedDownloadUrl, isConfigured, R2_BUCKET_NAME };
