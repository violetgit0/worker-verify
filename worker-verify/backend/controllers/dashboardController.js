const Worker     = require('../models/Worker');
const Attendance = require('../models/Attendance');
const DailySales = require('../models/DailySales');
const Shortage   = require('../models/Shortage');
const Branch     = require('../models/Branch');

function toMidnight(d) { const dt = d ? new Date(d) : new Date(); dt.setHours(0,0,0,0); return dt; }

const getDashboard = async (req, res) => {
  try {
    const cid   = req.companyId;
    const today = toMidnight();
    const m     = today.getMonth();
    const y     = today.getFullYear();
    const monthStart = toMidnight(new Date(y, m, 1));
    const monthEnd   = toMidnight(new Date(y, m + 1, 0));

    const [
      totalWorkers, activeWorkers, pendingWorkers,
      todayPresent, todayLate, todayAbsent,
      pendingShortages, branches,
      todaySales
    ] = await Promise.all([
      Worker.countDocuments({ company: cid }),
      Worker.countDocuments({ company: cid, status: 'active' }),
      Worker.countDocuments({ company: cid, status: 'pending' }),
      Attendance.countDocuments({ company: cid, date: today, status: 'present' }),
      Attendance.countDocuments({ company: cid, date: today, status: 'late' }),
      Attendance.countDocuments({ company: cid, date: today, status: 'absent' }),
      Shortage.countDocuments({ company: cid, status: 'pending' }),
      Branch.find({ company: cid, isActive: true }).select('name'),
      DailySales.aggregate([
        { $match: { company: cid, date: today } },
        { $group: { _id: null, total: { $sum: '$totalSales' }, cash: { $sum: '$cashSales' }, pos: { $sum: '$posSales' }, transfer: { $sum: '$transferSales' } } }
      ])
    ]);

    // Month sales
    const monthSalesAgg = await DailySales.aggregate([
      { $match: { company: cid, date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$totalSales' } } }
    ]);

    // Recent activity: last 5 clock-ins today
    const recentActivity = await Attendance.find({ company: cid, date: today, clockInTime: { $ne: null } })
      .populate('worker', 'fullName photo')
      .populate('branch', 'name')
      .sort({ clockInTime: -1 }).limit(5);

    // Branch summaries
    const branchIds = branches.map(b => b._id);
    const branchAttendance = await Attendance.aggregate([
      { $match: { company: cid, branch: { $in: branchIds }, date: today } },
      { $group: { _id: '$branch', present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } } } }
    ]);
    const branchMap = {};
    branchAttendance.forEach(b => { branchMap[b._id.toString()] = b; });

    const branchSummaries = await Promise.all(branches.map(async (b) => {
      const wCount = await Worker.countDocuments({ company: cid, branch: b._id, status: 'active' });
      const att    = branchMap[b._id.toString()];
      return { _id: b._id, name: b.name, workers: wCount, present: att?.present || 0, absent: att?.absent || 0 };
    }));

    res.json({
      success: true,
      stats: {
        totalWorkers, activeWorkers, pendingWorkers,
        todayPresent: todayPresent + todayLate,
        todayLate, todayAbsent,
        pendingShortages,
        todaySales: todaySales[0]?.total || 0,
        todayCash:  todaySales[0]?.cash  || 0,
        todayPOS:   todaySales[0]?.pos   || 0,
        todayTransfer: todaySales[0]?.transfer || 0,
        monthSales: monthSalesAgg[0]?.total || 0
      },
      branchSummaries,
      recentActivity
    });
  } catch (err) {
    console.error('[getDashboard]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getDashboard };
