const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function createCloudinaryStorage(options = {}) {
  const uploadOpts = {
    folder: options.folder || 'photographer',
    resource_type: 'image',
    ...options.params,
  };

  return {
    _handleFile(req, file, cb) {
      const uploadStream = cloudinary.uploader.upload_stream(uploadOpts, (err, result) => {
        if (err) return cb(err);
        cb(null, {
          path: result.secure_url,
          filename: result.public_id,
          width: result.width,
          height: result.height,
          size: result.bytes,
          format: result.format,
        });
      });

      file.stream.on('error', cb);
      uploadStream.on('error', cb);
      file.stream.pipe(uploadStream);
    },
    _removeFile(req, file, cb) {
      cb(null);
    },
  };
}

const upload = multer({ storage: createCloudinaryStorage({ folder: 'photographer' }) });

module.exports = { upload, cloudinary };
