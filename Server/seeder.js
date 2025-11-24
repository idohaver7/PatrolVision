// server/seeder.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Violation = require('./models/Violation');

// 1. Load env vars
dotenv.config();

// 2. Sample Data
const violationsData = [
  {
    violationType: 'Red Light Violation',
    licensePlate: '123-45-678',
    mediaUrl: 'https://picsum.photos/id/237/200/300', // Fake image
    location: { type: 'Point', coordinates: [34.7818, 32.0853] }, // Tel Aviv (Dizengoff)
    status: 'Pending Review',
    daysAgo: 0 // Today
  },
  {
    violationType: 'Illegal Parking', // Note: This assumes 'Other' or allowed enum
    violationType: 'Wrong Way Driving',
    licensePlate: '555-11-999',
    mediaUrl: 'https://picsum.photos/id/238/200/300',
    location: { type: 'Point', coordinates: [34.8000, 32.0800] }, // Ramat Gan
    status: 'Verified',
    daysAgo: 2 // 2 days ago
  },
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '777-88-222',
    mediaUrl: 'https://picsum.photos/id/239/200/300',
    location: { type: 'Point', coordinates: [34.7700, 32.0700] }, // South Tel Aviv
    status: 'Pending Review',
    daysAgo: 5 // 5 days ago
  },
  {
    violationType: 'Red Light Violation',
    licensePlate: '123-45-678', // Same car as first one (repeat offender!)
    mediaUrl: 'https://picsum.photos/id/240/200/300',
    location: { type: 'Point', coordinates: [34.7820, 32.0855] }, // Tel Aviv
    status: 'Closed',
    daysAgo: 10
  },
  {
    violationType: 'Illegal Turn',
    licensePlate: '999-00-111',
    mediaUrl: 'https://picsum.photos/id/241/200/300',
    location: { type: 'Point', coordinates: [32.7940, 34.9896] }, // Haifa (Far away)
    status: 'Pending Review',
    daysAgo: 1
  }
];

// 3. Connect to DB and Import Data
const importData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected...');

    // A. Find a user to assign violations to
    // We'll grab the first user in the DB.
    const user = await User.findOne();

    if (!user) {
      console.error('❌ No users found! Please register a user first via Postman.');
      process.exit(1);
    }

    console.log(`👤 Assigning violations to user: ${user.firstName} ${user.lastName}`);

    // B. Prepare the data (add user ID and fix dates)
    const sampleViolations = violationsData.map((v) => {
      const date = new Date();
      date.setDate(date.getDate() - v.daysAgo); // Set exact date based on "daysAgo"
      
      return {
        ...v,
        user: user._id,
        timestamp: date
      };
    });

    // C. Delete old violations (Optional - un-comment if you want a clean slate)
    // await Violation.deleteMany(); 
    // console.log('🗑️ Existing violations cleared.');

    // D. Insert new ones
    await Violation.insertMany(sampleViolations);
    console.log('🌱 Violations Imported Successfully!');

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

importData();