const DeductionRule = require('../models/DeductionRule');
const Deduction     = require('../models/Deduction');
const Worker        = require('../models/Worker');

const getDeductionRules = async (req, res) => {
  try {
    const cf = req.companyId ? { company: req.companyId } : {};
    const rules = await DeductionRule.find(cf).sort({ type: 1, minMinutes: 1 });
    res.json({ success: true, rules });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createDeductionRule = async (req, res) => {
  try {
    const { name, type, minMinutes, maxMinutes, amount, description } = req.body;
    if (!name || !type || amount === undefined) {
      return res.status(400).json({ success: false, message: 'name, type, and amount are required' });
    }
    const rule = await DeductionRule.create({
      company: req.companyId || null,
      name, type,
      minMinutes: minMinutes ?? 0,
      maxMinutes: maxMinutes ?? null,
      amount, description,
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, rule });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateDeductionRule = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.companyId) filter.company = req.companyId;
    const rule = await DeductionRule.findOneAndUpdate(filter, req.body, { new: true });
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    res.json({ success: true, rule });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteDeductionRule = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.companyId) filter.company = req.companyId;
    await DeductionRule.findOneAndDelete(filter);
    res.json({ success: true, message: 'Rule deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getDeductions = async (req, res) => {
  try {
    const { worker, branch, month, year, type, page = 1, limit = 50 } = req.query;
    const query = {};
    if (req.companyId) query.company = req.companyId;
    if (worker) query.worker = worker;
    if (branch) query.branch = branch;
    if (month)  query.month  = parseInt(month);
    if (year)   query.year   = parseInt(year);
    if (type)   query.type   = type;

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
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getWorkerDeductions = async (req, res) => {
  try {
    const workerId = req.worker?._id || req.params.workerId;
    const { month, year } = req.query;
    const query = { worker: workerId };
    if (req.companyId) query.company = req.companyId;
    if (month) query.month = parseInt(month);
    if (year)  query.year  = parseInt(year);

    const deductions = await Deduction.find(query)
      .populate('attendance', 'date status latenessMinutes')
      .sort({ createdAt: -1 });

    const totalAmount = deductions.reduce((sum, d) => sum + d.amount, 0);
    res.json({ success: true, deductions, totalAmount });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createManualDeduction = async (req, res) => {
  try {
    const { workerId, amount, description, month, year } = req.body;
    if (!workerId || !amount || !month || !year) {
      return res.status(400).json({ success: false, message: 'workerId, amount, month, year are required' });
    }
    const wFilter = { _id: workerId };
    if (req.companyId) wFilter.company = req.companyId;
    const worker = await Worker.findOne(wFilter);
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

    const deduction = await Deduction.create({
      company:     req.companyId || worker.company,
      worker:      workerId,
      branch:      worker.branch,
      month:       parseInt(month),
      year:        parseInt(year),
      type:        'manual',
      amount,
      description: description || 'Manual deduction',
      createdBy:   req.user._id
    });
    res.status(201).json({ success: true, deduction });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteDeduction = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.companyId) filter.company = req.companyId;
    const deduction = await Deduction.findOne(filter);
    if (!deduction) return res.status(404).json({ success: false, message: 'Deduction not found' });
    if (deduction.type !== 'manual') {
      return res.status(400).json({ success: false, message: 'Only manual deductions can be deleted' });
    }
    await deduction.deleteOne();
    res.json({ success: true, message: 'Deduction deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Seed default rules — only if NO rules exist globally (first boot)
const seedDefaultRules = async () => {
  const count = await DeductionRule.countDocuments();
  if (count > 0) return;
  // Note: rules created here have no company — they're template rules.
  // When a company is created, it gets its own copy via the onboarding flow.
};

module.exports = {
  getDeductionRules, createDeductionRule, updateDeductionRule, deleteDeductionRule,
  getDeductions, getWorkerDeductions, createManualDeduction, deleteDeduction,
  seedDefaultRules
};
