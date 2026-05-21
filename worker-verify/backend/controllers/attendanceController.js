const Attendance     = require('../models/Attendance');
const Deduction      = require('../models/Deduction');
const DeductionRule  = require('../models/DeductionRule');
const Worker         = require('../models/Worker');
const Branch         = require('../models/Branch');
const SecurityAlert  = require('../models/SecurityAlert');
const { haversineDistance } = require('../utils/geo');
const { toMidnightUTC, parseTimeOnDate, minutesDiff, monthYear } = require('../utils/time');

// ── Deduction helpers ──────────────────────────────────────────────────────────

async function applyLatenessDeduction(worker, attendance, latenessMinutes, performedBy, companyId) {
  if (latenessMinutes <= 0) return 0;
  const ruleFilter = { type: 'lateness', isActive: true };
  if (companyId) ruleFilter.company = companyId;
  const rules = await DeductionRule.find(ruleFilter).sort({ minMinutes: 1 });
  for (const rule of rules) {
    if (latenessMinutes >= rule.minMinutes &&
        (rule.maxMinutes === null || latenessMinutes <= rule.maxMinutes)) {
      const { month, year } = monthYear(attendance.date);
      await Deduction.create({
        worker: worker._id, branch: attendance.branch,
        attendance: attendance._id, rule: rule._id,
        month, year, type: 'lateness', amount: rule.amount,
        company: companyId || null,
        description: `Late by ${latenessMinutes} min on ${attendance.date.toISOString().slice(0,10)}`,
        createdBy: performedBy || null
      });
      return rule.amount;
    }
  }
  return 0;
}

async function applyAbsenceDeduction(worker, attendance, performedBy, companyId) {
  const dailyRate = worker.dailyRate || (worker.monthlySalary ? worker.monthlySalary / 26 : 0);
  if (!dailyRate) return 0;
  const { month, year } = monthYear(attendance.date);
  await Deduction.create({
    worker: worker._id, branch: attendance.branch,
    attendance: attendance._id,
    month, year, type: 'absence', amount: dailyRate,
    company: companyId || null,
    description: `Absent on ${attendance.date.toISOString().slice(0,10)}`,
    createdBy: performedBy || null
  });
  return dailyRate;
}

