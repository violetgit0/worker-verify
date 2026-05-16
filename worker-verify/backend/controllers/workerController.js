const Worker = require('../models/Worker');
const Guarantor = require('../models/Guarantor');
const VerificationLog = require('../models/VerificationLog');
const Branch = require('../models/Branch');
const TransferLog = require('../models/TransferLog');

const parseLocation = (lat, lng, addr, plusCode = '', mapsLink = '', method = 'map') => ({
  lat:         lat ? parseFloat(lat) : null,
  lng:         lng ? parseFloat(lng) : null,
  address:     addr      || '',
  plusCode:    plusCode   || '',
  mapsLink:    mapsLink   || '',
  inputMethod: method     || 'map'
});

const buildIdentityDoc = (docType, docNumber, file) => {
  if (!docType && !file) return undefined;
  return {
    docType:   docType   || 'nin_slip',
    docNumber: docNumber || '',
    fileUrl:   file?.path   || '',
    fileType:  file ? (file.mimetype === 'application/pdf' ? 'pdf' : 'image') : '',
    docStatus: 'pending',
    reviewNotes: ''
  };
};

const filePaths = (files, field) => (files[field] || []).map(f => f.path);

const registerWorker = async (req, res) => {
  const {
    fullName, phone, gender, dateOfBirth, nin, occupation,
    homeAddress, landmark,
    locationLat, locationLng, locationAddress, locationPlusCode, locationMapsLink, locationMethod,
    workerIdDocType, workerIdDocNumber,
    g1FullName, g1Phone, g1Nin, g1Relationship, g1HomeAddress, g1Landmark,
    g1LocationLat, g1LocationLng, g1LocationAddress, g1LocationPlusCode, g1LocationMapsLink, g1LocationMethod,
    g1IdDocType, g1IdDocNumber,
    g2FullName, g2Phone, g2Nin, g2Relationship, g2HomeAddress, g2Landmark,
    g2LocationLat, g2LocationLng, g2LocationAddress, g2LocationPlusCode, g2LocationMapsLink, g2LocationMethod,
    g2IdDocType, g2IdDocNumber
  } = req.body;

  const existingWorker = await Worker.findOne({ nin });
  if (existingWorker) {
    return res.status(400).json({ success: false, message: 'A worker with this NIN already exists' });
  }

  const files = req.files || {};

  const {
    branch: branchId, shift, dateEmployed
  } = req.body;

  const housePhotosArr  = filePaths(files, 'housePhotos');
  const streetPhotosArr = filePaths(files, 'streetPhotos');

  const workerData = {
    fullName, phone, gender, dateOfBirth, nin, occupation,
    homeAddress,
    landmark:      landmark     || '',
    location: parseLocation(locationLat, locationLng, locationAddress, locationPlusCode, locationMapsLink, locationMethod),
    passportPhoto: files.passportPhoto?.[0]?.path || '',
    housePhoto:    housePhotosArr[0] || files.housePhoto?.[0]?.path || '',
    housePhotos:   housePhotosArr,
    streetPhotos:  streetPhotosArr,
    registeredBy:  req.user._id
  };

  if (branchId)    workerData.branch = branchId;
  if (shift && ['A','B'].includes(shift)) workerData.shift = shift;
  if (dateEmployed) workerData.dateEmployed = dateEmployed;

  const workerIdDoc = buildIdentityDoc(workerIdDocType, workerIdDocNumber, files.workerIdDoc?.[0]);
  if (workerIdDoc) workerData.identityDoc = workerIdDoc;

  const worker = await Worker.create(workerData);

  const guarantorIds = [];

  if (g1FullName) {
    const g1HousePhotos  = filePaths(files, 'g1HousePhotos');
    const g1StreetPhotos = filePaths(files, 'g1StreetPhotos');
    const g1Data = {
      worker: worker._id, guarantorNumber: 1,
      fullName: g1FullName, phone: g1Phone, nin: g1Nin,
      relationship: g1Relationship, homeAddress: g1HomeAddress,
      landmark:  g1Landmark || '',
      location: parseLocation(g1LocationLat, g1LocationLng, g1LocationAddress, g1LocationPlusCode, g1LocationMapsLink, g1LocationMethod),
      passportPhoto: files.g1PassportPhoto?.[0]?.path || '',
      housePhoto:    g1HousePhotos[0] || files.g1HousePhoto?.[0]?.path || '',
      housePhotos:   g1HousePhotos,
      streetPhotos:  g1StreetPhotos
    };
    const g1IdDoc = buildIdentityDoc(g1IdDocType, g1IdDocNumber, files.g1IdDoc?.[0]);
    if (g1IdDoc) g1Data.identityDoc = g1IdDoc;
    const g1 = await Guarantor.create(g1Data);
    guarantorIds.push(g1._id);
  }

  if (g2FullName) {
    const g2HousePhotos  = filePaths(files, 'g2HousePhotos');
    const g2StreetPhotos = filePaths(files, 'g2StreetPhotos');
    const g2Data = {
      worker: worker._id, guarantorNumber: 2,
      fullName: g2FullName, phone: g2Phone, nin: g2Nin,
      relationship: g2Relationship, homeAddress: g2HomeAddress,
      landmark:  g2Landmark || '',
      location: parseLocation(g2LocationLat, g2LocationLng, g2LocationAddress, g2LocationPlusCode, g2LocationMapsLink, g2LocationMethod),
      passportPhoto: files.g2PassportPhoto?.[0]?.path || '',
      housePhoto:    g2HousePhotos[0] || files.g2HousePhoto?.[0]?.path || '',
      housePhotos:   g2HousePhotos,
      streetPhotos:  g2StreetPhotos
    };
    const g2IdDoc = buildIdentityDoc(g2IdDocType, g2IdDocNumber, files.g2IdDoc?.[0]);
    if (g2IdDoc) g2Data.identityDoc = g2IdDoc;
    const g2 = await Guarantor.create(g2Data);
    guarantorIds.push(g2._id);
  }

  worker.guarantors = guarantorIds;
  await worker.save();

  await VerificationLog.create({
    worker: worker._id, action: 'registered',
    performedBy: req.user._id, newStatus: 'pending',
    notes: `Registered by ${req.user.fullName}`
  });

  res.status(201).json({ success: true, message: 'Worker registered successfully', workerId: worker._id });
};

