const SupportForm = require("../models/supportForm/SupportForm");

// Create support form
exports.createSupportForm = async (req, res) => {
  try {
    const sf = new SupportForm(req.body);
    await sf.save();

    //seeding info
    //await seedVendor(vendor._id);

    res.status(201).json(sf);
  } catch (err) {
    console.log(err)
    res.status(400).json({ error: "Failed to create support form" });
  }
};

exports.getTickets = async (req, res) => {
  try {
    const items = await SupportForm.find();
    res.json(items);
    console.log(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tickets' });
  }
};

// update status
exports.updateSupportFormStatus = async (req, res) => {
  try {
    const { ticketID } = req.params;
    const { status } = req.body;

    const ALLOWED = ["New", "In Progress", "Completed"];
    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const update = { status };
    if (status === "Completed") {
      update.completionTime = new Date();
    } else if (status === "In Progress") {
      update.completionTime = null;
    }

    const doc = await SupportForm.findOneAndUpdate(
      { ticketID },           
      { $set: update },
      { new: true, runValidators: true } 
    );

    if (!doc) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    return res.json(doc);
  } catch (err) {
    console.error("updateSupportFormStatus error:", err);
    return res.status(500).json({ error: "Failed to update status" });
  }
};

exports.deleteTicket = async (req, res) => {
  try {
    const { ticketID } = req.params;
    const doc = await SupportForm.findOneAndDelete({ ticketID }); 
    if (!doc) return res.status(404).json({ error: "Ticket not found" });
    return res.json({ ok: true, deleted: ticketID });
  } catch (err) {
    console.error("deleteTicket error:", err);
    return res.status(500).json({ error: "Failed to delete ticket" });
  }
};

exports.addReply = async (req, res) => {
  try {
    const { ticketID } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Reply message is required" });
    }

    const doc = await SupportForm.findOneAndUpdate(
      { ticketID },
      { $push: { replies: message.trim() } },
      { new: true }
    );

    if (!doc) return res.status(404).json({ error: "Ticket not found" });

    return res.json({ ok: true, ticketID, replies: doc.replies });
  } catch (err) {
    console.error("addReply error:", err);
    return res.status(500).json({ error: "Failed to add reply" });
  }
};