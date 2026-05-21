const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name:         { type: String, required: true },       // 'Basic'
  key:          { type: String, required: true, unique: true }, // 'basic'
  description:  { type: String, default: '' },
  monthlyPrice: { type: Number, default: 0 },          // in kobo (NGN) or cents (USD)
  yearlyPrice:  { type: Number, default: 0 },
  currency:     { type: String, default: 'NGN' },

  // Resource limits (-1 = unlimited)
  maxWorkers:  { type: Number, default: 50 },
  maxBranches: { type: Number, default: 5 },
  maxStaff:    { type: Number, default: 10 },

  features: [{ type: String }],

  // Paystack/Stripe plan codes
  paystackMonthlyCode: { type: String, default: '' },
  paystackYearlyCode:  { type: String, default: '' },
  stripeMonthlyPriceId:{ type: String, default: '' },
  stripeYearlyPriceId: { type: String, default: '' },

  isActive:    { type: Boolean, default: true },
  sortOrder:   { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
