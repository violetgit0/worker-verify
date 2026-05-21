const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  // Multi-tenant
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },

  name:        { type: String, required: true, trim: true },
  code:        { type: String, required: true, trim: true, uppercase: true },
  address:     { type: String, default: '' },
  managerName: { type: String, default: '' },
  phone:       { type: String, default: '' },
  isActive:    { type: Boolean, default: true },
  location: {
    lat:         { type: Number, default: null },
    lng:         { type: Number, default: null },
    address:     { type: String, default: '' },
    plusCode:    { type: String, default: '' },
    mapsLink:    { type: String, default: '' },
    inputMethod: { type: String, enum: ['map','address','gps','plus_code','maps_link'], default: 'map' }
  },
  resumptionTimeA:   { type: String, default: '08:00' },
  resumptionTimeB:   { type: String, default: '08:00' },
  attendanceRadiusM: { type: Number, default: 500 }
}, { timestamps: true });

// Branch code unique per company
branchSchema.index({ company: 1, code: 1 }, { unique: true });
branchSchema.index({ company: 1 });
branchSchema.index({ name: 'text', code: 'text' });

module.exports = mongoose.model('Branch', branchSchema);
