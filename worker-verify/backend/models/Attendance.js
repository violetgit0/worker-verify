const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  worker:    { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  branch:    { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  date:      { type: Date, required: true },            // normalized to midnight UTC
  shift:     { type: String, enum: ['A', 'B', 'unassigned'], default: 'unassigned' },

  clockInTime:  { type: Date, default: null },
  clockOutTime: { type: Date, default: null },

  clockInLocation:  { lat: { type: Number }, lng: { type: Number } },
  clockOutLocation: { lat: { type: Number }, lng: { type: Number } },

  status: {
    type: String,
    enum: ['present', 'late', 'absent', 'on_leave', 'half_day', 'off_shift'],
    default: 'absent'
  },

  latenessMinutes:  { type: Number, default: 0 },
  deductionAmount:  { type: Number, default: 0 },

  isLocationVerified: { type: Boolean, default: false },
  clockInDistance:    { type: Number, default: null },   // metres from branch at clock-in

  // Anti-buddy-punching
  selfieUrl:         { type: String, default: '' },
  faceMatchStatus:   { type: String, enum: ['pending','matched','mismatched','skipped'], default: 'skipped' },
  deviceFingerprint: { type: String, default: '' },
  deviceInfo:        { type: String, default: '' },      // UA string
  suspiciousFlags:   [{ type: String }],                 // e.g. ['device_change','repeated_late']

  isManual:  { type: Boolean, default: false },
  markedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes:     { type: String, default: '' }
}, { timestamps: true });

attendanceSchema.index({ worker: 1, date: 1 }, { unique: true });
attendanceSchema.index({ branch: 1, date: 1 });
attendanceSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
