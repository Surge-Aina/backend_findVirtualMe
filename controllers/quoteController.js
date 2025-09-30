// server/controllers/quoteController.js
const QuoteRequest = require('../models/quoteRequestModel.js');

// POST /quotes  (customer)
const createQuote = async (req, res) => {
  try {
    const { services, details, dueDate, name, email, phone, status = 'new', type } = req.body;

    if (type === 'estimate') {
      if (!services?.length || !dueDate) {
        return res.status(400).json({ message: 'Missing rooms or due date for estimate.' });
      }
    } else {
      if (!services?.length || !dueDate || !name || !email || !phone) {
        return res.status(400).json({ message: 'Missing required fields.' });
      }
    }

    const doc = await QuoteRequest.create({
      services,
      details: details || '',
      dueDate,
      name: name || '',
      email: email || '',
      phone: phone || '',
      status,
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create quote', error: err.message });
  }
};


// GET /quotes  (admin)
const listQuotes = async (_req, res) => {
  try {
    const docs = await QuoteRequest.find().sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch quotes', error: err.message });
  }
};

// PATCH /quotes/:id/status  (admin)
const updateQuoteStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['new', 'in_progress', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updated = await QuoteRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Quote not found' });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update status', error: err.message });
  }
};

module.exports = { createQuote, listQuotes, updateQuoteStatus };
