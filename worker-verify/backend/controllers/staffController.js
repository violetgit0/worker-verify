const User = require('../models/User');
const Worker = require('../models/Worker');

const createStaff = async (req, res) => {
  const { fullName, username, email, phone, password, accountNumber, bankName } = req.body;

  const exists = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
  });
  if (exists) {
    return res.status(400).json({ success: false, message: 'Username or email already exists' });
  }

  const data = {
    fullName, username, email, phone, password,
    role: 'staff',
    accountNumber: accountNumber || '',
    bankName: bankName || '',
    createdBy: req.user._id
  };

  if (req.file) data.passportPhoto = req.file.path;

  const staff = await User.create(data);

  res.status(201).json({
    success: true,
    message: 'Staff account created successfully',
    staff: { id: staff._id, fullName: staff.fullName, username: staff.username, email: staff.email }
  });
};

const getAllStaff = async (req, res) => {
  const staff = await User.find({ role: 'staff' }).select('-password').sort({ createdAt: -1 });
  res.json({ success: true, count: staff.length, staff });
};

const getStaffById = async (req, res) => {
  const staff = await User.findById(req.params.id).select('-password');
  if (!staff || staff.role !== 'staff') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  const workerCount = await Worker.countDocuments({ registeredBy: staff._id });
  res.json({ success: true, staff, workerCount });
};

const updateStaff = async (req, res) => {
  const { fullName, phone, accountNumber, bankName, isActive } = req.body;
  const staff = await User.findById(req.params.id);

  if (!staff || staff.role !== 'staff') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  if (fullName !== undefined)     staff.fullName = fullName;
  if (phone !== undefined)        staff.phone = phone;
  if (accountNumber !== undefined) staff.accountNumber = accountNumber;
  if (bankName !== undefined)     staff.bankName = bankName;
  if (isActive !== undefined)     staff.isActive = isActive;
  if (req.file)                   staff.passportPhoto = req.file.path;

  await staff.save();
  res.json({ success: true, message: 'Staff updated successfully' });
};

const deleteStaff = async (req, res) => {
  const staff = await User.findById(req.params.id);
  if (!staff || staff.role !== 'staff') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }
  await staff.deleteOne();
  res.json({ success: true, message: 'Staff account deleted' });
};

const resetStaffPassword = async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ success: false, message: 'New password is required' });
  }

  const staff = await User.findById(req.params.id);
  if (!staff || staff.role !== 'staff') {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  staff.password = newPassword;
  await staff.save();
  res.json({ success: true, message: 'Password reset successfully' });
};

module.exports = { createStaff, getAllStaff, getStaffById, updateStaff, deleteStaff, resetStaffPassword };
