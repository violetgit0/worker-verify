const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const { protect } = require('../middleware/auth');
const { companyScope } = require('../middleware/companyScope');
const { authorize } = require('../middleware/roleCheck');

router.get('/', protect, companyScope, authorize('super_admin', 'company_admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action, targetType, performedBy } = req.query;
    const filter = {};

    // Company users see only their company's logs; platform super_admin sees all
    if (req.companyId) filter.company = req.companyId;

    if (action)      filter.action     = action;
    if (targetType)  filter.targetType = targetType;
    if (performedBy) filter.performedBy = performedBy;

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      ActivityLog.countDocuments(filter)
    ]);

    res.json({ success: true, logs, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
