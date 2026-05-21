const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');
const ActivityLog = require('../models/ActivityLog');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const login = async (req, res) => {
  try {
    const { username, password, companySlug } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    let companyId = null;
    let company   = null;

    if (companySlug) {
      company = await Company.findOne({ slug: companySlug.toLowerCase().trim() });
      if (!company) {
        return res.status(401).json({ success: false, message: 'Company not found. Check your company ID.' });
      }
      if (!company.isActive) {
        return res.status(401).json({ success: false, message: 'This company account is suspended.' });
      }
      companyId = company._id;
    }

    // Find user — if companySlug provided, scope to that company; otherwise look for platform super_admin
    let user;
    if (companyId) {
      user = await User.findOne({
        company: companyId,
        $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }],
        isDeleted: { $ne: true }
      });
    } else {
      // No slug — only super_admin (platform level, company: null) can log in this way
      user = await User.findOne({
        company: null,
        role: 'super_admin',
        $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }]
      });
    }

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
      company:         user.company || null,
      action:          'login',
      performedBy:     user._id,
      performedByName: user.fullName,
      performedByRole: user.role,
      targetType:      'system',
      details:         { ip, userAgent: ua },
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
        company:       user.company,
        branch:        user.branch,
        passportPhoto: user.passportPhoto
      },
      company: company ? {
        id:       company._id,
        name:     company.name,
        slug:     company.slug,
        plan:     company.plan,
        branding: company.branding
      } : null
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ success: false, message: err.message || 'Login failed' });
  }
};

const getMe = async (req, res) => {
  try {
    let companyData = null;
    if (req.user.company) {
      companyData = await Company.findById(req.user.company).select('name slug plan planStatus branding trialEndsAt subscriptionEndsAt');
    }
    res.json({ success: true, user: req.user, company: companyData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const changePassword = async (req, res) => {
  try {
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
  } catch (err) {
    console.error('[changePassword]', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to change password' });
  }
};

module.exports = { login, getMe, changePassword };