// ── Clock In (worker self-service) ────────────────────────────────────────────
const workerClockIn = async (req, res) => {
  const worker = req.worker;
  const { lat, lng, deviceFingerprint, deviceInfo } = req.body;
  const selfieFile = req.file; // from selfieUpload middleware (optional)

  if (!worker.branch) {
    return res.status(400).json({ success: false, message: 'You are not assigned to a branch yet' });
  }
  if (worker.allowClockIn === false) {
    return res.status(403).json({ success: false, message: 'Clock-in is restricted for your account. Contact your supervisor.' });
  }

  const today = toMidnightUTC();
  const existing = await Attendance.findOne({ worker: worker._id, date: today });
  if (existing && existing.clockInTime) {
    return res.status(400).json({ success: false, message: 'Already clocked in today' });
  }

  const branch = await Branch.findById(worker.branch._id || worker.branch);
  const now = new Date();

  // ── GPS Verification (hard block if branch has GPS configured) ──────────────
  let isLocationVerified = false;
  let clockInDistance = null;

  if (branch.location?.lat && branch.location?.lng) {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (!lat || !lng || isNaN(parsedLat) || isNaN(parsedLng)) {
      await SecurityAlert.create({
        worker: worker._id, branch: branch._id,
        type: 'location_mismatch', severity: 'high',
        company: worker.company || null,
        message: `${worker.fullName} attempted to clock in without GPS location`,
        details: { selfieUrl: selfieFile.path, deviceInfo }
      });
      return res.status(403).json({
        success: false,
        message: 'GPS location is required to clock in at this branch. Please enable location services and try again.'
      });
    }

    const dist = haversineDistance(parsedLat, parsedLng, branch.location.lat, branch.location.lng);
    clockInDistance = Math.round(dist);
    isLocationVerified = dist <= branch.attendanceRadiusM;

    if (!isLocationVerified) {
      await SecurityAlert.create({
        worker: worker._id, branch: branch._id,
        type: 'location_mismatch', severity: 'high',
        company: worker.company || null,
        message: `${worker.fullName} tried to clock in from ${clockInDistance}m away (limit: ${branch.attendanceRadiusM}m)`,
        details: {
          workerLat: parsedLat, workerLng: parsedLng,
          branchLat: branch.location.lat, branchLng: branch.location.lng,
          distance: clockInDistance, allowedRadius: branch.attendanceRadiusM,
          selfieUrl: selfieFile.path, deviceInfo
        }
      });
      return res.status(403).json({
        success: false,
        message: `You are ${clockInDistance}m from your branch. You must be within ${branch.attendanceRadiusM}m to clock in.`,
        distance: clockInDistance,
        allowed: branch.attendanceRadiusM
      });
    }
  }

  // ── Late detection ─────────────────────────────────────────────────────────
  const resumptionStr = worker.shift === 'B' ? branch.resumptionTimeB : branch.resumptionTimeA;
  const resumptionTime = parseTimeOnDate(resumptionStr || '08:00');
  const latenessMinutes = Math.max(0, minutesDiff(resumptionTime, now));
  const isLate = latenessMinutes > 0;

  // ── Device change detection ────────────────────────────────────────────────
  const suspiciousFlags = [];

  if (deviceFingerprint) {
    const lastWithDevice = await Attendance.findOne({
      worker: worker._id,
      deviceFingerprint: { $ne: '' },
      clockInTime: { $ne: null }
    }).sort({ createdAt: -1 });

    if (lastWithDevice?.deviceFingerprint && lastWithDevice.deviceFingerprint !== deviceFingerprint) {
      suspiciousFlags.push('device_change');
      await SecurityAlert.create({
        worker: worker._id, branch: branch._id,
        type: 'device_change', severity: 'medium',
        company: worker.company || null,
        message: `${worker.fullName} clocked in from a different device`,
        details: {
          previousFingerprint: lastWithDevice.deviceFingerprint,
          newFingerprint: deviceFingerprint,
          previousDevice: lastWithDevice.deviceInfo,
          newDevice: deviceInfo,
          selfieUrl: selfieFile.path
        }
      });
    }
  }

  // ── Repeated late alert (3rd+ late this month) ─────────────────────────────
  if (isLate) {
    const monthStart = toMidnightUTC(new Date(now.getFullYear(), now.getMonth(), 1));
    const lateCountThisMonth = await Attendance.countDocuments({
      worker: worker._id,
      date: { $gte: monthStart },
      status: 'late'
    });

    if (lateCountThisMonth >= 2) {
      suspiciousFlags.push('repeated_late');
      const ordinal = lateCountThisMonth + 1;
      await SecurityAlert.create({
        worker: worker._id, branch: branch._id,
        type: 'repeated_late', severity: 'low',
        company: worker.company || null,
        message: `${worker.fullName} is late for the ${ordinal}${['st','nd','rd'][ordinal-1]||'th'} time this month`,
        details: { latenessMinutes, lateCountThisMonth: ordinal }
      });
    }
  }

  // ── Build and save attendance record ───────────────────────────────────────
  const attendanceData = {
    worker: worker._id, branch: branch._id,
    date: today, shift: worker.shift,
    clockInTime: now,
    status: isLate ? 'late' : 'present',
    latenessMinutes, isLocationVerified, clockInDistance,
    isManual: false,
    company: worker.company || null,
    selfieUrl: selfieFile ? selfieFile.path : '',
    faceMatchStatus: selfieFile ? 'pending' : 'skipped',
    deviceFingerprint: deviceFingerprint || '',
    deviceInfo: deviceInfo ? deviceInfo.slice(0, 300) : '',
    suspiciousFlags
  };

  if (lat && lng) {
    attendanceData.clockInLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
  }

  let attendance;
  if (existing) {
    Object.assign(existing, attendanceData);
    attendance = await existing.save();
  } else {
    attendance = await Attendance.create(attendanceData);
  }

  const deductionAmount = await applyLatenessDeduction(worker, attendance, latenessMinutes, null, worker.company);
  attendance.deductionAmount = deductionAmount;
  await attendance.save();

  res.json({
    success: true,
    message: isLate ? `Clocked in — ${latenessMinutes} min late` : 'Clocked in successfully',
    attendance,
    isLate, latenessMinutes, isLocationVerified,
    suspiciousFlags
  });
};

