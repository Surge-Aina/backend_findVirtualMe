// // // models/Portfolio.js
// // // NEW FILE - Create this alongside your existing models
// // // This won't break anything, it's just a new collection

// // const mongoose = require('mongoose');

// // const portfolioSchema = new mongoose.Schema({
// //   // Link to FindVirtualMe user
// //   userId: {
// //     type: mongoose.Schema.Types.ObjectId,
// //     ref: 'User', // References your main User model (FindVirtualMe users)
// //     required: true,
// //     unique: true // Each user can only have ONE portfolio
// //   },
  
// //   // Template type (you can add more later)
// //   templateType: {
// //     type: String,
// //     enum: ['cleaning-service', 'salon', 'restaurant', 'plumber'],
// //     default: 'cleaning-service'
// //   },
  
// //   // Public URL slug (e.g., "john-cleaning-service")
// //   slug: {
// //     type: String,
// //     required: true,
// //     unique: true,
// //     trim: true,
// //     lowercase: true
// //   },
  
// //   // Is this portfolio visible to the public?
// //   isPublished: {
// //     type: Boolean,
// //     default: false
// //   },
  
// //   // ===== BUSINESS INFORMATION =====
// //   businessName: {
// //     type: String,
// //     default: 'My Cleaning Service'
// //   },
  
// //   tagline: {
// //     type: String,
// //     default: 'Professional cleaning for your home'
// //   },
  
// //   aboutUs: {
// //     type: String,
// //     default: 'We provide top-notch cleaning services for residential and commercial properties.'
// //   },
  
// //   // ===== SERVICES =====
// //   // This replaces your separate Service collection
// //   services: [{
// //     title: { type: String, required: true },
// //     description: { type: String, required: true },
// //     price: { type: String, default: '' },
// //     icon: { type: String }
// //   }],
  
// //   // ===== ROOM PRICING =====
// //   // This replaces your separate Room collection
// //   roomPricing: [{
// //     roomType: {
// //       type: String,
// //       enum: ['bedroom', 'kitchen', 'bathroom', 'livingRoom', 'office'],
// //       required: true
// //     },
// //     price: {
// //       type: Number,
// //       required: true,
// //       min: 0
// //     }
// //   }],
  
// //   // ===== TESTIMONIALS =====
// //   testimonials: [{
// //     name: { type: String, required: true },
// //     review: { type: String, required: true },
// //     rating: { type: Number, min: 1, max: 5 },
// //     date: { type: Date, default: Date.now }
// //   }],
  
// //   // ===== CONTACT INFORMATION =====
// //   contactInfo: {
// //     phone: { type: String },
// //     email: { type: String },
// //     address: { type: String },
// //     workingHours: { type: String }
// //   },
  
// //   // ===== GALLERY =====
// //   gallery: [{ type: String }], // Array of image URLs
  
// //   // ===== SOCIAL MEDIA =====
// //   socialMedia: {
// //     facebook: { type: String },
// //     instagram: { type: String },
// //     twitter: { type: String },
// //     linkedin: { type: String }
// //   },
  
// //   // ===== THEME/CUSTOMIZATION =====
// //   theme: {
// //     primaryColor: { type: String, default: '#3B82F6' },
// //     secondaryColor: { type: String, default: '#10B981' },
// //     fontFamily: { type: String, default: 'Inter' },
// //     logo: { type: String }
// //   },
  
// //   // ===== SEO =====
// //   seo: {
// //     metaTitle: { type: String },
// //     metaDescription: { type: String },
// //     keywords: [{ type: String }]
// //   },
  
// //   // ===== TIMESTAMPS =====
// //   createdAt: {
// //     type: Date,
// //     default: Date.now
// //   },
// //   updatedAt: {
// //     type: Date,
// //     default: Date.now
// //   }
// // });

// // // Automatically update 'updatedAt' before saving
// // portfolioSchema.pre('save', function(next) {
// //   this.updatedAt = Date.now();
// //   next();
// // });

// // // Remove sensitive data when converting to JSON
// // portfolioSchema.set('toJSON', {
// //   transform: (doc, ret) => {
// //     delete ret.__v;
// //     return ret;
// //   }
// // });

// // module.exports = mongoose.models.Portfolio || mongoose.model('Portfolio', portfolioSchema);
// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

// const PortfolioSchema = new Schema({
//   userId: { 
//     type: Schema.Types.ObjectId, 
//     ref: 'User', 
//     required: true 
//   },
  
