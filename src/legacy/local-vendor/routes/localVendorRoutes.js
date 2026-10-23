const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();
const { auth, adminOnly, vendorWrite } = require("../../legacyWriteGuard");
const {
  createVendor,
  getAllVendors,
  getMyVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  getFullPortfolio,
  injectVendorPortfolio,
} = require("../controllers/localVendorController");

router.post("/", auth, createVendor);
router.get("/", ...adminOnly, getAllVendors);
router.get("/mine", auth, getMyVendors);
router.get("/:vendorId", getVendorById);
router.put("/:vendorId", ...vendorWrite, updateVendor);
router.delete("/:vendorId", ...vendorWrite, deleteVendor);
router.post("/inject", auth, upload.single("file"), injectVendorPortfolio);
// Special endpoint → returns vendor + all linked sections
router.get("/:vendorId/full", getFullPortfolio);

module.exports = router;
