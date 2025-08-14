const express = require('express');
const { google } = require('googleapis');
const { oauth2Client, listFilesInFolder } = require('../oauthHandler');
const router = express.Router();
const backendUrl = process.env.VITE_BACKEND_API;
const dotenv = require('dotenv');
dotenv.config();

// Check OAuth2 status
router.get('/status', (req, res) => {
  const hasCredentials = !!(oauth2Client.credentials && oauth2Client.credentials.refresh_token);
  res.json({
    configured: hasCredentials,
    hasRefreshToken: !!oauth2Client.credentials?.refresh_token,
    message: hasCredentials ? 'OAuth2 is configured' : 'OAuth2 is not configured'
  });
});

router.get('/file/:id', async (req, res) => {
  try {
    const fileId = req.params.id;

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Get file metadata to know MIME type
    const meta = await drive.files.get({ fileId, fields: 'mimeType, name' });

    // Stream file contents
    const driveRes = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

    // Set proper content type
    res.setHeader('Content-Type', meta.data.mimeType);
    // Optional: Set caching headers
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    driveRes.data
      .on('error', (err) => {
        console.error('Drive stream error', err);
        res.sendStatus(500);
      })
      .pipe(res);

  } catch (err) {
    console.error('Error fetching file from Drive:', err);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

// Test connection to any Google Drive folder
router.get('/test/:folderId', async (req, res) => {
  try {
    const folderId = req.params.folderId;
    
    // Check if OAuth2 client is properly configured
    if (!oauth2Client.credentials || !oauth2Client.credentials.refresh_token) {
      console.error('OAuth2 client not properly configured. Missing refresh token.');
      return res.status(500).json({ 
        error: 'Google Drive API not configured. Please set up OAuth2 credentials.' 
      });
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // First, verify the folder exists and get its name
    const folderMeta = await drive.files.get({ 
      fileId: folderId, 
      fields: 'name,mimeType' 
    });

    if (folderMeta.data.mimeType !== 'application/vnd.google-apps.folder') {
      return res.status(400).json({ error: 'The provided ID is not a folder' });
    }

    // Get images in the folder
    const files = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`,
      fields: 'files(id,name,mimeType)',
    });

    res.json({
      folderId: folderId,
      folderName: folderMeta.data.name,
      imageCount: files.data.files.length,
      images: files.data.files.map(file => ({
        id: file.id,
        name: file.name,
        url: `${backendUrl}/drive/file/${file.id}`
      }))
    });

  } catch (err) {
    console.error('Error testing folder connection:', err);
    
    // Log more details about the error
    if (err.response) {
      console.error('Error response:', err.response.data);
      console.error('Error status:', err.response.status);
    }
    
    if (err.code === 404) {
      res.status(404).json({ error: 'Folder not found or access denied' });
    } else if (err.code === 403) {
      res.status(403).json({ error: 'Access denied to this folder' });
    } else if (err.message && err.message.includes('invalid_grant')) {
      res.status(401).json({ error: 'OAuth2 token expired. Please re-authenticate.' });
    } else {
      res.status(500).json({ 
        error: 'Failed to test folder connection',
        details: err.message || 'Unknown error'
      });
    }
  }
});

// Get photos from admin's Google Drive folder
router.get('/admin/:folderId', async (req, res) => {
  try {
    const folderId = req.params.folderId;
    const files = await listFilesInFolder(folderId);
    res.json(files);
  } catch (err) {
    console.error('Error fetching admin photos:', err);
    res.status(500).json({ error: 'Failed to fetch admin photos' });
  }
});

module.exports = router;