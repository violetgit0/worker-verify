const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Worker = require('../models/Worker');

// Admin sets/resets a worker's PIN — POST /api/worker-auth/set-pin
const setWorkerPin = async (req, res) => {
  const { workerId, pin } = req.body;
  if (!workerId || !pin) {
    return res.status(400).json({ success: false, message: 'workerId and pin are required' });
  }
  if (!/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ success: false, message: 'PIN must be 4–6 digits' });
  }
  const worker = await Worker.findById(workerId);
  if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });

  worker.pin = await bcrypt.hash(pin, 10);
  await worker.save();
  res.json({ success: true, message: 'PIN set successfully' });
};

// Worker logs in — POST /api/worker-auth/login
const workerLogin = async (req, res) => {
  const { phone, pin } = req.body;
  if (!phone || !pin) {
    return res.status(400).json({ success: false, message: 'Phone and PIN are required' });
  }
  const worker = await Worker.findOne({ phone: phone.trim() })
    .populate('branch', 'name code location resumptionTimeA resumptionTimeB attendanceRadiusM');

  if (!worker || !worker.pin) {
    return res.status(401).json({ success: false, message: 'Invalid phone number or PIN not set' });
  }
  if (worker.employmentStatus === 'sacked' || worker.employmentStatus === 'resigned') {
    return res.status(403).json({ success: false, message: 'Account inactive' });
  }

  const isMatch = await bcrypt.compare(pin, worker.pin);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Incorrect PIN' });
  }

  const token = jwt.sign(
    { type: 'worker', workerId: worker._id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const workerObj = worker.toObject();
  delete workerObj.pin;

  res.json({ success: true, token, worker: workerObj });
};

// Worker gets their own profile — GET /api/worker-auth/me
const getWorkerMe = async (req, res) => {
  const worker = req.worker.toObject();
  delete worker.pin;
  res.json({ success: true, worker });
};

module.exports = { setWorkerPin, workerLogin, getWorkerMe };
