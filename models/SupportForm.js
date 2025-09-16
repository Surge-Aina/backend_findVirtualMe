const mongoose = require("mongoose");

const supportFormSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String},
    requestType: { type: String},
    portfolioId: { type: String},
    message: { type: String, required: true}
  }, 
  { timestamps: true }
);


module.exports = mongoose.model("SupportForm", supportFormSchema);
