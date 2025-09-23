const express = require("express");
const upload = require("../../utils/multer");
const router = express.Router();
const {
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} = require("../../controllers/localFoodVendor/bannerController");

router.get("/:vendorId", getAllBanners);
router.post("/:vendorId", upload.single("image"), createBanner);
router.put("/:vendorId/:id", upload.single("image"), updateBanner);
router.delete("/:vendorId/:id", deleteBanner);

module.exports = router;
