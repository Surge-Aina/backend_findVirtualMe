const express = require("express");
const contactSvc = require("./aiPortfolioCreator.service");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { action, args } = req.body || {};
    let result;

    switch (action) {
      case "contact.create":
        result = await contactSvc.createContact(args || {});
        break;
      case "contact.update":
        result = await contactSvc.updateContact(args?.id, args || {});
        break;
      case "contact.ensure":
        result = await contactSvc.ensureContact(args || {});
        break;
      case "contact.list":
        result = await contactSvc.listContacts(args || {});
        break;
      default:
        return res.status(400).json({ ok: false, error: "Unknown action" });
    }

    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
