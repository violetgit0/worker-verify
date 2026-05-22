const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  slug:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  email:    { type: String, required: true, lowercase: true, trim: true },
  phone:    { type: String, default: '' },
  address:  { type: String, default: '' },
  branding: {
    logo:         { type: String, default: '' },
    primaryColor: { type: String, default: '#2563eb' }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