//   templateType: { 
//     type: String, 
//     default: 'cleaning-service' 
//   },
  
//   slug: { 
//     type: String, 
//     required: true, 
//     unique: true 
//   },
  
//   isPublished: { 
//     type: Boolean, 
//     default: false 
//   },
  
//   // Business Info
//   businessName: { 
//     type: String, 
//     default: "My Cleaning Service" 
//   },
  
//   tagline: { 
//     type: String, 
//     default: "Professional cleaning for your home" 
//   },
  
//   tagline1: { 
//     type: String, 
//     default: "We bring sparkle to your space." 
//   },
  
//   tagline2: { 
//     type: String, 
//     default: "From roof to floor – Every detail matters." 
//   },
  
//   tagline3: { 
//     type: String, 
//     default: "For those I love – My purpose in every sweep." 
//   },
  
// // ✅ ADD THESE TWO FIELDS:
// buildRoomsTitle: {
//   type: String,
//   default: "Build Your Rooms"
// },

// cleaningServicesTitle: {
//   type: String,
//   default: "Cleaning Services"
// },

//   aboutUs: { 
//     type: String, 
//     default: "We provide top-notch cleaning services for residential and commercial properties. Our experienced team ensures every corner shines." 
//   },
  
//   // Services array
//   services: [{
//     title: String,
//     description: String,
//     price: String,
//     icon: String
//   }],
  
//   // Room Pricing
//   roomPricing: [{
//     roomType: String,
//     price: Number
//   }],
  
//   // Contact Info
//   contactInfo: {
//     phone: { type: String, default: "" },
//     email: { type: String, default: "" },
//     address: { type: String, default: "" },
//     workingHours: { type: String, default: "Mon-Fri: 8AM-6PM" }
//   },
  
//   // Theme
//   theme: {
//     primaryColor: { type: String, default: "#3B82F6" },
//     secondaryColor: { type: String, default: "#10B981" },
//     fontFamily: { type: String, default: "Inter" }
//   }
  
// }, { timestamps: true });

// if (mongoose.models.Portfolio) {
//   delete mongoose.models.Portfolio;
// }

// module.exports = mongoose.model('Portfolio', PortfolioSchema);

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PortfolioSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  templateType: { 
    type: String, 
    default: 'cleaning-service' 
  },
  
  slug: { 
    type: String, 
    required: true, 
    unique: true 
  },
  
  isPublished: { 
    type: Boolean, 
    default: false 
  },
  
  // Business Info
  businessName: { 
    type: String, 
    default: "My Cleaning Service" 
  },
  
  tagline: { 
    type: String, 
    default: "Professional cleaning for your home" 
  },
  
  tagline1: { 
    type: String, 
    default: "We bring sparkle to your space." 
  },
  
  tagline2: { 
    type: String, 
    default: "From roof to floor – Every detail matters." 
  },
  
  tagline3: { 
    type: String, 
    default: "For those I love – My purpose in every sweep." 
  },
  
  buildRoomsTitle: {
    type: String,
    default: "Build Your Rooms"
  },

  cleaningServicesTitle: {
    type: String,
    default: "Cleaning Services"
  },

  // ✅ ADD ROOM LABELS HERE:
  roomLabels: {
    bedroom: {
      type: String,
      default: "Bedroom"
    },
    kitchen: {
      type: String,
      default: "Kitchen"
    },
    bathroom: {
      type: String,
      default: "Bathroom"
    },
    livingRoom: {
      type: String,
      default: "Living Room"
    }
  },

  aboutUs: { 
    type: String, 
    default: "We provide top-notch cleaning services for residential and commercial properties. Our experienced team ensures every corner shines." 
  },
  
  // Services array
  services: [{
    title: String,
    description: String,
    price: String,
    icon: String
  }],
  
  // Room Pricing
  roomPricing: [{
    roomType: String,
    price: Number
  }],
  
  // Contact Info
  contactInfo: {
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    workingHours: { type: String, default: "Mon-Fri: 8AM-6PM" }
  },
  
  // Theme
  theme: {
    primaryColor: { type: String, default: "#3B82F6" },
    secondaryColor: { type: String, default: "#10B981" },
    fontFamily: { type: String, default: "Inter" }
  }
  
}, { timestamps: true });

if (mongoose.models.Portfolio) {
  delete mongoose.models.Portfolio;
}

module.exports = mongoose.model('Portfolio', PortfolioSchema);