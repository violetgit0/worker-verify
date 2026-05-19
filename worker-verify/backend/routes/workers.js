const express = require('express');
const router = express.Router();
const {
  registerWorker, quickRegisterWorker, getAllWorkers, getWorkerById,
  updateVerificationStatus, searchWorkers, flagDocument,
  assignBranch, assignShift, updateEmploymentStatus, updateSalary,
  getWorkerCompletion, updateRestrictions
} = require('../controllers/workerController');
const { protect } = require('../middleware/auth');
const { hasPermission } = require('../middleware/roleCheck');
const { workerUpload } = require('../middleware/upload');

router.get('/search',     protect, searchWorkers);
router.get('/',           protect, getAllWorkers);
router.post('/',          protect, hasPermission('canRegisterWorkers'), workerUpload, registerWorker);
router.post('/quick',     protect, hasPermission('canRegisterWorkers'), quickRegisterWorker);
router.get('/:id',        protect, getWorkerById);
router.get('/:id/completion', protect, getWorkerCompletion);

router.put('/:id/status',            protect, hasPermission('canApproveVerification'),              updateVerificationStatus);
router.put('/:id/flag-document',     protect, hasPermission('canApproveVerification'),              flagDocument);
router.put('/:id/restrictions',      protect, hasPermission('canEditWorkers', 'canApproveVerification'), updateRestrictions);
router.put('/:id/assign-branch',     protect, hasPermission('canMoveWorkersBranch'),                assignBranch);
router.put('/:id/assign-shift',      protect, hasPermission('canAssignShifts'),                     assignShift);
router.put('/:id/employment-status', protect, hasPermission('canSackWorkers', 'canRestoreWorkers'), updateEmploymentStatus);
router.put('/:id/salary',            protect, hasPermission('canEditPayroll'),                      updateSalary);

module.exports = router;
