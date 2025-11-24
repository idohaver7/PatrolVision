const express = require('express');
const router = express.Router();
const { protect,admin } = require('../middleware/auth');
const { reportViolation, getViolations, deleteViolation, updateViolation ,getViolationById,getAnalytics } = require('../controllers/violationController');
const path = require('path');

const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname); 
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

router.route('/')
    .post(protect, upload.single('mediaFile'), reportViolation)
    .get(protect, getViolations);
router.get('/analytics', protect, admin, getAnalytics);
router.route('/:id')
    .get(protect, getViolationById)
    .put(protect, admin, updateViolation)
    .delete(protect, admin, deleteViolation);

module.exports = router;