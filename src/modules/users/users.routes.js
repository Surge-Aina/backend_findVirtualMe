const express = require("express");
const {
  addUser,
  getAllUsers,
  getUserById,
  getPublicUser,
  updateUser,
  deleteUser,
  getSubInfo,
  getHasSubscription,
  getAiEditAccess,
  getMe,
  addPortfolioID,
  changePassword,
  updateAppTheme,
} = require("./users.controller");
const auth = require("../../shared/middleware/auth");
const roleCheck = require("../../shared/middleware/roleCheck");

const router = express.Router();

router.get("/me", auth, getMe);
router.get("/subscription-info", auth, getSubInfo);
router.get("/subInfo", auth, getSubInfo);
router.get("/has-subscription", auth, getHasSubscription);
router.get("/ai-edit-access", auth, getAiEditAccess);

// Public portfolio pages need a display name before the viewer is logged in.
// This projection is the only unauthenticated read. It must stay above "/:id".
router.get("/public/:id", getPublicUser);

router.get("/", auth, roleCheck(["admin"]), getAllUsers);

// Account creation for the onboarding wizard, which runs before a token exists.
// Privileged fields are ignored in the controller. Signup is also available at
// POST /api/auth/signup.
router.post("/", addUser);
router.post("/addUser", addUser);

router.get("/getUser/:id", auth, getUserById);
router.get("/:id", auth, getUserById);

router.patch("/", auth, updateUser);
router.patch("/updateUser", auth, updateUser);
router.patch("/change-password", auth, changePassword);
router.patch("/app-theme", auth, updateAppTheme);
router.patch("/portfolio-id", auth, addPortfolioID);
router.patch("/:id", auth, updateUser);

router.delete("/:id", auth, roleCheck(["admin"]), deleteUser);

module.exports = router;
