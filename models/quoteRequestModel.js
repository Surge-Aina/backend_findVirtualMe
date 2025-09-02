// server/models/quoteRequestModel.js
const mongoose = require('mongoose');

const quoteRequestSchema = new mongoose.Schema(
  {
    services: [{ type: String, required: true }], // selected service titles
    details: { type: String, default: '' },
    dueDate: { type: Date, required: true },

    // contact info
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },

    // optional rough price estimate (from services page)
    estimate: { type: String }, // stored as string like "100", or "$100"

    // admin status
    status: {
      type: String,
      enum: ['new', 'in_progress', 'completed', 'rejected'],
      default: 'new',
    },
  },
  { timestamps: true }
);

// Collection is "forms"
module.exports = mongoose.model('QuoteRequest', quoteRequestSchema, 'forms');
