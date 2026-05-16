const Worker     = require('../models/Worker');
const User       = require('../models/User');
const Branch     = require('../models/Branch');
const Attendance = require('../models/Attendance');
const Payroll    = require('../models/Payroll');
const VerificationLog = require('../models/VerificationLog');
const { toMidnightUTC } = require('../utils/time');

const getAdminStats = async (req, res) => {
  const today = toMidnightUTC();
  const now   = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear  = now.getFullYear();

  const [
    totalWorkers,
    verifiedWorkers,
    pendingWorkers,
    rejectedWorkers,
    activeWorkers,
    suspendedWorkers,
    sackedWorkers,
    onLeaveWorkers,
    totalBranches,
    totalStaff,
    recentWorkers,
    recentLogs,
    branchBreakdown,
    shiftBreakdown,
    todayPresent,
    todayAbsent,
    todayLate,
    monthPayrollTotal
  ] = await Promise.all([
    Worker.countDocuments(),
    Worker.countDocuments({ verificationStatus: 'verified' }),
    Worker.countDocuments({ verificationStatus: 'pending' }),
    Worker.countDocuments({ verificationStatus: 'rejected' }),
    Worker.countDocuments({ employmentStatus: 'active' }),
    Worker.countDocuments({ employmentStatus: 'suspended' }),
    Worker.countDocuments({ employmentStatus: 'sacked' }),
    Worker.countDocuments({ employmentStatus: 'on_leave' }),
    Branch.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'staff', isActive: true }),
    Worker.find().sort({ createdAt: -1 }).limit(8)
      .populate('registeredBy', 'fullName')
      .populate('branch', 'name code'),
    VerificationLog.find().sort({ createdAt: -1 }).limit(10)
      .populate('worker', 'fullName')
      .populate('performedBy', 'fullName role'),
    Worker.aggregate([
      { $match: { branch: { $ne: null } } },
      { $group: { _id: '$branch', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$employmentStatus', 'active'] }, 1, 0] } } } },
      { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
      { $unwind: '$branch' },
      { $project: { _id: 1, name: '$branch.name', code: '$branch.code', total: 1, active: 1 } },
      { $sort: { total: -1 } }
    ]),
    Worker.aggregate([{ $group: { _id: '$shift', count: { $sum: 1 } } }]),
    Attendance.countDocuments({ date: today, status: { $in: ['present','late'] } }),
    Attendance.countDocuments({ date: today, status: 'absent' }),
    Attendance.countDocuments({ date: today, status: 'late' }),
    Payroll.aggregate([
      { $match: { month: thisMonth, year: thisYear } },
      { $group: { _id: null, total: { $sum: '$netSalary' }, count: { $sum: 1 } } }
    ])
  ]);

  const shiftMap = {};
  shiftBreakdown.forEach(s => { shiftMap[s._id] = s.count; });

  res.json({
    success: true,
    stats: {
      totalWorkers, verifiedWorkers, pendingWorkers, rejectedWorkers,
      activeWorkers, suspendedWorkers, sackedWorkers, onLeaveWorkers,
      totalBranches, totalStaff,
      shiftA: shiftMap['A'] || 0,
      shiftB: shiftMap['B'] || 0,
      unassignedShift: shiftMap['unassigned'] || 0,
      todayPresent, todayAbsent, todayLate,
      monthPayrollTotal: monthPayrollTotal[0]?.total || 0,
      monthPayrollCount: monthPayrollTotal[0]?.count || 0
    },
    recentWorkers,
    recentLogs,
    branchBreakdown
  });
};

const getStaffStats = async (req, res) => {
  const id = req.user._id;
  const [total, verified, pending, rejected, recentWorkers] = await Promise.all([
    Worker.countDocuments({ registeredBy: id }),
    Worker.countDocuments({ registeredBy: id, verificationStatus: 'verified' }),
    Worker.countDocuments({ registeredBy: id, verificationStatus: 'pending' }),
    Worker.countDocuments({ registeredBy: id, verificationStatus: 'rejected' }),
    Worker.find({ registeredBy: id }).sort({ createdAt: -1 }).limit(8)
      .populate('branch', 'name code')
  ]);

  res.json({
    success: true,
    stats: { total, verified, pending, rejected },
    recentWorkers
  });
};

module.exports = { getAdminStats, getStaffStats };
