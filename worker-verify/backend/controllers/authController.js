const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const user = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }]
  });

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  if (!user.isActive) {
    return res.status(401).json({ success: false, message: 'Account suspended. Contact your administrator.' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';

  user.loginHistory.unshift({ timestamp: new Date(), ip, userAgent: ua });
  if (user.loginHistory.length > 20) user.loginHistory.length = 20;
  await user.save();

  ActivityLog.create({
    action: 'login',
    performedBy: user._id,
    performedByName: user.fullName,
    performedByRole: user.role,
    targetType: 'system',
    details: { ip, userAgent: ua },
    ip
  }).catch(() => {});

  const token = generateToken(user._id);

  res.json({
    success: true,
    token,
    user: {
      id:            user._id,
      fullName:      user.fullName,
      username:      user.username,
      email:         user.email,
      role:          user.role,
      branch:        user.branch,
      passportPhoto: user.passportPhoto
    }
  });
};

const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Both fields are required' });
  }

  const user = await User.findById(req.user._id);
  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully' });
};

module.exports = { login, getMe, changePassword };
