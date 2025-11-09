// testNewFeatureCorrected.model.js
import mongoose from "mongoose";

const testNewFeatureCorrectedSchema = new mongoose.Schema({
  name: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("TestNewFeatureCorrected", testNewFeatureCorrectedSchema);
