const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Your role '${req.user.role}' is not permitted to perform this action`
    });
  }
  next();
};

// Restricts branch_manager to workers in their assigned branch only.
// Attaches req.branchFilter so controllers can apply it.
const branchRestrict = (req, res, next) => {
  if (req.user.role === 'branch_manager' && req.user.branch) {
    req.branchFilter = { branch: req.user.branch };
  } else {
    req.branchFilter = {};
  }
  next();
};

module.exports = { authorize, branchRestrict };
