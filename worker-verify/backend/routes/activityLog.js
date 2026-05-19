const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

router.get('/', protect, authorize('super_admin'), async (req, res) => {
  const { page = 1, limit = 50, action, targetType, performedBy } = req.query;
  const filter = {};
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;
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
});

module.exports = router;
