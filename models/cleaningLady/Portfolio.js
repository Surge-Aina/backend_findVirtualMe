const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PortfolioSchema = new Schema(
  {
    isPublic: { type: Boolean, default: false },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    templateType: {
      type: String,
      default: "cleaning-service",
    },

    slug: {
      type: String,
      required: true,
      unique: true,
    },

    isPublished: {
      type: Boolean,
      default: false,
    },

    // Business Info
    businessName: {
      type: String,
      default: "My Cleaning Service",
    },

    tagline: {
      type: String,
      default: "Professional cleaning for your home",
    },

    tagline1: {
      type: String,
      default: "We bring sparkle to your space.",
    },

    tagline2: {
      type: String,
      default: "From roof to floor – Every detail matters.",
    },

    tagline3: {
      type: String,
      default: "For those I love – My purpose in every sweep.",
    },

    buildRoomsTitle: {
      type: String,
      default: "Build Your Rooms",
    },

    cleaningServicesTitle: {
      type: String,
      default: "Cleaning Services",
    },

    // ✅ ADD ROOM LABELS HERE:
    roomLabels: {
      bedroom: {
        type: String,
        default: "Bedroom",
      },
      kitchen: {
        type: String,
        default: "Kitchen",
      },
      bathroom: {
        type: String,
        default: "Bathroom",
      },
      livingRoom: {
        type: String,
        default: "Living Room",
      },
    },

    aboutUs: {
      type: String,
      default:
        "We provide top-notch cleaning services for residential and commercial properties. Our experienced team ensures every corner shines.",
    },

    // Services array
    services: [
      {
        title: String,
        description: String,
        price: String,
        icon: String,
      },
    ],

    // Room Pricing
    roomPricing: [
      {
        roomType: String,
        price: Number,
      },
    ],

    // Contact Info
    contactInfo: {
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      address: { type: String, default: "" },
      workingHours: { type: String, default: "Mon-Fri: 8AM-6PM" },
    },

    // Theme
    theme: {
      primaryColor: { type: String, default: "#3B82F6" },
      secondaryColor: { type: String, default: "#10B981" },
      fontFamily: { type: String, default: "Inter" },
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.CleaningPortfolio ||
  mongoose.model("CleaningPortfolio", PortfolioSchema, "cleaning_portfolios");
