const express = require("express");
const cors = require("cors");
const localVendorRoutes = require("./src/legacy/local-vendor/routes/localVendorRoutes");
const menuRoutes = require("./src/legacy/local-vendor/routes/menuRoutes");
const aboutRoutes = require("./src/legacy/local-vendor/routes/aboutRoutes");
const bannerRoutes = require("./src/legacy/local-vendor/routes/bannerRoutes");
const galleryRoutes = require("./src/legacy/local-vendor/routes/galleryRoutes");
const reviewRoutes = require("./src/legacy/local-vendor/routes/reviewRoutes");
const taggedImageRoutes = require("./src/legacy/local-vendor/routes/taggedImageRoutes");

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
