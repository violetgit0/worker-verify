const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  company:      { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  branch:       { type: mongoose.Schema.Types.ObjectId, ref: 'Branch',  required: true },
  worker:       { type: mongoose.Schema.Types.ObjectId, ref: 'Worker',  required: true },
  date:         { type: Date, required: true },

  status: {
    type: String,
    enum: ['present', 'late', 'absent', 'off_day', 'on_leave'],
    default: 'absent'
  },

  clockInTime:      { type: Date, default: null },
  clockOutTime:     { type: Date, default: null },
  latenessMinutes:  { type: Number, default: 0 },

  isManual:  { type: Boolean, default: false },
  markedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes:     { type: String, default: '' }
}, { timestamps: true });

attendanceSchema.index({ company: 1, date: -1 });
attendanceSchema.index({ company: 1, worker: 1, date: -1 });
attendanceSchema.index({ worker: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
