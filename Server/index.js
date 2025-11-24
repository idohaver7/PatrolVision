const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Load Environment Variables (Standard 'dotenv')
require('dotenv').config();

// App Setup
const app = express();
const PORT = process.env.PORT;

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

// 6. Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/violations', require('./routes/violation'));
app.get('/', (req, res) => res.send('PatrolVision API Running'));



// 7. Start Server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});