const express = require("express");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const router = express.Router();
const {
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} = require("../controllers/bannerController");
const { vendorWrite } = require("../../legacyWriteGuard");

router.get("/:vendorId", getAllBanners);
router.post("/:vendorId", ...vendorWrite, upload.single("image"), createBanner);
router.put("/:vendorId/:id", ...vendorWrite, upload.single("image"), updateBanner);
router.delete("/:vendorId/:id", ...vendorWrite, deleteBanner);

module.exports = router;
