// server/seeder.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Violation = require('./models/Violation');

dotenv.config();

// 37 violations — randomized order, all 3 types mixed
// red1-13  → Red Light Violation
// pubic1 / public2-12 → Public Lane Violation
// solid1-13 → Illegal Overtaking
const violationsData = [
  // 1 — red1: Haifa junction (road signs: Haifa / Tiberias visible)
  {
    violationType: 'Red Light Violation',
    licensePlate: '23-456-78',
    mediaUrl: '/uploads/red1.png',
    address: 'HaNassi Interchange, Haifa',
    location: { type: 'Point', coordinates: [35.0200, 32.7940] },
    status: 'Pending Review',
    daysAgo: 3
  },
  // 2 — solid1: Desert road with trucks, Negev
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '11-222-33',
    mediaUrl: '/uploads/solid1.png',
    address: 'Route 40, Negev Desert, Be\'er Sheva Region',
    location: { type: 'Point', coordinates: [34.7600, 30.8000] },
    status: 'Verified',
    daysAgo: 7
  },
  // 3 — pubic1: Haifa daytime urban boulevard (bus lane)
  {
    violationType: 'Public Lane Violation',
    licensePlate: '45-678-90',
    mediaUrl: '/uploads/pubic1.jpeg',
    address: 'Ben Gurion Blvd, Haifa',
    location: { type: 'Point', coordinates: [35.0150, 32.7870] },
    status: 'Pending Review',
    daysAgo: 1
  },
  // 4 — red11: Rosh Pina Junction (Hebrew text "צומת ראש פינה" visible)
  {
    violationType: 'Red Light Violation',
    licensePlate: '88-999-11',
    mediaUrl: '/uploads/red11.png',
    address: 'Rosh Pina Junction, Galilee',
    location: { type: 'Point', coordinates: [35.5419, 32.9683] },
    status: 'Verified',
    daysAgo: 12
  },
  // 5 — solid5: Arava desert highway, very long straight road with big truck
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '33-111-55',
    mediaUrl: '/uploads/solid5.png',
    address: 'Route 90, Arava Valley, Eilat Region',
    location: { type: 'Point', coordinates: [35.2000, 30.5000] },
    status: 'Rejected',
    daysAgo: 20
  },
  // 6 — public2: Haifa uphill road with Egged bus
  {
    violationType: 'Public Lane Violation',
    licensePlate: '66-321-44',
    mediaUrl: '/uploads/public2.jpeg',
    address: 'HaCarmel Ave, Haifa',
    location: { type: 'Point', coordinates: [35.0180, 32.7650] },
    status: 'Verified',
    daysAgo: 5
  },
  // 7 — red2: Urban intersection, stone arch overpass (Jerusalem area)
  {
    violationType: 'Red Light Violation',
    licensePlate: '77-888-22',
    mediaUrl: '/uploads/red2.png',
    address: 'Jaffa St & King George St, Jerusalem',
    location: { type: 'Point', coordinates: [35.2140, 31.7800] },
    status: 'Pending Review',
    daysAgo: 2
  },
  // 8 — solid3: Mountain bridge road, green Galilee hills
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '12-345-67',
    mediaUrl: '/uploads/solid3.png',
    address: 'Route 85, Upper Galilee',
    location: { type: 'Point', coordinates: [35.3000, 32.9000] },
    status: 'Verified',
    daysAgo: 15
  },
  // 9 — public5: Flat highway, sunset light, central coastal plain
  {
    violationType: 'Public Lane Violation',
    licensePlate: '55-777-88',
    mediaUrl: '/uploads/public5.png',
    address: 'Route 4, Central District, near Rishon LeZion',
    location: { type: 'Point', coordinates: [34.8100, 31.9700] },
    status: 'Pending Review',
    daysAgo: 9
  },
  // 10 — red5: Ramat Gan urban boulevard intersection
  {
    violationType: 'Red Light Violation',
    licensePlate: '34-567-89',
    mediaUrl: '/uploads/red5.png',
    address: 'Begin Rd, Ramat Gan',
    location: { type: 'Point', coordinates: [34.8200, 32.0850] },
    status: 'Verified',
    daysAgo: 4
  },
  // 11 — solid8: GPS stamp N32°11′37″ E34°57′13″ → near Yavne
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '99-000-11',
    mediaUrl: '/uploads/solid8.png',
    address: 'Route 431, Yavne',
    location: { type: 'Point', coordinates: [34.9538, 32.1939] },
    status: 'Pending Review',
    daysAgo: 6
  },
  // 12 — public3: Night city with palm trees, warm coast (Herzliya)
  {
    violationType: 'Public Lane Violation',
    licensePlate: '22-333-44',
    mediaUrl: '/uploads/public3.jpeg',
    address: 'HaYarkon St, Herzliya',
    location: { type: 'Point', coordinates: [34.8445, 32.1662] },
    status: 'Pending Review',
    daysAgo: 0
  },
  // 13 — red13: Segev Shalom Junction (Hebrew text "צומת שגב שלום" visible, desert)
  {
    violationType: 'Red Light Violation',
    licensePlate: '77-123-45',
    mediaUrl: '/uploads/red13.png',
    address: 'Segev Shalom Junction, Negev',
    location: { type: 'Point', coordinates: [34.8486, 31.2017] },
    status: 'Verified',
    daysAgo: 18
  },
  // 14 — solid6: Desert road near Bedouin settlement, Negev
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '44-555-66',
    mediaUrl: '/uploads/solid6.png',
    address: 'Route 40, near Dimona, Negev',
    location: { type: 'Point', coordinates: [35.0200, 31.0800] },
    status: 'Rejected',
    daysAgo: 25
  },
  // 15 — public8: Route 1 highway with directional sign
  {
    violationType: 'Public Lane Violation',
    licensePlate: '13-246-80',
    mediaUrl: '/uploads/public8.png',
    address: 'Route 1, near Sha\'ar HaGai',
    location: { type: 'Point', coordinates: [35.0260, 31.8197] },
    status: 'Verified',
    daysAgo: 8
  },
  // 16 — red3: Route 444 junction, Kfar Saba sign visible
  {
    violationType: 'Red Light Violation',
    licensePlate: '56-789-01',
    mediaUrl: '/uploads/red3.png',
    address: 'Route 444 Junction, Kfar Saba',
    location: { type: 'Point', coordinates: [34.9066, 32.1750] },
    status: 'Pending Review',
    daysAgo: 11
  },
  // 17 — solid9: Mediterranean pine forest road, Carmel region
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '30-111-22',
    mediaUrl: '/uploads/solid9.png',
    address: 'Carmel Forest, near Zichron Yaakov',
    location: { type: 'Point', coordinates: [34.9560, 32.5700] },
    status: 'Verified',
    daysAgo: 17
  },
  // 18 — public4: Night with Tel Aviv/Ramat Gan skyscrapers
  {
    violationType: 'Public Lane Violation',
    licensePlate: '67-890-12',
    mediaUrl: '/uploads/public4.jpeg',
    address: 'Jabotinsky St, Ramat Gan',
    location: { type: 'Point', coordinates: [34.8244, 32.0710] },
    status: 'Pending Review',
    daysAgo: 1
  },
  // 19 — red9: Tel Aviv Kaplan area, towers and waterfront nearby
  {
    violationType: 'Red Light Violation',
    licensePlate: '89-012-34',
    mediaUrl: '/uploads/red9.png',
    address: 'Kaplan St, Tel Aviv-Yafo',
    location: { type: 'Point', coordinates: [34.7806, 32.0580] },
    status: 'Verified',
    daysAgo: 3
  },
  // 20 — solid2: Flat highway at dusk, central Sharon
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '21-432-10',
    mediaUrl: '/uploads/solid2.png',
    address: 'Route 6, Sharon Region',
    location: { type: 'Point', coordinates: [34.9100, 32.0500] },
    status: 'Pending Review',
    daysAgo: 14
  },
  // 21 — public6: Tel Aviv old center, narrow street near bus terminal
  {
    violationType: 'Public Lane Violation',
    licensePlate: '58-901-23',
    mediaUrl: '/uploads/public6.jpeg',
    address: 'Levinsky St, Tel Aviv-Yafo',
    location: { type: 'Point', coordinates: [34.7726, 32.0540] },
    status: 'Rejected',
    daysAgo: 22
  },
  // 22 — red7: Netanya intersection with construction zone
  {
    violationType: 'Red Light Violation',
    licensePlate: '43-210-98',
    mediaUrl: '/uploads/red7.png',
    address: 'Herzl St & Weizmann Blvd, Netanya',
    location: { type: 'Point', coordinates: [34.8563, 32.3215] },
    status: 'Pending Review',
    daysAgo: 5
  },
  // 23 — solid10: Country road with agricultural tractor
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '76-543-21',
    mediaUrl: '/uploads/solid10.png',
    address: 'Rural road, Kfar Saba area',
    location: { type: 'Point', coordinates: [34.9200, 32.1700] },
    status: 'Verified',
    daysAgo: 30
  },
  // 24 — public9: Route 1 mountain ascent, large truck climbing
  {
    violationType: 'Public Lane Violation',
    licensePlate: '14-258-36',
    mediaUrl: '/uploads/public9.png',
    address: 'Route 1, Sha\'ar HaGai ascent, Judean Foothills',
    location: { type: 'Point', coordinates: [35.0600, 31.7950] },
    status: 'Pending Review',
    daysAgo: 7
  },
  // 25 — red12: Petah Tikva urban junction (car service signage visible)
  {
    violationType: 'Red Light Violation',
    licensePlate: '80-123-45',
    mediaUrl: '/uploads/red12.png',
    address: 'Jabotinsky St, Petah Tikva',
    location: { type: 'Point', coordinates: [34.8867, 32.0849] },
    status: 'Verified',
    daysAgo: 10
  },
  // 26 — solid7: Night rural road, dashcam (2014 timestamp)
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '37-480-29',
    mediaUrl: '/uploads/solid7.png',
    address: 'Route 6, Central Israel (night)',
    location: { type: 'Point', coordinates: [34.9000, 31.8000] },
    status: 'Pending Review',
    daysAgo: 2
  },
  // 27 — public10: Route 1 Judean Mountains, rocky terrain, big truck
  {
    violationType: 'Public Lane Violation',
    licensePlate: '91-234-56',
    mediaUrl: '/uploads/public10.png',
    address: 'Route 1, Judean Mountains',
    location: { type: 'Point', coordinates: [35.0900, 31.7850] },
    status: 'Verified',
    daysAgo: 13
  },
  // 28 — red10: Tel Aviv Kaplan/Begin Rd, same skyscraper backdrop
  {
    violationType: 'Red Light Violation',
    licensePlate: '62-789-03',
    mediaUrl: '/uploads/red10.png',
    address: 'Begin Rd & Kaplan St, Tel Aviv-Yafo',
    location: { type: 'Point', coordinates: [34.7800, 32.0630] },
    status: 'Pending Review',
    daysAgo: 4
  },
  // 29 — solid11: Negev desert mountain road, rugged rocky terrain
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '47-800-91',
    mediaUrl: '/uploads/solid11.png',
    address: 'Route 40, Mitzpe Ramon, Negev Highlands',
    location: { type: 'Point', coordinates: [34.8010, 30.6100] },
    status: 'Rejected',
    daysAgo: 28
  },
  // 30 — public11: Route 1 near Motza, forested mountain section
  {
    violationType: 'Public Lane Violation',
    licensePlate: '18-369-25',
    mediaUrl: '/uploads/public11.png',
    address: 'Route 1, Motza, near Jerusalem',
    location: { type: 'Point', coordinates: [35.1350, 31.7960] },
    status: 'Verified',
    daysAgo: 16
  },
  // 31 — red4: Urban police-cam intersection, commercial area
  {
    violationType: 'Red Light Violation',
    licensePlate: '53-924-67',
    mediaUrl: '/uploads/red4.png',
    address: 'HaAtzmaut St & Rothschild St, Rishon LeZion',
    location: { type: 'Point', coordinates: [34.7870, 31.9770] },
    status: 'Pending Review',
    daysAgo: 0
  },
  // 32 — solid13: Very arid desert road, intercity bus (Negev/Dead Sea)
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '26-145-83',
    mediaUrl: '/uploads/solid13.png',
    address: 'Route 90, Dead Sea Region',
    location: { type: 'Point', coordinates: [35.3600, 31.1600] },
    status: 'Verified',
    daysAgo: 21
  },
  // 33 — red6: Route 6/65 interchange, "Tzfon" (North) sign visible
  {
    violationType: 'Red Light Violation',
    licensePlate: '79-630-14',
    mediaUrl: '/uploads/red6.png',
    address: 'Route 6 & Route 65 Interchange, Yokneam',
    location: { type: 'Point', coordinates: [35.0500, 32.6500] },
    status: 'Pending Review',
    daysAgo: 8
  },
  // 34 — public12: Route 1 Jerusalem entrance, stone walls and trees
  {
    violationType: 'Public Lane Violation',
    licensePlate: '04-567-89',
    mediaUrl: '/uploads/public12.png',
    address: 'Route 1, Motza Gate, Jerusalem entrance',
    location: { type: 'Point', coordinates: [35.1500, 31.7948] },
    status: 'Verified',
    daysAgo: 19
  },
  // 35 — solid12: Coastal road, domed building (Haifa port / old city)
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '61-470-28',
    mediaUrl: '/uploads/solid12.png',
    address: 'Kikar Paris, Haifa Port Area',
    location: { type: 'Point', coordinates: [34.9950, 32.8150] },
    status: 'Pending Review',
    daysAgo: 11
  },
  // 36 — red8: Haifa suburb intersection with Carmel hills backdrop
  {
    violationType: 'Red Light Violation',
    licensePlate: '38-592-04',
    mediaUrl: '/uploads/red8.png',
    address: 'Neve Shaanan Blvd, Haifa',
    location: { type: 'Point', coordinates: [35.0400, 32.7500] },
    status: 'Verified',
    daysAgo: 6
  },
  // 37 — solid4: Sunny country road, flat Sharon agricultural area
  {
    violationType: 'Illegal Overtaking',
    licensePlate: '95-016-37',
    mediaUrl: '/uploads/solid4.png',
    address: 'Route 4, Sharon Region',
    location: { type: 'Point', coordinates: [34.8200, 32.1200] },
    status: 'Pending Review',
    daysAgo: 23
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

    await Violation.deleteMany();
    console.log('Old violations cleared.');

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
