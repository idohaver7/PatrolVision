// server/seeder.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Violation = require('./models/Violation');

// 1. Load env vars
dotenv.config();

// 2. Sample Data (Matching your Schema exactly)
const violationsData = [
  // --- Tel Aviv ---
  {
    violationType: 'Red Light Violation',
    licensePlate: '12-345-67',
    mediaUrl: 'https://picsum.photos/id/237/400/600',
    address: 'Dizengoff St 50, Tel Aviv-Yafo',
    location: { 
        type: 'Point', 
        coordinates: [34.7750, 32.0750] // [Longitude, Latitude]
    },
    status: 'Pending Review',
    daysAgo: 0
  },
  // --- Highway (Route 2) ---
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '77-88-222',
    mediaUrl: 'https://picsum.photos/id/1/400/600',
    address: 'Kvish 2, Hof HaSharon',
    location: { 
        type: 'Point', 
        coordinates: [34.8400, 32.3000] 
    },
    status: 'Verified',
    daysAgo: 2
  },
  // --- Highway (Route 6) ---
  {
    violationType: 'Wrong Way Driving',
    licensePlate: '90-123-45',
    mediaUrl: 'https://picsum.photos/id/10/400/600',
    address: 'Kvish 6, Mateh Yehuda',
    location: { 
        type: 'Point', 
        coordinates: [34.9600, 31.8400] 
    },
    status: 'Disputed', // Matches your enum
    daysAgo: 5
  },
  // --- Haifa ---
  {
    violationType: 'Illegal Turn',
    licensePlate: '55-999-11',
    mediaUrl: 'https://picsum.photos/id/20/400/600',
    address: 'HaNassi Blvd 100, Haifa',
    location: { 
        type: 'Point', 
        coordinates: [35.0200, 32.7700] 
    },
    status: 'Pending Review',
    daysAgo: 1
  },
  // --- Be'er Sheva ---
  {
    violationType: 'Red Light Violation',
    licensePlate: '33-222-11',
    mediaUrl: 'https://picsum.photos/id/30/400/600',
    address: 'Rager Blvd 20, Be\'er Sheva',
    location: { 
        type: 'Point', 
        coordinates: [34.7915, 31.2518] 
    },
    status: 'Closed',
    daysAgo: 10
  },
  // --- Jerusalem ---
  {
    violationType: 'Other',
    licensePlate: '11-111-11',
    mediaUrl: 'https://picsum.photos/id/40/400/600',
    address: 'Jaffa St 20, Jerusalem',
    location: { 
        type: 'Point', 
        coordinates: [35.2160, 31.7760] 
    },
    status: 'Verified',
    daysAgo: 3
  }
];

// 3. Connect to DB and Import Data
const importData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected...');

    // A. Fetch ALL users
    const users = await User.find();

    if (users.length === 0) {
      console.error('❌ Error: No users found. Please register users first via App or Postman.');
      process.exit(1);
    }

    console.log(`👥 Found ${users.length} users. Distributing violations...`);

    // B. Clear old violations (To start fresh)
    await Violation.deleteMany(); 
    console.log('🗑️ Old violations cleared.');

    // C. Distribute violations among users (Round Robin)
    const sampleViolations = violationsData.map((v, index) => {
      // Rotate between users: User1 -> User2 -> User1...
      const assignedUser = users[index % users.length];

      const date = new Date();
      date.setDate(date.getDate() - v.daysAgo);
      date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60)); // Random time
      
      return {
        ...v,
        user: assignedUser._id,
        timestamp: date
      };
    });

    // D. Insert
    await Violation.insertMany(sampleViolations);
    console.log('🌱 Sample Violations Imported Successfully!');

    process.exit();
  } catch (err) {
    console.error('❌ Import Failed:', err);
    process.exit(1);
  }
};

importData();