const mongoose = require('mongoose');

const transferLogSchema = new mongoose.Schema({
  worker:      { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  changeType:  {
    type: String,
    enum: ['branch_assignment', 'shift_change', 'status_change'],
    required: true
  },
  oldValue:    { type: String, default: '' },
  newValue:    { type: String, default: '' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes:       { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('TransferLog', transferLogSchema);
