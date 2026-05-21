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

// Wrap singleUpload so Cloudinary/multer errors return clean JSON instead of HTML
const staffUpload = (req, res, next) => {
  singleUpload(req, res, (err) => {
    if (err) {
      console.error('[Staff Route] Upload error:', err.message, err.code);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed. Check file type and size (max 5MB).'
      });
    }
    if (req.file) {
      console.log('[Staff Route] File uploaded:', req.file.originalname,
                  '->', req.file.path, `(${(req.file.size/1024).toFixed(0)}KB)`);
    }
    next();
  });
};

router.get('/',                                          getAllStaff);
router.post('/',            staffUpload, enforceLimit(User, 'maxStaff'), createStaff);
router.get('/:id',                                       getStaffById);
router.put('/:id',          staffUpload,                 updateStaff);
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
