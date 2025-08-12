// Configuration object - centralized settings
const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 5100,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  },

  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/findVirtualMe',
    testUri: process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/test-portfolio'
  },

  // File Upload Configuration
  uploads: {
    directory: process.env.UPLOAD_DIR || 'uploads',
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: {
      images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      documents: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint'
      ]
    }
  },

  // Default Portfolio Templates
  portfolioTemplates: {
    software_engineer: {
      type: 'software_engineer',
      profile: {
        name: '',
        email: '',
        location: '',
        github: '',
        linkedin: '',
        bio: '',
        avatarUrl: ''
      },
      skills: [],
      projects: [],
      experience: [],
      education: [],
      certifications: [],
      resumePdfUrl: '',
      uiSettings: {
        baseRem: 1,
        sectionRem: {
          about: 1,
          skills: 1,
          projects: 1,
          experience: 1,
          education: 1,
          certifications: 1
        }
      }
    }
  },

  // Default Users (for development/testing)
  defaultUsers: {
    admin: {
      email: process.env.ADMIN_EMAIL || 'admin@test.com',
      username: 'admin',
      role: 'admin'
    },
    customer: {
      email: process.env.CUSTOMER_EMAIL || 'cust@test.com',
      username: 'customer',
      role: 'customer'
    }
  },

  // WebSocket Configuration
  websocket: {
    rooms: {
      admin: 'admin-updates',
      customer: 'customer-updates'
    }
  }
};

module.exports = config;
