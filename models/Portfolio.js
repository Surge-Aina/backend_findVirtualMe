// models/Portfolio.js
// Mongoose schema/model for user portfolios (resumes)

const mongoose = require('mongoose');

/**
 * PortfolioSchema defines the structure for a user's portfolio document in MongoDB.
 * @typedef {Object} Portfolio
 * @property {string} ownerId - Unique identifier for the portfolio owner (user)
 * @property {string} type - Type of portfolio (e.g., 'software_engineer')
 * @property {Object} profile - User's profile information
 * @property {Array<Object>} skills - List of skills with name and level
 * @property {Array<Object>} projects - List of projects with details
 * @property {Array<Object>} experience - Work experience entries
 * @property {Array<Object>} education - Education history
 * @property {Array<Object>} certifications - Certifications earned
 * @property {string} resumePdfUrl - Link to downloadable resume PDF
 * @property {Object} uiSettings - UI customization settings
 * @notes This schema is used by Mongoose to validate and interact with portfolio documents.
 */
const PortfolioSchema = new mongoose.Schema({
  ownerId: String, // Unique identifier for the portfolio owner (user)
  type: String, // Type of portfolio (e.g., 'software_engineer')
  // Legacy schema (for backward compatibility)
  profile: {
    name: String, // Full name of the user
    email: String, // Contact email
    location: String, // User's location
    github: String, // GitHub profile URL
    linkedin: String, // LinkedIn profile URL
    bio: String, // Short professional summary
    avatarUrl: String // Link to profile picture/avatar
  },
  // Universal schema (new format)
  about: {
    name: String,
    phone: String,
    address: String,
    linkedin: String,
    github: String,
    portfolio: String,
    link1: String,
    link2: String
  },
  // Skills can be either legacy format or simple strings (universal format)
  skills: mongoose.Schema.Types.Mixed,
  // Projects support both legacy and universal formats
  projects: mongoose.Schema.Types.Mixed,
  // Experience supports both legacy and universal formats
  experience: mongoose.Schema.Types.Mixed,
  // Education supports both legacy and universal formats
  education: mongoose.Schema.Types.Mixed,
  // Legacy certifications field
  certifications: [
    {
      title: String, // Certification title
      year: String, // Year obtained
      imageUrl: String // Link to certificate image
    }
  ],
  // Universal schema fields
  certificates: [String], // Simple string array for certificates
  testimonials: [String], // Simple string array for testimonials
  extraParts: [
    {
      title: String,
      content: String
    }
  ],
  resumePdfUrl: String, // Link to downloadable resume PDF
  uiSettings: {
    baseRem: Number, // Base rem value for UI scaling
    theme: String, // Theme preference (e.g., 'light', 'dark')
    sectionRem: {
      about: { type: Number, default: 1.1 },
      skills: { type: Number, default: 1.1 },
      projects: { type: Number, default: 1.1 },
      experience: { type: Number, default: 1.1 },
      education: { type: Number, default: 1.1 },
      certifications: { type: Number, default: 1.1 }
    }
  }
});

/**
 * Portfolio model for interacting with the portfolios collection in MongoDB.
 * @type {Model<Portfolio>}
 * @returns {mongoose.Model} Mongoose model for Portfolio
 * @notes Used in API routes to create, read, update, and delete portfolios.
 */
module.exports = mongoose.model('Portfolio', PortfolioSchema); 