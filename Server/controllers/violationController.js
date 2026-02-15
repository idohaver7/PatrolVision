
const Violation = require('../models/Violation');
const NodeGeocoder = require('node-geocoder');


const geocoder = NodeGeocoder({
  provider: 'openstreetmap',
  language: 'en',
});

// @desc    Create a new violation report
// @route   POST /api/violations
// @access  Private (User must be logged in)
exports.reportViolation = async (req, res) => {
  try {
    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    // Extract data from the request body
    const { violationType, licensePlate, latitude, longitude } = req.body;

    // Validate required fieldד
    if (!violationType || !licensePlate || !latitude || !longitude) {
      return res.status(400).json({ success: false, error: 'Please provide all required fields' });
    }

    // Construct the media URL
    // Currently points to local server. Will be updated to Cloud Storage URL later.
    const mediaUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    // Create Location object (GeoJSON format)
    const location = {
      type: 'Point',
      coordinates: [Number(longitude), Number(latitude)] 
    };
    // Reverse Geocode to get Address
    let address = 'Location not available';
    try {
      const res = await geocoder.reverse({ lat: latitude, lon: longitude });
      
      if (res && res.length > 0) {
        const data = res[0];
        
        // Option A: Urban Address (Street + Number + City)
        if (data.streetName && data.streetNumber) {
          address = `${data.streetName} ${data.streetNumber}, ${data.city || ''}`;
        }
        // Option B: Highway / Road (Just Street Name + City/District)
        // On highways, 'streetName' usually holds values like "Kvish 6" or "Ayalon"
        else if (data.streetName) {
          address = `${data.streetName}, ${data.city || data.state || ''}`;
        }
        // Option C: Fallback to the full formatted string provided by API
        else if (data.formattedAddress) {
          address = data.formattedAddress;
        }
        // Option D: Just City
        else {
          address = data.city || 'Unknown Road';
        }
        
        // Cleanup: Remove trailing commas or extra spaces
        address = address.replace(/,\s*$/, '').trim();
      }
    } catch (err) {
      console.error('Geocoder Error:', err.message);
      // Fallback: If geocoding fails, we will just show coordinates in the app
      address = `${latitude}, ${longitude}`; 
    }

    // 5. Create the record in the database
    const violation = await Violation.create({
      user: req.user._id,
      violationType,
      licensePlate,
      mediaUrl,
      location,
      address,
      status: 'Pending Review'
    });

    res.status(201).json({
      success: true,
      data: violation
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error creating violation' });
  }
};

// @desc    Get violations with Filters, Pagination AND Map Mode
// @route   GET /api/violations?mode=map&lat=...&lng=...
// @access  Private
exports.getViolations = async (req, res) => {
  try {
    const queryObj = {};

    // --- Check for Map Mode ---
    // If mode is 'map', we want to fetch MANY items (e.g., 500) to populate the map.
    // If mode is not 'map' (default), we use strict pagination (e.g., 20 items).
    const isMapMode = req.query.mode === 'map';

    // Filters 
    
    // User Role Filter
    if (req.user.role === 'admin') {
      if (req.query.userId) queryObj.user = req.query.userId;
    } else {
      queryObj.user = req.user._id;
    }

    // License Plate
    if (req.query.licensePlate) {
      queryObj.licensePlate = { $regex: req.query.licensePlate, $options: 'i' };
    }

    // Violation Type
    if (req.query.type) {
      queryObj.violationType = req.query.type;
    }

    // Date Range
    if (req.query.startDate || req.query.endDate) {
      queryObj.timestamp = {};
      if (req.query.startDate) queryObj.timestamp.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        queryObj.timestamp.$lte = end;
      }
    }

    // GeoSpatial Filter (Radius)
    if (req.query.lat && req.query.lng) {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      const radius = parseInt(req.query.radius) || 1000; // Default 1km

      queryObj.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radius
        }
      };
    }

    // --- Pagination Logic (Smart Limit) ---
    
    const page = parseInt(req.query.page, 10) || 1;
    
    // SMART LIMIT LOGIC:
    // If Map Mode -> Allow up to 500 items (to show pins).
    // If List Mode -> Default to 25 items (infinite scroll).
    let limit = parseInt(req.query.limit, 10) || (isMapMode ? 500 : 25);
    
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Violation.countDocuments(queryObj);

    // --- Sorting & Select ---
    let sortOrder = { createdAt: -1 };
    if (req.query.sort === 'oldest') sortOrder = { createdAt: 1 };

    // Optimization: If it's map mode, we might not need ALL fields immediately?
    // For now, let's return everything to keep it simple.
    const violations = await Violation.find(queryObj)
      .populate('user', 'firstName lastName email phoneNumber')
      .sort(sortOrder)
      .skip(startIndex)
      .limit(limit);

    // --- Pagination Info ---
    const pagination = {};
    if (endIndex < total) {
      pagination.next = { page: page + 1, limit };
    }
    if (startIndex > 0) {
      pagination.prev = { page: page - 1, limit };
    }

    res.status(200).json({
      success: true,
      count: violations.length,
      total,
      pagination,
      data: violations
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error fetching violations' });
  }
};
// @desc    Get a single violation by ID
// @route   GET /api/violations/:id
// @access  Private
exports.getViolationById = async (req, res) => {
  try {
    const violation = await Violation.findById(req.params.id).populate('user', 'firstName lastName email');

    if (!violation) {
      return res.status(404).json({ success: false, error: 'Violation not found' });
    }

    // Security Check:
    // Allow access ONLY if user is Admin OR the violation belongs to the user
    if (req.user.role !== 'admin' && violation.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this violation' });
    }

    res.status(200).json({
      success: true,
      data: violation
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Update a violation (e.g., change status to 'Verified')
// @route   PUT /api/violations/:id
// @access  Private (Admin Only)
exports.updateViolation = async (req, res) => {
  try {
    let violation = await Violation.findById(req.params.id);

    if (!violation) {
      return res.status(404).json({ success: false, error: 'Violation not found' });
    }

    // We use { new: true } to return the updated document
    // We use { runValidators: true } to ensure the new data is valid
    violation = await Violation.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: violation
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Delete a violation
// @route   DELETE /api/violations/:id
// @access  Private (Admin Only)
exports.deleteViolation = async (req, res) => {
  try {
    const violation = await Violation.findById(req.params.id);

    if (!violation) {
      return res.status(404).json({ success: false, error: 'Violation not found' });
    }

    await violation.deleteOne(); // Delete the document

    res.status(200).json({
      success: true,
      data: {},
      message: 'Violation deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
// @desc    Get Violation Analytics (Stats)
// @route   GET /api/violations/analytics
// @access  Private (Admin Only)
exports.getAnalytics = async (req, res) => {
  try {
    //  Total Violations Count
    const totalViolations = await Violation.countDocuments();

    //  Count by Status (Pending, Verified, etc.)
    const statusStats = await Violation.aggregate([
      {
        $group: {
          _id: '$status', // Group by status field
          count: { $sum: 1 } // Count occurrences
        }
      }
    ]);

    //  Count by Violation Type
    const typeStats = await Violation.aggregate([
      {
        $group: {
          _id: '$violationType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } } // Sort most frequent first
    ]);

    //  Recent Activity (Last 5 uploads)
    const recentActivity = await Violation.find()
      .select('violationType createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        totalViolations,
        statusStats,
        typeStats,
        recentActivity
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server Error generating analytics' });
  }
};