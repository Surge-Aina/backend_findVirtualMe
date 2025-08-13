const express = require("express");
const router = express.Router();
const upload = require("../utils/multer");
const {
  uploadImage,
  addTag,
  updateTag,
  deleteTag,
  getTaggedImage,
  getAllTaggedImages,
} = require("../controllers/taggedImageController");

// Upload a new image
router.post("/upload", upload.single("image"), uploadImage);

// Add a tag to the image
router.post("/:id/tags", addTag);

// Update a specific tag by image ID and tag index
router.put("/:imageId/tags/:tagIndex", updateTag);

// Delete a specific tag by image ID and tag index
router.delete("/:imageId/tags/:tagIndex", deleteTag);

// Get a single tagged image with populated tags
router.get("/:id", getTaggedImage);

// Get all tagged images
router.get("/", getAllTaggedImages);

module.exports = router;