// ── Clock Out (worker self-service) ───────────────────────────────────────────
const workerClockOut = async (req, res) => {
  const worker = req.worker;
  const { lat, lng } = req.body;

  const today = toMidnightUTC();
  const attendance = await Attendance.findOne({ worker: worker._id, date: today });
  if (!attendance || !attendance.clockInTime) {
    return res.status(400).json({ success: false, message: 'No clock-in found for today' });
  }
  if (attendance.clockOutTime) {
    return res.status(400).json({ success: false, message: 'Already clocked out today' });
  }

  attendance.clockOutTime = new Date();
  if (lat && lng) attendance.clockOutLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
  await attendance.save();

  res.json({ success: true, message: 'Clocked out successfully', attendance });
};

// ── Admin clock-in (manual, no selfie/GPS restriction) ────────────────────────
const adminClockIn = async (req, res) => {
  try {
    const { workerId, date: dateStr, clockInTime: timeStr, notes } = req.body;
    const workerFilter = { _id: workerId };
    if (req.companyId) workerFilter.company = req.companyId;
    const worker = await Worker.findOne(workerFilter).populate('branch');
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
    if (!worker.branch) return res.status(400).json({ success: false, message: 'Worker has no branch' });
    if (worker.allowClockIn === false) {
      return res.status(403).json({ success: false, message: `Clock-in is restricted for ${worker.fullName}` });
    }

    const date = dateStr ? toMidnightUTC(new Date(dateStr)) : toMidnightUTC();
    const existing = await Attendance.findOne({ worker: worker._id, date });
    if (existing && existing.clockInTime) {
      return res.status(400).json({ success: false, message: 'Already clocked in for this date' });
    }

    const branch = worker.branch;

    let clockInTime;
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      clockInTime = new Date(date);
      clockInTime.setHours(h, m, 0, 0);
    } else {
      clockInTime = new Date();
    }

    const resumptionStr = worker.shift === 'B' ? branch.resumptionTimeB : branch.resumptionTimeA;
    const resumptionTime = parseTimeOnDate(resumptionStr || '08:00', clockInTime);
    const latenessMinutes = Math.max(0, minutesDiff(resumptionTime, clockInTime));

    const attendanceData = {
      worker: worker._id, branch: branch._id, date,
      shift: worker.shift, clockInTime,
      status: latenessMinutes > 0 ? 'late' : 'present',
      latenessMinutes,
      isManual: true, markedBy: req.user._id,
      faceMatchStatus: 'skipped',
      company: req.companyId || worker.company || null,
      notes: notes || ''
    };

    let attendance;
    if (existing) { Object.assign(existing, attendanceData); attendance = await existing.save(); }
    else { attendance = await Attendance.create(attendanceData); }

    const cid = req.companyId || worker.company;
    const deductionAmount = await applyLatenessDeduction(worker, attendance, latenessMinutes, req.user._id, cid);
    attendance.deductionAmount = deductionAmount;
    await attendance.save();

    res.json({ success: true, message: `${worker.fullName} clocked in`, attendance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const adminClockOut = async (req, res) => {
  try {
    const { workerId, date: dateStr, clockOutTime: timeStr, notes } = req.body;
    const date = dateStr ? toMidnightUTC(new Date(dateStr)) : toMidnightUTC();
    const attFilter = { worker: workerId, date };
    if (req.companyId) attFilter.company = req.companyId;
    const attendance = await Attendance.findOne(attFilter);
    if (!attendance || !attendance.clockInTime) {
      return res.status(400).json({ success: false, message: 'No clock-in found for this date' });
    }
    if (attendance.clockOutTime) {
      return res.status(400).json({ success: false, message: 'Already clocked out for this date' });
    }

    let clockOutTime;
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      clockOutTime = new Date(date);
      clockOutTime.setHours(h, m, 0, 0);
    } else {
      clockOutTime = new Date();
    }

    attendance.clockOutTime = clockOutTime;
    attendance.isManual = true;
    attendance.markedBy = req.user._id;
    if (notes) attendance.notes = notes;
    await attendance.save();
    res.json({ success: true, message: 'Clocked out', attendance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Mark Absent ───────────────────────────────────────────────────────────────
const markAbsent = async (req, res) => {
  try {
    const { workerIds, date: dateStr, notes } = req.body;
    if (!workerIds?.length) {
      return res.status(400).json({ success: false, message: 'workerIds array required' });
    }
    const date = dateStr ? toMidnightUTC(new Date(dateStr)) : toMidnightUTC();
    const results = [];

    for (const workerId of workerIds) {
      const wFilter = { _id: workerId };
      if (req.companyId) wFilter.company = req.companyId;
      const worker = await Worker.findOne(wFilter);
      if (!worker || !worker.branch) continue;

      const existing = await Attendance.findOne({ worker: workerId, date });
      if (existing && existing.clockInTime) {
        results.push({ workerId, skipped: true, reason: 'Already clocked in' });
        continue;
      }

      const data = {
        worker: workerId, branch: worker.branch, date,
        shift: worker.shift, status: 'absent',
        isManual: true, markedBy: req.user._id,
        faceMatchStatus: 'skipped',
        company: req.companyId || worker.company || null,
        notes: notes || ''
      };

      let attendance;
      if (existing) { Object.assign(existing, data); attendance = await existing.save(); }
      else { attendance = await Attendance.create(data); }

      const cid = req.companyId || worker.company;
      const deduction = await applyAbsenceDeduction(worker, attendance, req.user._id, cid);
      attendance.deductionAmount = deduction;
      await attendance.save();
      results.push({ workerId, worker: worker.fullName, marked: true });
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get attendance list (admin) ───────────────────────────────────────────────
const getAttendance = async (req, res) => {
  try {
    const { branch, worker, date, from, to, status, shift, page = 1, limit = 25 } = req.query;
    const query = {};

    if (req.companyId) query.company = req.companyId;
    if (branch) query.branch = branch;
    if (worker) query.worker = worker;
    if (status) query.status = status;
    if (shift)  query.shift  = shift;
    if (date)   query.date   = toMidnightUTC(new Date(date));
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = toMidnightUTC(new Date(from));
      if (to)   query.date.$lte = toMidnightUTC(new Date(to));
    }

    if (req.user.role === 'staff') {
      const staffWorkers = await Worker.find({ registeredBy: req.user._id }).distinct('_id');
      query.worker = { $in: staffWorkers };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      Attendance.find(query)
        .populate('worker', 'fullName phone passportPhoto shift')
        .populate('branch', 'name code')
        .populate('markedBy', 'fullName')
        .sort({ date: -1, clockInTime: -1 })
        .skip(skip).limit(parseInt(limit)),
      Attendance.countDocuments(query)
    ]);

    const pages = Math.ceil(total / parseInt(limit));
    res.json({
      success: true,
      attendance: records,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Today's attendance for a branch ───────────────────────────────────────────
const getTodayAttendance = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { date: dateStr } = req.query;
    const today = dateStr ? toMidnightUTC(new Date(dateStr)) : toMidnightUTC();

    const workerFilter = { branch: branchId, employmentStatus: 'active' };
    if (req.companyId) workerFilter.company = req.companyId;
    const attFilter = { branch: branchId, date: today };
    if (req.companyId) attFilter.company = req.companyId;

    const workers = await Worker.find(workerFilter)
      .select('_id fullName passportPhoto shift phone');

    const attendanceRecords = await Attendance.find(attFilter)
      .select('worker clockInTime clockOutTime status latenessMinutes deductionAmount isLocationVerified isManual selfieUrl faceMatchStatus suspiciousFlags clockInDistance');

    const attendance = {};
    attendanceRecords.forEach(a => { attendance[a.worker.toString()] = a; });

    const summary = { present: 0, late: 0, absent: 0 };
    attendanceRecords.forEach(a => {
      if (a.status === 'present') summary.present++;
      else if (a.status === 'late') { summary.present++; summary.late++; }
      else if (a.status === 'absent') summary.absent++;
    });

    res.json({ success: true, workers, attendance, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Worker's own attendance history ───────────────────────────────────────────
const getWorkerAttendance = async (req, res) => {
  const workerId = req.worker?._id || req.params.workerId;
  const { month, year, page = 1, limit = 31 } = req.query;

  const query = { worker: workerId };
  if (month && year) {
    const start = toMidnightUTC(new Date(parseInt(year), parseInt(month) - 1, 1));
    const end   = toMidnightUTC(new Date(parseInt(year), parseInt(month), 0));
    query.date  = { $gte: start, $lte: end };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [records, total] = await Promise.all([
    Attendance.find(query)
      .populate('branch', 'name code')
      .sort({ date: -1 }).skip(skip).limit(parseInt(limit)),
    Attendance.countDocuments(query)
  ]);

  let summary = null;
  if (month && year) {
    // Count across ALL records in the month, not just the current page
    const [presentCount, lateCount, absentCount, onLeaveCount, deductions] = await Promise.all([
      Attendance.countDocuments({ ...query, status: 'present' }),
      Attendance.countDocuments({ ...query, status: 'late' }),
      Attendance.countDocuments({ ...query, status: 'absent' }),
      Attendance.countDocuments({ ...query, status: 'on_leave' }),
      Deduction.aggregate([
        { $match: { worker: require('mongoose').Types.ObjectId.createFromHexString(workerId.toString()), month: parseInt(month), year: parseInt(year) } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);
    summary = {
      present:  presentCount,
      late:     lateCount,
      absent:   absentCount,
      onLeave:  onLeaveCount,
      totalDeductions: deductions[0]?.total || 0
    };
  }

  res.json({ success: true, attendance: records, total, summary });
};

// ── Attendance report (date range, per branch) ────────────────────────────────
const getAttendanceReport = async (req, res) => {
  try {
  const { branch, from, to, month, year } = req.query;

  let start, end;
  if (from && to) {
    start = toMidnightUTC(new Date(from));
    end   = toMidnightUTC(new Date(to));
  } else if (month && year) {
    start = toMidnightUTC(new Date(parseInt(year), parseInt(month) - 1, 1));
    end   = toMidnightUTC(new Date(parseInt(year), parseInt(month), 0));
  } else {
    return res.status(400).json({ success: false, message: 'Provide from/to dates or month/year' });
  }

  const matchStage = { date: { $gte: start, $lte: end } };
  if (req.companyId) matchStage.company = req.companyId;
  if (branch) {
    matchStage.branch = require('mongoose').Types.ObjectId.createFromHexString(branch);
  }

  const report = await Attendance.aggregate([
    { $match: matchStage },
    { $group: {
      _id: '$worker',
      daysPresent:  { $sum: { $cond: [{ $eq: ['$status','present'] }, 1, 0] } },
      daysLate:     { $sum: { $cond: [{ $eq: ['$status','late']    }, 1, 0] } },
      daysAbsent:   { $sum: { $cond: [{ $eq: ['$status','absent']  }, 1, 0] } },
      daysOnLeave:  { $sum: { $cond: [{ $eq: ['$status','on_leave']}, 1, 0] } },
      totalDeductions: { $sum: '$deductionAmount' }
    }},
    { $lookup: { from: 'workers', localField: '_id', foreignField: '_id', as: 'worker' } },
    { $unwind: '$worker' },
    { $lookup: { from: 'branches', localField: 'worker.branch', foreignField: '_id', as: 'branch' } },
    { $project: {
      _id: 0, workerId: '$_id',
      workerName: '$worker.fullName', phone: '$worker.phone', shift: '$worker.shift',
      branchName: { $ifNull: [{ $arrayElemAt: ['$branch.name', 0] }, '—'] },
      daysPresent: 1, daysLate: 1, daysAbsent: 1, daysOnLeave: 1, totalDeductions: 1
    }},
    { $sort: { workerName: 1 } }
  ]);

  res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  workerClockIn, workerClockOut,
  adminClockIn, adminClockOut,
  markAbsent,
  getAttendance, getTodayAttendance,
  getWorkerAttendance, getAttendanceReport
};
