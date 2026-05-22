const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  color:       { type: String, default: '#2563eb' },
  isActive:    { type: Boolean, default: true }
}, { timestamps: true });

roleSchema.index({ company: 1 });
roleSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);
