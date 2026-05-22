const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  color:       { type: String, default: '#2563eb' },

  // rotation: N days on / N days off (e.g. 1 on / 1 off)
  // weekly:   fixed days of the week every week
  type: { type: String, enum: ['rotation', 'weekly'], required: true },

  // Rotation fields
  daysOn:  { type: Number, default: 1, min: 1 },
  daysOff: { type: Number, default: 1, min: 1 },

  // Weekly fields — 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  workDays: [{ type: Number, min: 0, max: 6 }],

  // Hours (both types)
  clockIn:          { type: String, default: '08:00' },
  clockOut:         { type: String, default: '20:00' },
  lateAfterMinutes: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

scheduleSchema.index({ company: 1 });
scheduleSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Schedule', scheduleSchema);
