const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const ROLES = ['company_admin', 'branch_manager', 'supervisor', 'staff'];

const userSchema = new mongoose.Schema({
  company:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  fullName: { type: String, required: true, trim: true },
  username: { type: String, required: true, lowercase: true, trim: true },
  email:    { type: String, required: true, lowercase: true, trim: true },
  phone:    { type: String, default: '' },
  password: { type: String, required: true },
  role:     { type: String, enum: ROLES, default: 'staff' },
  branch:   { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  photo:    { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.index({ company: 1, username: 1 }, { unique: true });
userSchema.index({ company: 1, email:    1 }, { unique: true });

module.exports.ROLES = ROLES;

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
