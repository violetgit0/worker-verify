const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  company:           { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  branch:            { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

  // Core identity
  fullName:          { type: String, required: true, trim: true },
  phone:             { type: String, required: true, trim: true },
  photo:             { type: String, default: '' },

  // Workforce
  role:              { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
  schedule:          { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', default: null },
  scheduleStartDate: { type: Date, default: null },
  salary:            { type: Number, default: 0 },
  dateEmployed:      { type: Date, default: Date.now },

  // Status
  status: {
    type: String,
    enum: ['active', 'pending', 'suspended', 'inactive'],
    default: 'active'
  },

  // Optional verification
  nin:     { type: String, default: '', trim: true },
  ninDoc:  {
    fileUrl: { type: String, default: '' },
    docType: { type: String, default: 'nin_slip' }
  },

  // Worker portal auth
  pin:         { type: String, default: '' },

  // Meta
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

workerSchema.index({ company: 1, status: 1 });
workerSchema.index({ company: 1, branch: 1, status: 1 });
workerSchema.index({ fullName: 'text', phone: 'text', nin: 'text' });

module.exports = mongoose.model('Worker', workerSchema);
