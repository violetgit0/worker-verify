const DeductionRule = require('../models/DeductionRule');
const Deduction     = require('../models/Deduction');
const Worker        = require('../models/Worker');

// ── Deduction Rules ────────────────────────────────────────────────────────────

const getDeductionRules = async (req, res) => {
  const rules = await DeductionRule.find().sort({ type: 1, minMinutes: 1 });
  res.json({ success: true, rules });
};

const createDeductionRule = async (req, res) => {
  const { name, type, minMinutes, maxMinutes, amount, description } = req.body;
  if (!name || !type || amount === undefined) {
    return res.status(400).json({ success: false, message: 'name, type, and amount are required' });
  }
  const rule = await DeductionRule.create({
    name, type,
    minMinutes: minMinutes ?? 0,
    maxMinutes: maxMinutes ?? null,
    amount, description,
    createdBy: req.user._id
  });
  res.status(201).json({ success: true, rule });
};

const updateDeductionRule = async (req, res) => {
  const rule = await DeductionRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
  res.json({ success: true, rule });
};

const deleteDeductionRule = async (req, res) => {
  await DeductionRule.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Rule deleted' });
};

// ── Deduction Records ──────────────────────────────────────────────────────────

const getDeductions = async (req, res) => {
  const { worker, branch, month, year, type, page = 1, limit = 50 } = req.query;
  const query = {};
  if (worker)  query.worker = worker;
  if (branch)  query.branch = branch;
  if (month)   query.month  = parseInt(month);
  if (year)    query.year   = parseInt(year);
  if (type)    query.type   = type;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [deductions, total] = await Promise.all([
    Deduction.find(query)
      .populate('worker', 'fullName phone')
      .populate('branch', 'name code')
      .populate('attendance', 'date status latenessMinutes')
      .populate('rule', 'name')
      .sort({ createdAt: -1 })
      .skip(skip).limit(parseInt(limit)),
    Deduction.countDocuments(query)
  ]);
  res.json({ success: true, deductions, total });
};

const getWorkerDeductions = async (req, res) => {
  const workerId = req.worker?._id || req.params.workerId;
  const { month, year } = req.query;
  const query = { worker: workerId };
  if (month) query.month = parseInt(month);
  if (year)  query.year  = parseInt(year);

  const deductions = await Deduction.find(query)
    .populate('attendance', 'date status latenessMinutes')
    .sort({ createdAt: -1 });

  const totalAmount = deductions.reduce((sum, d) => sum + d.amount, 0);
  res.json({ success: true, deductions, totalAmount });
};

const createManualDeduction = async (req, res) => {
  const { workerId, amount, description, month, year } = req.body;
  if (!workerId || !amount || !month || !year) {
    return res.status(400).json({ success: false, message: 'workerId, amount, month, year are required' });
  }
  const worker = await Worker.findById(workerId);
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

  const deduction = await Deduction.create({
    worker: workerId,
    branch: worker.branch,
    month: parseInt(month), year: parseInt(year),
    type: 'manual',
    amount, description: description || 'Manual deduction',
    createdBy: req.user._id
  });
  res.status(201).json({ success: true, deduction });
};

const deleteDeduction = async (req, res) => {
  const deduction = await Deduction.findById(req.params.id);
  if (!deduction) return res.status(404).json({ success: false, message: 'Deduction not found' });
  if (deduction.type !== 'manual') {
    return res.status(400).json({ success: false, message: 'Only manual deductions can be deleted' });
  }
  await deduction.deleteOne();
  res.json({ success: true, message: 'Deduction deleted' });
};

// Seed default deduction rules if none exist
const seedDefaultRules = async () => {
  const count = await DeductionRule.countDocuments();
  if (count > 0) return;
  const defaults = [
    { name: '1–15 mins late',    type: 'lateness', minMinutes: 1,  maxMinutes: 15,  amount: 500  },
    { name: '16–30 mins late',   type: 'lateness', minMinutes: 16, maxMinutes: 30,  amount: 1000 },
    { name: '31–60 mins late',   type: 'lateness', minMinutes: 31, maxMinutes: 60,  amount: 1500 },
    { name: 'Over 60 mins late', type: 'lateness', minMinutes: 61, maxMinutes: null,amount: 2000 },
    { name: 'Absence',           type: 'absence',  minMinutes: 0,  maxMinutes: null,amount: 0    }
  ];
  await DeductionRule.insertMany(defaults);
  console.log('[seed] Default deduction rules created');
};

module.exports = {
  getDeductionRules, createDeductionRule, updateDeductionRule, deleteDeductionRule,
  getDeductions, getWorkerDeductions, createManualDeduction, deleteDeduction,
  seedDefaultRules
};
