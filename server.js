const fs = require('fs');
const { google } = require('googleapis');
const { oauth2Client, getAuthUrl, getTokensFromCode, setCredentialsFromEnv, listFilesInFolder } = require('./oauthHandler');
const settingsRoutes = require('./routes/settingsRoute');
const driveRoutes = require('./routes/driveRoute');
const photoRoutes = require('./routes/photoRoute');
const uploadRoutes = require('./routes/uploadRoute');

require('dotenv').config();
const connectDB = require('./utils/db');
const app = require('./index');

const PORT = process.env.PORT;
setCredentialsFromEnv();

// Routes
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

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`listening on PORT:${PORT}`)
        });
    })
    .catch(error => {
        console.error('Database connection failed: ', error);
    });