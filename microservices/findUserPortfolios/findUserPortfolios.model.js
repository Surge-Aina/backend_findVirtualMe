// findUserPortfolios.model.js
import mongoose from "mongoose";

const findUserPortfoliosSchema = new mongoose.Schema({
  name: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("FindUserPortfolios", findUserPortfoliosSchema);
