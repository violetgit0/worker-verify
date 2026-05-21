const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  // Multi-tenant (null for platform-level actions)
  company:         { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },

  action:          { type: String, required: true },
  performedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performedByName: { type: String, default: '' },
  performedByRole: { type: String, default: '' },
  targetType:      { type: String, enum: ['worker', 'staff', 'attendance', 'branch', 'payroll', 'system', 'company'], default: 'system' },
  targetId:        { type: mongoose.Schema.Types.ObjectId, default: null },
  targetName:      { type: String, default: '' },
  details:         { type: mongoose.Schema.Types.Mixed, default: {} },
  ip:              { type: String, default: '' }
}, { timestamps: true });

activityLogSchema.index({ company: 1, createdAt: -1 });
activityLogSchema.index({ performedBy: 1 });
activityLogSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
