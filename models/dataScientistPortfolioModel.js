const mongoose = require('mongoose');

const dataScientistPortfolioSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: true,
    default: 'Gargi Ghadigaonkar'
  },
  title: {
    type: String,
    required: true,
    default: 'Data Scientist & Machine Learning Engineer'
  },
  email: {
    type: String,
    required: true,
    default: 'ghadigaonkargargi@gmail.com'
  },
  location: {
    type: String,
    default: 'San Francisco, CA'
  },
  summary: {
    type: String,
    default: 'Passionate Computer Science graduate with experience in data science, machine learning, and full-stack development. Skilled in Python, R, SQL, JavaScript, and various ML frameworks.'
  },
  
  // Social Links
  socialLinks: {
    github: {
      type: String,
      default: 'https://github.com/ghadigaonkar'
    },
    linkedin: {
      type: String,
      default: 'https://linkedin.com/in/ghadigaonkar'
    },
    twitter: {
      type: String
    },
    website: {
      type: String
    }
  },

  // Experience Section
  experience: [{
    title: {
      type: String,
      required: true
    },
    company: {
      type: String,
      required: true
    },
    location: {
      type: String
    },
    description: {
      type: [String],
      default: []
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    current: {
      type: Boolean,
      default: false
    }
  }],

  // Education Section
  education: [{
    school: {
      type: String,
      required: true
    },
    degrees: {
      type: [String],
      default: []
    },
    description: {
      type: String
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    current: {
      type: Boolean,
      default: false
    }
  }],

  // Projects Section
  projects: [{
    title: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    tags: {
      type: [String],
      default: []
    },
    github: {
      type: String
    },
    live: {
      type: String
    },
    image: {
      type: String
    }
  }],

  // Skills Section
  skills: [{
    category: {
      type: String,
      required: true
    },
    skills: {
      type: [String],
      default: []
    }
  }],

  // About Section (additional details)
  about: {
    bio: {
      type: String
    },
    interests: {
      type: [String],
      default: []
    },
    certifications: {
      type: [String],
      default: []
    }
  },

  // Portfolio Settings
  settings: {
    theme: {
      type: String,
      default: 'terminal'
    },
    showContact: {
      type: Boolean,
      default: true
    },
    showSkills: {
      type: Boolean,
      default: true
    }
  },

  // Metadata
  portfolioId: {
    type: String,
    default: 'datascience',
    unique: true
  },
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

// Index for faster queries (removed duplicate index)

module.exports = mongoose.model('DataScientistPortfolio', dataScientistPortfolioSchema);
