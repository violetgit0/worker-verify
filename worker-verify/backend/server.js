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

  // Browser-like UA — Google returns richer redirects to desktop browsers
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  const extractCoords = (text) => {
    // Normalise URL-encoded characters so all patterns work on encoded text too
    const t = text.replace(/%2C/gi, ',').replace(/%3D/gi, '=').replace(/&amp;/g, '&');

    // @lat,lng,zoom  (most common full Maps URL)
    const m1 = t.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
    if (m1) return { lat: parseFloat(m1[1]), lng: parseFloat(m1[2]) };

    // !3d<lat>!4d<lng>  (place data format)
    const m2 = t.match(/!3d(-?\d+\.?\d+)!4d(-?\d+\.?\d+)/);
    if (m2) return { lat: parseFloat(m2[1]), lng: parseFloat(m2[2]) };

    // center=lat,lng  (staticmap URLs — coordinates appear here when Google
    // returns a place-ID redirect that has no @lat,lng in the path)
    const m3 = t.match(/[?&]center=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
    if (m3) return { lat: parseFloat(m3[1]), lng: parseFloat(m3[2]) };

    // query params: q=lat,lng  ll=lat,lng  query=lat,lng
    try {
      const u = new URL(t.startsWith('http') ? t : 'https://x.invalid/?' + t);
      for (const p of ['q', 'll', 'center', 'query']) {
        const v = u.searchParams.get(p);
        if (v) {
          const m = v.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
          if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
        }
      }
    } catch (_) {}
    return null;
  };

  try {
    // Use GET — maps.app.goo.gl short links (esp. with ?g_st=ac from mobile sharing)
    // do NOT follow through to the coordinate-bearing URL with HEAD requests.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let getRes;
    try {
      getRes = await fetch(url, {
        method: 'GET', redirect: 'follow',
        headers: { 'User-Agent': UA },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    const finalUrl = getRes.url;

    // Try the final redirected URL first — usually contains @lat,lng
    const fromUrl = extractCoords(finalUrl);
    if (fromUrl) {
      return res.json({ success: true, lat: fromUrl.lat, lng: fromUrl.lng, finalUrl });
    }

    // Fallback: read first 10KB of HTML body — coords appear in og:url / canonical / JS
    let chunk = '';
    try {
      const reader = getRes.body.getReader();
      const decoder = new TextDecoder();
      let totalRead = 0;
      while (totalRead < 10240) {
        const { done, value } = await reader.read();
        if (done) break;
        chunk += decoder.decode(value, { stream: true });
        totalRead += value.length;
      }
      reader.cancel().catch(() => {});
    } catch (_) {}

    // Try raw body text
    const fromBody = extractCoords(chunk);
    if (fromBody) {
      return res.json({ success: true, lat: fromBody.lat, lng: fromBody.lng, finalUrl });
    }

    // Try og:url, canonical, and og:image / itemprop="image" (staticmap URLs live here)
    const metaUrls = [
      ...[...chunk.matchAll(/(?:og:url|og:image|canonical)[^>]+?(?:content|href)="([^"]+)"/g)].map(m => m[1]),
      ...[...chunk.matchAll(/itemprop="image"[^>]*content="([^"]+)"/g)].map(m => m[1]),
      ...[...chunk.matchAll(/content="([^"]*staticmap[^"]+)"/g)].map(m => m[1])
    ];
    for (const mu of metaUrls) {
      const fromMeta = extractCoords(mu);
      if (fromMeta) {
        return res.json({ success: true, lat: fromMeta.lat, lng: fromMeta.lng, finalUrl });
      }
    }

    return res.json({ success: false, finalUrl, message: 'Could not extract coordinates from this link' });
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
