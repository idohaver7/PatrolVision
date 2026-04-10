// server/seeder.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Violation = require('./models/Violation');

// 1. Load env vars
dotenv.config();

// 2. Sample Data — 11 violations spread across Israel using local images
const violationsData = [
  // --- Tel Aviv ---
  {
    violationType: 'Red Light Violation',
    licensePlate: '12-345-67',
    mediaUrl: '/uploads/PIC1.png',
    address: 'Dizengoff St 50, Tel Aviv-Yafo',
    location: { type: 'Point', coordinates: [34.7750, 32.0750] },
    status: 'Pending Review',
    daysAgo: 0
  },
  // --- Haifa ---
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '77-88-222',
    mediaUrl: '/uploads/PIC2.png',
    address: 'HaNassi Blvd 100, Haifa',
    location: { type: 'Point', coordinates: [35.0200, 32.7700] },
    status: 'Verified',
    daysAgo: 2
  },
  // --- Jerusalem ---
  {
    violationType: 'Public Lane Violation',
    licensePlate: '90-123-45',
    mediaUrl: '/uploads/PIC3.png',
    address: 'Jaffa St 20, Jerusalem',
    location: { type: 'Point', coordinates: [35.2160, 31.7760] },
    status: 'Rejected',
    daysAgo: 5
  },
  // --- Be'er Sheva ---
  {
    violationType: 'Red Light Violation',
    licensePlate: '33-222-11',
    mediaUrl: '/uploads/PIC4.png',
    address: 'Rager Blvd 20, Be\'er Sheva',
    location: { type: 'Point', coordinates: [34.7915, 31.2518] },
    status: 'Pending Review',
    daysAgo: 1
  },
  // --- Eilat ---
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '55-999-11',
    mediaUrl: '/uploads/PIC5.png',
    address: 'HaTmarim Blvd, Eilat',
    location: { type: 'Point', coordinates: [34.9519, 29.5577] },
    status: 'Verified',
    daysAgo: 7
  },
  // --- Netanya ---
  {
    violationType: 'Public Lane Violation',
    licensePlate: '44-567-89',
    mediaUrl: '/uploads/PIC6.png',
    address: 'Herzl St 30, Netanya',
    location: { type: 'Point', coordinates: [34.8563, 32.3215] },
    status: 'Pending Review',
    daysAgo: 3
  },
  // --- Ashdod ---
  {
    violationType: 'Red Light Violation',
    licensePlate: '66-321-00',
    mediaUrl: '/uploads/PIC7.png',
    address: 'HaAtzmaut St 15, Ashdod',
    location: { type: 'Point', coordinates: [34.6500, 31.8014] },
    status: 'Verified',
    daysAgo: 4
  },
  // --- Nazareth ---
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '22-876-54',
    mediaUrl: '/uploads/PIC8.png',
    address: 'Paulus HaShishi St, Nazareth',
    location: { type: 'Point', coordinates: [35.3033, 32.6996] },
    status: 'Rejected',
    daysAgo: 6
  },
  // --- Rishon LeZion ---
  {
    violationType: 'Public Lane Violation',
    licensePlate: '88-444-33',
    mediaUrl: '/uploads/PIC9.png',
    address: 'Rothschild St 10, Rishon LeZion',
    location: { type: 'Point', coordinates: [34.7898, 31.9642] },
    status: 'Pending Review',
    daysAgo: 8
  },
  // --- Tiberias ---
  {
    violationType: 'Red Light Violation',
    licensePlate: '11-222-33',
    mediaUrl: '/uploads/PIC10.png',
    address: 'HaGalil St 5, Tiberias',
    location: { type: 'Point', coordinates: [35.5321, 32.7940] },
    status: 'Verified',
    daysAgo: 9
  },
  // --- Petah Tikva ---
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '99-111-22',
    mediaUrl: '/uploads/PIC11.png',
    address: 'Jabotinsky St 40, Petah Tikva',
    location: { type: 'Point', coordinates: [34.8867, 32.0849] },
    status: 'Pending Review',
    daysAgo: 10
  }
];

// 3. Connect to DB and Import Data
const importData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');

    // A. Fetch ALL users
    const users = await User.find();

    if (users.length === 0) {
      console.error('Error: No users found. Please register a user first via the App.');
      process.exit(1);
    }

    console.log(`Found ${users.length} users. Distributing violations...`);

    // B. Clear old violations
    await Violation.deleteMany();
    console.log('Old violations cleared.');

    // C. Distribute violations among users (Round Robin)
    const sampleViolations = violationsData.map((v, index) => {
      const assignedUser = users[index % users.length];

      const date = new Date();
      date.setDate(date.getDate() - v.daysAgo);
      date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

      const { daysAgo, ...violationFields } = v;
      return {
        ...violationFields,
        user: assignedUser._id,
        timestamp: date
      };
    });

    // D. Insert
    await Violation.insertMany(sampleViolations);
    console.log(`${sampleViolations.length} violations imported successfully!`);

    process.exit();
  } catch (err) {
    console.error('Import Failed:', err);
    process.exit(1);
  }
};

importData();
