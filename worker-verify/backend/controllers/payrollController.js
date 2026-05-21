const Payroll    = require('../models/Payroll');
const Deduction  = require('../models/Deduction');
const Attendance = require('../models/Attendance');
const Worker     = require('../models/Worker');
const { toMidnightUTC, workingDaysInMonth } = require('../utils/time');

const generatePayroll = async (req, res) => {
  try {
    const { month, year, branchId } = req.body;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }
    const m = parseInt(month);
    const y = parseInt(year);
    const cf = req.companyId ? { company: req.companyId } : {};

    const workerQuery = { ...cf, employmentStatus: { $in: ['active', 'suspended', 'on_leave'] } };
    if (branchId) workerQuery.branch = branchId;

    const workers = await Worker.find(workerQuery);
    if (!workers.length) {
      return res.status(404).json({ success: false, message: 'No eligible workers found' });
    }

    const dateStart   = toMidnightUTC(new Date(y, m - 1, 1));
    const dateEnd     = toMidnightUTC(new Date(y, m, 0));
    const workingDays = workingDaysInMonth(m, y);
    const created = [], updated = [], skipped = [];

    for (const worker of workers) {
      const existingPayroll = await Payroll.findOne({ ...cf, worker: worker._id, month: m, year: y });
      if (existingPayroll && existingPayroll.status === 'paid') { skipped.push(worker._id); continue; }

      const [attendance, deductions] = await Promise.all([
        Attendance.find({ ...cf, worker: worker._id, date: { $gte: dateStart, $lte: dateEnd } }),
        Deduction.find({ ...cf, worker: worker._id, month: m, year: y })
      ]);

      const daysPresent  = attendance.filter(a => a.status === 'present').length;
      const daysLate     = attendance.filter(a => a.status === 'late').length;
      const daysAbsent   = attendance.filter(a => a.status === 'absent').length;
      const daysOnLeave  = attendance.filter(a => a.status === 'on_leave').length;
      const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

      const monthlySalary = worker.monthlySalary || 0;
      const dailyRate     = worker.dailyRate || (monthlySalary ? monthlySalary / 26 : 0);
      const baseSalary    = monthlySalary;
      const netSalary     = Math.max(0, baseSalary - totalDeductions);

      const payrollData = {
        company: worker.company,
        worker: worker._id, branch: worker.branch || null,
        month: m, year: y,
        monthlySalary, dailyRate, workingDays,
        daysPresent, daysLate, daysAbsent, daysOnLeave,
        baseSalary, totalDeductions, netSalary, status: 'draft'
      };

      if (existingPayroll) {
        Object.assign(existingPayroll, payrollData);
        await existingPayroll.save();
        updated.push(worker._id);
      } else {
        await Payroll.create(payrollData);
        created.push(worker._id);
      }
    }

    res.json({
      success: true,
      message: `Payroll generated: ${created.length} created, ${updated.length} updated, ${skipped.length} skipped (paid)`,
      created: created.length, updated: updated.length, skipped: skipped.length
    });
  } catch (err) {
    console.error('[generatePayroll]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getPayroll = async (req, res) => {
  try {
    const { branch, month, year, status, page = 1, limit = 50 } = req.query;
    const query = {};
    if (req.companyId) query.company = req.companyId;
    if (branch) query.branch = branch;
    if (month)  query.month  = parseInt(month);
    if (year)   query.year   = parseInt(year);
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [payrolls, total] = await Promise.all([
      Payroll.find(query)
        .populate('worker', 'fullName phone passportPhoto shift')
        .populate('branch', 'name code')
        .populate('approvedBy', 'fullName')
        .sort({ year: -1, month: -1, createdAt: -1 })
        .skip(skip).limit(parseInt(limit)),
      Payroll.countDocuments(query)
    ]);
    res.json({ success: true, payrolls, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getWorkerPayroll = async (req, res) => {
  try {
    const workerId = req.worker?._id || req.params.workerId;
    const { year, page = 1, limit = 12 } = req.query;
    const query = { worker: workerId };
    if (req.companyId) query.company = req.companyId;
    if (year) query.year = parseInt(year);

    const payrolls = await Payroll.find(query)
      .populate('branch', 'name code')
      .sort({ year: -1, month: -1 })
      .limit(parseInt(limit));
    res.json({ success: true, payrolls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updatePayrollStatus = async (req, res) => {
  try {
    const { status, paymentRef, notes, overtimeHours, overtimeRate } = req.body;
    if (!['draft', 'approved', 'paid'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const filter = { _id: req.params.id };
    if (req.companyId) filter.company = req.companyId;
    const payroll = await Payroll.findOne(filter);
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });

    payroll.status = status;
    if (notes)      payroll.notes      = notes;
    if (paymentRef) payroll.paymentRef = paymentRef;
    if (status === 'approved') { payroll.approvedBy = req.user._id; payroll.approvedAt = new Date(); }
    if (status === 'paid')     { payroll.paidAt     = new Date(); }

    if (overtimeHours !== undefined || overtimeRate !== undefined) {
      payroll.overtimeHours  = overtimeHours ?? payroll.overtimeHours;
      payroll.overtimeRate   = overtimeRate  ?? payroll.overtimeRate;
      payroll.overtimeAmount = payroll.overtimeHours * payroll.overtimeRate;
      payroll.netSalary      = Math.max(0, payroll.baseSalary + payroll.overtimeAmount - payroll.totalDeductions);
    }

    await payroll.save();
    res.json({ success: true, message: `Payroll ${status}`, payroll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getPayrollSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year required' });
    }
    const m = parseInt(month), y = parseInt(year);
    const cf = req.companyId ? { company: req.companyId } : {};

    const [summary, branchSummary] = await Promise.all([
      Payroll.aggregate([
        { $match: { ...cf, month: m, year: y } },
        { $group: { _id: '$status', count: { $sum: 1 }, totalNetSalary: { $sum: '$netSalary' }, totalDeductions: { $sum: '$totalDeductions' } } }
      ]),
      Payroll.aggregate([
        { $match: { ...cf, month: m, year: y } },
        { $group: { _id: '$branch', totalNet: { $sum: '$netSalary' }, count: { $sum: 1 } } },
        { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
        { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, branchName: '$branch.name', branchCode: '$branch.code', totalNet: 1, count: 1 } }
      ])
    ]);

    const totals = { totalNetSalary: 0, totalDeductions: 0 };
    summary.forEach(s => {
      totals[s._id]          = s.totalNetSalary;
      totals.totalNetSalary  += s.totalNetSalary;
      totals.totalDeductions += s.totalDeductions;
    });

    res.json({ success: true, totals, byStatus: summary, byBranch: branchSummary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { generatePayroll, getPayroll, getWorkerPayroll, updatePayrollStatus, getPayrollSummary };
