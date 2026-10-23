const mongoose = require("mongoose");
const Counter = require("./Counter"); 

const supportFormSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String},
    requestType: { type: String},
    portfolioId: { type: String},
    message: { type: String, required: true},
    ticketID: { type: String, required: true, unique: true },
    status: { 
      type: String, 
      enum: ["New", "In Progress", "Completed"], 
      default: "New" 
    },
    priority: { 
      type: String, 
      enum: ["Low", "Normal", "High"], 
      default: "Normal" 
    },
    completionTime: { type: Date, default: null },
    replies: { type: [String], default: [] },
    // ✅ ADD THESE TWO FIELDS: (check if req is coming from logged in user or guest user)
    userStatus: {
      type: String,
      enum: ['Guest User', 'Logged In User'],
      default: 'Guest User'
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  
  { timestamps: true }
);

supportFormSchema.pre("validate", async function (next) {
  if (!this.isNew || this.ticketID) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { name: "ticketID" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    this.ticketID = `T${String(counter.seq).padStart(5, "0")}`;
    next();
  } catch (err) {
    next(err);
  }
});


module.exports = mongoose.model("SupportForm", supportFormSchema);
