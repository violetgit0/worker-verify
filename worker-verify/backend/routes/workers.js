const express    = require('express');
const router     = express.Router();
const { protect }      = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { workerPhotoUpload } = require('../middleware/upload');
const { getWorkers, getWorker, createWorker, updateWorker, deleteWorker, searchWorkers } = require('../controllers/workerController');

router.use(protect, companyScope);
router.get('/search', searchWorkers);
router.get('/',       getWorkers);
router.get('/:id',    getWorker);
router.post('/',      workerPhotoUpload, createWorker);
router.put('/:id',    workerPhotoUpload, updateWorker);
router.delete('/:id', deleteWorker);

module.exports = router;