const getAllWorkers = async (req, res) => {
  const { page = 1, limit = 20, status, search, branch, shift, employmentStatus } = req.query;
  const query = {};

  if (req.user.role === 'staff') query.registeredBy = req.user._id;
  if (status && status !== 'all')           query.verificationStatus = status;
  if (branch && branch !== 'all')           query.branch = branch;
  if (shift && shift !== 'all')             query.shift = shift;
  if (employmentStatus && employmentStatus !== 'all') query.employmentStatus = employmentStatus;

  if (search) {
    const guarantorWorkerIds = await Guarantor.find({
      $or: [
        { fullName: { $regex: search, $options: 'i' } },
        { phone:    { $regex: search, $options: 'i' } },
        { nin:      { $regex: search, $options: 'i' } }
      ]
    }).distinct('worker');

    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { phone:    { $regex: search, $options: 'i' } },
      { nin:      { $regex: search, $options: 'i' } },
      { _id:      { $in: guarantorWorkerIds } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [workers, total] = await Promise.all([
    Worker.find(query)
      .populate('registeredBy', 'fullName username')
      .populate('verifiedBy', 'fullName')
      .populate('branch', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Worker.countDocuments(query)
  ]);

  res.json({
    success: true, workers,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
  });
};

const getWorkerById = async (req, res) => {
  const worker = await Worker.findById(req.params.id)
    .populate('registeredBy', 'fullName username phone')
    .populate('verifiedBy', 'fullName')
    .populate('guarantors')
    .populate('branch', 'name code address');

  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

  if (req.user.role === 'staff' && worker.registeredBy._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const [logs, transferLogs] = await Promise.all([
    VerificationLog.find({ worker: worker._id })
      .populate('performedBy', 'fullName role')
      .sort({ createdAt: -1 }),
    TransferLog.find({ worker: worker._id })
      .populate('performedBy', 'fullName role')
      .sort({ createdAt: -1 })
  ]);

  res.json({ success: true, worker, logs, transferLogs });
};

const updateVerificationStatus = async (req, res) => {
  const { status, rejectionReason } = req.body;

  if (!['verified', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be verified or rejected' });
  }

  const worker = await Worker.findById(req.params.id);
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

  const previousStatus = worker.verificationStatus;
  worker.verificationStatus = status;
  worker.verifiedBy = req.user._id;
  worker.verifiedAt = new Date();
  if (status === 'rejected') worker.rejectionReason = rejectionReason || '';

  await worker.save();

  await VerificationLog.create({
    worker: worker._id,
    action: status === 'verified' ? 'approved' : 'rejected',
    performedBy: req.user._id,
    previousStatus,
    newStatus: status,
    notes: rejectionReason || ''
  });

  res.json({ success: true, message: `Worker ${status} successfully` });
};

const searchWorkers = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ success: true, workers: [] });

  const guarantorWorkerIds = await Guarantor.find({
    $or: [
      { fullName: { $regex: q, $options: 'i' } },
      { phone:    { $regex: q, $options: 'i' } },
      { nin:      { $regex: q, $options: 'i' } }
    ]
  }).distinct('worker');

  const workers = await Worker.find({
    $or: [
      { fullName: { $regex: q, $options: 'i' } },
      { phone:    { $regex: q, $options: 'i' } },
      { nin:      { $regex: q, $options: 'i' } },
      { _id:      { $in: guarantorWorkerIds } }
    ]
  }).populate('registeredBy', 'fullName').limit(30);

  res.json({ success: true, workers });
};

const flagDocument = async (req, res) => {
  const { target, docStatus, reviewNotes } = req.body;
  // target: 'worker' | 'g1' | 'g2'
  const validStatuses = ['pending', 'approved', 'rejected', 'flagged'];
  if (!validStatuses.includes(docStatus)) {
    return res.status(400).json({ success: false, message: 'Invalid docStatus' });
  }

  const worker = await Worker.findById(req.params.id).populate('guarantors');
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

  let action = docStatus === 'approved' ? 'doc_approved' : 'doc_rejected';
  if (docStatus === 'flagged') action = 'flagged';

  if (target === 'worker') {
    worker.identityDoc.docStatus   = docStatus;
    worker.identityDoc.reviewNotes = reviewNotes || '';
    await worker.save();
  } else {
    const gNum = target === 'g1' ? 1 : 2;
    const guarantor = worker.guarantors.find(g => g.guarantorNumber === gNum);
    if (!guarantor) return res.status(404).json({ success: false, message: 'Guarantor not found' });
    guarantor.identityDoc.docStatus   = docStatus;
    guarantor.identityDoc.reviewNotes = reviewNotes || '';
    await guarantor.save();
  }

  await VerificationLog.create({
    worker: worker._id,
    action,
    performedBy: req.user._id,
    notes: `Doc ${docStatus} for ${target}${reviewNotes ? ': ' + reviewNotes : ''}`
  });

  res.json({ success: true, message: `Document ${docStatus} successfully` });
};

const updateSalary = async (req, res) => {
  const { monthlySalary, dailyRate } = req.body;
  const worker = await Worker.findById(req.params.id);
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
  if (monthlySalary !== undefined) worker.monthlySalary = parseFloat(monthlySalary) || 0;
  if (dailyRate !== undefined)     worker.dailyRate     = parseFloat(dailyRate) || 0;
  // Auto-compute daily rate if not set
  if (!worker.dailyRate && worker.monthlySalary) worker.dailyRate = worker.monthlySalary / 26;
  await worker.save();
  res.json({ success: true, message: 'Salary updated', monthlySalary: worker.monthlySalary, dailyRate: worker.dailyRate });
};

const assignBranch = async (req, res) => {
  const { branchId, notes } = req.body;
  const worker = await Worker.findById(req.params.id).populate('branch', 'name code');
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

  if (branchId) {
    const branch = await Branch.findById(branchId);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });
  }

  const oldBranch = worker.branch ? `${worker.branch.name} (${worker.branch.code})` : 'Unassigned';
  worker.branch = branchId || null;
  await worker.save();

  const newWorker = await Worker.findById(req.params.id).populate('branch', 'name code');
  const newBranch = newWorker.branch ? `${newWorker.branch.name} (${newWorker.branch.code})` : 'Unassigned';

  await TransferLog.create({
    worker: worker._id,
    changeType: 'branch_assignment',
    oldValue: oldBranch,
    newValue: newBranch,
    performedBy: req.user._id,
    notes: notes || ''
  });

  res.json({ success: true, message: 'Branch assignment updated', worker: newWorker });
};

