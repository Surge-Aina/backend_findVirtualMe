// guestAdminPanel.routes.js
const express = require("express");
const { getAllUsers, editUser } = require("./guestAdminPanel.controller");

const router = express.Router();

router.get("/getAllUsers", getAllUsers);
router.put("/editUser/:id", editUser);

module.exports = router;
