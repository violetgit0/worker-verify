const Company = require('../models/Company');
const User    = require('../models/User');
const Worker  = require('../models/Worker');
const Plan    = require('../models/Plan');
const ActivityLog = require('../models/ActivityLog');

const log = (action, by, targetId, targetName, details = {}) =>
  ActivityLog.create({
    company:         null,
    action,
    performedBy:     by._id,
    performedByName: by.fullName,
    performedByRole: by.role,
    targetType:      'company',
    targetId,
    targetName,
    details
  }).catch(() => {});

// ── Companies ───────────────────────────────────────────────────────────────

const getAllCompanies = async (req, res) => {
  try {
    const { status, plan, q } = req.query;
    const filter = {};
    if (status === 'active')    filter.isActive = true;
    if (status === 'suspended') filter.isActive = false;
    if (plan) filter.plan = plan;
    if (q) filter.name = { $regex: q, $options: 'i' };

    const companies = await Company.find(filter)
      .sort({ createdAt: -1 })
      .populate('adminUser', 'fullName email');

    // Attach worker + staff counts per company
    const ids = companies.map(c => c._id);
    const [workerCounts, staffCounts] = await Promise.all([
      Worker.aggregate([
        { $match: { company: { $in: ids } } },
        { $group: { _id: '$company', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $match: { company: { $in: ids }, role: { $ne: 'super_admin' }, isDeleted: { $ne: true } } },
        { $group: { _id: '$company', count: { $sum: 1 } } }
      ])
    ]);

    const wMap = {}, sMap = {};
    workerCounts.forEach(x => { wMap[x._id.toString()] = x.count; });
    staffCounts.forEach(x  => { sMap[x._id.toString()] = x.count; });

    const data = companies.map(c => ({
      ...c.toObject(),
      workerCount: wMap[c._id.toString()] || 0,
      staffCount:  sMap[c._id.toString()] || 0
    }));

    res.json({ success: true, count: data.length, companies: data });
  } catch (err) {
    console.error('[getAllCompanies]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).populate('adminUser', 'fullName email username');
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const [workerCount, staffCount, branchCount] = await Promise.all([
      Worker.countDocuments({ company: company._id }),
      User.countDocuments({ company: company._id, isDeleted: { $ne: true } }),
      require('../models/Branch').countDocuments({ company: company._id })
    ]);

    res.json({ success: true, company, stats: { workerCount, staffCount, branchCount } });
  } catch (err) {
    console.error('[getCompanyById]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const suspendCompany = async (req, res) => {
  try {
    const { reason } = req.body;
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    company.isActive     = false;
    company.suspendedAt  = new Date();
    company.suspendedBy  = req.user._id;
    company.suspendReason= reason || '';
    await company.save();

    log('suspend_company', req.user, company._id, company.name, { reason });
    res.json({ success: true, message: `${company.name} has been suspended` });
  } catch (err) {
    console.error('[suspendCompany]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const activateCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    company.isActive    = true;
    company.suspendedAt = null;
    company.suspendedBy = null;
    company.suspendReason = '';
    await company.save();

    log('activate_company', req.user, company._id, company.name);
    res.json({ success: true, message: `${company.name} has been activated` });
  } catch (err) {
    console.error('[activateCompany]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateCompanySubscription = async (req, res) => {
  try {
    const { plan, planStatus, subscriptionEndsAt, maxWorkers, maxBranches, maxStaff } = req.body;
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    if (plan)               company.plan               = plan;
    if (planStatus)         company.planStatus         = planStatus;
    if (subscriptionEndsAt) company.subscriptionEndsAt = new Date(subscriptionEndsAt);
    if (subscriptionEndsAt) company.subscriptionStartAt = new Date();
    if (maxWorkers  !== undefined) company.maxWorkers  = maxWorkers;
    if (maxBranches !== undefined) company.maxBranches = maxBranches;
    if (maxStaff    !== undefined) company.maxStaff    = maxStaff;

    await company.save();
    log('update_subscription', req.user, company._id, company.name, { plan, planStatus });
    res.json({ success: true, message: 'Subscription updated', company });
  } catch (err) {
    console.error('[updateCompanySubscription]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Platform analytics ───────────────────────────────────────────────────────

const getPlatformStats = async (_req, res) => {
  try {
    const [
      totalCompanies, activeCompanies, trialCompanies,
      totalWorkers, totalUsers
    ] = await Promise.all([
      Company.countDocuments(),
      Company.countDocuments({ isActive: true }),
      Company.countDocuments({ plan: 'trial', isActive: true }),
      Worker.countDocuments(),
      User.countDocuments({ role: { $ne: 'super_admin' }, isDeleted: { $ne: true } })
    ]);

    const planBreakdown = await Company.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);

    const recentCompanies = await Company.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name slug plan createdAt isActive');

    res.json({
      success: true,
      stats: {
        totalCompanies, activeCompanies, trialCompanies,
        paidCompanies:  activeCompanies - trialCompanies,
        totalWorkers,   totalUsers,
        planBreakdown:  planBreakdown.reduce((acc, p) => { acc[p._id] = p.count; return acc; }, {})
      },
      recentCompanies
    });
  } catch (err) {
    console.error('[getPlatformStats]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Plans management ─────────────────────────────────────────────────────────

const getPlans    = async (_req, res) => {
  try {
    const plans = await Plan.find().sort({ sortOrder: 1 });
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createPlan  = async (req, res) => {
  try {
    const plan = await Plan.create(req.body);
    res.status(201).json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updatePlan  = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Platform activity logs ───────────────────────────────────────────────────

const getPlatformLogs = async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
    const skip   = parseInt(req.query.skip) || 0;
    const logs   = await ActivityLog.find({ company: null })
      .sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('performedBy', 'fullName');
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllCompanies, getCompanyById, suspendCompany, activateCompany,
  updateCompanySubscription, getPlatformStats,
  getPlans, createPlan, updatePlan, getPlatformLogs
};
