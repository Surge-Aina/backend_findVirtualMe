const express = require("express");
const { loginUser, signupUser } = require("../src/modules/auth/auth.controller");
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
} = require("../src/modules/users/users.controller");
const auth = require("../src/shared/middleware/auth");
const router = express.Router();
//auth routes
router.post("/login", loginUser);
router.post("/signup", signupUser);

router.get("/getAllUsers", getAllUsers);
router.get("/getUser/:id", getUserById);
router.get("/subInfo", auth, getSubInfo);
router.get("/hasSubscription", auth, getHasSubscription);
router.get("/ai-edit-access", auth, getAiEditAccess);
router.get("/me", auth, getMe);
router.post("/addUser", addUser); //onboarding
router.patch("/change-password", auth, changePassword);
router.patch("/updateUser", auth, updateUser);
router.patch("/app-theme", auth, updateAppTheme);
router.patch("/addPortfolioId", auth, addPortfolioID);

router.delete("/deleteUser/:id", deleteUser);

module.exports = router;
