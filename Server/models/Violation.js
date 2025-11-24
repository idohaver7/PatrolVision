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
        enum: ['Illegal Overtaking', 'Red Light Violation', 'Wrong Way Driving', 'Illegal Turn', 'Other'] 
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
        enum: ['Pending Review', 'Verified', 'Disputed', 'Closed'],
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


module.exports = mongoose.model('Violation', ViolationSchema);