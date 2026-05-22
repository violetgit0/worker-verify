const mongoose = require('mongoose');

const dailySalesSchema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  branch:      { type: mongoose.Schema.Types.ObjectId, ref: 'Branch',  required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },

  date:         { type: Date, required: true },
  sessionLabel: { type: String, default: '' }, // e.g. "Morning", "Evening"

  // Sales figures
  cashSales:     { type: Number, default: 0 },
  posSales:      { type: Number, default: 0 },
  transferSales: { type: Number, default: 0 },
  totalSales:    { type: Number, default: 0 }, // auto-calculated on save

  // Expenses + shortages
  expenses:       { type: Number, default: 0 },
  expensesNote:   { type: String, default: '' },
  shortageAmount: { type: Number, default: 0 },
  shortageNote:   { type: String, default: '' },

  notes:  { type: String, default: '' },
  status: { type: String, enum: ['draft', 'submitted'], default: 'submitted' }
}, { timestamps: true });

dailySalesSchema.pre('save', function (next) {
  this.totalSales = (this.cashSales || 0) + (this.posSales || 0) + (this.transferSales || 0);
  next();
});

dailySalesSchema.index({ company: 1, date: -1 });
dailySalesSchema.index({ company: 1, branch: 1, date: -1 });

module.exports = mongoose.model('DailySales', dailySalesSchema);
