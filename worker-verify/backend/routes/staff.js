const express = require('express');
const router = express.Router();
const {
  createStaff, getAllStaff, getStaffById,
  updateStaff, suspendStaff, activateStaff,
  deleteStaff, resetStaffPassword,
  getStaffLoginHistory, assignBranch
} = require('../controllers/staffController');
const { updatePermissions, applyPreset } = require('../controllers/permissionController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { singleUpload } = require('../middleware/upload');

router.use(protect, authorize('super_admin'));

router.get('/',                                    getAllStaff);
router.post('/',                  singleUpload,    createStaff);
router.get('/:id',                                 getStaffById);
router.put('/:id',                singleUpload,    updateStaff);
router.delete('/:id',                              deleteStaff);
router.put('/:id/suspend',                         suspendStaff);
router.put('/:id/activate',                        activateStaff);
router.put('/:id/reset-password',                  resetStaffPassword);
router.get('/:id/login-history',                   getStaffLoginHistory);
router.put('/:id/assign-branch',                   assignBranch);
router.put('/:id/permissions',                     updatePermissions);
router.post('/:id/permissions/preset/:preset',     applyPreset);

module.exports = router;
