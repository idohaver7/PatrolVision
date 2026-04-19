// server/seeder.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Violation = require('./models/Violation');

dotenv.config();

// 11 PIC violations — appended to existing data in Mongo (no deleteMany)
const violationsData = [
  // 1 — PIC1
  {
    violationType: 'Red Light Violation',
    licensePlate: '12-987-65',
    mediaUrl: '/uploads/PIC1.png',
    address: 'Allenby St & Rothschild Blvd, Tel Aviv-Yafo',
    location: { type: 'Point', coordinates: [34.7710, 32.0648] },
    status: 'Pending Review',
    daysAgo: 1
  },
  // 2 — PIC2
  {
    violationType: 'Public Lane Violation',
    licensePlate: '20-456-71',
    mediaUrl: '/uploads/PIC2.png',
    address: 'Ibn Gabirol St, Tel Aviv-Yafo',
    location: { type: 'Point', coordinates: [34.7843, 32.0853] },
    status: 'Verified',
    daysAgo: 4
  },
  // 3 — PIC3
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '83-209-14',
    mediaUrl: '/uploads/PIC3.png',
    address: 'Route 2, Coastal Highway, near Hadera',
    location: { type: 'Point', coordinates: [34.9180, 32.4340] },
    status: 'Pending Review',
    daysAgo: 9
  },
  // 4 — PIC4
  {
    violationType: 'Red Light Violation',
    licensePlate: '47-815-36',
    mediaUrl: '/uploads/PIC4.png',
    address: 'Sokolov St, Holon',
    location: { type: 'Point', coordinates: [34.7700, 32.0150] },
    status: 'Verified',
    daysAgo: 6
  },
  // 5 — PIC5
  {
    violationType: 'Public Lane Violation',
    licensePlate: '59-301-22',
    mediaUrl: '/uploads/PIC5.png',
    address: 'King George St, Jerusalem',
    location: { type: 'Point', coordinates: [35.2170, 31.7820] },
    status: 'Pending Review',
    daysAgo: 2
  },
  // 6 — PIC6
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '71-628-49',
    mediaUrl: '/uploads/PIC6.png',
    address: 'Route 65, Wadi Ara',
    location: { type: 'Point', coordinates: [35.0900, 32.5050] },
    status: 'Rejected',
    daysAgo: 27
  },
  // 7 — PIC7
  {
    violationType: 'Red Light Violation',
    licensePlate: '08-749-52',
    mediaUrl: '/uploads/PIC7.png',
    address: 'Weizmann St, Kfar Saba',
    location: { type: 'Point', coordinates: [34.9070, 32.1750] },
    status: 'Pending Review',
    daysAgo: 0
  },
  // 8 — PIC8
  {
    violationType: 'Public Lane Violation',
    licensePlate: '36-512-87',
    mediaUrl: '/uploads/PIC8.png',
    address: 'Derech HaShalom, Tel Aviv-Yafo',
    location: { type: 'Point', coordinates: [34.7950, 32.0700] },
    status: 'Verified',
    daysAgo: 12
  },
  // 9 — PIC9
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '64-927-15',
    mediaUrl: '/uploads/PIC9.png',
    address: 'Route 38, Beit Shemesh area',
    location: { type: 'Point', coordinates: [34.9890, 31.7460] },
    status: 'Verified',
    daysAgo: 17
  },
  // 10 — PIC10
  {
    violationType: 'Red Light Violation',
    licensePlate: '92-184-03',
    mediaUrl: '/uploads/PIC10.png',
    address: 'Eilat St, Ashdod',
    location: { type: 'Point', coordinates: [34.6500, 31.8040] },
    status: 'Pending Review',
    daysAgo: 5
  },
  // 11 — PIC11
  {
    violationType: 'Public Lane Violation',
    licensePlate: '15-738-46',
    mediaUrl: '/uploads/PIC11.png',
    address: 'HaHistadrut Ave, Haifa',
    location: { type: 'Point', coordinates: [35.0220, 32.8210] },
    status: 'Verified',
    daysAgo: 14
  }
];

const importData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');

    const users = await User.find();
    if (users.length === 0) {
      console.error('Error: No users found. Please register a user first via the App.');
      process.exit(1);
    }
    console.log(`Found ${users.length} users. Distributing ${violationsData.length} violations...`);

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

    await Violation.insertMany(sampleViolations);
    console.log(`${sampleViolations.length} violations imported successfully!`);

    process.exit();
  } catch (err) {
    console.error('Import Failed:', err);
    process.exit(1);
  }
};

importData();
