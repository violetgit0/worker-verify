const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { register, login, getMe, changePassword, lookupCompany } = require('../controllers/authController');

router.post('/register',    register);
router.post('/login',       login);
router.get('/me',           protect, getMe);
router.put('/change-password', protect, changePassword);
router.get('/lookup/:slug', lookupCompany);

module.exports = router;
