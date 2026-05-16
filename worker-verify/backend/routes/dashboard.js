const express = require('express');
const router = express.Router();
const { getAdminStats, getStaffStats } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

router.get('/admin', protect, authorize('super_admin'), getAdminStats);
router.get('/staff', protect, authorize('staff'),       getStaffStats);

module.exports = router;
