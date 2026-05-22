const mongoose = require('mongoose');

// WorkerCategory defines WHAT a worker does (their role/job title).
// Schedule details (times, working days) live on the Shift, not here.
const workerCategorySchema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name:        { type: String, required: true, trim: true }, // "Pump Attendant", "Security", etc.
  description: { type: String, default: '', trim: true },
  color:       { type: String, default: '#6366f1' },        // hex for UI badges
  isActive:    { type: Boolean, default: true }
}, { timestamps: true });

workerCategorySchema.index({ company: 1 });
workerCategorySchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('WorkerCategory', workerCategorySchema);
