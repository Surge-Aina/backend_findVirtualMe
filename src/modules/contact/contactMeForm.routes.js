const express = require("express");
const router = express.Router();

const { submitContact } = require("./contactMeForm.controller");

router.post("/", submitContact);

module.exports = router;
