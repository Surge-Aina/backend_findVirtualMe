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

router.get("/", getMenuItems);
router.get("/categories", getUniqueCategories);
router.post("/", upload.single("image"), createMenuItem);
router.put("/:id", upload.single("image"), updateMenuItem);
router.delete("/:id", deleteMenuItem);

module.exports = router;
