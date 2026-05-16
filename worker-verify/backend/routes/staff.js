const express = require('express');
const router = express.Router();
const {
  createStaff, getAllStaff, getStaffById,
  updateStaff, deleteStaff, resetStaffPassword
} = require('../controllers/staffController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { singleUpload } = require('../middleware/upload');

// All staff-management routes are super_admin only
router.use(protect, authorize('super_admin'));

router.get('/',                        getAllStaff);
router.post('/',    singleUpload,      createStaff);
router.get('/:id',                     getStaffById);
router.put('/:id',  singleUpload,      updateStaff);
router.delete('/:id',                  deleteStaff);
router.put('/:id/reset-password',      resetStaffPassword);

module.exports = router;
