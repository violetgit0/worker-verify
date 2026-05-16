const express = require('express');
const router = express.Router();
const {
  getDeductionRules, createDeductionRule, updateDeductionRule, deleteDeductionRule,
  getDeductions, getWorkerDeductions, createManualDeduction, deleteDeduction
} = require('../controllers/deductionController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { workerProtect } = require('../middleware/workerAuth');

// Rules (super_admin only)
router.get('/rules',           protect, getDeductionRules);
router.post('/rules',          protect, authorize('super_admin'), createDeductionRule);
router.put('/rules/:id',       protect, authorize('super_admin'), updateDeductionRule);
router.delete('/rules/:id',    protect, authorize('super_admin'), deleteDeductionRule);

// Records
router.get('/',                protect, getDeductions);
router.get('/worker/:workerId', protect, getWorkerDeductions);
router.get('/my-deductions',   workerProtect, getWorkerDeductions);
router.post('/manual',         protect, authorize('super_admin'), createManualDeduction);
router.delete('/:id',          protect, authorize('super_admin'), deleteDeduction);

module.exports = router;
