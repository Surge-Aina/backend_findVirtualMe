const express = require("express");
const router = express.Router();
const {
  createSupportForm,
  getTickets,
  updateSupportFormStatus,
  deleteTicket,
  addReply
} = require("../controllers/supportFormController");

router.post("/", createSupportForm);
router.get("/", getTickets)
router.put("/:ticketID", updateSupportFormStatus);
router.delete("/:ticketID", deleteTicket); 
router.post("/:ticketID/replies", addReply);

module.exports = router;