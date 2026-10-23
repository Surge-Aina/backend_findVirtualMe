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
const auth = require("../../shared/middleware/auth");
const roleCheck = require("../../shared/middleware/roleCheck");

const adminOnly = [auth, roleCheck(["admin"])];

router.post("/", createSupportForm);
router.post("/with-email", submitSupportFormWithEmail);
router.get("/", ...adminOnly, getTickets);
router.put("/:ticketID", ...adminOnly, updateSupportFormStatus);
router.delete("/:ticketID", ...adminOnly, deleteTicket);
router.post("/:ticketID/replies", ...adminOnly, addReply);

module.exports = router;
