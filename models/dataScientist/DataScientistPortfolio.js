const mongoose = require('mongoose');

const dataScientistPortfolioSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  linkedin: {
    type: String,
    trim: true
  },
  github: {
    type: String,
    trim: true
  },
  portfolio: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    trim: true
  },
  avatarUrl: {
    type: String,
    trim: true
  },

  // Education
  education: [{
    degree: {
      type: String,
      required: true,
      trim: true
    },
    institution: {
      type: String,
      required: true,
      trim: true
    },
    year: {
      type: String,
      trim: true
    },
    points: [{
      type: String,
      trim: true
    }]
  }],

  // Skills
  skills: [{
    type: String,
    trim: true
  }],

  // Projects
  projects: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    about: {
      type: String,
      trim: true
    },
    time: {
      type: String,
      trim: true
    },
    points: [{
      type: String,
      trim: true
    }],
    technologies: [{
      type: String,
      trim: true
    }],
    githubUrl: {
      type: String,
      trim: true
    },
    liveUrl: {
      type: String,
      trim: true
    }
  }],

  // Experience
  experience: [{
    company: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      required: true,
      trim: true
    },
    duration: {
      type: String,
      trim: true
    },
    points: [{
      type: String,
      trim: true
    }]
  }],

  // Certificates
  certificates: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    issuer: {
      type: String,
      trim: true
    },
    date: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true
    }
  }],

  // Testimonials
  testimonials: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      trim: true
    },
    company: {
      type: String,
      trim: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  }],

  // Extra Parts
  extraParts: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      trim: true
    }
  }],

  // UI Settings
  uiSettings: {
    baseRem: {
      type: Number,
      default: 1
    },
    sectionRem: {
      about: { type: Number, default: 1 },
      skills: { type: Number, default: 1 },
      projects: { type: Number, default: 1 },
      experience: { type: Number, default: 1 },
      education: { type: Number, default: 1 },
      certificates: { type: Number, default: 1 }
    }
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
dataScientistPortfolioSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DataScientistPortfolio', dataScientistPortfolioSchema);
