require('dotenv').config();
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const connectDB = require('./config/db');

connectDB();

const app = express();

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : ['*'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin) || /localhost/.test(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static Frontend ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes ────────────────────────────────────────────────────────────────

// Public
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/companies',   require('./routes/companies'));

// Company-scoped (all protected inside each router)
app.use('/api/workers',     require('./routes/workers'));
app.use('/api/staff',       require('./routes/staff'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/branches',    require('./routes/branches'));
app.use('/api/worker-auth', require('./routes/workerAuth'));
app.use('/api/attendance',  require('./routes/attendance'));
app.use('/api/deductions',  require('./routes/deductions'));
app.use('/api/payroll',     require('./routes/payroll'));
app.use('/api/alerts',      require('./routes/alerts'));
app.use('/api/activity-logs', require('./routes/activityLog'));
app.use('/api/billing',     require('./routes/billing'));

// Platform super admin
app.use('/api/superadmin',  require('./routes/superadmin'));

// ── Health & Utilities ────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'WorkerSave API is running', version: '2.0.0' });
});

// Resolve shortened Google Maps links server-side
app.get('/api/resolve-maps', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, message: 'url query param required' });

  try {
    const headRes = await fetch(url, {
      method: 'HEAD', redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WorkerSaveBot/2.0)' },
      signal: AbortSignal.timeout(12000)
    });
    const finalUrl = headRes.url;
    let lat = null, lng = null;

    const atMatch = finalUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) { lat = parseFloat(atMatch[1]); lng = parseFloat(atMatch[2]); }

    if (!lat) {
      const dataMatch = finalUrl.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
      if (dataMatch) { lat = parseFloat(dataMatch[1]); lng = parseFloat(dataMatch[2]); }
    }

    if (!lat) {
      try {
        const u = new URL(finalUrl);
        for (const p of ['q','ll','center']) {
          const v = u.searchParams.get(p);
          if (v) {
            const m = v.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
            if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); break; }
          }
        }
      } catch (_) {}
    }

    if (!lat || !lng) {
      return res.json({ success: false, finalUrl, message: 'Could not extract coordinates from this link' });
    }
    res.json({ success: true, lat, lng, finalUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`WorkerSave API v2.0 running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`));
