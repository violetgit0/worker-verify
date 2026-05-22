const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { generatePayroll, getPayroll, getWorkerPayroll, updatePayrollStatus, addManualDeduction } = require('../controllers/payrollController');

router.use(protect, companyScope);
router.get('/',                  getPayroll);
router.get('/worker/:workerId',  getWorkerPayroll);
router.post('/generate',         generatePayroll);
router.post('/manual-deduction', addManualDeduction);
router.put('/:id/status',        updatePayrollStatus);

module.exports = router;
