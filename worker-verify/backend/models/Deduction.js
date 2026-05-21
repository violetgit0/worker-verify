const mongoose = require('mongoose');

const deductionSchema = new mongoose.Schema({
  company:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  worker:     { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  branch:     { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  attendance: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', default: null },
  rule:       { type: mongoose.Schema.Types.ObjectId, ref: 'DeductionRule', default: null },
  month:      { type: Number, required: true, min: 1, max: 12 },
  year:       { type: Number, required: true },
  type:       { type: String, enum: ['lateness', 'absence', 'manual'], required: true },
  amount:     { type: Number, required: true },
  description:{ type: String, default: '' },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

deductionSchema.index({ company: 1, worker: 1, month: 1, year: 1 });
deductionSchema.index({ attendance: 1 });

module.exports = mongoose.model('Deduction', deductionSchema);
