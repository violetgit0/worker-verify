const WorkerCategory = require('../models/WorkerCategory');
const Shift          = require('../models/Shift');
const Worker         = require('../models/Worker');

// ── Worker Categories ──────────────────────────────────────────────────────────

const getCategories = async (req, res) => {
  try {
    const filter = { company: req.companyId };
    if (req.query.active === 'true') filter.isActive = true;
    const cats = await WorkerCategory.find(filter).sort({ name: 1 });
    res.json({ success: true, categories: cats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const cat = await WorkerCategory.findOne({ _id: req.params.id, company: req.companyId });
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, category: cat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description, color, resumeTime, lateAfterMinutes,
            closingTime, overtimeAfterMinutes, workPattern, offDays, daysOn, daysOff } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const cat = await WorkerCategory.create({
      company: req.companyId, name, description, color,
      resumeTime, lateAfterMinutes, closingTime, overtimeAfterMinutes,
      workPattern, offDays, daysOn, daysOff
    });
    res.status(201).json({ success: true, category: cat });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A category with this name already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const cat = await WorkerCategory.findOne({ _id: req.params.id, company: req.companyId });
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });

    const fields = ['name','description','color','resumeTime','lateAfterMinutes',
                    'closingTime','overtimeAfterMinutes','workPattern','offDays','daysOn','daysOff','isActive'];
    fields.forEach(f => { if (req.body[f] !== undefined) cat[f] = req.body[f]; });
    await cat.save();
    res.json({ success: true, category: cat });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A category with this name already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const cat = await WorkerCategory.findOne({ _id: req.params.id, company: req.companyId });
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });

    const inUse = await Worker.countDocuments({ category: cat._id });
    if (inUse > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — ${inUse} worker(s) are assigned to this category`
      });
    }

    await cat.deleteOne();
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Shifts ─────────────────────────────────────────────────────────────────────

const getShifts = async (req, res) => {
  try {
    const filter = { company: req.companyId };
    if (req.query.branch) filter.branch = req.query.branch;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.active === 'true') filter.isActive = true;

    const shifts = await Shift.find(filter)
      .populate('branch', 'name code')
      .populate('category', 'name color resumeTime workPattern')
      .populate('supervisorUser', 'fullName')
      .sort({ name: 1 });

    // Attach worker counts
    const shiftIds = shifts.map(s => s._id);
    const counts = await Worker.aggregate([
      { $match: { shiftRef: { $in: shiftIds }, employmentStatus: 'active' } },
      { $group: { _id: '$shiftRef', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c.count; });

    const result = shifts.map(s => ({
      ...s.toObject(),
      workerCount: countMap[s._id.toString()] || 0
    }));

    res.json({ success: true, shifts: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getShiftById = async (req, res) => {
  try {
    const shift = await Shift.findOne({ _id: req.params.id, company: req.companyId })
      .populate('branch', 'name code')
      .populate('category', 'name color resumeTime workPattern')
      .populate('supervisorUser', 'fullName');
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

    const workerCount = await Worker.countDocuments({ shiftRef: shift._id, employmentStatus: 'active' });
    res.json({ success: true, shift: { ...shift.toObject(), workerCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createShift = async (req, res) => {
  try {
    const { name, supervisorName, supervisorUser, category, branch,
            resumeTime, lateAfterMinutes, closingTime, overtimeAfterMinutes,
            workPattern, offDays, daysOn, daysOff, referenceDate } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const shift = await Shift.create({
      company: req.companyId, name, supervisorName, supervisorUser: supervisorUser || null,
      category: category || null, branch: branch || null,
      resumeTime: resumeTime || null, lateAfterMinutes: lateAfterMinutes ?? null,
      closingTime: closingTime || null, overtimeAfterMinutes: overtimeAfterMinutes ?? null,
      workPattern: workPattern || null, offDays: offDays || [],
      daysOn: daysOn || 1, daysOff: daysOff || 1,
      referenceDate: referenceDate ? new Date(referenceDate) : null
    });
    res.status(201).json({ success: true, shift });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A shift with this name already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateShift = async (req, res) => {
  try {
    const shift = await Shift.findOne({ _id: req.params.id, company: req.companyId });
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

    const fields = ['name','supervisorName','supervisorUser','category','branch',
                    'resumeTime','lateAfterMinutes','closingTime','overtimeAfterMinutes',
                    'workPattern','offDays','daysOn','daysOff','referenceDate','isActive'];
    fields.forEach(f => { if (req.body[f] !== undefined) shift[f] = req.body[f] ?? null; });
    if (req.body.referenceDate) shift.referenceDate = new Date(req.body.referenceDate);
    await shift.save();
    res.json({ success: true, shift });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A shift with this name already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteShift = async (req, res) => {
  try {
    const shift = await Shift.findOne({ _id: req.params.id, company: req.companyId });
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

    const inUse = await Worker.countDocuments({ shiftRef: shift._id });
    if (inUse > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — ${inUse} worker(s) are assigned to this shift`
      });
    }

    await shift.deleteOne();
    res.json({ success: true, message: 'Shift deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Assign workers to a shift ──────────────────────────────────────────────────

const assignWorkersToShift = async (req, res) => {
  try {
    const { workerIds, shiftId, categoryId } = req.body;
    if (!workerIds?.length) {
      return res.status(400).json({ success: false, message: 'workerIds array required' });
    }

    const updateFields = {};
    if (shiftId !== undefined) updateFields.shiftRef = shiftId || null;
    if (categoryId !== undefined) updateFields.category = categoryId || null;

    const result = await Worker.updateMany(
      { _id: { $in: workerIds }, company: req.companyId },
      { $set: updateFields }
    );

    res.json({ success: true, message: `Updated ${result.modifiedCount} worker(s)` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Workers per shift summary ──────────────────────────────────────────────────

const getShiftSummary = async (req, res) => {
  try {
    const summary = await Worker.aggregate([
      { $match: { company: require('mongoose').Types.ObjectId.createFromHexString(req.companyId.toString()), employmentStatus: 'active' } },
      { $group: {
        _id: '$shiftRef',
        count: { $sum: 1 },
        workers: { $push: { name: '$fullName', id: '$_id' } }
      }},
      { $lookup: { from: 'shifts', localField: '_id', foreignField: '_id', as: 'shift' } },
      { $project: {
        shiftName: { $ifNull: [{ $arrayElemAt: ['$shift.name', 0] }, 'Unassigned'] },
        supervisorName: { $ifNull: [{ $arrayElemAt: ['$shift.supervisorName', 0] }, '—'] },
        count: 1, workers: 1
      }}
    ]);

    const categoryBreakdown = await Worker.aggregate([
      { $match: { company: require('mongoose').Types.ObjectId.createFromHexString(req.companyId.toString()), employmentStatus: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $lookup: { from: 'workercategories', localField: '_id', foreignField: '_id', as: 'cat' } },
      { $project: {
        categoryName: { $ifNull: [{ $arrayElemAt: ['$cat.name', 0] }, 'Uncategorized'] },
        color: { $ifNull: [{ $arrayElemAt: ['$cat.color', 0] }, '#6366f1'] },
        count: 1
      }}
    ]);

    res.json({ success: true, byShift: summary, byCategory: categoryBreakdown });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getCategories, getCategoryById, createCategory, updateCategory, deleteCategory,
  getShifts, getShiftById, createShift, updateShift, deleteShift,
  assignWorkersToShift, getShiftSummary
};