const assignShift = async (req, res) => {
  const { shift, notes } = req.body;
  if (!['A', 'B', 'unassigned'].includes(shift)) {
    return res.status(400).json({ success: false, message: 'Invalid shift. Use A, B, or unassigned' });
  }

  const worker = await Worker.findById(req.params.id);
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

  const oldShift = worker.shift;
  worker.shift = shift;
  await worker.save();

  await TransferLog.create({
    worker: worker._id,
    changeType: 'shift_change',
    oldValue: `Shift ${oldShift}`,
    newValue: `Shift ${shift}`,
    performedBy: req.user._id,
    notes: notes || ''
  });

  res.json({ success: true, message: 'Shift updated', shift });
};

const updateEmploymentStatus = async (req, res) => {
  const { employmentStatus, notes } = req.body;
  const validStatuses = ['active', 'suspended', 'resigned', 'sacked', 'on_leave'];
  if (!validStatuses.includes(employmentStatus)) {
    return res.status(400).json({ success: false, message: 'Invalid employment status' });
  }

  const worker = await Worker.findById(req.params.id);
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

  const oldStatus = worker.employmentStatus;
  worker.employmentStatus = employmentStatus;
  await worker.save();

  await TransferLog.create({
    worker: worker._id,
    changeType: 'status_change',
    oldValue: oldStatus,
    newValue: employmentStatus,
    performedBy: req.user._id,
    notes: notes || ''
  });

  res.json({ success: true, message: `Worker status updated to ${employmentStatus}`, employmentStatus });
};

module.exports = {
  registerWorker, getAllWorkers, getWorkerById,
  updateVerificationStatus, searchWorkers, flagDocument,
  assignBranch, assignShift, updateEmploymentStatus, updateSalary
};
