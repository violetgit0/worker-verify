const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { getShortages, createShortage, approveShortage, rejectShortage, deleteShortage } = require('../controllers/shortageController');

router.use(protect, companyScope);
router.get('/',              getShortages);
router.post('/',             createShortage);
router.put('/:id/approve',   approveShortage);
router.put('/:id/reject',    rejectShortage);
router.delete('/:id',        deleteShortage);

module.exports = router;
