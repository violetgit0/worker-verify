const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { adminClockIn, adminClockOut, markAbsent, getAttendance, getTodayAttendance, getWorkerAttendance } = require('../controllers/attendanceController');

router.use(protect, companyScope);
router.get('/',            getAttendance);
router.get('/today/:branchId', getTodayAttendance);
router.get('/worker/:workerId', getWorkerAttendance);
router.post('/clock-in',   adminClockIn);
router.post('/clock-out',  adminClockOut);
router.post('/mark-absent', markAbsent);

module.exports = router;
