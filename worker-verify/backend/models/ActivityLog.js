const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  action:          { type: String, required: true },
  performedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performedByName: { type: String, default: '' },
  performedByRole: { type: String, default: '' },
  targetType:      { type: String, enum: ['worker', 'staff', 'attendance', 'branch', 'payroll', 'system'], default: 'system' },
  targetId:        { type: mongoose.Schema.Types.ObjectId, default: null },
  targetName:      { type: String, default: '' },
  details:         { type: mongoose.Schema.Types.Mixed, default: {} },
  ip:              { type: String, default: '' }
}, { timestamps: true });

activityLogSchema.index({ performedBy: 1 });
activityLogSchema.index({ targetType: 1, targetId: 1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
