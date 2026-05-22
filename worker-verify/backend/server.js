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
    if (
      !origin ||
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      /\.vercel\.app$/.test(origin) ||
      /\.onrender\.com$/.test(origin) ||
      /\.netlify\.app$/.test(origin) ||
      /\.railway\.app$/.test(origin) ||
      /localhost/.test(origin)
    ) {
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
const FRONTEND_DIR = path.join(__dirname, '../frontend');
app.use(express.static(FRONTEND_DIR));

// Explicit root handler — guarantees index.html is served for /
app.get('/', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

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
app.use('/api/shifts',      require('./routes/shifts'));
app.use('/api/schedules',   require('./routes/schedules'));

// Platform super admin
app.use('/api/superadmin',  require('./routes/superadmin'));

// ── Health & Utilities ────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'WorkerSave API is running', version: '2.0.0' });
});

// Resolve shortened Google Maps links server-side
app.get('/api/resolve-maps', async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).json({ success: false, message: 'url query param required' });
  // Normalise — add https:// if pasted without scheme
  if (!/^https?:\/\//i.test(url) && !url.toLowerCase().startsWith('geo:')) {
    url = 'https://' + url;
  }

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  // Extract coords from a Google Maps URL (NOT from raw HTML bodies).
  // Only matches patterns that are definitively the place location — not IP-based defaults.
  const extractCoordsFromUrl = (text) => {
    const t = text.replace(/%2C/gi, ',').replace(/%3D/gi, '=').replace(/&amp;/g, '&');
    // @lat,lng,zoom — only in canonical Maps URLs
    const m1 = t.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
    if (m1) return { lat: parseFloat(m1[1]), lng: parseFloat(m1[2]) };
    // !3d<lat>!4d<lng> — place data encoding
    const m2 = t.match(/!3d(-?\d+\.?\d+)!4d(-?\d+\.?\d+)/);
    if (m2) return { lat: parseFloat(m2[1]), lng: parseFloat(m2[2]) };
    // URL query params q=, ll=, center= when on the URL itself (not from HTML body)
    try {
      const u = new URL(t.startsWith('http') ? t : 'https://x.invalid/?' + t);
      for (const p of ['q', 'll', 'center']) {
        const v = u.searchParams.get(p);
        if (v) {
          const m = v.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
          if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
        }
      }
    } catch (_) {}
    return null;
  };

  // Extract place name from a Google Maps URL — handles two redirect formats:
  // 1. /maps/place/NAME/data=...   (g_st=ac links)
  // 2. /maps?q=NAME&ftid=...       (g_st=ic links)
  const extractPlaceName = (mapUrl) => {
    try {
      const u = new URL(mapUrl);
      // Format 1: place name in path
      const parts = u.pathname.split('/');
      const pi = parts.indexOf('place');
      if (pi !== -1 && parts[pi + 1]) {
        return decodeURIComponent(parts[pi + 1].replace(/\+/g, ' '));
      }
      // Format 2: place name in q= param (only when it's a name, not bare coordinates)
      const q = u.searchParams.get('q');
      if (q && !/^-?\d+\.?\d*[,\s]+-?\d+\.?\d*$/.test(q.trim())) {
        return q;
      }
    } catch (_) {}
    return null;
  };

  // Geocode via Nominatim (OSM) — tries progressively simpler queries
  // so specific business names that OSM doesn't know still resolve via address
  const nominatimGeocode = async (placeName) => {
    const parts = placeName.split(',').map(p => p.trim()).filter(Boolean);
    // Remove pure 6-digit postcodes from parts list
    const noPc = parts.filter(p => !/^\d{5,6}$/.test(p));
    const queries = [
      placeName,
      parts.slice(1).join(', '),                     // no business name
      noPc.slice(1).join(', '),                       // no business, no postcode
      [noPc[1], noPc[noPc.length - 2], noPc[noPc.length - 1]].filter(Boolean).join(', '), // street + city + state
      noPc.slice(-2).join(', '),                      // just city + state
    ].filter((q, i, a) => q && q.length > 3 && a.indexOf(q) === i);

    for (const q of queries) {
      try {
        console.log('[resolve-maps] Nominatim query:', q);
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
          { headers: { 'User-Agent': 'WorkerVerify/2.0 contact:violet.okomi@miva.edu.ng' },
            signal: AbortSignal.timeout(8000) }
        );
        const data = await nomRes.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log('[resolve-maps] Nominatim hit on query:', q);
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
      } catch (_) {}
    }
    return null;
  };

  try {
    // Step 1: GET with redirect:follow — captures final URL after all redirects
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
    console.log('[resolve-maps] finalUrl:', finalUrl.slice(0, 120));

    // Step 2: extract coords from the redirected URL itself (@lat,lng or !3d!4d)
    const fromUrl = extractCoordsFromUrl(finalUrl);
    if (fromUrl) {
      console.log('[resolve-maps] coords from URL:', fromUrl);
      return res.json({ success: true, ...fromUrl, finalUrl });
    }

    // Step 3: place name → Nominatim (OSM) geocoding.
    // HTML body scraping is intentionally skipped — Google embeds its IP-based
    // geolocation (Render US servers → Texas) into staticmap center= params,
    // producing completely wrong coordinates for non-US places.
    const placeName = extractPlaceName(finalUrl);
    if (placeName) {
      console.log('[resolve-maps] no coords in URL, trying Nominatim for:', placeName);
      const fromNominatim = await nominatimGeocode(placeName);
      if (fromNominatim) {
        console.log('[resolve-maps] coords from Nominatim:', fromNominatim);
        return res.json({ success: true, ...fromNominatim, finalUrl });
      }
    }

    console.log('[resolve-maps] all methods failed, finalUrl:', finalUrl.slice(0, 200));
    return res.json({ success: false, finalUrl, message: 'Could not extract coordinates from this link' });
  } catch (err) {
    console.error('[resolve-maps] error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── SPA Catch-all — serve index.html for any non-API GET ─────────────────────
// Prevents 404/JSON for deep-links and refreshes on frontend routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Global Error Handler]', err.stack);
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// ── Prevent unhandled rejections from crashing Render ────────────────────────
// Express 4 does NOT auto-catch unhandled promise rejections in route handlers.
// Without this, any async route without try-catch causes a 502 on Render.
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection] at:', promise, 'reason:', reason);
  // Do NOT exit — let the request time out gracefully instead of crashing.
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  // Only exit for truly unrecoverable errors (syntax errors, etc.)
  // For async/operational errors we log and keep running.
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`WorkerSave API v2.0 running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`));
