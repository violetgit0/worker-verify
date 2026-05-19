const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { PERMISSIONS, PRESETS } = require('../config/permissions');

const log = (action, by, targetId, targetName, details, ip) =>
  ActivityLog.create({
    action,
    performedBy: by._id,
    performedByName: by.fullName,
    performedByRole: by.role,
    targetType: 'staff',
    targetId,
    targetName,
    details,
    ip
  }).catch(() => {});

const updatePermissions = async (req, res) => {
  const staff = await User.findById(req.params.id);
  if (!staff || staff.role === 'super_admin') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  const { permissions } = req.body;
  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ success: false, message: 'permissions object required' });
  }

  const changed = {};
  for (const key of PERMISSIONS) {
    if (key in permissions) {
      staff.permissions[key] = Boolean(permissions[key]);
      changed[key] = Boolean(permissions[key]);
    }
  }
  await staff.save();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('update_permissions', req.user, staff._id, staff.fullName, { changed }, ip);

  res.json({ success: true, message: 'Permissions updated', permissions: staff.permissions });
};

const applyPreset = async (req, res) => {
  const { preset } = req.params;
  if (!PRESETS[preset]) {
    return res.status(400).json({ success: false, message: 'Invalid preset. Use: fullHR, attendance, verification, none' });
  }

  const staff = await User.findById(req.params.id);
  if (!staff || staff.role === 'super_admin') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  for (const [key, val] of Object.entries(PRESETS[preset])) {
    staff.permissions[key] = val;
  }
  await staff.save();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  log('apply_permission_preset', req.user, staff._id, staff.fullName, { preset }, ip);

  res.json({ success: true, message: `Preset "${preset}" applied`, permissions: staff.permissions });
};

module.exports = { updatePermissions, applyPreset };
