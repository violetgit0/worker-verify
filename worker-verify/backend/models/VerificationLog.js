const mongoose = require('mongoose');

const verificationLogSchema = new mongoose.Schema({
  worker:         { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  action:         { type: String, enum: ['registered', 'approved', 'rejected', 'updated', 'flagged', 'doc_approved', 'doc_rejected'], required: true },
  performedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  previousStatus: { type: String, default: '' },
  newStatus:      { type: String, default: '' },
  notes:          { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('VerificationLog', verificationLogSchema);
