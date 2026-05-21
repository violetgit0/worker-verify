const express = require('express');
const router = express.Router();
const { getAllBranches, getBranchById, createBranch, updateBranch, deleteBranch, getBranchWorkers } = require('../controllers/branchController');
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { authorize, hasPermission } = require('../middleware/roleCheck');

router.use(protect, companyScope);

router.get('/',            getAllBranches);
router.get('/:id',         getBranchById);
router.get('/:id/workers', getBranchWorkers);
router.post('/',           hasPermission('canManageBranches'), createBranch);
router.put('/:id',         hasPermission('canManageBranches'), updateBranch);
router.delete('/:id',      authorize('super_admin', 'company_admin'), deleteBranch);

module.exports = router;
