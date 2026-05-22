const Branch = require('../models/Branch');
const Worker = require('../models/Worker');

const getBranches = async (req, res) => {
  try {
    const branches = await Branch.find({ company: req.companyId }).sort({ name: 1 });
    const ids = branches.map(b => b._id);
    const counts = await Worker.aggregate([
      { $match: { branch: { $in: ids }, status: 'active' } },
      { $group: { _id: '$branch', count: { $sum: 1 } } }
    ]);
    const cm = {};
    counts.forEach(c => { cm[c._id.toString()] = c.count; });
    res.json({ success: true, branches: branches.map(b => ({ ...b.toObject(), workerCount: cm[b._id.toString()] || 0 })) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getBranch = async (req, res) => {
  try {
    const b = await Branch.findOne({ _id: req.params.id, company: req.companyId });
    if (!b) return res.status(404).json({ success: false, message: 'Branch not found' });
    res.json({ success: true, branch: b });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createBranch = async (req, res) => {
  try {
    const { name, code, address, phone } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Branch name is required' });
    const b = await Branch.create({ company: req.companyId, name: name.trim(), code: code || '', address: address || '', phone: phone || '' });
    res.status(201).json({ success: true, branch: b });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Branch name already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateBranch = async (req, res) => {
  try {
    const b = await Branch.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!b) return res.status(404).json({ success: false, message: 'Branch not found' });
    res.json({ success: true, branch: b });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteBranch = async (req, res) => {
  try {
    const inUse = await Worker.countDocuments({ branch: req.params.id, status: { $in: ['active', 'pending', 'suspended'] } });
    if (inUse) return res.status(400).json({ success: false, message: `${inUse} active worker(s) are assigned to this branch` });
    await Branch.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    res.json({ success: true, message: 'Branch deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getBranches, getBranch, createBranch, updateBranch, deleteBranch };
