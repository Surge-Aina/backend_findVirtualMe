const express = require('express');
const router = express.Router();

const userController = require("../controllers/onboardingController");

router.post("/addUser", userController.addUser);
router.get("/getAllUsers", userController.getAllUsers);
router.get("/getUser/:id", userController.getUserById);
router.put("/editUser/:id", userController.updateUser);
router.delete("/deleteUser/:id", userController.deleteUser);

module.exports = router;