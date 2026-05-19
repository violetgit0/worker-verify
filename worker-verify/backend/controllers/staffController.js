const User = require('../models/User');
const Worker = require('../models/Worker');
const ActivityLog = require('../models/ActivityLog');
const { ROLE_DEFAULTS } = require('../config/permissions');

const ROLE_LABELS = {
  super_admin:          'Super Admin',
  branch_manager:       'Branch Manager',
  hr_staff:             'HR Staff',
  attendance_officer:   'Attendance Officer',
  verification_officer: 'Verification Officer',
  staff:                'Staff'
};

const log = (action, by, targetType, targetId, targetName, details = {}, ip = '') =>
  ActivityLog.create({
    action,
    performedBy: by._id,
    performedByName: by.fullName,
    performedByRole: by.role,
    targetType,
    targetId,
    targetName,
    details,
    ip
  }).catch(() => {});

const createStaff = async (req, res) => {
  const { fullName, username, email, phone, password, role, branch, accountNumber, bankName } = req.body;

  const allowedRoles = ['branch_manager', 'hr_staff', 'attendance_officer', 'verification_officer', 'staff'];
  if (role && !allowedRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role specified' });
  }

  const uname = username.toLowerCase();
  const uemail = email.toLowerCase();

  // Check for active (non-deleted) conflict
  const activeConflict = await User.findOne({
    isDeleted: { $ne: true },
    $or: [{ username: uname }, { email: uemail }]
  });
  if (activeConflict) {
    return res.status(400).json({ success: false, message: 'Username or email already exists' });
  }

  // Check if a deleted record holds this username or email — suggest restore
  const deletedConflict = await User.findOne({
    isDeleted: true,
    $or: [{ deletedUsername: uname }, { deletedEmail: uemail }]
  });
  if (deletedConflict) {
    return res.status(409).json({
      success: false,
      message: `A deleted staff account (${deletedConflict.deletedUsername}) already used this username or email. You can restore it instead.`,
      canRestore: true,
      deletedStaffId: deletedConflict._id,
      deletedStaffName: deletedConflict.fullName
    });
  }

  const resolvedRole = role || 'hr_staff';
  const data = {
    fullName, username: uname, email: uemail, phone, password,
    role: resolvedRole,
    branch: branch || null,
    accountNumber: accountNumber || '',
    bankName: bankName || '',
    permissions: ROLE_DEFAULTS[resolvedRole] || {},
    createdBy: req.user._id
  };

  if (req.file) data.passportPhoto = req.file.path;

  const staff = await User.create(data);

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('create_staff', req.user, 'staff', staff._id, staff.fullName, { role: staff.role }, ip);

  res.status(201).json({
    success: true,
    message: 'Staff account created successfully',
    staff: { id: staff._id, fullName: staff.fullName, username: staff.username, role: staff.role }
  });
};

const getAllStaff = async (req, res) => {
  const showDeleted = req.query.deleted === 'true';

  const filter = showDeleted
    ? { role: { $ne: 'super_admin' }, isDeleted: true }
    : { role: { $ne: 'super_admin' }, isDeleted: { $ne: true } };

  const staff = await User.find(filter)
    .select('-password -loginHistory')
    .populate('branch', 'name code')
    .populate('createdBy', 'fullName')
    .populate('deletedBy', 'fullName')
    .sort({ createdAt: -1 });

  res.json({ success: true, count: staff.length, staff });
};

const getStaffById = async (req, res) => {
  const staff = await User.findById(req.params.id)
    .select('-password')
    .populate('branch', 'name code')
    .populate('createdBy', 'fullName')
    .populate('suspendedBy', 'fullName')
    .populate('deletedBy', 'fullName');

  if (!staff || staff.role === 'super_admin') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  const workerCount = await Worker.countDocuments({ registeredBy: staff._id });
  res.json({ success: true, staff, workerCount });
};

const updateStaff = async (req, res) => {
  const { fullName, phone, role, branch, accountNumber, bankName } = req.body;
  const staff = await User.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

  if (!staff || staff.role === 'super_admin') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  if (fullName !== undefined)      staff.fullName = fullName;
  if (phone !== undefined)         staff.phone = phone;
  if (role !== undefined && role !== 'super_admin') staff.role = role;
  if (branch !== undefined)        staff.branch = branch || null;
  if (accountNumber !== undefined) staff.accountNumber = accountNumber;
  if (bankName !== undefined)      staff.bankName = bankName;
  if (req.file)                    staff.passportPhoto = req.file.path;

  await staff.save();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('update_staff', req.user, 'staff', staff._id, staff.fullName, {}, ip);

  res.json({ success: true, message: 'Staff updated successfully' });
};

