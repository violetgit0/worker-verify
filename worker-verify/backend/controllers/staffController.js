const User = require('../models/User');
const Worker = require('../models/Worker');
const ActivityLog = require('../models/ActivityLog');
const { ROLE_DEFAULTS } = require('../config/permissions');

const log = (action, by, targetType, targetId, targetName, details = {}, ip = '') =>
  ActivityLog.create({
    company: by.company || null,
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
  try {
    const { fullName, username, email, phone, password, role, branch, accountNumber, bankName } = req.body;

    if (!fullName || !username || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'fullName, username, email, phone and password are required' });
    }

    const allowedRoles = ['branch_manager', 'hr_staff', 'attendance_officer', 'verification_officer', 'staff', 'company_admin'];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    const uname  = username.trim().toLowerCase();
    const uemail = email.trim().toLowerCase();
    const cid    = req.companyId;

    // Check active conflict within this company
    const activeConflict = await User.findOne({
      company: cid,
      isDeleted: { $ne: true },
      $or: [{ username: uname }, { email: uemail }]
    });
    if (activeConflict) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }

    // Check deleted conflict within this company
    const deletedConflict = await User.findOne({
      company: cid,
      isDeleted: true,
      $or: [{ deletedUsername: uname }, { deletedEmail: uemail }]
    });
    if (deletedConflict) {
      return res.status(409).json({
        success: false,
        message: `A deleted staff account (${deletedConflict.deletedUsername}) used this username or email. You can restore it instead.`,
        canRestore: true,
        deletedStaffId: deletedConflict._id,
        deletedStaffName: deletedConflict.fullName
      });
    }

    const resolvedRole = role || 'hr_staff';
    const data = {
      company:       cid,
      fullName:      fullName.trim(),
      username:      uname,
      email:         uemail,
      phone:         phone.trim(),
      password,
      role:          resolvedRole,
      branch:        branch || null,
      accountNumber: accountNumber || '',
      bankName:      bankName || '',
      permissions:   ROLE_DEFAULTS[resolvedRole] || {},
      createdBy:     req.user._id
    };

    if (req.file) {
      data.passportPhoto = req.file.path;
      console.log('[createStaff] Photo saved to MongoDB:', req.file.path);
    } else {
      console.log('[createStaff] No photo file in request');
    }

    const staff = await User.create(data);

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    log('create_staff', req.user, 'staff', staff._id, staff.fullName, { role: staff.role }, ip);

    res.status(201).json({
      success: true,
      message: 'Staff account created successfully',
      staff: { id: staff._id, fullName: staff.fullName, username: staff.username, role: staff.role }
    });
  } catch (err) {
    console.error('[createStaff]', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(400).json({ success: false, message: `Duplicate ${field} — this ${field} is already in use.` });
    }
    res.status(500).json({ success: false, message: err.message || 'Failed to create staff account' });
  }
};

const getAllStaff = async (req, res) => {
  try {
    const showDeleted = req.query.deleted === 'true';
    const filter = { company: req.companyId, role: { $nin: ['super_admin', 'company_admin'] } };
    if (showDeleted) {
      filter.isDeleted = true;
    } else {
      filter.isDeleted = { $ne: true };
    }

    const staff = await User.find(filter)
      .select('-password -loginHistory')
      .populate('branch', 'name code')
      .populate('createdBy', 'fullName')
      .populate('deletedBy', 'fullName')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: staff.length, staff });
  } catch (err) {
    console.error('[getAllStaff]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch staff' });
  }
};

const getStaffById = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.companyId) filter.company = req.companyId;

    const staff = await User.findOne(filter)
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
  } catch (err) {
    console.error('[getStaffById]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch staff' });
  }
};

const updateStaff = async (req, res) => {
  try {
    const { fullName, phone, role, branch, accountNumber, bankName } = req.body;
    const filter = { _id: req.params.id, isDeleted: { $ne: true } };
    if (req.companyId) filter.company = req.companyId;

    const staff = await User.findOne(filter);
    if (!staff || staff.role === 'super_admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    if (fullName !== undefined)      staff.fullName = fullName;
    if (phone !== undefined)         staff.phone = phone;
    if (role !== undefined && !['super_admin'].includes(role)) staff.role = role;
    if (branch !== undefined)        staff.branch = branch || null;
    if (accountNumber !== undefined) staff.accountNumber = accountNumber;
    if (bankName !== undefined)      staff.bankName = bankName;
    if (req.file) {
      staff.passportPhoto = req.file.path;
      console.log('[updateStaff] Photo updated in MongoDB:', req.file.path);
    }

    await staff.save();

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    log('update_staff', req.user, 'staff', staff._id, staff.fullName, {}, ip);

    res.json({ success: true, message: 'Staff updated successfully' });
  } catch (err) {
    console.error('[updateStaff]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update staff' });
  }
};

const suspendStaff = async (req, res) => {
  try {
    const { reason } = req.body;
    const filter = { _id: req.params.id, isDeleted: { $ne: true } };
    if (req.companyId) filter.company = req.companyId;

    const staff = await User.findOne(filter);
    if (!staff || staff.role === 'super_admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    staff.isActive    = false;
    staff.suspendedAt = new Date();
    staff.suspendedBy = req.user._id;
    staff.suspendReason = reason || '';
    await staff.save();

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    log('suspend_staff', req.user, 'staff', staff._id, staff.fullName, { reason }, ip);

    res.json({ success: true, message: 'Staff account suspended' });
  } catch (err) {
    console.error('[suspendStaff]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to suspend staff' });
  }
};

