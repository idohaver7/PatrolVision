// server/models/Violation.js
const mongoose = require('mongoose');

const ViolationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    violationType: {
        type: String,
        required: [true, 'violation type is required'],
        enum: ['Illegal Overtaking', 'Red Light Violation', 'Public Lane Violation'] 
    },
    licensePlate: {
        type: String,
        required: [true, 'license plate is required'],
        trim: true
    },
    mediaUrl: {
        type: String,
        required: [true, 'evidence URL (image/video) is required']
    },
    address: {
        type: String,
        required: false
    },
    // GeoSpatial Data 
    location: {
        type: {
            type: String,
            enum: ['Point'], // GeoJSON Type
            default: 'Point',
            required: true
        },
        coordinates: { // [Longitude, Latitude]
            type: [Number],
            required: [true, 'coordinates are required'],
        }
    },
    // Optional
    status: {
        type: String,
        enum: ['Pending Review', 'Verified', 'Rejected', 'Closed'],
        default: 'Pending Review'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    // Automatically adds createdAt and updatedAt
    timestamps: true
});

//Create a geospatial index to enable fast queries
ViolationSchema.index({ location: '2dsphere' });

ViolationSchema.index({ timestamp: -1 });
ViolationSchema.index({ user: 1 });

module.exports = mongoose.model('Violation', ViolationSchema);