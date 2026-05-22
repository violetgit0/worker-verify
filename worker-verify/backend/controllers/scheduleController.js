const Schedule = require('../models/Schedule');
const Worker   = require('../models/Worker');

const getSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find({ company: req.companyId }).sort({ name: 1 });
    const ids    = schedules.map(s => s._id);
    const counts = await Worker.aggregate([
      { $match: { schedule: { $in: ids }, status: { $ne: 'inactive' } } },
      { $group: { _id: '$schedule', count: { $sum: 1 } } }
    ]);
    const cm = {};
    counts.forEach(c => { cm[c._id.toString()] = c.count; });
    res.json({ success: true, schedules: schedules.map(s => ({ ...s.toObject(), workerCount: cm[s._id.toString()] || 0 })) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getSchedule = async (req, res) => {
  try {
    const s = await Schedule.findOne({ _id: req.params.id, company: req.companyId });
    if (!s) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true, schedule: s });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createSchedule = async (req, res) => {
  try {
    const { name, description, color, type, daysOn, daysOff, workDays, clockIn, clockOut, lateAfterMinutes } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Schedule name is required' });
    if (!type)        return res.status(400).json({ success: false, message: 'Schedule type is required' });
    if (!clockIn)     return res.status(400).json({ success: false, message: 'Clock-in time is required' });
    if (!clockOut)    return res.status(400).json({ success: false, message: 'Clock-out time is required' });
    if (type === 'weekly' && (!workDays || !workDays.length))
      return res.status(400).json({ success: false, message: 'Select at least one working day' });

    const s = await Schedule.create({
      company: req.companyId, name: name.trim(), description: description || '', color: color || '#2563eb',
      type, daysOn: parseInt(daysOn) || 1, daysOff: parseInt(daysOff) || 1,
      workDays: workDays || [], clockIn, clockOut, lateAfterMinutes: parseInt(lateAfterMinutes) || 0
    });
    res.status(201).json({ success: true, schedule: s });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Schedule name already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateSchedule = async (req, res) => {
  try {
    const s = await Schedule.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { $set: req.body }, { new: true }
    );
    if (!s) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true, schedule: s });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteSchedule = async (req, res) => {
  try {
    const inUse = await Worker.countDocuments({ schedule: req.params.id });
    if (inUse) return res.status(400).json({ success: false, message: `${inUse} worker(s) use this schedule. Reassign first.` });
    await Schedule.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Determine if worker is scheduled to work on a given date
function resolveIsWorkDay(worker, schedule, date) {
  if (!schedule) return true;
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  if (schedule.type === 'rotation') {
    const start = new Date(worker.scheduleStartDate || worker.dateEmployed || worker.createdAt);
    start.setHours(0, 0, 0, 0);
    const days  = Math.floor((d - start) / 86400000);
    const cycle = (schedule.daysOn || 1) + (schedule.daysOff || 1);
    return ((days % cycle) + cycle) % cycle < (schedule.daysOn || 1);
  }
  if (schedule.type === 'weekly') return (schedule.workDays || []).includes(d.getDay());
  return true;
}

module.exports = { getSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule, resolveIsWorkDay };
