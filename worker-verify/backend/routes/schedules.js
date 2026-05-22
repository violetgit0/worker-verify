const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { getSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule } = require('../controllers/scheduleController');

router.use(protect, companyScope);
router.get('/',     getSchedules);
router.get('/:id',  getSchedule);
router.post('/',    createSchedule);
router.put('/:id',  updateSchedule);
router.delete('/:id', deleteSchedule);

module.exports = router;
