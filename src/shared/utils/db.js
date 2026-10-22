const mongoose = require("mongoose");

mongoose.set("strictQuery", true);

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const error = new Error("Missing required environment variable: MONGODB_URI");
    console.error("MongoDB connection failed");
    throw error;
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed");
    throw err;
  }
};

module.exports = connectDB;
