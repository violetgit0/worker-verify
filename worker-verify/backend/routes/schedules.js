const express = require('express');
const router  = express.Router();
const { protect }       = require('../middleware/auth');
const { companyScope }  = require('../middleware/companyScope');
const {
  getSchedules, getScheduleById,
  createSchedule, updateSchedule, deleteSchedule,
  checkWorkerSchedule
} = require('../controllers/scheduleController');

router.use(protect, companyScope);

router.get('/',                     getSchedules);
router.get('/check/:workerId',      checkWorkerSchedule);
router.get('/:id',                  getScheduleById);
router.post('/',                    createSchedule);
router.put('/:id',                  updateSchedule);
router.delete('/:id',               deleteSchedule);

module.exports = router;
