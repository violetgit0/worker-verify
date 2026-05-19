require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

connectDB().then(async () => {
  const { seedDefaultRules } = require('./controllers/deductionController');
  await seedDefaultRules();
});

const app = express();

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : ['*'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/workers',     require('./routes/workers'));
app.use('/api/staff',       require('./routes/staff'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/branches',    require('./routes/branches'));
app.use('/api/worker-auth', require('./routes/workerAuth'));
app.use('/api/attendance',  require('./routes/attendance'));
app.use('/api/deductions',  require('./routes/deductions'));
app.use('/api/payroll',     require('./routes/payroll'));
app.use('/api/alerts',        require('./routes/alerts'));
app.use('/api/activity-logs', require('./routes/activityLog'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'Worker Verify API is running' });
});

// Resolve shortened Google Maps links server-side (browser can't follow cross-origin redirects)
app.get('/api/resolve-maps', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, message: 'url query param required' });

  try {
    // Step 1: Follow redirect via HEAD to get the final Google Maps URL
    const headRes = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SageEnergyBot/1.0)' },
      signal: AbortSignal.timeout(12000)
    });
    const finalUrl = headRes.url;

    let lat = null, lng = null;

    // Strategy 1: @lat,lng in final URL path
    const atMatch = finalUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) { lat = parseFloat(atMatch[1]); lng = parseFloat(atMatch[2]); }

    // Strategy 2: !3d<lat>!4d<lng> data params in URL
    if (!lat) {
      const dataMatch = finalUrl.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
      if (dataMatch) { lat = parseFloat(dataMatch[1]); lng = parseFloat(dataMatch[2]); }
    }

    // Strategy 3: ?q=lat,lng or ?ll=lat,lng numeric pair
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

    // Strategy 4: Nominatim geocode using place name from ?q=
    // Try progressively simpler address parts until we get a hit
    if (!lat) {
      let placeName = '';
      try {
        const u = new URL(finalUrl);
        placeName = (u.searchParams.get('q') || '').trim();
      } catch (_) {}

      if (placeName) {
        const parts = placeName.split(',').map(s => s.trim()).filter(Boolean);
        // Build candidates from most specific to least specific
        const candidates = [];
        for (let start = 0; start < Math.min(parts.length, 3); start++) {
          const slice = parts.slice(start).join(', ');
          if (slice) candidates.push(slice);
        }
        // Also try just the street name (part[1]) + city
        if (parts.length >= 3) candidates.push(`${parts[1]}, ${parts[parts.length-2]}, ${parts[parts.length-1]}`);
        // City only as last resort
        if (parts.length >= 2) candidates.push(parts.slice(-2).join(', '));

        for (const q of candidates) {
          try {
            const nomRes = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
              { headers: { 'Accept-Language': 'en', 'User-Agent': 'SageEnergyWorkerVerify/1.0' },
                signal: AbortSignal.timeout(8000) }
            );
            if (nomRes.ok) {
              const data = await nomRes.json();
              if (data.length) {
                lat = parseFloat(data[0].lat);
                lng = parseFloat(data[0].lon);
                break;
              }
            }
          } catch (_) {}
        }
      }
    }

    if (!lat || !lng) {
      return res.json({ success: false, finalUrl, message: 'Could not extract coordinates from this link' });
    }

    res.json({ success: true, lat, lng, finalUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`));
