const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  // Multi-tenant
  company:      { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },

  worker:       { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  branch:       { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  month:        { type: Number, required: true, min: 1, max: 12 },
  year:         { type: Number, required: true },

  monthlySalary:  { type: Number, default: 0 },
  dailyRate:      { type: Number, default: 0 },

  workingDays:  { type: Number, default: 26 },
  daysPresent:  { type: Number, default: 0 },
  daysAbsent:   { type: Number, default: 0 },
  daysLate:     { type: Number, default: 0 },
  daysOnLeave:  { type: Number, default: 0 },

  baseSalary:      { type: Number, default: 0 },
  overtimeHours:   { type: Number, default: 0 },
  overtimeRate:    { type: Number, default: 0 },
  overtimeAmount:  { type: Number, default: 0 },

  totalDeductions: { type: Number, default: 0 },
  netSalary:       { type: Number, default: 0 },

  status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  paidAt:     { type: Date, default: null },
  paymentRef: { type: String, default: '' },
  notes:      { type: String, default: '' }
}, { timestamps: true });

payrollSchema.index({ company: 1, worker: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ company: 1, branch: 1, month: 1, year: 1 });

module.exports = mongoose.model('Payroll', payrollSchema);
