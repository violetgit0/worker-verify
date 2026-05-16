const express = require('express');
const router  = express.Router();
const { getAlerts, getAlertStats, resolveAlert, reviewFace } = require('../controllers/alertsController');
const { protect }   = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

router.get('/stats',                   protect, getAlertStats);
router.get('/',                        protect, getAlerts);
router.put('/:id/resolve',             protect, authorize('super_admin'), resolveAlert);
router.put('/face-review/:attendanceId', protect, authorize('super_admin'), reviewFace);

module.exports = router;
