const mongoose = require('mongoose');

const securityAlertSchema = new mongoose.Schema({
  company:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  worker:     { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  attendance: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', default: null },
  branch:     { type: mongoose.Schema.Types.ObjectId, ref: 'Branch',    default: null },

  type: {
    type: String,
    enum: ['location_mismatch', 'face_mismatch', 'device_change', 'repeated_late', 'suspicious_attempt', 'no_selfie'],
    required: true
  },
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

  message: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },

  isResolved: { type: Boolean, default: false },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  notes:      { type: String, default: '' }
}, { timestamps: true });

securityAlertSchema.index({ company: 1, worker: 1, createdAt: -1 });
securityAlertSchema.index({ company: 1, isResolved: 1, createdAt: -1 });

module.exports = mongoose.model('SecurityAlert', securityAlertSchema);
