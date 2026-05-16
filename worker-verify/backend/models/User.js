const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName:      { type: String, required: true, trim: true },
  username:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:         { type: String, required: true },
  password:      { type: String, required: true },
  role:          { type: String, enum: ['super_admin', 'staff'], default: 'staff' },
  accountNumber: { type: String, default: '' },
  bankName:      { type: String, default: '' },
  passportPhoto: { type: String, default: '' },
  isActive:      { type: Boolean, default: true },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
