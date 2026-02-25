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
} = require("../../controllers/projectManager/portfolioController");
const {
  submitContact,
} = require("../../microservices/contactMeForm/contactMeForm.controller");
const auth = require("../../middleware/auth");

const upload = multer({ storage: multer.memoryStorage() });
router.get("/email/:email", getPortfolioByEmail);
router.get("/all-porfolios-by-email/:email", getAllPortfoliosByEmail);
router.get("/id/:id", getPortfolioById);
router.get("/all-portfolios", getAllPortfolios);

router.post("/add", addPortfolio);
router.post("/upload-pdf", upload.single("resume"), addPDF);
router.post("/ai-summary", aiSummary);
router.post("/contact", submitContact);
router.patch("/edit", auth, editPortfolioByEmail);
router.post("/profile-image/:id",auth,upload.single("image"),uploadProfileImage);
router.delete("/delete", deletePortfolioByEmail);
router.post("/resume/:id", auth, upload.single("resume"), uploadResume);

module.exports = router;
