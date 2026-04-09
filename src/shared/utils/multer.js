const multer = require("multer");
const path = require("path");

// Set up storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // make sure this folder exists
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  },
});

// File type filtering - allow images, PDFs, and PowerPoint files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || 
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      file.mimetype === "application/vnd.ms-powerpoint") {
    cb(null, true);
  } else {
    cb(new Error("Only image, PDF, and PowerPoint files are allowed!"), false);
  }
};

// Export the configured multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size for PDFs and images
  },
});

module.exports = upload;
