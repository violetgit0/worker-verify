const express = require('express');
const router = express.Router();
const {
  getAllBranches, getBranchById, createBranch,
  updateBranch, deleteBranch, getBranchWorkers
} = require('../controllers/branchController');
const { protect } = require('../middleware/auth');
const { authorize, hasPermission } = require('../middleware/roleCheck');

router.get('/',            protect, getAllBranches);
router.get('/:id',         protect, getBranchById);
router.get('/:id/workers', protect, getBranchWorkers);
router.post('/',           protect, hasPermission('canManageBranches'), createBranch);
router.put('/:id',         protect, hasPermission('canManageBranches'), updateBranch);
router.delete('/:id',      protect, authorize('super_admin'),           deleteBranch);

module.exports = router;
