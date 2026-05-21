const express = require('express');
const router = express.Router();
const {
  createStaff, getAllStaff, getStaffById,
  updateStaff, suspendStaff, activateStaff,
  deleteStaff, restoreStaff, resetStaffPassword,
  getStaffLoginHistory, assignBranch, resetAllStaff
} = require('../controllers/staffController');
const { updatePermissions, applyPreset } = require('../controllers/permissionController');
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { authorize } = require('../middleware/roleCheck');
const { singleUpload } = require('../middleware/upload');
const User = require('../models/User');
const { enforceLimit } = require('../middleware/companyScope');

router.use(protect, companyScope, authorize('super_admin', 'company_admin'));

router.get('/',                                    getAllStaff);
router.post('/',            singleUpload, enforceLimit(User, 'maxStaff'), createStaff);
router.get('/:id',                                 getStaffById);
router.put('/:id',          singleUpload,          updateStaff);
router.delete('/:id',                              deleteStaff);
router.put('/:id/suspend',                         suspendStaff);
router.put('/:id/activate',                        activateStaff);
router.put('/:id/restore',                         restoreStaff);
router.put('/:id/reset-password',                  resetStaffPassword);
router.get('/:id/login-history',                   getStaffLoginHistory);
router.put('/:id/assign-branch',                   assignBranch);
router.put('/:id/permissions',                     updatePermissions);
router.post('/:id/permissions/preset/:preset',     applyPreset);
router.post('/reset-all',                          resetAllStaff);

module.exports = router;
