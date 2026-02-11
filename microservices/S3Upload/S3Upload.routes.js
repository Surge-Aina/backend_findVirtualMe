const express = require('express');
const router = express.Router();

const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const uuid = require('uuid').v4;
const { s3 } = require('../../services/s3Service');

router.post('/', async (req, res) => {
  try {
    const { fileType } = req.body;

    const key = `hero-images/${uuid()}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60, // seconds
    });

    const publicUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    res.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

module.exports = router;
