const express = require("express");
const {
  addUser,
  getAllUsers,
  getUserById,
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

const router = express.Router();

router.get("/me", auth, getMe);
router.get("/subscription-info", auth, getSubInfo);
router.get("/has-subscription", auth, getHasSubscription);
router.get("/ai-edit-access", auth, getAiEditAccess);

router.get("/", getAllUsers);
router.post("/", addUser);
router.get("/:id", getUserById);

router.patch("/", auth, updateUser);
router.patch("/change-password", auth, changePassword);
router.patch("/app-theme", auth, updateAppTheme);
router.patch("/portfolio-id", auth, addPortfolioID);

router.delete("/:id", deleteUser);

module.exports = router;
