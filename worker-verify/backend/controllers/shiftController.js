const mongoose    = require('mongoose');
const WorkerCategory = require('../models/WorkerCategory');
const Shift          = require('../models/Shift');
const Worker         = require('../models/Worker');
const Attendance     = require('../models/Attendance');

// ── Worker Roles (Categories) ─────────────────────────────────────────────────
// A role defines WHAT the worker does: Pump Attendant, Security, Manager, etc.

const getCategories = async (req, res) => {
  try {
    const filter = { company: req.companyId };
    if (req.query.active === 'true') filter.isActive = true;
    const categories = await WorkerCategory.find(filter).sort({ name: 1 });

    // Attach worker count per role
    const ids = categories.map(c => c._id);
    const counts = await Worker.aggregate([
      { $match: { category: { $in: ids }, employmentStatus: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c.count; });

    const result = categories.map(c => ({
      ...c.toObject(),
      workerCount: countMap[c._id.toString()] || 0
    }));

    res.json({ success: true, categories: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const cat = await WorkerCategory.findOne({ _id: req.params.id, company: req.companyId });
    if (!cat) return res.status(404).json({ success: false, message: 'Role not found' });
    res.json({ success: true, category: cat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Role name is required' });

    const cat = await WorkerCategory.create({
      company: req.companyId,
      name: name.trim(),
      description: description || '',
      color: color || '#6366f1'
    });
    res.status(201).json({ success: true, category: cat });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A role with this name already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const cat = await WorkerCategory.findOne({ _id: req.params.id, company: req.companyId });
    if (!cat) return res.status(404).json({ success: false, message: 'Role not found' });

    ['name', 'description', 'color', 'isActive'].forEach(f => {
      if (req.body[f] !== undefined) cat[f] = req.body[f];
    });
    await cat.save();
    res.json({ success: true, category: cat });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A role with this name already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const cat = await WorkerCategory.findOne({ _id: req.params.id, company: req.companyId });
    if (!cat) return res.status(404).json({ success: false, message: 'Role not found' });

    const inUse = await Worker.countDocuments({ category: cat._id });
    if (inUse > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — ${inUse} worker(s) are assigned to this role`
      });
    }
    await cat.deleteOne();
    res.json({ success: true, message: 'Role deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Shifts ────────────────────────────────────────────────────────────────────
// A shift defines WHEN workers work: supervisor, times, and working days.

const getShifts = async (req, res) => {
  try {
    const filter = { company: req.companyId };
    if (req.query.branch)        filter.branch   = req.query.branch;
    if (req.query.active === 'true') filter.isActive = true;

    const shifts = await Shift.find(filter)
      .populate('branch', 'name code')
      .populate('supervisorUser', 'fullName')
      .sort({ name: 1 });

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
    const {
      name, supervisorName, supervisorUser, branch,
      resumeTime, closingTime, lateAfterMinutes, overtimeAfterMinutes,
      workPattern, offDays, allowCustomSchedule
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Shift name is required' });

    const shift = await Shift.create({
      company:              req.companyId,
      name:                 name.trim(),
      supervisorName:       supervisorName || '',
      supervisorUser:       supervisorUser || null,
      branch:               branch || null,
      resumeTime:           resumeTime   || '08:00',
      closingTime:          closingTime  || '17:00',
      lateAfterMinutes:     lateAfterMinutes     !== undefined ? Number(lateAfterMinutes)     : 0,
      overtimeAfterMinutes: overtimeAfterMinutes !== undefined ? Number(overtimeAfterMinutes) : 60,
      workPattern:          workPattern || 'all_week',
      offDays:              offDays || [],
      allowCustomSchedule:  allowCustomSchedule || false
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

    const fields = [
      'name', 'supervisorName', 'supervisorUser', 'branch',
      'resumeTime', 'closingTime', 'lateAfterMinutes', 'overtimeAfterMinutes',
      'workPattern', 'offDays', 'allowCustomSchedule', 'isActive'
    ];
    fields.forEach(f => { if (req.body[f] !== undefined) shift[f] = req.body[f]; });
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

// ── Shift Dashboard ───────────────────────────────────────────────────────────

const getShiftDashboard = async (req, res) => {
  try {
    const shift = await Shift.findOne({ _id: req.params.id, company: req.companyId })
      .populate('branch', 'name');
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

    // Today's date range (midnight to midnight, company local time assumed UTC)
    const now   = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end   = new Date(now); end.setHours(23, 59, 59, 999);

    // All active workers in this shift
    const workers = await Worker.find({
      shiftRef:         shift._id,
      employmentStatus: 'active',
      company:          req.companyId
    })
      .populate('category', 'name color')
      .select('fullName passportPhoto category employmentStatus');

    const workerIds = workers.map(w => w._id);

    // Today's attendance for these workers
    const records = await Attendance.find({
      worker:  { $in: workerIds },
      company: req.companyId,
      date:    { $gte: start, $lte: end }
    }).select('worker status clockInTime clockOutTime latenessMinutes');

    const attendanceMap = {};
    records.forEach(r => { attendanceMap[r.worker.toString()] = r; });

    // Build worker rows
    const workerRows = workers.map(w => {
      const att = attendanceMap[w._id.toString()];
      return {
        _id:          w._id,
        fullName:     w.fullName,
        passportPhoto:w.passportPhoto || '',
        category:     w.category ? { name: w.category.name, color: w.category.color } : null,
        status:       att?.status || 'absent',
        clockIn:      att?.clockInTime  || null,
        clockOut:     att?.clockOutTime || null,
        latenessMinutes: att?.latenessMinutes || 0
      };
    });

    // Stats
    const total   = workerRows.length;
    const present = workerRows.filter(w => ['present','late','half_day'].includes(w.status)).length;
    const late    = workerRows.filter(w => w.status === 'late').length;
    const onTime  = workerRows.filter(w => w.status === 'present').length;
    const absent  = workerRows.filter(w => w.status === 'absent').length;

    res.json({
      success: true,
      shift: {
        _id:            shift._id,
        name:           shift.name,
        supervisorName: shift.supervisorName,
        resumeTime:     shift.resumeTime,
        closingTime:    shift.closingTime,
        branch:         shift.branch
      },
      stats: { total, present, onTime, late, absent },
      workers: workerRows
    });
  } catch (err) {
    console.error('[getShiftDashboard]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Assign workers ────────────────────────────────────────────────────────────

const assignWorkersToShift = async (req, res) => {
  try {
    const { workerIds, shiftId, categoryId } = req.body;
    if (!workerIds?.length) {
      return res.status(400).json({ success: false, message: 'workerIds array required' });
    }

    const updateFields = {};
    if (shiftId    !== undefined) updateFields.shiftRef  = shiftId    || null;
    if (categoryId !== undefined) updateFields.category  = categoryId || null;

    const result = await Worker.updateMany(
      { _id: { $in: workerIds }, company: req.companyId },
      { $set: updateFields }
    );
    res.json({ success: true, message: `Updated ${result.modifiedCount} worker(s)` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Summary ───────────────────────────────────────────────────────────────────

const getShiftSummary = async (req, res) => {
  try {
    const companyOid = mongoose.Types.ObjectId.createFromHexString(req.companyId.toString());

    const [byShift, byRole] = await Promise.all([
      Worker.aggregate([
        { $match: { company: companyOid, employmentStatus: 'active' } },
        { $group: { _id: '$shiftRef', count: { $sum: 1 } } },
        { $lookup: { from: 'shifts', localField: '_id', foreignField: '_id', as: 'shift' } },
        { $project: {
          shiftName:      { $ifNull: [{ $arrayElemAt: ['$shift.name', 0] }, 'Unassigned'] },
          supervisorName: { $ifNull: [{ $arrayElemAt: ['$shift.supervisorName', 0] }, '—'] },
          count: 1
        }}
      ]),
      Worker.aggregate([
        { $match: { company: companyOid, employmentStatus: 'active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $lookup: { from: 'workercategories', localField: '_id', foreignField: '_id', as: 'cat' } },
        { $project: {
          roleName: { $ifNull: [{ $arrayElemAt: ['$cat.name', 0] }, 'No Role'] },
          color:    { $ifNull: [{ $arrayElemAt: ['$cat.color', 0] }, '#6366f1'] },
          count: 1
        }}
      ])
    ]);

    res.json({ success: true, byShift, byRole });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getCategories, getCategoryById, createCategory, updateCategory, deleteCategory,
  getShifts, getShiftById, createShift, updateShift, deleteShift,
  getShiftDashboard, assignWorkersToShift, getShiftSummary
};
