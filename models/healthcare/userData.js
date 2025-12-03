const mongoose = require("mongoose");

const UserDataSchema = new mongoose.Schema({
  portfolioType: { type: String, immutable: true, default: "Healthcare" },
  isPublic: { type: Boolean, default: false },
  practiceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  subdomain: {
    type: String,
    unique: true,
    sparse: true, // Allow null but must be unique if present
    lowercase: true,
    trim: true,
  },
  practice: {
    name: { type: String, required: true },
    tagline: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  contact: {
    phone: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    email: { type: String, default: "" },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zip: { type: String, default: "" },
    },
  },
  hours: {
    weekdays: { type: String, default: "Mon-Fri: 9:00 AM - 5:00 PM" },
    saturday: { type: String, default: "Sat: Closed" },
    sunday: { type: String, default: "Sun: Closed" },
  },
  stats: {
    yearsExperience: { type: String, default: "0" },
    patientsServed: { type: String, default: "0" },
    successRate: { type: String, default: "0" },
    doctorsCount: { type: String, default: "0" },
  },
  services: [
    {
      id: String,
      title: String,
      description: String,
      icon: String,
      price: String,
      duration: String,
      image: String,
      features: [String],
    },
  ],
  blogPosts: [
    {
      id: Number,
      title: String,
      slug: String,
      excerpt: String,
      content: String,
      image: String,
      publishDate: String,
      author: {
        name: String,
        id: String,
      },
      category: String,
      tags: [String],
      readTime: String,
      featured: Boolean,
    },
  ],
  gallery: {
    facilityImages: [
      {
        url: String,
        caption: String,
        description: String,
      },
    ],
    beforeAfterCases: [
      {
        title: String,
        treatment: String,
        duration: String,
        description: String,
        beforeImage: String,
        afterImage: String,
      },
    ],
  },
  seo: {
    siteTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    keywords: { type: String, default: "" },
  },
  ui: {
    hero: {
      primaryButtonText: { type: String, default: "Get Started" },
      secondaryButtonText: { type: String, default: "Learn More" },
    },
    services: {
      viewAllText: { type: String, default: "View All Services" },
      bookButtonText: { type: String, default: "Book Now" },
    },
    blog: {
      readMoreText: { type: String, default: "Read More" },
      viewAllText: { type: String, default: "View All Posts" },
    },
    contact: {
      buttonText: { type: String, default: "Contact Us" },
      submitText: { type: String, default: "Send Message" },
    },
    cta: {
      heading: { type: String, default: "Ready to Get Started?" },
      description: {
        type: String,
        default: "Contact us today to schedule your appointment",
      },
      buttonText: { type: String, default: "Schedule Appointment" },
    },
    social: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      youtube: { type: String, default: "" },
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastModified: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

// Update lastModified on save
UserDataSchema.pre("save", function (next) {
  this.lastModified = new Date();
  next();
});

module.exports = mongoose.model("HealthcareSettings", UserDataSchema);
