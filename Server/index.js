const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Load Environment Variables (Standard 'dotenv')
require('dotenv').config();

// App Setup
const app = express();
const PORT = process.env.PORT;

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Make io accessible to controllers via req.app
app.set('io', io);

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('📡 Dashboard connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('📡 Dashboard disconnected:', socket.id);
  });
});

// Middleware
app.use(cors()); // Allows requests from React Native
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json()); 


app.use(express.urlencoded({ extended: true })); 

//Database Connection (Robust & Async)
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1); // Stop server if DB fails
  }
};

//  Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/violations', require('./routes/violation'));
app.get('/', (req, res) => res.send('PatrolVision API Running'));



// Start Server
connectDB().then(() => {
  server.listen(PORT,'0.0.0.0', () => {
   console.log(`🚀 Server running on port ${PORT} (LAN: http://192.168.35:${PORT})`);
  });
});