const suspendStaff = async (req, res) => {
  const { reason } = req.body;
  const staff = await User.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

  if (!staff || staff.role === 'super_admin') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  staff.isActive = false;
  staff.suspendedAt = new Date();
  staff.suspendedBy = req.user._id;
  staff.suspendReason = reason || '';
  await staff.save();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('suspend_staff', req.user, 'staff', staff._id, staff.fullName, { reason }, ip);

  res.json({ success: true, message: 'Staff account suspended' });
};

const activateStaff = async (req, res) => {
  const staff = await User.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

  if (!staff || staff.role === 'super_admin') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  staff.isActive = true;
  staff.suspendedAt = null;
  staff.suspendedBy = null;
  staff.suspendReason = '';
  await staff.save();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('activate_staff', req.user, 'staff', staff._id, staff.fullName, {}, ip);

  res.json({ success: true, message: 'Staff account activated' });
};

// Soft delete — mangles username/email so the unique index is freed
const deleteStaff = async (req, res) => {
  const staff = await User.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
  if (!staff || staff.role === 'super_admin') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  const suffix = `_deleted_${Date.now()}`;
  staff.deletedUsername = staff.username;
  staff.deletedEmail    = staff.email;
  staff.username        = staff.username + suffix;
  staff.email           = staff.email + suffix;
  staff.isDeleted       = true;
  staff.deletedAt       = new Date();
  staff.deletedBy       = req.user._id;
  staff.isActive        = false;
  await staff.save();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('delete_staff', req.user, 'staff', staff._id, staff.deletedUsername, { softDelete: true }, ip);

  res.json({ success: true, message: 'Staff account archived (soft deleted). It can be restored if needed.' });
};

// Restore a soft-deleted staff account
const restoreStaff = async (req, res) => {
  const staff = await User.findOne({ _id: req.params.id, isDeleted: true });
  if (!staff) {
    return res.status(404).json({ success: false, message: 'Deleted staff not found' });
  }

  // Check if the original username/email is now taken by an active account
  const uname  = staff.deletedUsername;
  const uemail = staff.deletedEmail;

  const conflict = await User.findOne({
    isDeleted: { $ne: true },
    _id: { $ne: staff._id },
    $or: [{ username: uname }, { email: uemail }]
  });
  if (conflict) {
    return res.status(409).json({
      success: false,
      message: `Cannot restore: username "${uname}" or email is already taken by another active account.`
    });
  }

  staff.username       = uname;
  staff.email          = uemail;
  staff.isDeleted      = false;
  staff.deletedAt      = null;
  staff.deletedBy      = null;
  staff.deletedUsername = '';
  staff.deletedEmail   = '';
  staff.isActive       = true;
  staff.suspendedAt    = null;
  staff.suspendedBy    = null;
  staff.suspendReason  = '';
  await staff.save();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('restore_staff', req.user, 'staff', staff._id, staff.fullName, {}, ip);

  res.json({ success: true, message: `${staff.fullName}'s account has been restored and reactivated.` });
};

const resetStaffPassword = async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  const staff = await User.findById(req.params.id);
  if (!staff || staff.role === 'super_admin') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  staff.password = newPassword;
  await staff.save();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('reset_password', req.user, 'staff', staff._id, staff.fullName, {}, ip);

  res.json({ success: true, message: 'Password reset successfully' });
};

const getStaffLoginHistory = async (req, res) => {
  const staff = await User.findById(req.params.id).select('fullName loginHistory');
  if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
  res.json({ success: true, fullName: staff.fullName, loginHistory: staff.loginHistory });
};

const assignBranch = async (req, res) => {
  const { branch } = req.body;
  const staff = await User.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
  if (!staff || staff.role === 'super_admin') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  staff.branch = branch || null;
  await staff.save();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('assign_branch', req.user, 'staff', staff._id, staff.fullName, { branch }, ip);

  res.json({ success: true, message: 'Branch assigned successfully' });
};

module.exports = {
  createStaff, getAllStaff, getStaffById, updateStaff,
  suspendStaff, activateStaff, deleteStaff, restoreStaff,
  resetStaffPassword, getStaffLoginHistory, assignBranch
};
