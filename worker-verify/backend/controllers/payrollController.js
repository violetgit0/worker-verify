const Payroll    = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const Shortage   = require('../models/Shortage');
const Worker     = require('../models/Worker');

function toMidnight(d) { const dt = new Date(d); dt.setHours(0,0,0,0); return dt; }

const generatePayroll = async (req, res) => {
  try {
    const { month, year, branchId } = req.body;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });
    const m = parseInt(month), y = parseInt(year);

    const wq = { company: req.companyId, status: { $in: ['active', 'suspended'] } };
    if (branchId) wq.branch = branchId;
    const workers = await Worker.find(wq);
    if (!workers.length) return res.status(404).json({ success: false, message: 'No workers found' });

    const dateStart = toMidnight(new Date(y, m - 1, 1));
    const dateEnd   = toMidnight(new Date(y, m, 0));
    const created = [], updated = [], skipped = [];

    for (const worker of workers) {
      const existing = await Payroll.findOne({ company: req.companyId, worker: worker._id, month: m, year: y });
      if (existing?.status === 'paid') { skipped.push(worker._id); continue; }

      const [attendance, shortages] = await Promise.all([
        Attendance.find({ company: req.companyId, worker: worker._id, date: { $gte: dateStart, $lte: dateEnd } }),
        Shortage.find({ company: req.companyId, worker: worker._id, status: 'approved',
          date: { $gte: dateStart, $lte: dateEnd } })
      ]);

      const daysPresent = attendance.filter(a => a.status === 'present').length;
      const daysLate    = attendance.filter(a => a.status === 'late').length;
      const daysAbsent  = attendance.filter(a => a.status === 'absent').length;
      const daysOff     = attendance.filter(a => a.status === 'off_day').length;
      const daysWorked  = daysPresent + daysLate;

      const base     = worker.salary || 0;
      const dailyRate = base ? base / 26 : 0;

      const deductions = [];
      let totalDed = 0;

      // Absence deductions
      if (daysAbsent > 0 && dailyRate > 0) {
        const amt = Math.round(dailyRate * daysAbsent);
        deductions.push({ type: 'absence', amount: amt, reason: `${daysAbsent} day(s) absent` });
        totalDed += amt;
      }

      // Lateness: 1/4 daily rate per late day
      if (daysLate > 0 && dailyRate > 0) {
        const amt = Math.round((dailyRate / 4) * daysLate);
        deductions.push({ type: 'lateness', amount: amt, reason: `${daysLate} late arrival(s)` });
        totalDed += amt;
      }

      // Approved shortages
      shortages.forEach(s => {
        deductions.push({ type: 'shortage', amount: s.amount, reason: s.reason || 'Shortage', date: s.date });
        totalDed += s.amount;
      });

      const netSalary = Math.max(0, base - totalDed);

      const data = {
        company: req.companyId, branch: worker.branch, worker: worker._id,
        month: m, year: y, baseSalary: base,
        daysWorked, daysAbsent, daysLate, daysOff, daysScheduled: daysWorked + daysAbsent,
        deductions, totalDeductions: totalDed, netSalary
      };

      if (existing) { Object.assign(existing, data); await existing.save(); updated.push(worker._id); }
      else { await Payroll.create(data); created.push(worker._id); }
    }

    res.json({
      success: true,
      message: `Payroll generated: ${created.length} created, ${updated.length} updated, ${skipped.length} skipped`,
      created: created.length, updated: updated.length, skipped: skipped.length
    });
  } catch (err) {
    console.error('[generatePayroll]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getPayroll = async (req, res) => {
  try {
    const { month, year, branch, status, page = 1, limit = 30 } = req.query;
    const q = { company: req.companyId };
    if (month)  q.month  = parseInt(month);
    if (year)   q.year   = parseInt(year);
    if (branch) q.branch = branch;
    if (status) q.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      Payroll.find(q)
        .populate('worker', 'fullName phone photo')
        .populate('branch', 'name')
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Payroll.countDocuments(q)
    ]);
    res.json({ success: true, payroll: records, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getWorkerPayroll = async (req, res) => {
  try {
    const records = await Payroll.find({ company: req.companyId, worker: req.params.workerId })
      .sort({ year: -1, month: -1 }).limit(24);
    res.json({ success: true, payroll: records });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updatePayrollStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const p = await Payroll.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { $set: { status, notes: notes || '', approvedBy: req.user._id, approvedAt: new Date() } },
      { new: true }
    );
    if (!p) return res.status(404).json({ success: false, message: 'Payroll record not found' });
    res.json({ success: true, payroll: p });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const addManualDeduction = async (req, res) => {
  try {
    const { workerId, month, year, amount, reason } = req.body;
    const p = await Payroll.findOne({ company: req.companyId, worker: workerId, month: parseInt(month), year: parseInt(year) });
    if (!p) return res.status(404).json({ success: false, message: 'Payroll record not found. Generate payroll first.' });
    p.deductions.push({ type: 'manual', amount: parseFloat(amount), reason: reason || 'Manual deduction' });
    p.totalDeductions = p.deductions.reduce((s, d) => s + d.amount, 0);
    p.netSalary = Math.max(0, p.baseSalary - p.totalDeductions);
    await p.save();
    res.json({ success: true, payroll: p });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { generatePayroll, getPayroll, getWorkerPayroll, updatePayrollStatus, addManualDeduction };
