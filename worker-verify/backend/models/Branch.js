const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  code:        { type: String, required: true, unique: true, trim: true, uppercase: true },
  address:     { type: String, default: '' },
  managerName: { type: String, default: '' },
  phone:       { type: String, default: '' },
  isActive:    { type: Boolean, default: true },
  // GPS + scheduling
  location: {
    lat:         { type: Number, default: null },
    lng:         { type: Number, default: null },
    address:     { type: String, default: '' },
    plusCode:    { type: String, default: '' },
    mapsLink:    { type: String, default: '' },
    inputMethod: { type: String, enum: ['map','address','gps','plus_code','maps_link'], default: 'map' }
  },
  resumptionTimeA:  { type: String, default: '08:00' }, // HH:MM for Shift A
  resumptionTimeB:  { type: String, default: '08:00' }, // HH:MM for Shift B
  attendanceRadiusM:{ type: Number, default: 500 }       // meters
}, { timestamps: true });

branchSchema.index({ name: 'text', code: 'text' });

module.exports = mongoose.model('Branch', branchSchema);
