const mongoose = require('mongoose');

const deductionItemSchema = new mongoose.Schema({
  type:   { type: String, enum: ['lateness', 'absence', 'shortage', 'manual'], required: true },
  amount: { type: Number, required: true },
  reason: { type: String, default: '' },
  date:   { type: Date, default: null }
}, { _id: false });

const payrollSchema = new mongoose.Schema({
  company:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  branch:   { type: mongoose.Schema.Types.ObjectId, ref: 'Branch',  default: null },
  worker:   { type: mongoose.Schema.Types.ObjectId, ref: 'Worker',  required: true },
  month:    { type: Number, required: true },
  year:     { type: Number, required: true },

  baseSalary:      { type: Number, default: 0 },
  daysScheduled:   { type: Number, default: 0 },
  daysWorked:      { type: Number, default: 0 },
  daysAbsent:      { type: Number, default: 0 },
  daysLate:        { type: Number, default: 0 },
  daysOff:         { type: Number, default: 0 },

  deductions:      [deductionItemSchema],
  totalDeductions: { type: Number, default: 0 },
  netSalary:       { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['draft', 'approved', 'paid'],
    default: 'draft'
  },

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  notes:      { type: String, default: '' }
}, { timestamps: true });

payrollSchema.index({ company: 1, month: 1, year: 1 });
payrollSchema.index({ worker: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
