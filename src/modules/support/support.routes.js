const express = require("express");
const router = express.Router();
const {
  createSupportForm,
  getTickets,
  updateSupportFormStatus,
  deleteTicket,
  submitSupportFormWithEmail,
  addReply,
} = require("./support.controller");

router.post("/", createSupportForm);
router.post("/with-email", submitSupportFormWithEmail);
router.get("/", getTickets);
router.put("/:ticketID", updateSupportFormStatus);
router.delete("/:ticketID", deleteTicket);
router.post("/:ticketID/replies", addReply);

module.exports = router;
