const express = require("express");
const router = express.Router();

const { submitContact } = require("./contactMeForm.controller");

router.post("/contactMeForm", submitContact);

module.exports = router;
