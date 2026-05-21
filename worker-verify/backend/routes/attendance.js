const express = require('express');
const router = express.Router();
const {
  workerClockIn, workerClockOut,
  adminClockIn, adminClockOut,
  markAbsent,
  getAttendance, getTodayAttendance,
  getWorkerAttendance, getAttendanceReport
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { hasPermission } = require('../middleware/roleCheck');
const { workerProtect } = require('../middleware/workerAuth');
const { selfieUpload } = require('../config/cloudinary');

// Worker self-service (worker auth, not staff auth)
router.post('/clock-in',  workerProtect, selfieUpload, workerClockIn);
router.post('/clock-out', workerProtect, workerClockOut);
router.get('/my-history', workerProtect, getWorkerAttendance);

// Admin / staff — all require company scope
router.get('/',                       protect, companyScope, getAttendance);
router.get('/report',                 protect, companyScope, getAttendanceReport);
router.get('/today/:branchId',        protect, companyScope, getTodayAttendance);
router.get('/worker/:workerId',       protect, companyScope, getWorkerAttendance);
router.post('/admin-clock-in',        protect, companyScope, hasPermission('canManageAttendance'), adminClockIn);
router.post('/admin-clock-out',       protect, companyScope, hasPermission('canManageAttendance'), adminClockOut);
router.post('/mark-absent',           protect, companyScope, hasPermission('canManageAttendance'), markAbsent);

module.exports = router;
