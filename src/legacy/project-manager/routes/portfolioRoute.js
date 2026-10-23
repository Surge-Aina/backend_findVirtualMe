const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  getPortfolioByEmail,
  getAllPortfoliosByEmail,
  addPortfolio,
  addPDF,
  deletePortfolioByEmail,
  editPortfolioByEmail,
  getPortfolioById,
  aiSummary,
  getAllPortfolios,
  uploadProfileImage,
  uploadResume, 
} = require("../controllers/portfolioController");
const {
  submitContact,
} = require("../../../modules/contact/contactMeForm.controller");
const { auth, adminOnly, requireSelfOrAdminEmail } = require("../../legacyWriteGuard");

const upload = multer({ storage: multer.memoryStorage() });
router.get("/email/:email", auth, requireSelfOrAdminEmail("email"), getPortfolioByEmail);
router.get("/all-porfolios-by-email/:email", auth, requireSelfOrAdminEmail("email"), getAllPortfoliosByEmail);
router.get("/id/:id", getPortfolioById);
router.get("/all-portfolios", ...adminOnly, getAllPortfolios);

router.post("/add", auth, addPortfolio);
router.post("/upload-pdf", auth, upload.single("resume"), addPDF);
router.post("/ai-summary", auth, aiSummary);
router.post("/contact", submitContact);
router.patch("/edit", auth, editPortfolioByEmail);
router.post("/profile-image/:id",auth,upload.single("image"),uploadProfileImage);
router.delete("/delete", auth, deletePortfolioByEmail);
router.post("/resume/:id", auth, upload.single("resume"), uploadResume);

module.exports = router;
