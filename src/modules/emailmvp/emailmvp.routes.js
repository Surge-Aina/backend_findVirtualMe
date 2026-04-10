const express = require('express');
const router = express.Router();

const authRoutes = require('./routes/auth.routes');
const emailRoutes = require('./routes/email.routes');
const googleRoutes = require('./routes/google.routes');

router.use('/auth', authRoutes);
router.use('/email', emailRoutes);
router.use('/google', googleRoutes);

module.exports = router;