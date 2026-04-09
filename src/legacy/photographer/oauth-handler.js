const { google } = require('googleapis');
const dotenv = require('dotenv');
const backendUrl = process.env.VITE_BACKEND_API;
dotenv.config();

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// STEP 1: Generate auth URL
function getAuthUrl() {
  const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // gets refresh_token
    scope: scopes,
    prompt: 'consent'
  });
}

// STEP 2: Exchange code for tokens
async function getTokensFromCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens; // includes refresh_token on first consent
}

// STEP 3: Set credentials with refresh token
function setCredentialsFromEnv() {
  if (process.env.REFRESH_TOKEN) {
    console.log('Setting OAuth2 credentials with refresh token...');
    oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
    console.log('OAuth2 credentials set successfully');
  } else {
    console.warn('No REFRESH_TOKEN found in environment variables. Google Drive API will not work.');
  }
}

// STEP 4: Fetch files in a folder
async function listFilesInFolder(folderId) {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`,
    fields: 'files(id,name)',
  });

  return res.data.files.map(file => ({
    id: file.id,
    name: file.name,
    url: `${backendUrl}/drive/file/${file.id}`
  }));
}

module.exports = {
  oauth2Client,
  getAuthUrl,
  getTokensFromCode,
  setCredentialsFromEnv,
  listFilesInFolder
};