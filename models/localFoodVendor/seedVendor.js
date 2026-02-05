const Banner = require("./Banner");
const About = require("./About");
const MenuItem = require("./MenuItems");
// add Gallery, Reviews, TaggedImage etc if needed

async function seedVendor(vendorId) {
  // 🔹 Create starter banner
  await Banner.create({
    vendorId,
    title: "Brand Name!",
    description: "Your tagline goes here.",
    shape: "fullscreen",
    image: "",
  });

  // 🔹 Create starter about section
  await About.create({
    vendorId,
    contentBlocks: [
      { heading: "Our Story", subheading: "Founded 2024" },
      { heading: "Our Vision", subheading: "Making great skincare accessible" },
    ],
    gridImages: [],
  });

  // 🔹 Add one sample menu item
  await MenuItem.create({
    vendorId,
    name: "New Product",
    description: "Edit me to add your own product!",
    price: 10,
    category: "General",
    isAvailable: true,
  });

  console.log(`✅ Seeded starter data for vendor ${vendorId}`);
}

module.exports = seedVendor;
