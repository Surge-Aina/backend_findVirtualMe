// guestAdminPanel.model.js
import mongoose from "mongoose";

const guestAdminPanelSchema = new mongoose.Schema({
  name: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("GuestAdminPanel", guestAdminPanelSchema);
