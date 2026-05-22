const express = require('express');
const router = express.Router();
const {
  registerWorker, quickRegisterWorker, getAllWorkers, getWorkerById,
  updateVerificationStatus, searchWorkers, flagDocument,
  assignBranch, assignShift, updateEmploymentStatus, updateSalary,
  getWorkerCompletion, updateRestrictions, assignWorkerSchedule
} = require('../controllers/workerController');
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { hasPermission } = require('../middleware/roleCheck');
const { workerUpload } = require('../middleware/upload');
const Worker = require('../models/Worker');
const { enforceLimit } = require('../middleware/companyScope');

router.use(protect, companyScope);

router.get('/search',     searchWorkers);
router.get('/',           getAllWorkers);
router.post('/',          hasPermission('canRegisterWorkers'), enforceLimit(Worker, 'maxWorkers'), workerUpload, registerWorker);
router.post('/quick',     hasPermission('canRegisterWorkers'), enforceLimit(Worker, 'maxWorkers'), quickRegisterWorker);
router.get('/:id',        getWorkerById);
router.get('/:id/completion', getWorkerCompletion);

router.put('/:id/status',            hasPermission('canApproveVerification'),                   updateVerificationStatus);
router.put('/:id/flag-document',     hasPermission('canApproveVerification'),                   flagDocument);
router.put('/:id/restrictions',      hasPermission('canEditWorkers', 'canApproveVerification'), updateRestrictions);
router.put('/:id/assign-branch',     hasPermission('canMoveWorkersBranch'),                     assignBranch);
router.put('/:id/assign-shift',      hasPermission('canAssignShifts'),                          assignShift);
router.put('/:id/assign-schedule',   hasPermission('canAssignShifts'),                          assignWorkerSchedule);
router.put('/:id/employment-status', hasPermission('canSackWorkers', 'canRestoreWorkers'),      updateEmploymentStatus);
router.put('/:id/salary',            hasPermission('canEditPayroll'),                           updateSalary);

module.exports = router;
