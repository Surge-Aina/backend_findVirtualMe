const HandymanInquiry = require('../../models/handymanInquiryModel');

const createInquiry = async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const newInquiry = new HandymanInquiry({ name, email, message });
    await newInquiry.save();
    res.status(201).json({ message: 'Inquiry received successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error while saving inquiry.' });
  }
};

module.exports = { createInquiry };
