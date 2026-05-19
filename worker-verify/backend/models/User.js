const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['super_admin', 'branch_manager', 'hr_staff', 'attendance_officer', 'verification_officer', 'staff'];

const permissionsSchema = new mongoose.Schema({
  canRegisterWorkers:      { type: Boolean, default: false },
  canEditWorkers:          { type: Boolean, default: false },
  canDeleteWorkers:        { type: Boolean, default: false },
  canApproveVerification:  { type: Boolean, default: false },
  canSuspendWorkers:       { type: Boolean, default: false },
  canManageAttendance:     { type: Boolean, default: false },
  canViewPayroll:          { type: Boolean, default: false },
  canEditPayroll:          { type: Boolean, default: false },
  canManageBranches:       { type: Boolean, default: false },
  canCreateStaff:          { type: Boolean, default: false },
  canAssignShifts:         { type: Boolean, default: false },
  canMoveWorkersBranch:    { type: Boolean, default: false },
  canSackWorkers:          { type: Boolean, default: false },
  canRestoreWorkers:       { type: Boolean, default: false },
  canExportReports:        { type: Boolean, default: false },
  canViewAllBranches:      { type: Boolean, default: false },
  canOnlyViewAssignedBranch: { type: Boolean, default: false }
}, { _id: false });

const userSchema = new mongoose.Schema({
  fullName:      { type: String, required: true, trim: true },
  username:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:         { type: String, required: true },
  password:      { type: String, required: true },
  role:          { type: String, enum: ROLES, default: 'hr_staff' },
  branch:        { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  accountNumber: { type: String, default: '' },
  bankName:      { type: String, default: '' },
  passportPhoto: { type: String, default: '' },
  isActive:      { type: Boolean, default: true },
  suspendedAt:   { type: Date, default: null },
  suspendedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  suspendReason: { type: String, default: '' },
  permissions:   { type: permissionsSchema, default: () => ({}) },
  loginHistory:  [{
    timestamp: { type: Date, default: Date.now },
    ip:        { type: String, default: '' },
    userAgent: { type: String, default: '' }
  }],
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

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
