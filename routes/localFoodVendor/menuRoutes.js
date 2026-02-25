const express = require("express");
const router = express.Router();
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });

const {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getUniqueCategories,
} = require("../../controllers/localFoodVendor/menuController");

router.get("/:vendorId", getMenuItems);
router.get("/:vendorId/categories", getUniqueCategories);
router.post("/:vendorId", upload.single("image"), createMenuItem);
router.put("/:vendorId/:id", upload.single("image"), updateMenuItem);
router.delete("/:vendorId/:id", deleteMenuItem);

module.exports = router;
