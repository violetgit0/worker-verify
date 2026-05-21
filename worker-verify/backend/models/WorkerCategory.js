const mongoose = require('mongoose');

const workerCategorySchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },

  name:        { type: String, required: true, trim: true }, // "Pump Attendant", "Security"
  description: { type: String, default: '' },
  color:       { type: String, default: '#6366f1' }, // hex color for UI badges

  // Clock-in times
  resumeTime:           { type: String, default: '08:00' }, // HH:MM
  lateAfterMinutes:     { type: Number, default: 0  },      // grace period before marking late
  closingTime:          { type: String, default: '17:00' },
  overtimeAfterMinutes: { type: Number, default: 60 },

  // Work pattern
  workPattern: {
    type: String,
    enum: ['all_week', 'weekdays', 'alternating', 'custom'],
    default: 'all_week'
  },
  // For custom / weekdays: days off (0=Sun,1=Mon,...,6=Sat)
  offDays:  [{ type: Number, min: 0, max: 6 }],
  // For alternating: 1 day on / 1 day off, 2 on / 1 off, etc.
  daysOn:   { type: Number, default: 1 },
  daysOff:  { type: Number, default: 1 },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

workerCategorySchema.index({ company: 1 });
workerCategorySchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('WorkerCategory', workerCategorySchema);
