const jwt     = require('jsonwebtoken');
const Company = require('../models/Company');
const User    = require('../models/User');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });

const register = async (req, res) => {
  try {
    const { companyName, companySlug, email, fullName, username, password, phone } = req.body;
    if (!companyName || !companySlug || !fullName || !username || !password)
      return res.status(400).json({ success: false, message: 'All required fields must be provided' });

    const slug = companySlug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (await Company.findOne({ slug }))
      return res.status(400).json({ success: false, message: 'Company ID is already taken' });

    const resolvedEmail = email?.trim() || `${username.trim().toLowerCase()}@${slug}.local`;
    const company = await Company.create({ name: companyName.trim(), slug, email: resolvedEmail, phone: phone || '' });
    const admin   = await User.create({
      company: company._id,
      fullName: fullName.trim(), username: username.trim().toLowerCase(),
      email: resolvedEmail.toLowerCase(), password, phone: phone || '', role: 'company_admin'
    });

    const token = signToken(admin._id);
    res.status(201).json({
      success: true, token,
      user:    { _id: admin._id, fullName: admin.fullName, username: admin.username, role: admin.role },
      company: { _id: company._id, name: company.name, slug: company.slug }
    });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Username or email already in use' });
    res.status(500).json({ success: false, message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { companySlug, username, password } = req.body;
    if (!companySlug || !username || !password)
      return res.status(400).json({ success: false, message: 'Company ID, username, and password are required' });

    const company = await Company.findOne({ slug: companySlug.toLowerCase() });
    if (!company || !company.isActive)
      return res.status(401).json({ success: false, message: 'Company not found or inactive' });

    const user = await User.findOne({ company: company._id, username: username.toLowerCase(), isActive: true });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid username or password' });

    const token = signToken(user._id);
    res.json({
      success: true, token,
      user:    { _id: user._id, fullName: user.fullName, username: user.username, email: user.email, role: user.role, branch: user.branch, photo: user.photo },
      company: { _id: company._id, name: company.name, slug: company.slug, branding: company.branding }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user    = await User.findById(req.user._id).select('-password').populate('branch', 'name code');
    const company = await Company.findById(req.user.company);
    res.json({ success: true, user, company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(currentPassword)))
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const lookupCompany = async (req, res) => {
  try {
    const company = await Company.findOne({ slug: req.params.slug.toLowerCase(), isActive: true }).select('name slug branding');
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { register, login, getMe, changePassword, lookupCompany };
