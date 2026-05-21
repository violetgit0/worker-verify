const Company = require('../models/Company');

/**
 * Resolves and validates the company for the authenticated user.
 * Sets req.companyId and req.company on the request.
 *
 * Skipped entirely for platform super_admin (company === null).
 * Called AFTER protect middleware.
 */
const companyScope = async (req, res, next) => {
  try {
    // Platform super_admin operates without company context on regular routes
    if (req.user.role === 'super_admin' && !req.user.company) {
      req.companyId = null;
      req.company   = null;
      return next();
    }

    const companyId = req.user.company;
    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: 'No company associated with this account. Contact platform support.'
      });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(403).json({ success: false, message: 'Company not found' });
    }

    if (!company.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your company account has been suspended. Contact support.'
      });
    }

    // Check subscription / trial expiry
    if (company.plan === 'trial' && company.trialEndsAt && new Date() > company.trialEndsAt) {
      return res.status(402).json({
        success: false,
        message: 'Your free trial has expired. Please upgrade your plan to continue.',
        code: 'TRIAL_EXPIRED'
      });
    }

    if (company.plan !== 'trial' && company.subscriptionEndsAt && new Date() > company.subscriptionEndsAt) {
      return res.status(402).json({
        success: false,
        message: 'Your subscription has expired. Please renew to continue.',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    req.companyId = company._id;
    req.company   = company;
    next();
  } catch (err) {
    console.error('[companyScope]', err);
    res.status(500).json({ success: false, message: 'Company verification failed' });
  }
};

/**
 * Enforces a resource limit.
 * Usage: enforceLimit('workers', 'maxWorkers')
 */
const enforceLimit = (Model, limitField) => async (req, res, next) => {
  try {
    if (!req.companyId || !req.company) return next();
    const limit = req.company[limitField];
    if (!limit || limit === -1) return next();
    const count = await Model.countDocuments({ company: req.companyId });
    if (count >= limit) {
      return res.status(402).json({
        success: false,
        message: `You have reached the ${limitField.replace('max', '')} limit (${limit}) for your plan. Please upgrade.`,
        code: 'PLAN_LIMIT_REACHED'
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { companyScope, enforceLimit };
