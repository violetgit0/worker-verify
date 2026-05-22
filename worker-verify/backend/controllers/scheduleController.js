const ScheduleTemplate = require('../models/ScheduleTemplate');
const Worker           = require('../models/Worker');

// ── List all schedule templates ───────────────────────────────────────────────
const getSchedules = async (req, res) => {
  try {
    const filter = { company: req.companyId };
    if (req.query.active === 'true') filter.isActive = true;

    const templates = await ScheduleTemplate.find(filter).sort({ name: 1 });

    // Attach worker count per schedule
    const ids    = templates.map(t => t._id);
    const counts = await Worker.aggregate([
      { $match: { scheduleRef: { $in: ids }, employmentStatus: 'active' } },
      { $group: { _id: '$scheduleRef', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c.count; });

    const result = templates.map(t => ({
      ...t.toObject(),
      workerCount: countMap[t._id.toString()] || 0
    }));

    res.json({ success: true, schedules: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get single schedule ───────────────────────────────────────────────────────
const getScheduleById = async (req, res) => {
  try {
    const s = await ScheduleTemplate.findOne({ _id: req.params.id, company: req.companyId });
    if (!s) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true, schedule: s });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Create schedule ───────────────────────────────────────────────────────────
const createSchedule = async (req, res) => {
  try {
    const { name, description, color, type, daysOn, daysOff, workDays,
            clockIn, clockOut, lateAfterMinutes } = req.body;

    if (!name?.trim())    return res.status(400).json({ success: false, message: 'Schedule name is required' });
    if (!type)            return res.status(400).json({ success: false, message: 'Schedule type is required' });
    if (!clockIn)         return res.status(400).json({ success: false, message: 'Clock-in time is required' });
    if (!clockOut)        return res.status(400).json({ success: false, message: 'Clock-out time is required' });

    if (type === 'rotation') {
      if (!daysOn  || daysOn  < 1) return res.status(400).json({ success: false, message: 'daysOn must be ≥ 1' });
      if (!daysOff || daysOff < 1) return res.status(400).json({ success: false, message: 'daysOff must be ≥ 1' });
    }
    if (type === 'weekly') {
      if (!Array.isArray(workDays) || !workDays.length)
        return res.status(400).json({ success: false, message: 'Select at least one working day' });
    }

    const s = await ScheduleTemplate.create({
      company: req.companyId,
      name: name.trim(),
      description: description || '',
      color: color || '#6366f1',
      type,
      daysOn:  parseInt(daysOn)  || 1,
      daysOff: parseInt(daysOff) || 1,
      workDays: workDays || [],
      clockIn,
      clockOut,
      lateAfterMinutes: parseInt(lateAfterMinutes) || 0
    });

    res.status(201).json({ success: true, schedule: s });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: 'A schedule with this name already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update schedule ───────────────────────────────────────────────────────────
const updateSchedule = async (req, res) => {
  try {
    const s = await ScheduleTemplate.findOne({ _id: req.params.id, company: req.companyId });
    if (!s) return res.status(404).json({ success: false, message: 'Schedule not found' });

    const { name, description, color, type, daysOn, daysOff, workDays,
            clockIn, clockOut, lateAfterMinutes, isActive } = req.body;

    if (name  !== undefined) s.name        = name.trim();
    if (description !== undefined) s.description = description;
    if (color !== undefined) s.color       = color;
    if (type  !== undefined) s.type        = type;
    if (daysOn  !== undefined) s.daysOn    = parseInt(daysOn)  || 1;
    if (daysOff !== undefined) s.daysOff   = parseInt(daysOff) || 1;
    if (workDays !== undefined) s.workDays = workDays;
    if (clockIn  !== undefined) s.clockIn  = clockIn;
    if (clockOut !== undefined) s.clockOut = clockOut;
    if (lateAfterMinutes !== undefined) s.lateAfterMinutes = parseInt(lateAfterMinutes) || 0;
    if (isActive !== undefined) s.isActive = isActive;

    await s.save();
    res.json({ success: true, schedule: s });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: 'A schedule with this name already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Delete schedule ───────────────────────────────────────────────────────────
const deleteSchedule = async (req, res) => {
  try {
    const s = await ScheduleTemplate.findOne({ _id: req.params.id, company: req.companyId });
    if (!s) return res.status(404).json({ success: false, message: 'Schedule not found' });

    const inUse = await Worker.countDocuments({ scheduleRef: s._id });
    if (inUse)
      return res.status(400).json({
        success: false,
        message: `${inUse} worker(s) use this schedule. Reassign them before deleting.`
      });

    await s.deleteOne();
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Check if a specific worker is scheduled today ────────────────────────────
// GET /api/schedules/check/:workerId  (or passes date query param)
const checkWorkerSchedule = async (req, res) => {
  try {
    const workerFilter = { _id: req.params.workerId };
    if (req.companyId) workerFilter.company = req.companyId;

    const worker = await Worker.findOne(workerFilter).populate('scheduleRef');
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

    const dateStr = req.query.date;
    const checkDate = dateStr ? new Date(dateStr) : new Date();
    checkDate.setHours(0, 0, 0, 0);

    const schedule = worker.scheduleRef;
    if (!schedule) {
      return res.json({ success: true, isWorkDay: true, reason: 'no_schedule', schedule: null });
    }

    const isWorkDay = resolveIsWorkDay(worker, schedule, checkDate);
    res.json({ success: true, isWorkDay, schedule, scheduleStartDate: worker.scheduleStartDate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Pure helper — exported so attendanceController can import it.
 * Returns true if `checkDate` is a scheduled work day for `worker`.
 */
function resolveIsWorkDay(worker, schedule, checkDate) {
  if (!schedule) return true;

  if (schedule.type === 'rotation') {
    // Anchor: scheduleStartDate → day 0 of the rotation (first work day)
    const startDate = worker.scheduleStartDate
      ? new Date(worker.scheduleStartDate)
      : new Date(worker.dateEmployed || worker.createdAt);
    startDate.setHours(0, 0, 0, 0);

    const daysSinceStart = Math.floor((checkDate - startDate) / 86400000);
    const cycle   = (schedule.daysOn || 1) + (schedule.daysOff || 1);
    const position = ((daysSinceStart % cycle) + cycle) % cycle; // always 0 … cycle-1
    return position < (schedule.daysOn || 1);
  }

  if (schedule.type === 'weekly') {
    return (schedule.workDays || []).includes(checkDate.getDay());
  }

  return true;
}

module.exports = {
  getSchedules, getScheduleById, createSchedule, updateSchedule, deleteSchedule,
  checkWorkerSchedule,
  resolveIsWorkDay
};
