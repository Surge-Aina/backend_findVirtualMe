const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();
const auth = require("../../../shared/middleware/auth");
const {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  getFullPortfolio,
  injectVendorPortfolio,
} = require("../controllers/localVendorController");

router.post("/", auth, createVendor);
router.get("/", getAllVendors);
router.get("/:vendorId", getVendorById);
router.put("/:vendorId", updateVendor);
router.delete("/:vendorId", deleteVendor);
router.post("/inject", auth, upload.single("file"), injectVendorPortfolio);
// Special endpoint → returns vendor + all linked sections
router.get("/:vendorId/full", getFullPortfolio);

module.exports = router;
