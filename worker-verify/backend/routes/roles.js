const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { getRoles, createRole, updateRole, deleteRole } = require('../controllers/roleController');

router.use(protect, companyScope);
router.get('/',     getRoles);
router.post('/',    createRole);
router.put('/:id',  updateRole);
router.delete('/:id', deleteRole);

module.exports = router;
