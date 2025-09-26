const express = require("express");
const cors = require("cors");
const localVendorRoutes = require("./routes/localVendorRoutes");
const menuRoutes = require("./routes/menuRoutes");
const aboutRoutes = require("./routes/aboutRoutes");
const bannerRoutes = require("./routes/bannerRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const taggedImageRoutes = require("./routes/taggedImageRoutes");

const app = express();
app.use(cors());
app.use(express.json());

// Only mount what you care about for these tests
app.use("/vendor", localVendorRoutes);
app.use("/menu", menuRoutes);
app.use("/about", aboutRoutes);
app.use("/banner", bannerRoutes);
app.use("/gallery", galleryRoutes);
app.use("/review", reviewRoutes);
app.use("/tagged-image", taggedImageRoutes);

module.exports = app;
