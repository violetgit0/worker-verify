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
const { hasPermission } = require('../middleware/roleCheck');
const { workerProtect } = require('../middleware/workerAuth');
const { selfieUpload } = require('../config/cloudinary');

// Worker self-service
router.post('/clock-in',      workerProtect, selfieUpload, workerClockIn);
router.post('/clock-out',     workerProtect, workerClockOut);
router.get('/my-history',     workerProtect, getWorkerAttendance);

// Admin / staff
router.get('/',                       protect, getAttendance);
router.get('/report',                 protect, getAttendanceReport);
router.get('/today/:branchId',        protect, getTodayAttendance);
router.get('/worker/:workerId',       protect, getWorkerAttendance);
router.post('/admin-clock-in',        protect, hasPermission('canManageAttendance'), adminClockIn);
router.post('/admin-clock-out',       protect, hasPermission('canManageAttendance'), adminClockOut);
router.post('/mark-absent',           protect, hasPermission('canManageAttendance'), markAbsent);

module.exports = router;
