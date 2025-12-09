const mongoose = require("mongoose");

const ExperienceSchema = new mongoose.Schema(
  {
    company: { type: String },
    title: { type: String },
    location: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    description: { type: String },
  },
  { _id: false }
);

const EducationSchema = new mongoose.Schema(
  {
    school: { type: String },
    gpa: { type: Number },
    degrees: [{ type: String }],
    fieldOfStudy: { type: String },
    awards: [{ type: String }],
    startDate: { type: Date },
    endDate: { type: Date },
    description: { type: String },
  },
  { _id: false }
);

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String },
    description: { type: String },
    link: { type: String },
  },
  { _id: false }
);

const PortfolioSchema = new mongoose.Schema(
  {
    isPublic: { type: Boolean, default: false },
    portfolioType: { type: String, immutable: true, default: "ProjectManager" },

    name: { type: String },
    title: { type: String },
    summary: { type: String },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    location: { type: String },
    skills: [{ type: String }],
    experiences: [ExperienceSchema],
    education: [EducationSchema],
    projects: [ProjectSchema],
    socialLinks: {
      github: { type: String },
      linkedin: { type: String },
      website: { type: String },
    },
    sessionId: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("portfolio", PortfolioSchema);
