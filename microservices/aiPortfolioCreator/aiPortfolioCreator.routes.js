const express = require("express");
const {
  listContacts,
  createContact,
  updateContact,
  bulkUpdate,
} = require("./aiPortfolioCreator.controller");
const router = express.Router();

router.get("/", listContacts);
router.post("/", createContact);
router.patch("/:id", updateContact);
router.patch("/", bulkUpdate);

module.exports = router;
