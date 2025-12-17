// src/config/db.js
const mongoose = require("mongoose");
async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is missing from .env");
  }

  console.log("   Using Mongo URI:", uri.slice(0, 40) + "...");

  try {
    await mongoose.connect(uri, {
      autoIndex: true,
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    throw err;
  }
}
module.exports = { connectDB };