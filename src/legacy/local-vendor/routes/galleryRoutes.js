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
} = require("../controllers/galleryController");
const { vendorWrite } = require("../../legacyWriteGuard");

router.get("/:vendorId", getAllGalleryImages);
router.post("/:vendorId", ...vendorWrite, upload.single("image"), createGalleryImage);
router.put("/:vendorId/:id", ...vendorWrite, upload.single("image"), updateGalleryImage);
router.post(
  "/:vendorId/multiple",
  ...vendorWrite,
  upload.array("images", 10),
  insertMultipleGalleryImage
);
router.delete("/:vendorId/:id", ...vendorWrite, deleteGalleryImage);

module.exports = router;
