const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { getBranches, getBranch, createBranch, updateBranch, deleteBranch } = require('../controllers/branchController');

router.use(protect, companyScope);
router.get('/',     getBranches);
router.get('/:id',  getBranch);
router.post('/',    createBranch);
router.put('/:id',  updateBranch);
router.delete('/:id', deleteBranch);

module.exports = router;
