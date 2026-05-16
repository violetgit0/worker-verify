const mongoose = require('mongoose');

const deductionRuleSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  type:        { type: String, enum: ['lateness', 'absence', 'manual'], required: true },
  minMinutes:  { type: Number, default: 0 },    // for lateness: lower bound (inclusive)
  maxMinutes:  { type: Number, default: null },  // null = unlimited upper bound
  amount:      { type: Number, required: true }, // ₦ deduction
  description: { type: String, default: '' },
  isActive:    { type: Boolean, default: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('DeductionRule', deductionRuleSchema);
