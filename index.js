const express = require("express");
const connectDB = require('./utils/db'); // Import database connection from utils
const cors = require("cors");
require('dotenv').config(); // Load environment variables from .env file
const path = require("path");
const fs = require("fs");
const http = require("http");
const socketIo = require("socket.io");
const { google } = require("googleapis");
const {
  oauth2Client,
  getAuthUrl,
  getTokensFromCode,
  setCredentialsFromEnv,
  listFilesInFolder,
} = require("./oauthHandler");
const settingsRoutes = require("./routes/settingsRoute");
const driveRoutes = require("./routes/driveRoute");
const photoRoutes = require("./routes/photoRoute");
const uploadRoutes = require("./routes/uploadRoute");
const userRoutes = require("./routes/userRoute");
const portfolioRoutes = require("./routes/portfolioRoute");
const softwareEngRoutes = require("./routes/portfolio");

const testimonialRoutes = require("./routes/testimonialRoute");
const dashboardRoutes = require("./routes/dashboardRoute");
const bannerRoutes = require("./routes/bannerRoutes");
const aboutRoutes = require("./routes/aboutRoutes");
const menuRoutes = require("./routes/menuRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const taggedImageRoutes = require("./routes/taggedImageRoutes");
const handymanPortfolioRoutes = require("./routes/handymanPortfolioRoutes");
const dataScientistRoutes = require("./routes/dataScientistRoutes");
const authRoutes = require('./routes/auth'); // Import authentication routes
const seedUsers = require('./seed/users'); // Import seed users function
const handymanTemplateRoutes = require('./routes/handymanTemplateRoutes');
const localVendorRoutes = require("./routes/localVendorRoutes");


// Import configuration from separate file
const config = require("./config");

const app = express();
const PORT = process.env.PORT;

app.use(
  cors({
    origin: config.server.corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
setCredentialsFromEnv();

// Mount the main portfolio API routes at /portfolio
app.use('/portfolio', portfolioRoutes);

// Mount the software engineering portfolio API routes at /softwareeng
app.use('/softwareeng', softwareEngRoutes);

// Test route to verify routing is working
app.get('/test-route', (req, res) => {
  res.json({ message: 'Test route is working!', timestamp: new Date().toISOString() });
});

//jaqueline login route
app.use("/user", userRoutes);
app.use("/settings", settingsRoutes);
app.use("/drive", driveRoutes);
app.use("/photo", photoRoutes);
app.use("/upload", uploadRoutes);
app.use("/testimonials", testimonialRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/banner", bannerRoutes);
app.use("/about", aboutRoutes);
app.use("/menu", menuRoutes);
app.use("/gallery", galleryRoutes);
app.use("/reviews", reviewRoutes);
app.use("/tagged", taggedImageRoutes);
app.use("/vendor", localVendorRoutes);
app.use("/api/handyman/portfolio", handymanPortfolioRoutes);
app.use("/datascience-portfolio", dataScientistRoutes);
app.use("/api/handyman-template", handymanTemplateRoutes);


app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.get("/health", (_req, res) =>
  res.status(200).json({ ok: true, ts: Date.now() })
);

/**
 * Connect to MongoDB using the connection function from utils/db.js
 * @function
 * @returns {Promise<void>} Logs success or error to console
 * @notes Uses centralized database connection. Connection is required for API to function.
 */
connectDB()
  .then(async () => {
    // Seed users after successful database connection
    await seedUsers();
  })
  .catch(err => console.error(err)); // Log connection errors



/**
 * Mount the authentication API routes at /auth
 * @function
 * @param {string} path - The base path for the routes
 * @param {Router} router - The Express router for authentication APIs
 */
app.use('/auth', authRoutes);

/**
 * Serve static files from uploads directory
 * @function
 * @param {string} path - The URL path to serve files from
 * @param {Function} middleware - Express static middleware
 */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from uploads directory
app.use(
  `/${config.uploads.directory}`,
  express.static(path.join(__dirname, config.uploads.directory))
);

// Make config available to the app
app.set("config", config);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Back end is alive",
    timestamp: new Date().toISOString(),
  });
});

app.get("/auth-url", (req, res) => {
  // Call manually in browser
  res.send(getAuthUrl());
});

// OAuth callback (Google will redirect here after consent)
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  try {
    const tokens = await getTokensFromCode(code);

    if (tokens.refresh_token) {
      fs.appendFileSync(".env", `\nREFRESH_TOKEN=${tokens.refresh_token}`);
    }

    res.send("Authorization successful! You can close this tab.");
  } catch (err) {
    console.error("Error exchanging code:", err);
    res.status(500).send("Auth failed");
  }
});

// Create HTTP server with Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: config.server.corsOrigin,
    methods: ["GET", "POST"],
  },
});

/**
 * Socket.IO connection handling for real-time updates
 */
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  socket.on('join-customer-room', () => {
    socket.join('customer-updates');
    socket.join('cust@test.com-updates');
    console.log('👥 Customer joined update room');
  });
  
  socket.on('join-admin-room', () => {
    socket.join('admin-updates');
    socket.join('admin@test.com-updates');
    console.log('👤 Admin joined update room');
  });
  
  socket.on('join-user-room', (userId) => {
    socket.join(`${userId}-updates`);
    console.log(`👤 User ${userId} joined their specific room`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

/**
 * Test endpoint to trigger WebSocket events
 * @route   POST /test-websocket
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} Success message
 */
app.post('/test-websocket', (req, res) => {
  const io = req.app.get('io');
  if (io) {
    io.emit('test-event', {
      message: 'Test WebSocket event',
      timestamp: new Date().toISOString()
    });
    console.log('📡 Test WebSocket event emitted');
    res.json({ message: 'Test event sent' });
  } else {
    res.status(500).json({ error: 'Socket.IO not available' });
  }
});

/**
 * Start the Express server on the specified port
 * @function
 * @param {number} PORT - The port number to listen on
 * @returns {void}
 */

// Only start the server if this file is run directly (not imported for testing)
if (require.main === module) {
  server.listen(PORT, () => console.log(`✅ Server running on PORT: ${PORT}`));
}

module.exports = { app, server }; 
