const Company = require('../models/Company');
const User    = require('../models/User');
const Plan    = require('../models/Plan');
const ActivityLog = require('../models/ActivityLog');
const { ROLE_DEFAULTS } = require('../config/permissions');

// Slug: lowercase, alphanumeric + hyphens
const toSlug = (name) =>
  name.trim().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);

// ── Public: Register new company ────────────────────────────────────────────

const registerCompany = async (req, res) => {
  try {
    const {
      companyName, companyEmail, companyPhone, companyAddress, industry,
      planKey,
      adminFullName, adminUsername, adminEmail, adminPhone, adminPassword
    } = req.body;

    if (!companyName || !companyEmail || !adminFullName || !adminUsername || !adminEmail || !adminPhone || !adminPassword) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided' });
    }

    if (adminPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Admin password must be at least 6 characters' });
    }

    // Resolve plan limits
    const planDetails = await Plan.findOne({ key: planKey || 'trial', isActive: true });
    const plan = planKey || 'trial';
    const maxWorkers  = planDetails?.maxWorkers  ?? 20;
    const maxBranches = planDetails?.maxBranches ?? 2;
    const maxStaff    = planDetails?.maxStaff    ?? 5;

    // Generate unique slug
    let slug = toSlug(companyName);
    const existing = await Company.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    // Check company email not already used
    const emailUsed = await Company.findOne({ email: companyEmail.toLowerCase().trim() });
    if (emailUsed) {
      return res.status(400).json({ success: false, message: 'A company with this email already exists' });
    }

    // Create company
    const company = await Company.create({
      name:        companyName.trim(),
      slug,
      email:       companyEmail.toLowerCase().trim(),
      phone:       companyPhone  || '',
      address:     companyAddress || '',
      industry:    industry || '',
      plan,
      maxWorkers,
      maxBranches,
      maxStaff,
      trialEndsAt: plan === 'trial' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null
    });

    // Check admin username/email not used within this company (edge case: first user, always fine)
    const uname  = adminUsername.trim().toLowerCase();
    const uemail = adminEmail.trim().toLowerCase();

    // Create company admin user
    const adminUser = await User.create({
      company:     company._id,
      fullName:    adminFullName.trim(),
      username:    uname,
      email:       uemail,
      phone:       adminPhone.trim(),
      password:    adminPassword,
      role:        'company_admin',
      permissions: ROLE_DEFAULTS['company_admin'] || {}
    });

    // Link admin to company
    company.adminUser = adminUser._id;
    await company.save();

    ActivityLog.create({
      company:         company._id,
      action:          'company_registered',
      performedBy:     adminUser._id,
      performedByName: adminUser.fullName,
      performedByRole: adminUser.role,
      targetType:      'company',
      targetId:        company._id,
      targetName:      company.name,
      details:         { plan, slug }
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Company registered successfully. You can now log in.',
      company: { id: company._id, name: company.name, slug: company.slug, plan },
      admin:   { id: adminUser._id, username: adminUser.username, email: adminUser.email }
    });
  } catch (err) {
    console.error('[registerCompany]', err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Username or email already in use for this company' });
    }
    res.status(500).json({ success: false, message: err.message || 'Registration failed' });
  }
};

// ── Company profile ─────────────────────────────────────────────────────────

const getCompanyProfile = async (req, res) => {
  try {
    const company = await Company.findById(req.companyId).select('-billing.customerId -billing.subscriptionId');
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateCompanyProfile = async (req, res) => {
  try {
    const { name, phone, address, industry, website, country } = req.body;
    const company = await Company.findById(req.companyId);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    if (name    !== undefined) company.name    = name.trim();
    if (phone   !== undefined) company.phone   = phone;
    if (address !== undefined) company.address = address;
    if (industry!== undefined) company.industry= industry;
    if (website !== undefined) company.website = website;
    if (country !== undefined) company.country = country;

    // Logo via Cloudinary upload
    if (req.file) company.branding.logo = req.file.path;

    await company.save();
    res.json({ success: true, message: 'Company profile updated', company });
  } catch (err) {
    console.error('[updateCompanyProfile]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateBranding = async (req, res) => {
  try {
    const { primaryColor, accentColor } = req.body;
    const company = await Company.findById(req.companyId);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    if (primaryColor) company.branding.primaryColor = primaryColor;
    if (accentColor)  company.branding.accentColor  = accentColor;
    if (req.file)     company.branding.logo         = req.file.path;

    await company.save();
    res.json({ success: true, message: 'Branding updated', branding: company.branding });
  } catch (err) {
    console.error('[updateBranding]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Public: lookup company by slug (for login page) ─────────────────────────

const lookupCompany = async (req, res) => {
  try {
    const { slug } = req.params;
    const company = await Company.findOne({ slug: slug.toLowerCase(), isActive: true })
      .select('name slug branding plan planStatus');
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Public: list active plans ────────────────────────────────────────────────

const getPlans = async (_req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 });
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  registerCompany, getCompanyProfile, updateCompanyProfile,
  updateBranding, lookupCompany, getPlans
};
