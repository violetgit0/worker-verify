const Role   = require('../models/Role');
const Worker = require('../models/Worker');

const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({ company: req.companyId }).sort({ name: 1 });
    const ids = roles.map(r => r._id);
    const counts = await Worker.aggregate([
      { $match: { role: { $in: ids }, status: { $ne: 'inactive' } } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    const cm = {};
    counts.forEach(c => { cm[c._id.toString()] = c.count; });
    res.json({ success: true, roles: roles.map(r => ({ ...r.toObject(), workerCount: cm[r._id.toString()] || 0 })) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createRole = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Role name is required' });
    const role = await Role.create({ company: req.companyId, name: name.trim(), description: description || '', color: color || '#2563eb' });
    res.status(201).json({ success: true, role });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Role name already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateRole = async (req, res) => {
  try {
    const role = await Role.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { $set: req.body }, { new: true }
    );
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    res.json({ success: true, role });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteRole = async (req, res) => {
  try {
    const inUse = await Worker.countDocuments({ role: req.params.id });
    if (inUse) return res.status(400).json({ success: false, message: `${inUse} worker(s) use this role. Reassign first.` });
    await Role.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    res.json({ success: true, message: 'Role deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getRoles, createRole, updateRole, deleteRole };
