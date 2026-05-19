const User = require('../models/User');
const Worker = require('../models/Worker');
const ActivityLog = require('../models/ActivityLog');

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

  const exists = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
  });
  if (exists) {
    return res.status(400).json({ success: false, message: 'Username or email already exists' });
  }

  const data = {
    fullName, username, email, phone, password,
    role: role || 'hr_staff',
    branch: branch || null,
    accountNumber: accountNumber || '',
    bankName: bankName || '',
    createdBy: req.user._id
  };

  if (req.file) data.passportPhoto = req.file.path;

  const staff = await User.create(data);

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('create_staff', req.user, 'staff', staff._id, staff.fullName,
    { role: staff.role }, ip);

  res.status(201).json({
    success: true,
    message: 'Staff account created successfully',
    staff: { id: staff._id, fullName: staff.fullName, username: staff.username, role: staff.role }
  });
};

const getAllStaff = async (req, res) => {
  const filter = { role: { $ne: 'super_admin' } };
  const staff = await User.find(filter)
    .select('-password -loginHistory')
    .populate('branch', 'name code')
    .populate('createdBy', 'fullName')
    .sort({ createdAt: -1 });
  res.json({ success: true, count: staff.length, staff });
};

const getStaffById = async (req, res) => {
  const staff = await User.findById(req.params.id)
    .select('-password')
    .populate('branch', 'name code')
    .populate('createdBy', 'fullName')
    .populate('suspendedBy', 'fullName');

  if (!staff || staff.role === 'super_admin') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  const workerCount = await Worker.countDocuments({ registeredBy: staff._id });
  res.json({ success: true, staff, workerCount });
};

const updateStaff = async (req, res) => {
  const { fullName, phone, role, branch, accountNumber, bankName } = req.body;
  const staff = await User.findById(req.params.id);

  if (!staff || staff.role === 'super_admin') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  if (fullName !== undefined)     staff.fullName = fullName;
  if (phone !== undefined)        staff.phone = phone;
  if (role !== undefined && role !== 'super_admin') staff.role = role;
  if (branch !== undefined)       staff.branch = branch || null;
  if (accountNumber !== undefined) staff.accountNumber = accountNumber;
  if (bankName !== undefined)     staff.bankName = bankName;
  if (req.file)                   staff.passportPhoto = req.file.path;

  await staff.save();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('update_staff', req.user, 'staff', staff._id, staff.fullName, {}, ip);

  res.json({ success: true, message: 'Staff updated successfully' });
};

const suspendStaff = async (req, res) => {
  const { reason } = req.body;
  const staff = await User.findById(req.params.id);

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
  const staff = await User.findById(req.params.id);

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

const deleteStaff = async (req, res) => {
  const staff = await User.findById(req.params.id);
  if (!staff || staff.role === 'super_admin') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }
  await staff.deleteOne();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('delete_staff', req.user, 'staff', staff._id, staff.fullName, {}, ip);

  res.json({ success: true, message: 'Staff account deleted' });
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
  const staff = await User.findById(req.params.id);
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
  suspendStaff, activateStaff, deleteStaff,
  resetStaffPassword, getStaffLoginHistory, assignBranch
};
