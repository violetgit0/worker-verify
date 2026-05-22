const Attendance = require('../models/Attendance');
const Worker     = require('../models/Worker');
const { resolveIsWorkDay } = require('./scheduleController');

function toMidnight(d) {
  const dt = d ? new Date(d) : new Date();
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function parseTime(hhMM, onDate) {
  const [h, m] = hhMM.split(':').map(Number);
  const dt = new Date(onDate);
  dt.setHours(h, m, 0, 0);
  return dt;
}

// Admin: clock in worker
const adminClockIn = async (req, res) => {
  try {
    const { workerId, date: dateStr, clockInTime: timeStr, notes } = req.body;
    const worker = await Worker.findOne({ _id: workerId, company: req.companyId }).populate('schedule');
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

    const date     = toMidnight(dateStr);
    const existing = await Attendance.findOne({ worker: workerId, date });
    if (existing?.clockInTime) return res.status(400).json({ success: false, message: 'Already clocked in for this date' });

    let clockInTime;
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      clockInTime = new Date(date); clockInTime.setHours(h, m, 0, 0);
    } else {
      clockInTime = new Date();
    }

    const schedule = worker.schedule;
    const resumeStr = schedule?.clockIn || '08:00';
    const graceMin  = schedule?.lateAfterMinutes || 0;
    const resumeTime = parseTime(resumeStr, clockInTime);
    const rawLate    = Math.max(0, Math.floor((clockInTime - resumeTime) / 60000));
    const latenessMinutes = Math.max(0, rawLate - graceMin);

    const data = {
      company: req.companyId, branch: worker.branch, worker: workerId, date,
      status: latenessMinutes > 0 ? 'late' : 'present',
      clockInTime, latenessMinutes, isManual: true, markedBy: req.user._id, notes: notes || ''
    };

    let att;
    if (existing) { Object.assign(existing, data); att = await existing.save(); }
    else { att = await Attendance.create(data); }

    res.json({ success: true, message: `${worker.fullName} clocked in`, attendance: att });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Admin: clock out worker
const adminClockOut = async (req, res) => {
  try {
    const { workerId, date: dateStr, clockOutTime: timeStr, notes } = req.body;
    const date = toMidnight(dateStr);
    const att  = await Attendance.findOne({ worker: workerId, date, company: req.companyId });
    if (!att?.clockInTime) return res.status(400).json({ success: false, message: 'No clock-in found for this date' });
    if (att.clockOutTime)  return res.status(400).json({ success: false, message: 'Already clocked out' });

    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      att.clockOutTime = new Date(date); att.clockOutTime.setHours(h, m, 0, 0);
    } else {
      att.clockOutTime = new Date();
    }
    att.isManual = true; att.markedBy = req.user._id;
    if (notes) att.notes = notes;
    await att.save();
    res.json({ success: true, message: 'Clocked out', attendance: att });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Admin: mark workers absent
const markAbsent = async (req, res) => {
  try {
    const { workerIds, date: dateStr, notes } = req.body;
    if (!workerIds?.length) return res.status(400).json({ success: false, message: 'workerIds required' });
    const date = toMidnight(dateStr);
    const results = [];
    for (const wid of workerIds) {
      const worker = await Worker.findOne({ _id: wid, company: req.companyId });
      if (!worker) continue;
      const existing = await Attendance.findOne({ worker: wid, date });
      if (existing?.clockInTime) { results.push({ wid, skipped: true }); continue; }
      const data = { company: req.companyId, branch: worker.branch, worker: wid, date, status: 'absent', isManual: true, markedBy: req.user._id, notes: notes || '' };
      if (existing) { Object.assign(existing, data); await existing.save(); }
      else await Attendance.create(data);
      results.push({ wid, marked: true });
    }
    res.json({ success: true, results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Get attendance list
const getAttendance = async (req, res) => {
  try {
    const { branch, worker, status, date, from, to, page = 1, limit = 30 } = req.query;
    const q = { company: req.companyId };
    if (branch) q.branch = branch;
    if (worker) q.worker = worker;
    if (status) q.status = status;
    if (date)   q.date   = toMidnight(date);
    else if (from || to) {
      q.date = {};
      if (from) q.date.$gte = toMidnight(from);
      if (to)   q.date.$lte = toMidnight(to);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      Attendance.find(q)
        .populate('worker', 'fullName phone photo')
        .populate('branch', 'name code')
        .populate('markedBy', 'fullName')
        .sort({ date: -1, clockInTime: -1 })
        .skip(skip).limit(parseInt(limit)),
      Attendance.countDocuments(q)
    ]);
    res.json({ success: true, attendance: records, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Today's branch attendance snapshot
const getTodayAttendance = async (req, res) => {
  try {
    const { branchId } = req.params;
    const today = toMidnight();

    const [workers, records] = await Promise.all([
      Worker.find({ company: req.companyId, branch: branchId, status: 'active' })
        .populate('schedule').select('fullName phone photo schedule scheduleStartDate dateEmployed createdAt'),
      Attendance.find({ company: req.companyId, branch: branchId, date: today })
    ]);

    const attMap = {};
    records.forEach(r => { attMap[r.worker.toString()] = r; });

    const list = workers.map(w => {
      const att = attMap[w._id.toString()];
      const isWorkDay = resolveIsWorkDay(w, w.schedule, today);
      return {
        _id: w._id, fullName: w.fullName, phone: w.phone, photo: w.photo,
        isWorkDay,
        status:    att?.status || (isWorkDay ? 'absent' : 'off_day'),
        clockIn:   att?.clockInTime  || null,
        clockOut:  att?.clockOutTime || null,
        latenessMinutes: att?.latenessMinutes || 0
      };
    });

    const summary = {
      total:   list.length,
      present: list.filter(w => ['present', 'late'].includes(w.status)).length,
      late:    list.filter(w => w.status === 'late').length,
      absent:  list.filter(w => w.status === 'absent').length,
      offDay:  list.filter(w => w.status === 'off_day').length
    };

    res.json({ success: true, workers: list, summary });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Worker's own attendance history
const getWorkerAttendance = async (req, res) => {
  try {
    const { month, year, page = 1, limit = 35 } = req.query;
    const q = { worker: req.params.workerId, company: req.companyId };
    if (month && year) {
      q.date = {
        $gte: toMidnight(new Date(parseInt(year), parseInt(month) - 1, 1)),
        $lte: toMidnight(new Date(parseInt(year), parseInt(month), 0))
      };
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      Attendance.find(q).sort({ date: -1 }).skip(skip).limit(parseInt(limit)),
      Attendance.countDocuments(q)
    ]);

    let summary = null;
    if (month && year) {
      const allMonth = await Attendance.find(q);
      summary = {
        present: allMonth.filter(a => a.status === 'present').length,
        late:    allMonth.filter(a => a.status === 'late').length,
        absent:  allMonth.filter(a => a.status === 'absent').length,
        offDay:  allMonth.filter(a => a.status === 'off_day').length
      };
    }
    res.json({ success: true, attendance: records, total, summary });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { adminClockIn, adminClockOut, markAbsent, getAttendance, getTodayAttendance, getWorkerAttendance };
