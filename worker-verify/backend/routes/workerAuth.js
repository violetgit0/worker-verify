const express = require('express');
const router = express.Router();
const { setWorkerPin, workerLogin, getWorkerMe } = require('../controllers/workerAuthController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { workerProtect } = require('../middleware/workerAuth');

router.post('/login',    workerLogin);
router.post('/set-pin',  protect, authorize('super_admin', 'staff'), setWorkerPin);
router.get('/me',        workerProtect, getWorkerMe);

module.exports = router;
