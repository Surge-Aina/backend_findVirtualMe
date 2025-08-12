const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { google } = require('googleapis');
const { oauth2Client, getAuthUrl, getTokensFromCode, setCredentialsFromEnv, listFilesInFolder } = require('./oauthHandler');
const settingsRoutes = require('./routes/settingsRoute');
const driveRoutes = require('./routes/driveRoute');
const photoRoutes = require('./routes/photoRoute');
const uploadRoutes = require('./routes/uploadRoute');
const userRoutes = require('./routes/userRoute');
const portfolioRoutes = require('./routes/portfolioRoute');
const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());
setCredentialsFromEnv();

//jaqueline login route
app.use('/user', userRoutes);
app.use('/portfolio', portfolioRoutes);

app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Back end is alive',
        timestamp: new Date().toISOString()
    });
});

app.use('/settings', settingsRoutes)
app.use('/drive', driveRoutes)
app.use('/photo', photoRoutes);
app.use('/upload', uploadRoutes);

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