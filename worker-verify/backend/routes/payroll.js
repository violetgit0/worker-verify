const express = require('express');
const router = express.Router();
const {
  generatePayroll, getPayroll, getWorkerPayroll,
  updatePayrollStatus, getPayrollSummary
} = require('../controllers/payrollController');
const { protect } = require('../middleware/auth');
const { hasPermission } = require('../middleware/roleCheck');
const { workerProtect } = require('../middleware/workerAuth');

router.get('/summary',          protect, getPayrollSummary);
router.get('/',                 protect, hasPermission('canViewPayroll'), getPayroll);
router.get('/worker/:workerId', protect, hasPermission('canViewPayroll'), getWorkerPayroll);
router.get('/my-payroll',       workerProtect, getWorkerPayroll);
router.post('/generate',        protect, hasPermission('canEditPayroll'), generatePayroll);
router.put('/:id/status',       protect, hasPermission('canEditPayroll'), updatePayrollStatus);

module.exports = router;
