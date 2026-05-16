const express = require('express');
const router = express.Router();
const {
  registerWorker, getAllWorkers, getWorkerById,
  updateVerificationStatus, searchWorkers, flagDocument,
  assignBranch, assignShift, updateEmploymentStatus, updateSalary
} = require('../controllers/workerController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { workerUpload } = require('../middleware/upload');

router.get('/search',              protect, searchWorkers);
router.get('/',                    protect, getAllWorkers);
router.post('/',                   protect, workerUpload, registerWorker);
router.get('/:id',                 protect, getWorkerById);
router.put('/:id/status',          protect, authorize('super_admin'), updateVerificationStatus);
router.put('/:id/flag-document',      protect, authorize('super_admin'), flagDocument);
router.put('/:id/assign-branch',      protect, authorize('super_admin'), assignBranch);
router.put('/:id/assign-shift',       protect, authorize('super_admin'), assignShift);
router.put('/:id/employment-status',  protect, authorize('super_admin'), updateEmploymentStatus);
router.put('/:id/salary',             protect, authorize('super_admin'), updateSalary);

module.exports = router;
