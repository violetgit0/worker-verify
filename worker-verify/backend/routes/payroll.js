const express = require('express');
const router = express.Router();
const {
  generatePayroll, getPayroll, getWorkerPayroll,
  updatePayrollStatus, getPayrollSummary
} = require('../controllers/payrollController');
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { hasPermission } = require('../middleware/roleCheck');
const { workerProtect } = require('../middleware/workerAuth');

// Worker self-service route (uses worker JWT, must be before protect middleware)
router.get('/my-payroll', workerProtect, getWorkerPayroll);

router.use(protect, companyScope);

router.get('/summary',          getPayrollSummary);
router.get('/',                 hasPermission('canViewPayroll'), getPayroll);
router.get('/worker/:workerId', hasPermission('canViewPayroll'), getWorkerPayroll);
router.post('/generate',        hasPermission('canEditPayroll'), generatePayroll);
router.put('/:id/status',       hasPermission('canEditPayroll'), updatePayrollStatus);

module.exports = router;
