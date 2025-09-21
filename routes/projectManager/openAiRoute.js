const express = require('express');
const router = express.Router();
const { generateMatchSummary } = require('../../services/openAiService');

router.post('/summary', async (req, res) => {
  const { resumeJSON, jobText } = req.body;
  if (!resumeJSON || !jobText)
    return res.status(400).json({ error: 'Missing input' });

  try {
    const summary = await generateMatchSummary(resumeJSON, jobText);
    res.json({ summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Generation failed' });
  }
});

module.exports = router;
