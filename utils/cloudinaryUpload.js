const cloudinary = require('../config/cloudinary');

/**
 * Upload file to Cloudinary
 * @param {Buffer|string} file - File buffer or file path
 * @param {string} folder - Cloudinary folder name
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} Upload result with URL and public ID
 */
const uploadToCloudinary = async (file, folder = 'portfolios', options = {}) => {
  try {
    const uploadOptions = {
      folder: folder,
      resource_type: 'auto',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ],
      ...options
    };

    console.log('📤 Uploading to Cloudinary with options:', uploadOptions);
    console.log('📤 File type:', typeof file);
    console.log('📤 File is Buffer:', Buffer.isBuffer(file));
    console.log('📤 File length:', file?.length);

    let result;
    
    if (Buffer.isBuffer(file)) {
      // Use upload_stream for Buffer data (more reliable)
      console.log('📤 Using upload_stream for Buffer data');
      
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('❌ Cloudinary upload_stream error:', error);
              resolve({
                success: false,
                error: error.message
              });
            } else {
              console.log('✅ Cloudinary upload_stream successful:', result.public_id);
              resolve({
                success: true,
                url: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                size: result.bytes,
                width: result.width,
                height: result.height
              });
            }
          }
        );
        
        // Write the buffer to the upload stream
        uploadStream.end(file);
      });
    } else {
      // For non-buffer data (like file paths), use regular upload
      console.log('📤 Using regular upload for non-buffer data');
      result = await cloudinary.uploader.upload(file, uploadOptions);
    }
    
    if (result) {
      console.log('✅ Cloudinary upload successful:', result.public_id);
      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        size: result.bytes,
        width: result.width,
        height: result.height
      };
    }
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      http_code: error.http_code,
      name: error.name
    });
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Deletion result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: true,
      result: result
    };
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Upload resume PDF to Cloudinary
 * @param {Buffer} fileBuffer - PDF file buffer
 * @param {string} ownerId - Portfolio owner ID
 * @returns {Promise<Object>} Upload result
 */
const uploadResume = async (fileBuffer, ownerId) => {
  return await uploadToCloudinary(fileBuffer, `resumes/${ownerId}`, {
    resource_type: 'raw',
    format: 'pdf'
  });
};

/**
 * Upload image to Cloudinary
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {string} ownerId - Portfolio owner ID
 * @param {string} type - Image type (project, certificate, profile)
 * @returns {Promise<Object>} Upload result
 */
const uploadImage = async (fileBuffer, ownerId, type = 'general') => {
  console.log('🖼️ Processing image upload for type:', type);
  console.log('🖼️ Buffer length:', fileBuffer.length);
  console.log('🖼️ Buffer first bytes:', fileBuffer.slice(0, 4));

  // Determine content type from buffer signature
  let mimeType = 'image/jpeg';
  let format = 'jpg';
  
  if (fileBuffer.length > 2) {
    // Check file signature to determine type
    if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8) {
      mimeType = 'image/jpeg';
      format = 'jpg';
      console.log('🖼️ Detected JPEG format');
    } else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
      mimeType = 'image/png';
      format = 'png';
      console.log('🖼️ Detected PNG format');
    } else if (fileBuffer[0] === 0x47 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46) {
      mimeType = 'image/gif';
      format = 'gif';
      console.log('🖼️ Detected GIF format');
    } else {
      console.log('⚠️ Unknown format, defaulting to JPEG');
    }
  }

  return await uploadToCloudinary(fileBuffer, `images/${ownerId}/${type}`, {
    resource_type: 'image',
    format: format,
    transformation: [
      { quality: 'auto:good' },
      { fetch_format: 'auto' },
      { width: 800, height: 600, crop: 'limit' }
    ]
  });
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadResume,
  uploadImage
};
