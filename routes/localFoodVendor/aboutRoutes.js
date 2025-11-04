const express = require("express");
const multer = require("multer");
const router = express.Router();
const {
  getAllAbouts,
  createAbout,
  updateAbout,
  imageUpload,
  deleteAbout,
} = require("../../controllers/localFoodVendor/aboutController");

// Use memory storage for S3 uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/:vendorId", getAllAbouts);

router.post(
  "/:vendorId",
  upload.fields([
    { name: "bannerImage", maxCount: 1 },
    { name: "gridImages", maxCount: 6 },
  ]),
  createAbout
);

// routes/aboutRoutes.js
router.put(
  "/:vendorId",
  upload.fields([
    { name: "bannerImage", maxCount: 1 },
    { name: "gridImages", maxCount: 10 },
  ]),
  updateAbout
);

router.post(
  "/:vendorId/upload-grid-images",
  upload.array("images", 10),
  imageUpload
);

router.delete("/:vendorId/:id", deleteAbout);

module.exports = router;
