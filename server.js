require('dotenv').config();
const express = require('express');
const connectDB = require('./utils/db');
const app = require('./index');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
// Get config from the app
const config = app.get('config');



const PORT = process.env.PORT;

// Create HTTP server with Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: config.server.corsOrigin,
    methods: ["GET", "POST"]
  }
});



// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  socket.on('join-customer-room', () => {
    socket.join(config.websocket.rooms.customer);
    socket.join(`${config.defaultUsers.customer.email}-updates`);
    console.log('👥 Customer joined update room');
  });
  
  socket.on('join-admin-room', () => {
    socket.join(config.websocket.rooms.admin);
    socket.join(`${config.defaultUsers.admin.email}-updates`);
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

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`listening on PORT:${PORT}`)
        });
    })
    .catch(error => {
        console.error('Database connection failed: ', error);
    });

module.exports = app;