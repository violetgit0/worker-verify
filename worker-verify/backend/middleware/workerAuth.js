const jwt = require('jsonwebtoken');
const Worker = require('../models/Worker');

const workerProtect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Not authorized – no token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'worker') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }
    const worker = await Worker.findById(decoded.workerId)
      .populate('branch', 'name code location resumptionTimeA resumptionTimeB attendanceRadiusM');
    if (!worker) {
      return res.status(401).json({ success: false, message: 'Worker not found' });
    }
    req.worker = worker;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

module.exports = { workerProtect };