const activateStaff = async (req, res) => {
  try {
    const filter = { _id: req.params.id, isDeleted: { $ne: true } };
    if (req.companyId) filter.company = req.companyId;

    const staff = await User.findOne(filter);
    if (!staff || staff.role === 'super_admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    staff.isActive    = true;
    staff.suspendedAt = null;
    staff.suspendedBy = null;
    staff.suspendReason = '';
    await staff.save();

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    log('activate_staff', req.user, 'staff', staff._id, staff.fullName, {}, ip);

    res.json({ success: true, message: 'Staff account activated' });
  } catch (err) {
    console.error('[activateStaff]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to activate staff' });
  }
};

const deleteStaff = async (req, res) => {
  try {
    const filter = { _id: req.params.id, isDeleted: { $ne: true } };
    if (req.companyId) filter.company = req.companyId;

    const staff = await User.findOne(filter);
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

    res.json({ success: true, message: 'Staff account archived. It can be restored if needed.' });
  } catch (err) {
    console.error('[deleteStaff]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to archive staff' });
  }
};

const restoreStaff = async (req, res) => {
  try {
    const filter = { _id: req.params.id, isDeleted: true };
    if (req.companyId) filter.company = req.companyId;

    const staff = await User.findOne(filter);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Deleted staff not found' });
    }

    const uname  = staff.deletedUsername;
    const uemail = staff.deletedEmail;

    const conflictFilter = {
      company: staff.company,
      isDeleted: { $ne: true },
      _id: { $ne: staff._id },
      $or: [{ username: uname }, { email: uemail }]
    };
    const conflict = await User.findOne(conflictFilter);
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: `Cannot restore: username "${uname}" or email is already taken by another active account.`
      });
    }

    staff.username        = uname;
    staff.email           = uemail;
    staff.isDeleted       = false;
    staff.deletedAt       = null;
    staff.deletedBy       = null;
    staff.deletedUsername = '';
    staff.deletedEmail    = '';
    staff.isActive        = true;
    staff.suspendedAt     = null;
    staff.suspendedBy     = null;
    staff.suspendReason   = '';
    await staff.save();

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    log('restore_staff', req.user, 'staff', staff._id, staff.fullName, {}, ip);

    res.json({ success: true, message: `${staff.fullName}'s account has been restored and reactivated.` });
  } catch (err) {
    console.error('[restoreStaff]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to restore staff' });
  }
};

const resetStaffPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const filter = { _id: req.params.id };
    if (req.companyId) filter.company = req.companyId;

    const staff = await User.findOne(filter);
    if (!staff || staff.role === 'super_admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    staff.password = newPassword;
    await staff.save();

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    log('reset_password', req.user, 'staff', staff._id, staff.fullName, {}, ip);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('[resetStaffPassword]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to reset password' });
  }
};

const getStaffLoginHistory = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.companyId) filter.company = req.companyId;

    const staff = await User.findOne(filter).select('fullName loginHistory');
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    res.json({ success: true, fullName: staff.fullName, loginHistory: staff.loginHistory });
  } catch (err) {
    console.error('[getStaffLoginHistory]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch login history' });
  }
};

const assignBranch = async (req, res) => {
  try {
    const { branch } = req.body;
    const filter = { _id: req.params.id, isDeleted: { $ne: true } };
    if (req.companyId) filter.company = req.companyId;

    const staff = await User.findOne(filter);
    if (!staff || staff.role === 'super_admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    staff.branch = branch || null;
    await staff.save();

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    log('assign_branch', req.user, 'staff', staff._id, staff.fullName, { branch }, ip);

    res.json({ success: true, message: 'Branch assigned successfully' });
  } catch (err) {
    console.error('[assignBranch]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to assign branch' });
  }
};

const resetAllStaff = async (req, res) => {
  try {
    const confirmKey = req.body.confirm;
    if (confirmKey !== 'RESET_ALL_STAFF') {
      return res.status(400).json({
        success: false,
        message: 'Missing confirmation key. Send { confirm: "RESET_ALL_STAFF" } to proceed.'
      });
    }

    const filter = {
      role: { $nin: ['super_admin', 'company_admin'] }
    };
    if (req.companyId) filter.company = req.companyId;

    const toDelete = await User.find(filter).select('fullName username role');
    const count = toDelete.length;

    if (count === 0) {
      return res.json({ success: true, message: 'Nothing to delete — no staff accounts found.', deleted: 0 });
    }

    await User.deleteMany(filter);

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
    log('reset_all_staff', req.user, 'system', null, 'ALL STAFF',
      { deletedCount: count, deletedNames: toDelete.map(s => `${s.fullName} (${s.role})`) }, ip);

    res.json({
      success: true,
      message: `Deleted ${count} staff account(s). Only Admin remains.`,
      deleted: count
    });
  } catch (err) {
    console.error('[resetAllStaff]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to reset staff' });
  }
};

module.exports = {
  createStaff, getAllStaff, getStaffById, updateStaff,
  suspendStaff, activateStaff, deleteStaff, restoreStaff,
  resetStaffPassword, getStaffLoginHistory, assignBranch,
  resetAllStaff
};
