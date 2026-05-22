const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  company:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name:     { type: String, required: true, trim: true },
  code:     { type: String, default: '', uppercase: true, trim: true },
  address:  { type: String, default: '' },
  phone:    { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

branchSchema.index({ company: 1 });
branchSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Branch', branchSchema);
