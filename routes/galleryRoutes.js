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

router.get("/", getAllGalleryImages);
router.post("/", upload.single("image"), createGalleryImage);
router.put("/:id", upload.single("image"), updateGalleryImage);
router.post(
  "/multiple",
  upload.array("images", 10),
  insertMultipleGalleryImage
);
router.delete("/:id", deleteGalleryImage);

module.exports = router;
