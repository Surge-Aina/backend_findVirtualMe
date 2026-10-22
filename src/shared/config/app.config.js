// Configuration object - centralized settings
const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 5100,
    corsOrigin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:5174']
  },

  // Database Configuration. No local fallback: a missing URI must fail at connect time.
  database: {
    uri: process.env.MONGODB_URI,
    testUri: process.env.MONGODB_URI_TEST
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

  // Default users. Emails and usernames come from the environment; there is no built-in account.
  defaultUsers: {
    admin: {
      email: process.env.ADMIN_EMAIL,
      username: process.env.ADMIN_USERNAME,
      role: 'admin'
    },
    customer: {
      email: process.env.CUSTOMER_EMAIL,
      username: process.env.CUSTOMER_USERNAME,
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
