const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { oauth2Client, getAuthUrl, getTokensFromCode, setCredentialsFromEnv, listFilesInFolder } = require('./oauthHandler');
const settingsRoutes = require('./routes/settingsRoute');
const driveRoutes = require('./routes/driveRoute');
const photoRoutes = require('./routes/photoRoute');
const uploadRoutes = require('./routes/uploadRoute');
const userRoutes = require('./routes/userRoute');
const portfolioRoutes = require('./routes/portfolioRoute');
const softwareEngRoutes = require('./routes/softwareEng');

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

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());
setCredentialsFromEnv();

//jaqueline login route
app.use('/user', userRoutes);
app.use('/software-eng', softwareEngRoutes);
app.use('/portfolio', portfolioRoutes);
app.use('/settings', settingsRoutes);
app.use('/drive', driveRoutes);
app.use('/photo', photoRoutes);
app.use('/upload', uploadRoutes);

// Serve static files from uploads directory
app.use(`/${config.uploads.directory}`, express.static(path.join(__dirname, config.uploads.directory)));

// Make config available to the app
app.set('config', config);

app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Back end is alive',
        timestamp: new Date().toISOString()
    });
});

app.get('/auth-url', (req, res) => { // Call manually in browser
  res.send(getAuthUrl());
});

// OAuth callback (Google will redirect here after consent)
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  try {
    const tokens = await getTokensFromCode(code);

    if (tokens.refresh_token) {
      fs.appendFileSync('.env', `\nREFRESH_TOKEN=${tokens.refresh_token}`);
    }

    res.send('Authorization successful! You can close this tab.');
  } catch (err) {
    console.error('Error exchanging code:', err);
    res.status(500).send('Auth failed');
  }
});

module.exports = app;