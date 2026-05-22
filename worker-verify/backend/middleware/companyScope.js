// Ensures req.companyId is set (already done by protect middleware)
const companyScope = (req, res, next) => {
  if (!req.companyId)
    return res.status(403).json({ success: false, message: 'Company context required' });
  next();
};

module.exports = { companyScope };
