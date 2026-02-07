    // services/s3Service.js
    const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
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

    await s3.send(new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET, // "findvirtualme"
        Key: key,                          // e.g. "ports/HandyMan/uuid.jpg"
        Body: fileBuffer,
        ContentType: mimeType,
    }));

    const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    return { url, key };
    }

    async function deleteFromS3(key) {
    await s3.send(new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
    }));
    }

    module.exports = { uploadToS3, deleteFromS3, s3 };
