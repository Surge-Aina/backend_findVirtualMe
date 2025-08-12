const express = require('express');
const { google } = require('googleapis');
const { oauth2Client, listFilesInFolder } = require('../oauthHandler');

const router = express.Router();

router.get('/highlights', async (req, res) => {
  try {
    const files = await listFilesInFolder(process.env.HIGHLIGHTS_FOLDER_ID);
    res.json(files);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch highlights' });
  }
});

router.get('/weddings', async (req, res) => {
  try {
    const files = await listFilesInFolder(process.env.WEDDINGS_FOLDER_ID);
    res.json(files);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch weddings' });
  }
});

router.get('/graduations', async (req, res) => {
  try {
    const files = await listFilesInFolder(process.env.GRADUATIONS_FOLDER_ID);
    res.json(files);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch graduations' });
  }
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

module.exports = router;
