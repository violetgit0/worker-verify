const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'Not authenticated' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive)
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });

    req.user      = user;
    req.companyId = user.company;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = { protect };
