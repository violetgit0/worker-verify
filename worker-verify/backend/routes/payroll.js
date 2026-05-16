const express = require('express');
const router = express.Router();
const {
  generatePayroll, getPayroll, getWorkerPayroll,
  updatePayrollStatus, getPayrollSummary
} = require('../controllers/payrollController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { workerProtect } = require('../middleware/workerAuth');

router.get('/summary',         protect, getPayrollSummary);
router.get('/',                protect, getPayroll);
router.get('/worker/:workerId',protect, getWorkerPayroll);
router.get('/my-payroll',      workerProtect, getWorkerPayroll);
router.post('/generate',       protect, authorize('super_admin'), generatePayroll);
router.put('/:id/status',      protect, authorize('super_admin'), updatePayrollStatus);

module.exports = router;
