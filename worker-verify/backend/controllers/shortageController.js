const Shortage = require('../models/Shortage');
const Worker   = require('../models/Worker');

const getShortages = async (req, res) => {
  try {
    const { branch, worker, status, from, to, page = 1, limit = 30 } = req.query;
    const q = { company: req.companyId };
    if (branch) q.branch = branch;
    if (worker) q.worker = worker;
    if (status) q.status = status;
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = new Date(from);
      if (to)   q.date.$lte = new Date(to);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      Shortage.find(q)
        .populate('worker',     'fullName photo')
        .populate('branch',     'name')
        .populate('recordedBy', 'fullName')
        .populate('approvedBy', 'fullName')
        .sort({ date: -1 }).skip(skip).limit(parseInt(limit)),
      Shortage.countDocuments(q)
    ]);
    res.json({ success: true, shortages: records, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createShortage = async (req, res) => {
  try {
    const { workerId, branchId, date, amount, reason } = req.body;
    if (!workerId) return res.status(400).json({ success: false, message: 'Worker is required' });
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

    const worker = await Worker.findOne({ _id: workerId, company: req.companyId });
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

    const s = await Shortage.create({
      company: req.companyId,
      branch:  branchId || worker.branch,
      worker:  workerId,
      recordedBy: req.user._id,
      date:    new Date(date),
      amount:  parseFloat(amount),
      reason:  reason || ''
    });
    await s.populate(['worker', 'branch', 'recordedBy']);
    res.status(201).json({ success: true, shortage: s });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const approveShortage = async (req, res) => {
  try {
    const s = await Shortage.findOne({ _id: req.params.id, company: req.companyId });
    if (!s) return res.status(404).json({ success: false, message: 'Shortage not found' });
    if (s.status !== 'pending') return res.status(400).json({ success: false, message: `Shortage is already ${s.status}` });

    s.status    = 'approved';
    s.approvedBy = req.user._id;
    s.approvedAt = new Date();
    await s.save();
    res.json({ success: true, shortage: s, message: 'Shortage approved — will affect payroll' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const rejectShortage = async (req, res) => {
  try {
    const { note } = req.body;
    const s = await Shortage.findOne({ _id: req.params.id, company: req.companyId });
    if (!s) return res.status(404).json({ success: false, message: 'Shortage not found' });
    s.status = 'rejected';
    s.rejectionNote = note || '';
    s.approvedBy = req.user._id;
    await s.save();
    res.json({ success: true, shortage: s });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteShortage = async (req, res) => {
  try {
    const s = await Shortage.findOne({ _id: req.params.id, company: req.companyId });
    if (!s) return res.status(404).json({ success: false, message: 'Shortage not found' });
    if (s.status === 'approved') return res.status(400).json({ success: false, message: 'Cannot delete an approved shortage' });
    await s.deleteOne();
    res.json({ success: true, message: 'Shortage deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getShortages, createShortage, approveShortage, rejectShortage, deleteShortage };
