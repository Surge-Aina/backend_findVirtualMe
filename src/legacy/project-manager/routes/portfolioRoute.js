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
const { auth, optionalAuth, adminOnly, requireSelfOrAdminEmail } = require("../../legacyWriteGuard");
const { createRateLimiter, clientIp } = require("../../../shared/middleware/rateLimit");

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

function pdfFileFilter(_req, file, cb) {
  const name = String(file.originalname || "").toLowerCase();
  const type = String(file.mimetype || "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    cb(null, true);
    return;
  }
  cb(new Error("Only PDF files are allowed"));
}

const upload = multer({ storage: multer.memoryStorage() });

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_BYTES, files: 1 },
  fileFilter: pdfFileFilter,
});

function handleOnboardingResume(req, res, next) {
  resumeUpload.single("resume")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "PDF must be 5MB or smaller" });
    }
    return res.status(400).json({ error: err.message || "Invalid upload" });
  });
}

const uploadPdfIpLimit = createRateLimiter({
  name: "upload-pdf-ip",
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyFn: clientIp,
});

const uploadPdfSessionLimit = createRateLimiter({
  name: "upload-pdf-session",
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyFn: (req) => String(req.body?.sessionId || req.user?._id || clientIp(req)),
});

const aiSummaryUserLimit = createRateLimiter({
  name: "ai-summary-user",
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyFn: (req) => String(req.user?._id || clientIp(req)),
});

const aiSummaryIpLimit = createRateLimiter({
  name: "ai-summary-ip",
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyFn: clientIp,
});
router.get("/email/:email", auth, requireSelfOrAdminEmail("email"), getPortfolioByEmail);
router.get("/all-porfolios-by-email/:email", auth, requireSelfOrAdminEmail("email"), getAllPortfoliosByEmail);
router.get("/id/:id", getPortfolioById);
router.get("/all-portfolios", ...adminOnly, getAllPortfolios);

router.post("/add", auth, addPortfolio);
router.post("/upload-pdf", optionalAuth, uploadPdfIpLimit, handleOnboardingResume, uploadPdfSessionLimit, addPDF);
router.post("/ai-summary", auth, aiSummaryUserLimit, aiSummaryIpLimit, aiSummary);
router.post("/contact", submitContact);
router.patch("/edit", auth, editPortfolioByEmail);
router.post("/profile-image/:id",auth,upload.single("image"),uploadProfileImage);
router.delete("/delete", auth, deletePortfolioByEmail);
router.post("/resume/:id", auth, upload.single("resume"), uploadResume);

router.resetOnboardingLimits = () => {
  uploadPdfIpLimit.reset();
  uploadPdfSessionLimit.reset();
  aiSummaryUserLimit.reset();
  aiSummaryIpLimit.reset();
};

module.exports = router;
