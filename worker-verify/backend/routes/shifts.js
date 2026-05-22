const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const {
  getCategories, getCategoryById, createCategory, updateCategory, deleteCategory,
  getShifts, getShiftById, createShift, updateShift, deleteShift,
  getShiftDashboard, assignWorkersToShift, getShiftSummary
} = require('../controllers/shiftController');

router.use(protect, companyScope);

// Worker Roles (categories)
router.get('/categories',        getCategories);
router.get('/categories/:id',    getCategoryById);
router.post('/categories',       createCategory);
router.put('/categories/:id',    updateCategory);
router.delete('/categories/:id', deleteCategory);

// Shifts
router.get('/summary',           getShiftSummary);
router.get('/',                  getShifts);
router.get('/:id/dashboard',     getShiftDashboard);
router.get('/:id',               getShiftById);
router.post('/',                 createShift);
router.put('/:id',               updateShift);
router.delete('/:id',            deleteShift);

// Bulk assign workers to a shift / role
router.post('/assign-workers',   assignWorkersToShift);

module.exports = router;
