const express = require('express');
const router = express.Router();
const {
  getDeductionRules, createDeductionRule, updateDeductionRule, deleteDeductionRule,
  getDeductions, getWorkerDeductions, createManualDeduction, deleteDeduction
} = require('../controllers/deductionController');
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { authorize } = require('../middleware/roleCheck');
const { workerProtect } = require('../middleware/workerAuth');

router.use(protect, companyScope);

router.get('/rules',            getDeductionRules);
router.post('/rules',           authorize('super_admin', 'company_admin'), createDeductionRule);
router.put('/rules/:id',        authorize('super_admin', 'company_admin'), updateDeductionRule);
router.delete('/rules/:id',     authorize('super_admin', 'company_admin'), deleteDeductionRule);

router.get('/',                 getDeductions);
router.get('/worker/:workerId', getWorkerDeductions);
router.post('/manual',          authorize('super_admin', 'company_admin'), createManualDeduction);
router.delete('/:id',           authorize('super_admin', 'company_admin'), deleteDeduction);

module.exports = router;
