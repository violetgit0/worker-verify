const SecurityAlert = require('../models/SecurityAlert');
const Attendance    = require('../models/Attendance');

// ── Get alerts (paginated, filterable) ────────────────────────────────────────
const getAlerts = async (req, res) => {
  const { type, severity, resolved, worker, branch, page = 1, limit = 25 } = req.query;
  const query = {};

  if (type)     query.type       = type;
  if (severity) query.severity   = severity;
  if (worker)   query.worker     = worker;
  if (branch)   query.branch     = branch;
  if (resolved !== undefined) query.isResolved = resolved === 'true';

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [alerts, total] = await Promise.all([
    SecurityAlert.find(query)
      .populate('worker', 'fullName phone passportPhoto')
      .populate('branch', 'name code')
      .populate('resolvedBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip).limit(parseInt(limit)),
    SecurityAlert.countDocuments(query)
  ]);

  const pages = Math.ceil(total / parseInt(limit));
  res.json({ success: true, alerts, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages } });
};

// ── Alert stats (for dashboard badge) ────────────────────────────────────────
const getAlertStats = async (req, res) => {
  const [unresolved, high, byType] = await Promise.all([
    SecurityAlert.countDocuments({ isResolved: false }),
    SecurityAlert.countDocuments({ isResolved: false, severity: 'high' }),
    SecurityAlert.aggregate([
      { $match: { isResolved: false } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ])
  ]);

  const typeMap = {};
  byType.forEach(t => { typeMap[t._id] = t.count; });

  res.json({ success: true, unresolved, high, byType: typeMap });
};

// ── Resolve alert ─────────────────────────────────────────────────────────────
const resolveAlert = async (req, res) => {
  const { notes } = req.body;
  const alert = await SecurityAlert.findById(req.params.id);
  if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });

  alert.isResolved = true;
  alert.resolvedBy = req.user._id;
  alert.resolvedAt = new Date();
  if (notes) alert.notes = notes;
  await alert.save();

  res.json({ success: true, message: 'Alert resolved' });
};

// ── Face review: admin marks attendance selfie as matched/mismatched ──────────
const reviewFace = async (req, res) => {
  const { attendanceId } = req.params;
  const { status, notes } = req.body; // status: 'matched' | 'mismatched'

  if (!['matched', 'mismatched'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be matched or mismatched' });
  }

  const attendance = await Attendance.findById(attendanceId).populate('worker', 'fullName');
  if (!attendance) return res.status(404).json({ success: false, message: 'Attendance record not found' });

  attendance.faceMatchStatus = status;
  await attendance.save();

  if (status === 'mismatched') {
    await SecurityAlert.create({
      worker: attendance.worker._id,
      attendance: attendance._id,
      branch: attendance.branch,
      type: 'face_mismatch',
      severity: 'high',
      message: `Face mismatch detected for ${attendance.worker.fullName} on ${attendance.date.toISOString().slice(0,10)}`,
      details: {
        selfieUrl: attendance.selfieUrl,
        reviewedBy: req.user._id,
        notes: notes || ''
      }
    });
  }

  res.json({ success: true, message: `Face marked as ${status}`, faceMatchStatus: status });
};

module.exports = { getAlerts, getAlertStats, resolveAlert, reviewFace };
