// services/s3Service.js
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function joinKey(prefix, filename) {
  const safePrefix = (prefix || "").replace(/^\/+|\/+$/g, ""); // trim slashes
  return safePrefix ? `${safePrefix}/${filename}` : filename;
}

async function uploadToS3(fileBuffer, fileName, mimeType, prefix = "") {
  const ext = (fileName?.split(".").pop() || "bin").toLowerCase();
  const key = joinKey(prefix, `${uuidv4()}.${ext}`);

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    }),
  );

  const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return { url, key };
}

async function deleteFromS3(key) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }),
  );
}

/**
 * List all object keys under a prefix (paginated). Returns { Key, LastModified } per object.
 */
async function listByPrefix(prefix) {
  const bucket = process.env.AWS_S3_BUCKET;
  const normalized = (prefix || "").replace(/^\/+/, "");
  const results = [];
  let continuationToken;

  do {
    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: normalized,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of out.Contents || []) {
      if (obj.Key) {
        results.push({ Key: obj.Key, LastModified: obj.LastModified });
      }
    }
    continuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (continuationToken);

  return results;
}

/**
 * Delete every object whose key starts with the given prefix (e.g. portfolios/abc123/).
 */
async function deleteManyByPrefix(prefix) {
  const keys = await listByPrefix(prefix);
  if (keys.length === 0) return { deleted: 0 };

  const bucket = process.env.AWS_S3_BUCKET;
  let deleted = 0;
  const chunkSize = 1000;

  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize).map((k) => ({ Key: k.Key }));
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk,
          Quiet: true,
        },
      }),
    );
    deleted += chunk.length;
  }

  return { deleted };
}

/**
 * Extract S3 object key from a virtual-hosted-style public URL for this bucket.
 */
function keyFromPublicUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  const patterns = [
    new RegExp(
      `^https?://${bucket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.s3\\.${region.replace(/-/g, "\\-")}\\.amazonaws\\.com/(.+)$`,
    ),
    new RegExp(
      `^https?://${bucket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.s3\\.amazonaws\\.com/(.+)$`,
    ),
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

module.exports = {
  uploadToS3,
  deleteFromS3,
  listByPrefix,
  deleteManyByPrefix,
  keyFromPublicUrl,
  s3,
};
