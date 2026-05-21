const mongoose = require('mongoose');

const deductionRuleSchema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name:        { type: String, required: true, trim: true },
  type:        { type: String, enum: ['lateness', 'absence', 'manual'], required: true },
  minMinutes:  { type: Number, default: 0 },
  maxMinutes:  { type: Number, default: null },
  amount:      { type: Number, required: true },
  description: { type: String, default: '' },
  isActive:    { type: Boolean, default: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

deductionRuleSchema.index({ company: 1 });

module.exports = mongoose.model('DeductionRule', deductionRuleSchema);
