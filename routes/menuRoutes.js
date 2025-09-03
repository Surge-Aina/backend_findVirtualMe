const express = require("express");
const router = express.Router();
const upload = require("../utils/multer");
const {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getUniqueCategories,
} = require("../controllers/menuController");

router.get("/:vendorId", getMenuItems);
router.get("/:vendorId/categories", getUniqueCategories);
router.post("/:vendorId", upload.single("image"), createMenuItem);
router.put("/:vendorId/:id", upload.single("image"), updateMenuItem);
router.delete("/:vendorId/:id", deleteMenuItem);

module.exports = router;
