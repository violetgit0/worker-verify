const mongoose = require('mongoose');

const shortageSchema = new mongoose.Schema({
  company:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  branch:     { type: mongoose.Schema.Types.ObjectId, ref: 'Branch',  required: true },
  worker:     { type: mongoose.Schema.Types.ObjectId, ref: 'Worker',  required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },

  date:   { type: Date, required: true },
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, default: '', trim: true },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:    { type: Date, default: null },
  rejectionNote: { type: String, default: '' },

  // When approved, this shortage can be linked to payroll deduction
  payrollRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll', default: null }
}, { timestamps: true });

shortageSchema.index({ company: 1, date: -1 });
shortageSchema.index({ company: 1, worker: 1, date: -1 });
shortageSchema.index({ company: 1, status: 1 });

module.exports = mongoose.model('Shortage', shortageSchema);
