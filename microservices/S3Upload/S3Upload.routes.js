const express = require("express");
const router = express.Router();

const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const uuid = require("uuid").v4;
const auth = require("../../middleware/auth");
const { assertPortfolioOwner } = require("../../services/portfolio.service");
const { s3, deleteFromS3, keyFromPublicUrl } = require("../../services/s3Service");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function publicUrlForKey(key) {
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * POST / — presigned PUT for portfolio images (portfolios/<id>/...) or legacy hero-images/ (no portfolioId).
 * Body: { fileType, portfolioId?, contentLength? }
 * For portfolio uploads, contentLength is required (exact size for signed PUT).
 */
router.post("/", auth, async (req, res) => {
  try {
    const { fileType, portfolioId, contentLength } = req.body || {};

    if (!fileType || typeof fileType !== "string") {
      return res.status(400).json({ error: "fileType is required" });
    }

    const normalizedType = fileType.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(normalizedType)) {
      return res.status(400).json({
        error: "Unsupported file type. Allowed: JPEG, PNG, WebP, GIF.",
      });
    }

    const ext = MIME_TO_EXT[normalizedType];
    let key;
    let commandOpts = {
      Bucket: process.env.AWS_S3_BUCKET,
      ContentType: normalizedType,
    };

    if (portfolioId) {
      const check = await assertPortfolioOwner(portfolioId, req.user._id);
      if (!check.ok) {
        return res.status(check.status).json({ error: check.error });
      }

      const len = Number(contentLength);
      if (!Number.isFinite(len) || len <= 0 || len > MAX_BYTES) {
        return res.status(400).json({
          error: `contentLength must be a positive number up to ${MAX_BYTES} bytes`,
        });
      }

      key = `portfolios/${portfolioId}/${uuid()}.${ext}`;
      commandOpts.Key = key;
      commandOpts.ContentLength = Math.floor(len);
    } else {
      // Legacy: healthcare admin and others — key without extension (matches previous behavior)
      key = `hero-images/${uuid()}`;
      commandOpts.Key = key;

      const len = contentLength != null ? Number(contentLength) : null;
      if (len != null && Number.isFinite(len) && len > 0 && len <= MAX_BYTES) {
        commandOpts.ContentLength = Math.floor(len);
      }
    }

    const command = new PutObjectCommand(commandOpts);

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 120,
    });

    const publicUrl = publicUrlForKey(key);

    res.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * DELETE / — remove an object by public URL; must belong to portfolios/<portfolioId>/...
 * Body: { imageUrl, portfolioId }
 */
router.delete("/", auth, async (req, res) => {
  try {
    const { imageUrl, portfolioId } = req.body || {};

    if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({ error: "imageUrl is required" });
    }
    if (!portfolioId) {
      return res.status(400).json({ error: "portfolioId is required" });
    }

    const check = await assertPortfolioOwner(portfolioId, req.user._id);
    if (!check.ok) {
      return res.status(check.status).json({ error: check.error });
    }

    const key = keyFromPublicUrl(imageUrl.trim());
    if (!key) {
      return res.status(400).json({ error: "Could not parse S3 key from imageUrl" });
    }

    const expectedPrefix = `portfolios/${portfolioId}/`;
    if (!key.startsWith(expectedPrefix)) {
      return res.status(403).json({
        error: "Image does not belong to this portfolio prefix",
      });
    }

    await deleteFromS3(key);
    res.json({ ok: true, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

module.exports = router;
