const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema({
  sigType:  { type: String, enum: ['drawn', 'uploaded'], default: null },
  url:      { type: String, default: '' },
  signedAt: { type: Date, default: null }
}, { _id: false });

const locationSchema = new mongoose.Schema({
  lat:         { type: Number,  default: null },
  lng:         { type: Number,  default: null },
  address:     { type: String,  default: '' },  // Nominatim / Google reverse-geocode address
  plusCode:    { type: String,  default: '' },
  mapsLink:    { type: String,  default: '' },
  inputMethod: { type: String,  enum: ['map','address','gps','plus_code','maps_link'], default: 'map' }
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

const workerSchema = new mongoose.Schema({
  fullName:           { type: String, required: true, trim: true },
  phone:              { type: String, required: true },
  gender:             { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  dateOfBirth:        { type: Date, required: true },
  nin:                { type: String, required: true, unique: true, trim: true },
  occupation:         { type: String, required: true },
  passportPhoto:      { type: String, default: '' },
  homeAddress:        { type: String, required: true },
  landmark:           { type: String, default: '' },
  location:           { type: locationSchema },
  housePhoto:         { type: String, default: '' },   // legacy single photo (kept for compat)
  housePhotos:        [{ type: String }],              // multiple house/building photos
  streetPhotos:       [{ type: String }],              // street / environment photos
  identityDoc:        { type: identityDocSchema, default: () => ({}) },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'incomplete', 'legacy', 'temporary'],
    default: 'pending'
  },
  rejectionReason:    { type: String, default: '' },
  // Restriction flags — admin can block unverified workers from clocking in / appearing in payroll
  allowClockIn:       { type: Boolean, default: true },
  allowPayroll:       { type: Boolean, default: true },
  guarantors:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'Guarantor' }],
  registeredBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  verifiedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt:         { type: Date },
  // Branch & workforce management
  branch:             { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  shift:              { type: String, enum: ['A', 'B', 'unassigned'], default: 'unassigned' },
  employmentStatus:   { type: String, enum: ['active', 'suspended', 'resigned', 'sacked', 'on_leave'], default: 'active' },
  dateEmployed:       { type: Date, default: Date.now },
  // Payroll
  monthlySalary:      { type: Number, default: 0 },
  dailyRate:          { type: Number, default: 0 },
  // Signatures
  workerSignature:    { type: signatureSchema, default: () => ({}) },
  // Worker portal PIN (bcrypt hashed)
  pin:                { type: String, default: '' }
}, { timestamps: true });

workerSchema.index({ fullName: 'text', phone: 'text', nin: 'text', homeAddress: 'text' });
workerSchema.index({ branch: 1, shift: 1, employmentStatus: 1 });

module.exports = mongoose.model('Worker', workerSchema);
