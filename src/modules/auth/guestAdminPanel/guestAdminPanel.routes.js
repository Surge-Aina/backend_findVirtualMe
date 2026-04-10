// guestAdminPanel.routes.js
const express = require("express");
const { getAllUsers, editUser } = require("./guestAdminPanel.controller");

const router = express.Router();

router.get("/users", getAllUsers);
router.put("/users/:id", editUser);

module.exports = router;
