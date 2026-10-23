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
} = require("../controllers/menuController");
const { vendorWrite } = require("../../legacyWriteGuard");

router.get("/:vendorId", getMenuItems);
router.get("/:vendorId/categories", getUniqueCategories);
router.post("/:vendorId", ...vendorWrite, upload.single("image"), createMenuItem);
router.put("/:vendorId/:id", ...vendorWrite, upload.single("image"), updateMenuItem);
router.delete("/:vendorId/:id", ...vendorWrite, deleteMenuItem);

module.exports = router;
