require('dotenv').config();
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const connectDB = require('./config/db');

connectDB();
const app = express();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || /netlify\.app$/.test(origin) || /railway\.app$/.test(origin) || /localhost/.test(origin)) {
      cb(null, true);
    } else if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.split(',').map(s => s.trim()).includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static frontend
const FRONTEND_DIR = path.join(__dirname, '../frontend');
app.use(express.static(FRONTEND_DIR));
app.get('/', (_req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

// API routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/branches',   require('./routes/branches'));
app.use('/api/roles',      require('./routes/roles'));
app.use('/api/schedules',  require('./routes/schedules'));
app.use('/api/workers',    require('./routes/workers'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/payroll',    require('./routes/payroll'));
app.use('/api/shortages',  require('./routes/shortages'));
app.use('/api/sales',      require('./routes/sales'));
app.use('/api/dashboard',  require('./routes/dashboard'));

app.get('/api/health', (_req, res) => res.json({ status: 'OK', version: '2.0.0' }));

// Serve frontend for all non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));
