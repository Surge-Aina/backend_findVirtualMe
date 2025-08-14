const express = require("express");
const cors = require("cors");
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
const softwareEngRoutes = require("./routes/softwareEng");
const testimonialRoutes = require("./routes/testimonialRoute");
const dashboardRoutes = require("./routes/dashboardRoute");
const bannerRoutes = require("./routes/bannerRoutes");
const aboutRoutes = require("./routes/aboutRoutes");
const menuRoutes = require("./routes/menuRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const taggedImageRoutes = require("./routes/taggedImageRoutes");

// Import configuration from separate file
const config = require("./config");

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());
setCredentialsFromEnv();

//jaqueline login route
app.use("/user", userRoutes);
app.use("/software-eng", softwareEngRoutes);
app.use("/portfolio", portfolioRoutes);
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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.get("/health", (_req, res) =>
  res.status(200).json({ ok: true, ts: Date.now() })
);

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

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("join-customer-room", () => {
    socket.join(config.websocket.rooms.customer);
    socket.join(`${config.defaultUsers.customer.email}-updates`);
    console.log("👥 Customer joined update room");
  });

  socket.on("join-admin-room", () => {
    socket.join(config.websocket.rooms.admin);
    socket.join(`${config.defaultUsers.admin.email}-updates`);
    console.log("👤 Admin joined update room");
  });

  socket.on("join-user-room", (userId) => {
    socket.join(`${userId}-updates`);
    console.log(`👤 User ${userId} joined their specific room`);
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
  });
});

// Make io available to routes
app.set("io", io);

// Test endpoint for WebSocket events
app.post("/test-websocket", (req, res) => {
  const io = req.app.get("io");
  if (io) {
    io.emit("test-event", {
      message: "Test WebSocket event",
      timestamp: new Date().toISOString(),
    });
    console.log("📡 Test WebSocket event emitted");
    res.json({ message: "Test event sent" });
  } else {
    res.status(500).json({ error: "Socket.IO not available" });
  }
});

module.exports = { app, server };
