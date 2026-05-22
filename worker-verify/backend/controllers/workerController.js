const Worker   = require('../models/Worker');
const Branch   = require('../models/Branch');

const getWorkers = async (req, res) => {
  try {
    const { branch, role, schedule, status, search, page = 1, limit = 30 } = req.query;
    const q = { company: req.companyId };
    if (branch)   q.branch   = branch;
    if (role)     q.role     = role;
    if (schedule) q.schedule = schedule;
    if (status && status !== 'all') q.status = status;
    if (search)   q.$text = { $search: search };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [workers, total] = await Promise.all([
      Worker.find(q)
        .populate('branch',   'name code')
        .populate('role',     'name color')
        .populate('schedule', 'name type clockIn clockOut')
        .sort({ createdAt: -1 })
        .skip(skip).limit(parseInt(limit)),
      Worker.countDocuments(q)
    ]);
    res.json({ success: true, workers, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getWorker = async (req, res) => {
  try {
    const w = await Worker.findOne({ _id: req.params.id, company: req.companyId })
      .populate('branch', 'name code')
      .populate('role',   'name color')
      .populate('schedule', 'name type clockIn clockOut daysOn daysOff workDays');
    if (!w) return res.status(404).json({ success: false, message: 'Worker not found' });
    res.json({ success: true, worker: w });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createWorker = async (req, res) => {
  try {
    const { fullName, phone, branch, role, schedule, scheduleStartDate, salary, nin, dateEmployed } = req.body;
    if (!fullName?.trim()) return res.status(400).json({ success: false, message: 'Full name is required' });
    if (!phone?.trim())    return res.status(400).json({ success: false, message: 'Phone number is required' });
    if (!branch)           return res.status(400).json({ success: false, message: 'Branch is required' });

    const branchDoc = await Branch.findOne({ _id: branch, company: req.companyId });
    if (!branchDoc) return res.status(400).json({ success: false, message: 'Invalid branch' });

    let photo = '';
    if (req.file) photo = req.file.path; // CloudinaryStorage sets path = the Cloudinary URL

    const worker = await Worker.create({
      company: req.companyId, branch, fullName: fullName.trim(), phone: phone.trim(),
      role: role || null, schedule: schedule || null,
      scheduleStartDate: scheduleStartDate ? new Date(scheduleStartDate) : new Date(),
      salary: parseFloat(salary) || 0,
      nin: nin || '',
      dateEmployed: dateEmployed ? new Date(dateEmployed) : new Date(),
      photo, createdBy: req.user._id
    });

    await worker.populate(['branch', 'role', 'schedule']);
    res.status(201).json({ success: true, worker });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateWorker = async (req, res) => {
  try {
    const { fullName, phone, branch, role, schedule, scheduleStartDate, salary, nin, status, dateEmployed } = req.body;
    const w = await Worker.findOne({ _id: req.params.id, company: req.companyId });
    if (!w) return res.status(404).json({ success: false, message: 'Worker not found' });

    if (fullName)           w.fullName          = fullName.trim();
    if (phone)              w.phone             = phone.trim();
    if (branch)             w.branch            = branch;
    if (role   !== undefined) w.role            = role   || null;
    if (schedule !== undefined) w.schedule      = schedule || null;
    if (scheduleStartDate)  w.scheduleStartDate = new Date(scheduleStartDate);
    if (salary  !== undefined) w.salary         = parseFloat(salary) || 0;
    if (nin     !== undefined) w.nin            = nin;
    if (status)             w.status            = status;
    if (dateEmployed)       w.dateEmployed      = new Date(dateEmployed);

    if (req.file) w.photo = req.file.path;

    await w.save();
    await w.populate(['branch', 'role', 'schedule']);
    res.json({ success: true, worker: w });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteWorker = async (req, res) => {
  try {
    await Worker.findOneAndUpdate({ _id: req.params.id, company: req.companyId }, { status: 'inactive' });
    res.json({ success: true, message: 'Worker deactivated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const searchWorkers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, workers: [] });
    const workers = await Worker.find({
      company: req.companyId,
      status: { $ne: 'inactive' },
      $or: [
        { fullName: { $regex: q, $options: 'i' } },
        { phone:    { $regex: q, $options: 'i' } },
        { nin:      { $regex: q, $options: 'i' } }
      ]
    }).populate('role', 'name color').populate('branch', 'name').limit(20);
    res.json({ success: true, workers });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getWorkers, getWorker, createWorker, updateWorker, deleteWorker, searchWorkers };
