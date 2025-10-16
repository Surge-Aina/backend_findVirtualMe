const express = require("express");
const { loginUser, signupUser, addUser, getAllUsers, getUserById, updateUser, deleteUser, getSubInfo, getHasSubscription,getMe } = require("../controllers/userController");
const auth = require("../middleware/auth");
const router = express.Router();
//auth routes
router.post("/login", loginUser);
router.post("/signup", signupUser);

router.get("/getAllUsers", getAllUsers);
router.get("/getUser/:id", getUserById);
router.get("/subInfo", auth, getSubInfo);
router.get("/hasSubscription", auth, getHasSubscription);
router.get('/me', auth, getMe);
router.post("/addUser", addUser); //onboarding

router.patch("/updateUser/:id", updateUser);

router.delete("/deleteUser/:id", deleteUser);

router.get("/me", auth, (req, res) => {
  // // Return all safe profile fields
  // const {
  //     _id,
  //     username,
  //     email,
  //     firstName,
  //     lastName,
  //     phone,
  //     location,
  // } = req.user;
  // res.json({
  //     id: _id,
  //     username,
  //     email,
  //     firstName,
  //     lastName,
  //     phone,
  //     location,
  // });
  res.json({ ...req.user._doc }); //send all data from user back
});

module.exports = router;
