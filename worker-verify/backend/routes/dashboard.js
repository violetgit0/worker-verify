const express = require('express');
const router = express.Router();
const { getAdminStats, getStaffStats } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { authorize } = require('../middleware/roleCheck');

router.use(protect, companyScope);

router.get('/admin', authorize('super_admin', 'company_admin', 'branch_manager'), getAdminStats);
router.get('/staff', getStaffStats);

module.exports = router;
