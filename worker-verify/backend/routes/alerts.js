const express = require('express');
const router  = express.Router();
const { getAlerts, getAlertStats, resolveAlert, reviewFace } = require('../controllers/alertsController');
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { authorize } = require('../middleware/roleCheck');

router.use(protect, companyScope);

router.get('/stats',                      getAlertStats);
router.get('/',                           getAlerts);
router.put('/:id/resolve',                authorize('super_admin', 'company_admin'), resolveAlert);
router.put('/face-review/:attendanceId',  authorize('super_admin', 'company_admin'), reviewFace);

module.exports = router;
