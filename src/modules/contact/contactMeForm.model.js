const mongoose = require("mongoose");

const ContactMeFormSchema = new mongoose.Schema(
  {
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "portfolio",
      required: true,
    },
    portfolioType: {
      type: String,
    },
    ownerEmail: {
      type: String,
      required: true,
    },
    ownerName: {
      type: String,
    },
    // Visitor info
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    leadType: {
      type: String,
      enum: ["contact", "booking"],
      default: "contact",
    },
    bookingService: { type: String },
    bookingRequestedStart: { type: Date },
    bookingRequestedEnd: { type: Date },
    bookingTimezone: { type: String },
    bookingSectionId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    /** Set only when the form asks for contact consent. Absent means it did not ask. */
    consentContact: { type: Boolean },
    status: {
      type: String,
      enum: ["new", "read", "replied"],
      default: "new",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("contactMeForm", ContactMeFormSchema);
