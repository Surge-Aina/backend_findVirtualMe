// models/Portfolio.js
// Mongoose schema/model for user portfolios (resumes)

const mongoose = require('mongoose');

/**
 * SoftwareEngSchema defines the structure for a software engineer's portfolio document in MongoDB.
 * @typedef {Object} SoftwareEng
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
const SoftwareEngSchema = new mongoose.Schema({
  ownerId: String, // Unique identifier for the portfolio owner (user)
  type: String, // Type of portfolio (e.g., 'software_engineer')
  profile: {
    name: String, // Full name of the user
    email: String, // Contact email
    location: String, // User's location
    github: String, // GitHub profile URL
    linkedin: String, // LinkedIn profile URL
    bio: String, // Short professional summary
    avatarUrl: String // Link to profile picture/avatar
  },
  skills: [
    {
      name: String, // Name of the skill (e.g., 'JavaScript')
      level: String, // Proficiency level (e.g., 'Expert', 'Intermediate')
      rating: Number // Star rating (1-5)
    }
  ],
  projects: [
    {
      title: String, // Project title
      description: String, // Brief description of the project
      repoUrl: String, // Link to code repository (e.g., GitHub)
      demoUrl: String, // Link to live demo
      techStack: [String], // List of technologies used
      imageUrl: String // Link to project image
    }
  ],
  experience: [
    {
      company: String, // Company name
      role: String, // Job title/role
      duration: String, // Time period (e.g., '2022-2023')
      details: String // Key responsibilities/achievements
    }
  ],
  education: [
    {
      degree: String, // Degree earned (e.g., 'B.Tech in Computer Science')
      institution: String, // Name of the institution
      year: String // Graduation year
    }
  ],
  certifications: [
    {
      title: String, // Certification title
      year: String, // Year obtained
      imageUrl: String // Link to certificate image
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
 * SoftwareEng model for interacting with the software engineer portfolios collection in MongoDB.
 * @type {Model<SoftwareEng>}
 * @returns {mongoose.Model} Mongoose model for SoftwareEng
 * @notes Used in API routes to create, read, update, and delete software engineer portfolios.
 */
module.exports = mongoose.model('SoftwareEng', SoftwareEngSchema); 