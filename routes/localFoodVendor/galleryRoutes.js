const express = require("express");
const router = express.Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const {
  getAllGalleryImages,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  insertMultipleGalleryImage,
} = require("../../controllers/localFoodVendor/galleryController");

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
