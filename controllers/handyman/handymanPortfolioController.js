// controllers/handyman/handymanPortfolioController.js
const HandymanPortfolio = require('../../models/handyMan/handymanPortfolioModel');
const { uploadToS3, deleteFromS3 } = require('../../services/s3Service');

const S3_PREFIX = 'Ports/HandyMan';

// helper: derive key from a URL in case older docs don’t have keys
function keyFromUrl(url) {
  try {
    const u = new URL(url);
    // /Ports/HandyMan/uuid.jpg -> remove leading slash
    return u.pathname.replace(/^\/+/, '');
  } catch {
    return null;
  }
}

const getPortfolioItems = async (req, res) => {
  try {
    const { templateId } = req.query;
    const query = templateId ? { templateId } : {};
    const items = await HandymanPortfolio.find(query).sort({ createdAt: -1 });
    res.json({ projects: items });
  } catch (error) {
    console.error('getPortfolioItems error', error);
    res.status(500).json({ message: 'Error fetching portfolio items' });
  }
};

const createPortfolioItem = async (req, res) => {
  try {
    const { title, subtitle, category, templateId, beforeImageUrl, afterImageUrl } = req.body;
    if (!title || !category || !templateId) {
      return res.status(400).json({ message: 'title, category and templateId are required' });
    }

    let beforeUrl = beforeImageUrl || '';
    let afterUrl  = afterImageUrl || '';
    let beforeKey = '';
    let afterKey  = '';

    if (req.files?.beforeImage?.[0]) {
      const r1 = await uploadToS3(
        req.files.beforeImage[0].buffer,
        req.files.beforeImage[0].originalname,
        req.files.beforeImage[0].mimetype,
        S3_PREFIX
      );
      beforeUrl = r1.url;
      beforeKey = r1.key;
    }
    if (req.files?.afterImage?.[0]) {
      const r2 = await uploadToS3(
        req.files.afterImage[0].buffer,
        req.files.afterImage[0].originalname,
        req.files.afterImage[0].mimetype,
        S3_PREFIX
      );
      afterUrl = r2.url;
      afterKey = r2.key;
    }

    if (!beforeUrl || !afterUrl) {
      return res.status(400).json({ message: 'Both before and after images are required' });
    }

    const newItem = await HandymanPortfolio.create({
      templateId,
      title,
      subtitle: subtitle || '',            // <-- save subtitle
      category,
      beforeImageUrl: beforeUrl,
      afterImageUrl: afterUrl,
      beforeImageKey: beforeKey || keyFromUrl(beforeUrl),
      afterImageKey:  afterKey  || keyFromUrl(afterUrl),
    });

    res.status(201).json(newItem);
  } catch (error) {
    console.error('createPortfolioItem error', error);
    res.status(500).json({ message: 'Error creating portfolio item.' });
  }
};

const updatePortfolioItem = async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow the fields we expect
    const update = {};
    ['title', 'subtitle', 'category', 'beforeImageUrl', 'afterImageUrl', 'beforeImageKey', 'afterImageKey']
      .forEach(k => {
        if (req.body[k] !== undefined) update[k] = req.body[k];
      });

    if (req.files?.beforeImage?.[0]) {
      const r1 = await uploadToS3(
        req.files.beforeImage[0].buffer,
        req.files.beforeImage[0].originalname,
        req.files.beforeImage[0].mimetype,
        S3_PREFIX
      );
      update.beforeImageUrl = r1.url;
      update.beforeImageKey = r1.key;
    }
    if (req.files?.afterImage?.[0]) {
      const r2 = await uploadToS3(
        req.files.afterImage[0].buffer,
        req.files.afterImage[0].originalname,
        req.files.afterImage[0].mimetype,
        S3_PREFIX
      );
      update.afterImageUrl = r2.url;
      update.afterImageKey = r2.key;
    }

    // if only URLs are provided (no new uploads), ensure keys exist for future deletes
    if (update.beforeImageUrl && !update.beforeImageKey) {
      update.beforeImageKey = keyFromUrl(update.beforeImageUrl);
    }
    if (update.afterImageUrl && !update.afterImageKey) {
      update.afterImageKey = keyFromUrl(update.afterImageUrl);
    }

    const item = await HandymanPortfolio.findByIdAndUpdate(id, update, { new: true });
    if (!item) return res.status(404).json({ message: 'Not found' });

    res.json(item);
  } catch (error) {
    console.error('updatePortfolioItem error', error);
    res.status(500).json({ message: 'Error updating portfolio item.' });
  }
};

const deletePortfolioItem = async (req, res) => {
  try {
    const { id } = req.params;

    // 1) find the doc to get S3 keys (or derive from URLs)
    const item = await HandymanPortfolio.findById(id);
    if (!item) return res.status(404).json({ message: 'Not found' });

    const beforeKey = item.beforeImageKey || keyFromUrl(item.beforeImageUrl);
    const afterKey  = item.afterImageKey  || keyFromUrl(item.afterImageUrl);

    // 2) try to delete S3 objects (best-effort, don’t fail hard if one is missing)
    try { if (beforeKey) await deleteFromS3(beforeKey); } catch (e) { console.warn('S3 delete (before) failed:', e?.message); }
    try { if (afterKey)  await deleteFromS3(afterKey);  } catch (e) { console.warn('S3 delete (after) failed:',  e?.message); }

    // 3) delete DB record
    await HandymanPortfolio.findByIdAndDelete(id);

    res.json({ ok: true });
  } catch (error) {
    console.error('deletePortfolioItem error', error);
    res.status(500).json({ message: 'Error deleting portfolio item.' });
  }
};

module.exports = {
  getPortfolioItems,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
};
