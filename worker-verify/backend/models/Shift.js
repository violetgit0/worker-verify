const mongoose = require('mongoose');

// Shift defines WHEN workers work — supervisor, times, and working days.
// Workers belong to one Shift (schedule) and one WorkerCategory (role).
const shiftSchema = new mongoose.Schema({
  company:        { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  branch:         { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },

  name:           { type: String, required: true, trim: true }, // e.g. "Morning Shift - Mr. John"
  supervisorName: { type: String, default: '', trim: true },
  supervisorUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Schedule — required on the shift itself (no category inheritance)
  resumeTime:           { type: String, default: '08:00' },  // HH:MM clock-in
  closingTime:          { type: String, default: '17:00' },  // HH:MM clock-out
  lateAfterMinutes:     { type: Number, default: 0  },       // grace period
  overtimeAfterMinutes: { type: Number, default: 60 },

  // Working days — offDays: array of day numbers excluded (0=Sun … 6=Sat)
  // workPattern is derived: 'all_week' | 'weekdays' | 'custom'
  workPattern: {
    type: String,
    enum: ['all_week', 'weekdays', 'custom'],
    default: 'all_week'
  },
  offDays: [{ type: Number, min: 0, max: 6 }], // days workers do NOT work

  // Allow workers in this shift to have a custom personal schedule
  // (useful for Outside Supervisors, Security, Managers)
  allowCustomSchedule: { type: Boolean, default: false },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

shiftSchema.index({ company: 1 });
shiftSchema.index({ company: 1, name: 1 }, { unique: true });
shiftSchema.index({ company: 1, branch: 1 });

module.exports = mongoose.model('Shift', shiftSchema);
