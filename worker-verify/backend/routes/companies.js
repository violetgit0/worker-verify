const express = require('express');
const router  = express.Router();
const {
  registerCompany, getCompanyProfile, updateCompanyProfile,
  updateBranding, lookupCompany, getPlans
} = require('../controllers/companyController');
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { authorize } = require('../middleware/roleCheck');
const { singleUpload } = require('../middleware/upload');

// Public
router.get('/plans',           getPlans);
router.post('/register',       registerCompany);
router.get('/lookup/:slug',    lookupCompany);

// Protected — company admin only
router.get('/profile',    protect, companyScope, authorize('company_admin', 'super_admin'), getCompanyProfile);
router.put('/profile',    protect, companyScope, authorize('company_admin', 'super_admin'), singleUpload, updateCompanyProfile);
router.put('/branding',   protect, companyScope, authorize('company_admin', 'super_admin'), singleUpload, updateBranding);

module.exports = router;
