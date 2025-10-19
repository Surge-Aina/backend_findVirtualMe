const express = require("express");
const cors = require("cors");
const localVendorRoutes = require("./routes/localFoodVendor/localVendorRoutes");
const menuRoutes = require("./routes/localFoodVendor/menuRoutes");
const aboutRoutes = require("./routes/localFoodVendor/aboutRoutes");
const bannerRoutes = require("./routes/localFoodVendor/bannerRoutes");
const galleryRoutes = require("./routes/localFoodVendor/galleryRoutes");
const reviewRoutes = require("./routes/localFoodVendor/reviewRoutes");
const taggedImageRoutes = require("./routes/localFoodVendor/taggedImageRoutes");

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
