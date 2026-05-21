const { ROLE_DEFAULTS } = require('../config/permissions');

const ADMIN_ROLES = ['super_admin', 'company_admin'];

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Your role '${req.user.role}' is not permitted to perform this action`
    });
  }
  next();
};

// Permission-based middleware. super_admin and company_admin always pass.
const hasPermission = (...permKeys) => (req, res, next) => {
  if (ADMIN_ROLES.includes(req.user.role)) return next();

  const perms = req.user.permissions ? req.user.permissions.toObject() : {};
  const hasAnySet = Object.values(perms).some(v => v === true);
  const effective = hasAnySet ? perms : (ROLE_DEFAULTS[req.user.role] || {});

  const allowed = permKeys.some(k => effective[k] === true);
  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action'
    });
  }
  next();
};

const branchRestrict = (req, res, next) => {
  const user = req.user;
  const perms = user.permissions ? user.permissions.toObject() : {};
  const restricted = user.role === 'branch_manager' ||
    (perms.canOnlyViewAssignedBranch === true && perms.canViewAllBranches !== true);

  if (restricted && user.branch) {
    req.branchFilter = { branch: user.branch };
  } else {
    req.branchFilter = {};
  }
  next();
};

module.exports = { authorize, hasPermission, branchRestrict, ADMIN_ROLES };
