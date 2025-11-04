const express = require("express");
const router = express.Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const {
  uploadImage,
  addTag,
  updateTag,
  deleteTag,
  getTaggedImage,
  getAllTaggedImages,
} = require("../../controllers/localFoodVendor/taggedImageController");

// Upload a new image
router.post("/:vendorId/upload", upload.single("image"), uploadImage);

// Add a tag to the image
router.post("/:vendorId/:id/tags", addTag);

// Update a specific tag by image ID and tag index
router.put("/:vendorId/:imageId/tags/:tagIndex", updateTag);

// Delete a specific tag by image ID and tag index
router.delete("/:vendorId/:imageId/tags/:tagIndex", deleteTag);

// Get a single tagged image with populated tags
router.get("/:vendorId/:id", getTaggedImage);

// Get all tagged images
router.get("/:vendorId", getAllTaggedImages);

module.exports = router;
