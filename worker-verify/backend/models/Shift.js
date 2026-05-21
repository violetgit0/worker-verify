const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  company:        { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  branch:         { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },

  name:           { type: String, required: true, trim: true }, // "Shift - Mr John"
  supervisorName: { type: String, default: '' },
  supervisorUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  category:       { type: mongoose.Schema.Types.ObjectId, ref: 'WorkerCategory', default: null },

  // Time overrides — null means inherit from category (or branch fallback)
  resumeTime:           { type: String, default: null },  // 'HH:MM' or null
  lateAfterMinutes:     { type: Number, default: null },
  closingTime:          { type: String, default: null },
  overtimeAfterMinutes: { type: Number, default: null },

  // Work pattern — null means inherit from category
  workPattern: {
    type: String,
    enum: ['all_week', 'weekdays', 'alternating', 'custom', null],
    default: null
  },
  offDays:       [{ type: Number, min: 0, max: 6 }],
  daysOn:        { type: Number, default: 1 },
  daysOff:       { type: Number, default: 1 },
  referenceDate: { type: Date, default: null }, // anchor for alternating pattern

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

shiftSchema.index({ company: 1 });
shiftSchema.index({ company: 1, name: 1 }, { unique: true });
shiftSchema.index({ company: 1, branch: 1 });
shiftSchema.index({ company: 1, category: 1 });

module.exports = mongoose.model('Shift', shiftSchema);
