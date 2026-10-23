const express = require("express");
const multer = require("multer");
const router = express.Router();
const {
  getAllAbouts,
  createAbout,
  updateAbout,
  imageUpload,
  deleteAbout,
} = require("../controllers/aboutController");

// Use memory storage for S3 uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });
const { vendorWrite } = require("../../legacyWriteGuard");

router.get("/:vendorId", getAllAbouts);

router.post(
  "/:vendorId",
  ...vendorWrite,
  upload.fields([
    { name: "bannerImage", maxCount: 1 },
    { name: "gridImages", maxCount: 6 },
  ]),
  createAbout
);

// routes/aboutRoutes.js
router.put(
  "/:vendorId",
  ...vendorWrite,
  upload.fields([
    { name: "bannerImage", maxCount: 1 },
    { name: "gridImages", maxCount: 10 },
  ]),
  updateAbout
);

router.post(
  "/:vendorId/upload-grid-images",
  ...vendorWrite,
  upload.array("images", 10),
  imageUpload
);

router.delete("/:vendorId/:id", ...vendorWrite, deleteAbout);

module.exports = router;
