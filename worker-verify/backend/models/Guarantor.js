const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema({
  sigType:  { type: String, enum: ['drawn', 'uploaded'], default: null },
  url:      { type: String, default: '' },
  signedAt: { type: Date, default: null }
}, { _id: false });

const identityDocSchema = new mongoose.Schema({
  docType: {
    type: String,
    enum: ['nin_slip', 'voter_card', 'drivers_license', 'international_passport', 'national_id'],
    default: 'nin_slip'
  },
  docNumber:   { type: String, default: '' },
  fileUrl:     { type: String, default: '' },
  fileType:    { type: String, default: '' },   // 'image' | 'pdf'
  docStatus:   { type: String, enum: ['pending', 'approved', 'rejected', 'flagged'], default: 'pending' },
  reviewNotes: { type: String, default: '' }
}, { _id: false });

const guarantorSchema = new mongoose.Schema({
  worker:          { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  guarantorNumber: { type: Number, enum: [1, 2], required: true },
  fullName:        { type: String, required: true, trim: true },
  phone:           { type: String, required: true },
  nin:             { type: String, required: true, trim: true },
  relationship:    { type: String, required: true },
  homeAddress:     { type: String, required: true },
  passportPhoto:   { type: String, default: '' },
  landmark:        { type: String, default: '' },
  housePhoto:      { type: String, default: '' },    // legacy single photo
  housePhotos:     [{ type: String }],               // multiple house/building photos
  streetPhotos:    [{ type: String }],               // street / environment photos
  identityDoc:     { type: identityDocSchema, default: () => ({}) },
  signature:       { type: signatureSchema, default: () => ({}) },
  location: {
    lat:         { type: Number,  default: null },
    lng:         { type: Number,  default: null },
    address:     { type: String,  default: '' },
    plusCode:    { type: String,  default: '' },
    mapsLink:    { type: String,  default: '' },
    inputMethod: { type: String,  enum: ['map','address','gps','plus_code','maps_link'], default: 'map' }
  }
}, { timestamps: true });

guarantorSchema.index({ fullName: 'text', phone: 'text', nin: 'text' });

module.exports = mongoose.model('Guarantor', guarantorSchema);
