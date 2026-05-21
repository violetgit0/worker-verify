const express = require('express');
const router  = express.Router();
const {
  getAllCompanies, getCompanyById, suspendCompany, activateCompany,
  updateCompanySubscription, getPlatformStats,
  getPlans, createPlan, updatePlan, getPlatformLogs,
  resetSystem
} = require('../controllers/superAdminController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// All super admin routes require platform super_admin role
router.use(protect, authorize('super_admin'));

router.get('/stats',                          getPlatformStats);
router.get('/companies',                      getAllCompanies);
router.get('/companies/:id',                  getCompanyById);
router.put('/companies/:id/suspend',          suspendCompany);
router.put('/companies/:id/activate',         activateCompany);
router.put('/companies/:id/subscription',     updateCompanySubscription);
router.get('/plans',                          getPlans);
router.post('/plans',                         createPlan);
router.put('/plans/:id',                      updatePlan);
router.get('/logs',                           getPlatformLogs);
router.post('/reset-all',                     resetSystem);

module.exports = router;
