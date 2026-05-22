const mongoose = require('mongoose');

/**
 * ScheduleTemplate defines WHEN workers work.
 *
 * Two types:
 *  - rotation : alternating work/off cycles (e.g. 1 day on / 1 day off)
 *  - weekly   : fixed days of the week (e.g. Mon–Sat, off Sun+Wed)
 *
 * Workers reference this via Worker.scheduleRef.
 * Worker.scheduleStartDate anchors the rotation cycle for that worker.
 */
const scheduleTemplateSchema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },

  name:        { type: String, required: true, trim: true }, // "1-Day Rotation", "Supervisor Weekly"
  description: { type: String, default: '', trim: true },
  color:       { type: String, default: '#6366f1' },

  type: {
    type: String,
    enum: ['rotation', 'weekly'],
    required: true
  },

  // ── Rotation fields (type === 'rotation') ───────────────────────────────────
  // daysOn + daysOff = total cycle length
  daysOn:  { type: Number, default: 1, min: 1 },  // consecutive work days
  daysOff: { type: Number, default: 1, min: 1 },  // consecutive off days

  // ── Weekly fields (type === 'weekly') ───────────────────────────────────────
  // Array of day numbers: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  workDays: [{ type: Number, min: 0, max: 6 }],

  // ── Work hours (applies to both types) ─────────────────────────────────────
  clockIn:           { type: String, default: '08:00' }, // HH:MM
  clockOut:          { type: String, default: '20:00' }, // HH:MM
  lateAfterMinutes:  { type: Number, default: 0 },       // grace period before "late"

  isActive:    { type: Boolean, default: true }
}, { timestamps: true });

scheduleTemplateSchema.index({ company: 1 });
scheduleTemplateSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ScheduleTemplate', scheduleTemplateSchema);
