const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { getSales, createSales, updateSales, deleteSales, getSalesSummary } = require('../controllers/salesController');

router.use(protect, companyScope);
router.get('/summary', getSalesSummary);
router.get('/',        getSales);
router.post('/',       createSales);
router.put('/:id',     updateSales);
router.delete('/:id',  deleteSales);

module.exports = router;
