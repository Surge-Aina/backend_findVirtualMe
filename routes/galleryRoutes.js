const express = require("express");
const router = express.Router();
const upload = require("../utils/multer");
const {
  getAllGalleryImages,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  insertMultipleGalleryImage,
} = require("../controllers/galleryController");

router.get("/:vendorId", getAllGalleryImages);
router.post("/:vendorId", upload.single("image"), createGalleryImage);
router.put("/:vendorId/:id", upload.single("image"), updateGalleryImage);
router.post(
  "/:vendorId/multiple",
  upload.array("images", 10),
  insertMultipleGalleryImage
);
router.delete("/:vendorId/:id", deleteGalleryImage);

module.exports = router;
