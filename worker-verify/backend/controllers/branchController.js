const Branch = require('../models/Branch');
const Worker = require('../models/Worker');

const getAllBranches = async (req, res) => {
  try {
    const filter = req.companyId ? { company: req.companyId } : {};
    const branches = await Branch.find(filter).sort({ name: 1 });

    const ids = branches.map(b => b._id);
    const counts = await Worker.aggregate([
      { $match: { branch: { $in: ids } } },
      { $group: { _id: '$branch', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$employmentStatus', 'active'] }, 1, 0] } } } }
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c; });

    const data = branches.map(b => ({
      ...b.toObject(),
      workerCount: countMap[b._id.toString()]?.total || 0,
      activeCount: countMap[b._id.toString()]?.active || 0
    }));

    res.json({ success: true, branches: data });
  } catch (err) {
    console.error('[getAllBranches]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getBranchById = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.companyId) filter.company = req.companyId;
    const branch = await Branch.findOne(filter);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });
    res.json({ success: true, branch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const parseBranchLocation = (body) => {
  const { locationLat, locationLng, locationAddress, locationPlusCode, locationMapsLink, locationMethod } = body;
  if (!locationLat && !locationLng) return undefined;
  return {
    lat:         locationLat  ? parseFloat(locationLat)  : null,
    lng:         locationLng  ? parseFloat(locationLng)  : null,
    address:     locationAddress   || '',
    plusCode:    locationPlusCode  || '',
    mapsLink:    locationMapsLink  || '',
    inputMethod: locationMethod    || 'map'
  };
};

const createBranch = async (req, res) => {
  try {
    const { name, code, address, managerName, phone,
            resumptionTimeA, resumptionTimeB, attendanceRadiusM } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Name and code are required' });
    }

    const filter = { code: code.toUpperCase() };
    if (req.companyId) filter.company = req.companyId;
    const existing = await Branch.findOne(filter);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Branch code already exists' });
    }

    const branchData = { name, code, address, managerName, phone };
    if (req.companyId)       branchData.company           = req.companyId;
    if (resumptionTimeA)     branchData.resumptionTimeA   = resumptionTimeA;
    if (resumptionTimeB)     branchData.resumptionTimeB   = resumptionTimeB;
    if (attendanceRadiusM)   branchData.attendanceRadiusM = Number(attendanceRadiusM);
    const loc = parseBranchLocation(req.body);
    if (loc) branchData.location = loc;

    const branch = await Branch.create(branchData);
    res.status(201).json({ success: true, message: 'Branch created successfully', branch });
  } catch (err) {
    console.error('[createBranch]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateBranch = async (req, res) => {
  try {
    const { name, code, address, managerName, phone, isActive,
            resumptionTimeA, resumptionTimeB, attendanceRadiusM } = req.body;

    if (code) {
      const dupFilter = { code: code.toUpperCase(), _id: { $ne: req.params.id } };
      if (req.companyId) dupFilter.company = req.companyId;
      const existing = await Branch.findOne(dupFilter);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Branch code already in use' });
      }
    }

    const update = { name, code, address, managerName, phone, isActive };
    if (resumptionTimeA !== undefined) update.resumptionTimeA = resumptionTimeA;
    if (resumptionTimeB !== undefined) update.resumptionTimeB = resumptionTimeB;
    if (attendanceRadiusM !== undefined) update.attendanceRadiusM = Number(attendanceRadiusM);
    const loc = parseBranchLocation(req.body);
    if (loc) update.location = loc;

    const branchFilter = { _id: req.params.id };
    if (req.companyId) branchFilter.company = req.companyId;

    const branch = await Branch.findOneAndUpdate(branchFilter, update, { new: true, runValidators: true });
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });
    res.json({ success: true, message: 'Branch updated', branch });
  } catch (err) {
    console.error('[updateBranch]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.companyId) filter.company = req.companyId;
    const branch = await Branch.findOne(filter);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });

    const workerCount = await Worker.countDocuments({ branch: req.params.id });
    if (workerCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch — ${workerCount} worker(s) are still assigned. Reassign them first.`
      });
    }

    branch.isActive = false;
    await branch.save();
    res.json({ success: true, message: 'Branch deactivated' });
  } catch (err) {
    console.error('[deleteBranch]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getBranchWorkers = async (req, res) => {
  try {
    const { shift, employmentStatus, page = 1, limit = 50 } = req.query;
    const query = { branch: req.params.id };
    if (req.companyId) query.company = req.companyId;
    if (shift && shift !== 'all') query.shift = shift;
    if (employmentStatus && employmentStatus !== 'all') query.employmentStatus = employmentStatus;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [workers, total] = await Promise.all([
      Worker.find(query)
        .populate('registeredBy', 'fullName')
        .sort({ fullName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Worker.countDocuments(query)
    ]);
    res.json({ success: true, workers, total });
  } catch (err) {
    console.error('[getBranchWorkers]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllBranches, getBranchById, createBranch, updateBranch, deleteBranch, getBranchWorkers };
