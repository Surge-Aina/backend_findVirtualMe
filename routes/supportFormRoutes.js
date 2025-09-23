const express = require("express");
const router = express.Router();
const {
  createSupportForm,
} = require("../controllers/supportFormController");

router.post("/", createSupportForm);

module.exports = router;