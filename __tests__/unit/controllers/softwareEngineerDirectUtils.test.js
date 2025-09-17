// Test file for Software Engineering Portfolio Direct Utility Functions
// This file tests actual utility functions to increase code coverage

describe('Software Engineer Portfolio Direct Utility Tests', () => {
  // Mock cloudinary before importing the utility
  const mockCloudinary = {
    uploader: {
      upload_stream: jest.fn(),
      upload: jest.fn(),
      destroy: jest.fn()
    }
  };

  // Mock the cloudinary config
  jest.mock('../../../config/cloudinary', () => mockCloudinary);

  let cloudinaryUpload;

  beforeAll(() => {
    // Import after mocking
    cloudinaryUpload = require('../../../utils/cloudinaryUpload');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadToCloudinary function', () => {
    it('should upload buffer file successfully', async () => {
      const mockResult = {
        public_id: 'test_id',
        secure_url: 'https://test.url/image.jpg',
        format: 'jpg',
        bytes: 1024,
        width: 800,
        height: 600
      };

      mockCloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(null, mockResult);
        return { end: jest.fn() };
      });

      const mockBuffer = Buffer.from('mock image data');
      const result = await cloudinaryUpload.uploadToCloudinary(mockBuffer, 'test-folder');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://test.url/image.jpg');
      expect(result.publicId).toBe('test_id');
      expect(result.format).toBe('jpg');
    });

    it('should handle upload_stream error', async () => {
      const mockError = new Error('Upload failed');
      
      mockCloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(mockError, null);
        return { end: jest.fn() };
      });

      const mockBuffer = Buffer.from('mock image data');
      const result = await cloudinaryUpload.uploadToCloudinary(mockBuffer, 'test-folder');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Upload failed');
    });

    it('should upload non-buffer file successfully', async () => {
      const mockResult = {
        public_id: 'test_id',
        secure_url: 'https://test.url/image.jpg',
        format: 'jpg',
        bytes: 1024,
        width: 800,
        height: 600
      };

      mockCloudinary.uploader.upload.mockResolvedValue(mockResult);

      const result = await cloudinaryUpload.uploadToCloudinary('path/to/file.jpg', 'test-folder');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://test.url/image.jpg');
      expect(mockCloudinary.uploader.upload).toHaveBeenCalledWith('path/to/file.jpg', expect.objectContaining({
        folder: 'test-folder',
        resource_type: 'auto'
      }));
    });

    it('should handle upload error for non-buffer', async () => {
      const mockError = new Error('Upload failed');
      mockCloudinary.uploader.upload.mockRejectedValue(mockError);

      const result = await cloudinaryUpload.uploadToCloudinary('path/to/file.jpg', 'test-folder');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Upload failed');
    });
  });

  describe('deleteFromCloudinary function', () => {
    it('should delete file successfully', async () => {
      const mockResult = { result: 'ok' };
      mockCloudinary.uploader.destroy.mockResolvedValue(mockResult);

      const result = await cloudinaryUpload.deleteFromCloudinary('test_public_id');

      expect(result.success).toBe(true);
      expect(result.result).toBe(mockResult);
      expect(mockCloudinary.uploader.destroy).toHaveBeenCalledWith('test_public_id');
    });

    it('should handle deletion error', async () => {
      const mockError = new Error('Deletion failed');
      mockCloudinary.uploader.destroy.mockRejectedValue(mockError);

      const result = await cloudinaryUpload.deleteFromCloudinary('test_public_id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Deletion failed');
    });
  });

  describe('uploadResume function', () => {
    it('should upload resume PDF successfully', async () => {
      const mockResult = {
        public_id: 'resume_id',
        secure_url: 'https://test.url/resume.pdf',
        format: 'pdf',
        bytes: 2048
      };

      mockCloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(null, mockResult);
        return { end: jest.fn() };
      });

      const mockPdfBuffer = Buffer.from('mock pdf data');
      const result = await cloudinaryUpload.uploadResume(mockPdfBuffer, 'test@example.com');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://test.url/resume.pdf');
      expect(mockCloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'resumes/test@example.com',
          resource_type: 'raw',
          format: 'pdf'
        }),
        expect.any(Function)
      );
    });
  });

  describe('uploadImage function', () => {
    it('should upload JPEG image successfully', async () => {
      const mockResult = {
        public_id: 'image_id',
        secure_url: 'https://test.url/image.jpg',
        format: 'jpg',
        bytes: 1024,
        width: 800,
        height: 600
      };

      mockCloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(null, mockResult);
        return { end: jest.fn() };
      });

      // Create a JPEG buffer (starts with 0xFF 0xD8)
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
      const result = await cloudinaryUpload.uploadImage(jpegBuffer, 'test@example.com', 'project');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://test.url/image.jpg');
      expect(mockCloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'images/test@example.com/project',
          resource_type: 'image',
          format: 'jpg'
        }),
        expect.any(Function)
      );
    });

    it('should upload PNG image successfully', async () => {
      const mockResult = {
        public_id: 'image_id',
        secure_url: 'https://test.url/image.png',
        format: 'png',
        bytes: 1024,
        width: 800,
        height: 600
      };

      mockCloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(null, mockResult);
        return { end: jest.fn() };
      });

      // Create a PNG buffer (starts with 0x89 0x50 0x4E 0x47)
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const result = await cloudinaryUpload.uploadImage(pngBuffer, 'test@example.com', 'avatar');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://test.url/image.png');
      expect(mockCloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'images/test@example.com/avatar',
          resource_type: 'image',
          format: 'png'
        }),
        expect.any(Function)
      );
    });

    it('should handle unknown image format', async () => {
      const mockResult = {
        public_id: 'image_id',
        secure_url: 'https://test.url/image.jpg',
        format: 'jpg',
        bytes: 1024,
        width: 800,
        height: 600
      };

      mockCloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(null, mockResult);
        return { end: jest.fn() };
      });

      // Create an unknown format buffer
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const result = await cloudinaryUpload.uploadImage(unknownBuffer, 'test@example.com', 'certificate');

      expect(result.success).toBe(true);
      expect(mockCloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'images/test@example.com/certificate',
          resource_type: 'image',
          format: 'jpg' // Should default to jpg
        }),
        expect.any(Function)
      );
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty buffer', async () => {
      const mockResult = {
        public_id: 'image_id',
        secure_url: 'https://test.url/image.jpg',
        format: 'jpg',
        bytes: 0,
        width: 0,
        height: 0
      };

      mockCloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(null, mockResult);
        return { end: jest.fn() };
      });

      const emptyBuffer = Buffer.alloc(0);
      const result = await cloudinaryUpload.uploadImage(emptyBuffer, 'test@example.com', 'project');

      expect(result.success).toBe(true);
      expect(mockCloudinary.uploader.upload_stream).toHaveBeenCalled();
    });

    it('should handle very small buffer', async () => {
      const mockResult = {
        public_id: 'image_id',
        secure_url: 'https://test.url/image.jpg',
        format: 'jpg',
        bytes: 1,
        width: 0,
        height: 0
      };

      mockCloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(null, mockResult);
        return { end: jest.fn() };
      });

      const smallBuffer = Buffer.from([0xFF]);
      const result = await cloudinaryUpload.uploadImage(smallBuffer, 'test@example.com', 'project');

      expect(result.success).toBe(true);
      expect(mockCloudinary.uploader.upload_stream).toHaveBeenCalled();
    });
  });
});
