// ─── Enhanced Location System ─────────────────────────────────────────────────
// Supports: Address Search (Nominatim autocomplete), Google Maps Links,
//           Google Plus Codes (Open Location Code), GPS Coordinates
// All APIs are free and require no key.

const OSM_TILE    = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR    = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';
const NOM_BASE    = 'https://nominatim.openstreetmap.org';
const MAP_DEFAULT_LAT  = 9.0820;
const MAP_DEFAULT_LNG  = 8.6753;
const MAP_DEFAULT_ZOOM = 6;

// ─── GOOGLE MAPS URL PARSER ───────────────────────────────────────────────────
// Handles: maps.google.com, google.com/maps/@, google.com/maps/place/.../@, geo:
function parseGoogleMapsLink(url) {
  try {
    url = url.trim();

    // geo: URI  →  geo:6.5244,3.3792
    if (url.toLowerCase().startsWith('geo:')) {
      const m = url.match(/geo:(-?\d+\.?\d*),(-?\d+\.?\d*)/i);
      if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    }

    // !3d<lat>!4d<lng>  (Google Maps data parameter, any URL format)
    const dataMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
    if (dataMatch) return { lat: parseFloat(dataMatch[1]), lng: parseFloat(dataMatch[2]) };

    const u = new URL(url);

    // @lat,lng[,zoom] in the path  →  google.com/maps/@6.5244,3.3792,15z
    const atMatch = u.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

    // ?ll=lat,lng
    const ll = u.searchParams.get('ll');
    if (ll) {
      const [lat, lng] = ll.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }

    // ?q=lat,lng  (only if pure coordinates, not a place name)
    const q = u.searchParams.get('q');
    if (q) {
      const qm = q.trim().match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
      if (qm) return { lat: parseFloat(qm[1]), lng: parseFloat(qm[2]) };
    }

    // ?center=lat,lng  (some embedded map URLs)
    const center = u.searchParams.get('center');
    if (center) {
      const [lat, lng] = center.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
  } catch (_) {
    // If URL() fails try raw coordinate extraction
    const coordMatch = url.match(/(-?\d{1,2}\.\d{4,})[,\s]+(-?\d{1,3}\.\d{4,})/);
    if (coordMatch) return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
  }
  return null;
}

// ─── GOOGLE MAPS LINK GENERATOR ───────────────────────────────────────────────
function makeGoogleMapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${parseFloat(lat).toFixed(7)},${parseFloat(lng).toFixed(7)}`;
}

// ─── PLUS CODE RESOLVER ───────────────────────────────────────────────────────
// Uses open-location-code library if loaded, falls back to Nominatim search
async function resolvePlusCode(code) {
  code = code.trim().toUpperCase();

  // Basic Plus Code validation: "XXXX+XX" or "XXXX+XX City"
  const OLC_CHARS  = '[23456789CFGHJMPQRVWX]';
  const shortFull  = new RegExp(`^${OLC_CHARS}{4,8}\\+${OLC_CHARS}{0,2}(\\s.+)?$`, 'i');
  if (!shortFull.test(code)) {
    throw new Error('Invalid Plus Code. Example: 7FG8+5W Lagos  or  6GCRMQPX+97');
  }

  const parts     = code.split(/\s+/);
  const plusPart  = parts[0];
  const reference = parts.slice(1).join(' ');

  if (typeof OpenLocationCode !== 'undefined') {
    let fullCode = plusPart;
    if (!OpenLocationCode.isFull(fullCode)) {
      if (!reference) throw new Error('Short Plus Code needs a reference city, e.g. "7FG8+5W Lagos"');
      const refRes = await nominatimSearch(reference);
      if (!refRes) throw new Error(`Could not find reference location: ${reference}`);
      fullCode = OpenLocationCode.recoverNearest(fullCode, refRes.lat, refRes.lng);
    }
    const decoded = OpenLocationCode.decode(fullCode);
    return { lat: decoded.latitudeCenter, lng: decoded.longitudeCenter, plusCode: fullCode };
  }

  // Fallback: search Nominatim directly with the raw code
  const res = await nominatimSearch(code);
  if (!res) throw new Error('Could not resolve this Plus Code. Try entering coordinates directly.');
  return { lat: res.lat, lng: res.lng, plusCode: plusPart };
}

// ─── NOMINATIM HELPERS ────────────────────────────────────────────────────────
async function nominatimSearch(query) {
  try {
    const r = await fetch(
      `${NOM_BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const results = await r.json();
    if (!results.length) return null;
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), address: results[0].display_name };
  } catch { return null; }
}

async function nominatimAutocomplete(query) {
  if (query.length < 3) return [];
  try {
    const r = await fetch(
      `${NOM_BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    return await r.json();
  } catch { return []; }
}

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(
      `${NOM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const d = await r.json();
    return d.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch { return `${lat.toFixed(6)}, ${lng.toFixed(6)}`; }
}

// ─── OPEN LOCATION PICKER MODAL ───────────────────────────────────────────────
function openLocationPicker(fieldPrefix, labelText = 'Pin Location') {
  document.getElementById('mapPickerModal')?.remove();

  const modal = document.createElement('div');
  modal.id        = 'mapPickerModal';
  modal.className = 'map-picker-modal';
  modal.innerHTML = `
    <div class="map-picker-content loc-picker-content">
      <div class="map-picker-header">
        <h3>📍 ${labelText}</h3>
        <button class="btn-icon" id="mapPickerClose">&#x2715;</button>
      </div>

      <!-- Method tabs -->
      <div class="loc-tabs">
        <button class="loc-tab active" data-tab="address">🔍 Search Address</button>
        <button class="loc-tab" data-tab="mapslink">🔗 Maps Link</button>
        <button class="loc-tab" data-tab="pluscode">🔢 Plus Code</button>
        <button class="loc-tab" data-tab="gps">🌐 GPS</button>
      </div>

      <!-- ── ADDRESS TAB ── -->
      <div class="loc-tab-panel active" id="locTab_address">
        <div class="loc-input-row">
          <div class="loc-search-wrap">
            <input id="locAddressInput" type="text" class="form-control"
              placeholder="Type street, area, city, state…" autocomplete="off" />
            <div class="loc-autocomplete" id="locSuggestions"></div>
          </div>
          <button class="btn btn-primary btn-sm" id="locAddressSearch">Search</button>
        </div>
        <div class="loc-hint">💡 Type any address and select from suggestions, or click the map directly</div>
      </div>

      <!-- ── MAPS LINK TAB ── -->
      <div class="loc-tab-panel" id="locTab_mapslink">
        <div class="loc-input-row">
          <input id="locMapsLinkInput" type="text" class="form-control"
            placeholder="Paste Google Maps link here…" />
          <button class="btn btn-primary btn-sm" id="locMapsLinkExtract">Extract</button>
        </div>
        <div class="loc-hint">
          ✅ Supports all Google Maps links — full links, short links (<code>maps.app.goo.gl</code>), and <code>geo:</code> URIs
        </div>
      </div>

      <!-- ── PLUS CODE TAB ── -->
      <div class="loc-tab-panel" id="locTab_pluscode">
        <div class="loc-input-row">
          <input id="locPlusCodeInput" type="text" class="form-control"
            placeholder="e.g.  7FG8+5W Lagos   or   6GCRMQPX+97"
            style="letter-spacing:.08em;font-family:monospace;" />
          <button class="btn btn-primary btn-sm" id="locPlusCodeResolve">Resolve</button>
        </div>
        <div class="loc-hint">
          💡 Find your Plus Code in Google Maps → Share → Copy Plus Code<br/>
          Short codes (e.g. <code>7FG8+5W</code>) need a city name after them
        </div>
      </div>

      <!-- ── GPS TAB ── -->
      <div class="loc-tab-panel" id="locTab_gps">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div>
            <label class="form-label" style="font-size:12px;margin-bottom:4px;">Latitude</label>
            <input id="locGpsLat" type="text" class="form-control"
              placeholder="e.g. 6.5244" inputmode="decimal" />
          </div>
          <div>
            <label class="form-label" style="font-size:12px;margin-bottom:4px;">Longitude</label>
            <input id="locGpsLng" type="text" class="form-control"
              placeholder="e.g. 3.3792" inputmode="decimal" />
          </div>
        </div>
        <button class="btn btn-primary btn-sm w-full" id="locGpsGo">📍 Go to Coordinates</button>
        <div class="loc-hint">💡 You can also paste both as <code>6.5244, 3.3792</code> in the Latitude field</div>
      </div>

      <!-- Map -->
      <div id="mapPickerContainer" class="loc-map-container"></div>
      <p class="map-hint">🖱️ Click anywhere on the map to fine-tune the pin. Drag the marker to adjust.</p>
      <div id="pickedAddress" class="picked-address"></div>

      <div class="map-picker-footer">
        <button class="btn btn-secondary" id="mapCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="confirmLocationBtn" disabled>✅ Confirm Location</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // ── Close handlers ──────────────────────────────────────────────────────────
  modal.querySelector('#mapPickerClose').onclick = () => modal.remove();
  modal.querySelector('#mapCancelBtn').onclick   = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // ── Tab switching ───────────────────────────────────────────────────────────
  modal.querySelectorAll('.loc-tab').forEach(btn => {
    btn.onclick = () => {
      modal.querySelectorAll('.loc-tab').forEach(b => b.classList.remove('active'));
      modal.querySelectorAll('.loc-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      modal.querySelector(`#locTab_${btn.dataset.tab}`).classList.add('active');
    };
  });

  // ── Init Leaflet map ────────────────────────────────────────────────────────
  const map = L.map('mapPickerContainer').setView([MAP_DEFAULT_LAT, MAP_DEFAULT_LNG], MAP_DEFAULT_ZOOM);
  L.tileLayer(OSM_TILE, { attribution: OSM_ATTR, maxZoom: 19 }).addTo(map);
  setTimeout(() => map.invalidateSize(), 200);

  let marker        = null;
  let pickedPlusCode = '';
  let pickedMapsLink = '';
  let pickedMethod   = 'map';

  // ── Core: place/move pin, reverse-geocode, update confirm button ────────────
  async function pinAt(lat, lng, method, preAddress = '', prePlusCode = '') {
    pickedMethod   = method;
    pickedPlusCode = prePlusCode;
    pickedMapsLink = makeGoogleMapsLink(lat, lng);

    // Store on modal dataset immediately (so Confirm works even if fetch is slow)
    Object.assign(modal.dataset, {
      lat: lat, lng: lng,
      address: preAddress || '',
      plusCode: prePlusCode,
      mapsLink: pickedMapsLink,
      method:   method
    });

    // Fly map
    map.flyTo([lat, lng], 16, { duration: 1.0 });

    // Place draggable marker
    if (marker) marker.remove();
    marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    marker.on('dragend', async () => {
      const p = marker.getLatLng();
      await pinAt(p.lat, p.lng, 'map');
    });

    // Update address display
    const addrEl = document.getElementById('pickedAddress');
    const btnEl  = document.getElementById('confirmLocationBtn');
    if (!addrEl) return;

    if (preAddress) {
      addrEl.innerHTML = `<span class="loc-pin-icon">📍</span> ${preAddress}`;
      btnEl.disabled   = false;
      modal.dataset.address = preAddress;
    } else {
      addrEl.innerHTML = `<span class="loc-pin-icon">📍</span> <em style="color:var(--gray-400);">Getting address…</em>`;
      btnEl.disabled   = true;
      const resolved = await reverseGeocode(lat, lng);
      const addrEl2  = document.getElementById('pickedAddress');
      const btnEl2   = document.getElementById('confirmLocationBtn');
      if (!addrEl2) return;
      addrEl2.innerHTML   = `<span class="loc-pin-icon">📍</span> ${resolved}`;
      btnEl2.disabled     = false;
      modal.dataset.address = resolved;
    }
  }

  // Click-on-map
  map.on('click', e => pinAt(e.latlng.lat, e.latlng.lng, 'map'));

  // ── ADDRESS SEARCH TAB ──────────────────────────────────────────────────────
  let sugTimer = null;
  const addrInput   = document.getElementById('locAddressInput');
  const suggestions = document.getElementById('locSuggestions');

  function hideSuggestions() { suggestions.innerHTML = ''; suggestions.style.display = 'none'; }

  addrInput.addEventListener('input', () => {
    clearTimeout(sugTimer);
    const q = addrInput.value.trim();
    if (q.length < 3) { hideSuggestions(); return; }
    sugTimer = setTimeout(async () => {
      const results = await nominatimAutocomplete(q);
      if (!results.length) { hideSuggestions(); return; }
      suggestions.innerHTML = results.map(r =>
        `<div class="loc-suggestion"
              data-lat="${r.lat}" data-lng="${r.lon}"
              data-addr="${encodeURIComponent(r.display_name)}">
           📍 ${r.display_name}
         </div>`
      ).join('');
      suggestions.style.display = 'block';
      suggestions.querySelectorAll('.loc-suggestion').forEach(el => {
        el.onclick = () => {
          hideSuggestions();
          const addr = decodeURIComponent(el.dataset.addr);
          addrInput.value = addr.split(',').slice(0, 3).join(',').trim();
          pinAt(parseFloat(el.dataset.lat), parseFloat(el.dataset.lng), 'address', addr);
        };
      });
    }, 350);
  });

  document.addEventListener('click', e => {
    if (!suggestions.contains(e.target) && e.target !== addrInput) hideSuggestions();
  });

  async function doAddressSearch() {
    const q = addrInput.value.trim();
    if (!q) return;
    hideSuggestions();
    const res = await nominatimSearch(q);
    if (!res) {
      showToast('Address not found. Try more detail, or click the map directly.', 'error');
      return;
    }
    addrInput.value = res.address.split(',').slice(0, 3).join(',').trim();
    pinAt(res.lat, res.lng, 'address', res.address);
  }

  modal.querySelector('#locAddressSearch').onclick = doAddressSearch;
  addrInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAddressSearch(); } });

  // ── MAPS LINK TAB ───────────────────────────────────────────────────────────
  const isShortLink = (url) => /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);

  const doMapsLinkExtract = async () => {
    const raw = document.getElementById('locMapsLinkInput').value.trim();
    if (!raw) { showToast('Paste a Google Maps link first', 'error'); return; }

    const extractBtn = modal.querySelector('#locMapsLinkExtract');

    // Try direct parsing first (works for full links)
    const coords = parseGoogleMapsLink(raw);
    if (coords) {
      pinAt(coords.lat, coords.lng, 'maps_link');
      setTimeout(() => { modal.dataset.mapsLink = raw; }, 50);
      return;
    }

    // Shortened link — resolve via backend proxy
    if (isShortLink(raw)) {
      extractBtn.disabled = true;
      extractBtn.textContent = '⏳ Resolving…';
      try {
        const apiBase = (window.CONFIG?.API_URL || 'http://localhost:5001/api').replace(/\/api$/, '');
        const res = await fetch(`${apiBase}/api/resolve-maps?url=${encodeURIComponent(raw)}`);
        const data = await res.json();
        if (data.success && data.lat && data.lng) {
          pinAt(data.lat, data.lng, 'maps_link');
          setTimeout(() => { modal.dataset.mapsLink = raw; }, 50);
        } else {
          showToast('Could not extract coordinates from this link. Try the GPS tab.', 'error');
        }
      } catch (_) {
        showToast('Server error resolving link. Try the GPS tab.', 'error');
      } finally {
        extractBtn.disabled = false;
        extractBtn.textContent = 'Extract';
      }
      return;
    }

    showToast('Could not extract coordinates. Try a full Maps link or use the GPS tab.', 'error');
  };
  modal.querySelector('#locMapsLinkExtract').onclick = doMapsLinkExtract;
  document.getElementById('locMapsLinkInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doMapsLinkExtract(); }
  });

  // ── PLUS CODE TAB ───────────────────────────────────────────────────────────
  const doPlusCode = async () => {
    const code = document.getElementById('locPlusCodeInput').value.trim();
    if (!code) { showToast('Enter a Plus Code first', 'error'); return; }
    try {
      const res = await resolvePlusCode(code);
      await pinAt(res.lat, res.lng, 'plus_code', '', res.plusCode || code);
      modal.dataset.plusCode = res.plusCode || code;
    } catch (err) {
      showToast(err.message || 'Could not resolve Plus Code', 'error');
    }
  };
  modal.querySelector('#locPlusCodeResolve').onclick = doPlusCode;
  document.getElementById('locPlusCodeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doPlusCode(); }
  });

  // ── GPS COORDINATES TAB ─────────────────────────────────────────────────────
  const doGps = () => {
    let latVal = document.getElementById('locGpsLat').value.trim();
    let lngVal = document.getElementById('locGpsLng').value.trim();

    // Support "lat, lng" pasted in lat field
    const both = latVal.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (both) {
      latVal = both[1]; lngVal = both[2];
      document.getElementById('locGpsLng').value = lngVal;
    }

    const lat = parseFloat(latVal), lng = parseFloat(lngVal);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showToast('Invalid coordinates. Lat: −90 to 90 · Lng: −180 to 180', 'error');
      return;
    }
    pinAt(lat, lng, 'gps');
  };
  modal.querySelector('#locGpsGo').onclick = doGps;
  document.getElementById('locGpsLat').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doGps(); }
  });
  document.getElementById('locGpsLng').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doGps(); }
  });

  // ── CONFIRM ─────────────────────────────────────────────────────────────────
  modal.querySelector('#confirmLocationBtn').onclick = () => confirmLocation(fieldPrefix);
}

// ─── CONFIRM + FILL FORM FIELDS ───────────────────────────────────────────────
function confirmLocation(fieldPrefix) {
  const modal = document.getElementById('mapPickerModal');
  if (!modal) return;

  const lat      = modal.dataset.lat      || '';
  const lng      = modal.dataset.lng      || '';
  const addr     = modal.dataset.address  || '';
  const plusCode = modal.dataset.plusCode || '';
  const mapsLink = modal.dataset.mapsLink || makeGoogleMapsLink(parseFloat(lat), parseFloat(lng));
  const method   = modal.dataset.method   || 'map';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

  set(`${fieldPrefix}LocationLat`,      lat);
  set(`${fieldPrefix}LocationLng`,      lng);
  set(`${fieldPrefix}LocationAddress`,  addr);
  set(`${fieldPrefix}LocationPlusCode`, plusCode);
  set(`${fieldPrefix}LocationMapsLink`, mapsLink);
  set(`${fieldPrefix}LocationMethod`,   method);

  // Build display card
  const dispEl = document.getElementById(`${fieldPrefix}LocationDisplay`);
  if (dispEl) {
    const shortAddr = addr.split(',').slice(0, 3).join(',').trim() ||
                      `${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}`;
    dispEl.innerHTML = `
      <div class="loc-confirmed-card">
        <div class="loc-confirmed-icon">📍</div>
        <div class="loc-confirmed-body">
          <div class="loc-confirmed-address">${shortAddr}</div>
          <div class="loc-confirmed-meta">
            ${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}
            ${plusCode ? `&nbsp;·&nbsp;<span class="loc-plus-code-tag">${plusCode}</span>` : ''}
          </div>
          <div class="loc-confirmed-actions">
            <a href="${mapsLink}" target="_blank" rel="noopener" class="loc-open-maps">🗺 Open in Maps ↗</a>
            <button type="button" class="loc-change-btn"
              onclick="openLocationPicker('${fieldPrefix}','Change Location')">✏️ Change</button>
          </div>
        </div>
      </div>
    `;
  }

  modal.remove();
  showToast('Location saved ✓', 'success');
}

// ─── READ-ONLY / ADMIN MAP VIEW ───────────────────────────────────────────────
function showStaticMap(containerId, lat, lng, opts = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!lat || !lng) {
    el.innerHTML     = `<div class="loc-no-location">📍 No location pinned</div>`;
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    return;
  }

  el.innerHTML     = '';
  el.style.display = 'block';
  el.style.position = 'relative';

  const interactive = opts.interactive !== false;
  const mapOpts = interactive
    ? { zoomControl: true,  dragging: true,  scrollWheelZoom: false, doubleClickZoom: true,  attributionControl: true }
    : { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, attributionControl: true,
        keyboard: false, tap: false };

  const map = L.map(containerId, mapOpts).setView([parseFloat(lat), parseFloat(lng)], 15);
  L.tileLayer(OSM_TILE, { attribution: OSM_ATTR, maxZoom: 19 }).addTo(map);

  const pin = L.marker([parseFloat(lat), parseFloat(lng)]).addTo(map);
  if (opts.address) {
    const shortAddr = opts.address.split(',').slice(0, 2).join(',').trim();
    pin.bindPopup(`<strong>📍</strong> ${shortAddr}`);
  }

  // Admin overlay controls — render below map in ctrlContainer if provided
  if (interactive) {
    const mapsLink = opts.mapsLink || makeGoogleMapsLink(parseFloat(lat), parseFloat(lng));
    const coordStr = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;

    const ctrl = document.createElement('div');
    ctrl.className = 'loc-map-ctrl-bar';
    ctrl.innerHTML = `
      <a href="${mapsLink}" target="_blank" rel="noopener" class="loc-ctrl-btn loc-ctrl-maps">
        🗺 Open in Maps
      </a>
      <button type="button" class="loc-ctrl-btn loc-ctrl-copy"
        onclick="navigator.clipboard.writeText('${coordStr}').then(()=>showToast('Coordinates copied ✓','success'))">
        📋 Copy Coords
      </button>
      ${opts.plusCode ? `<span class="loc-ctrl-chip">📌 ${opts.plusCode}</span>` : ''}
      ${opts.address ? `<span class="loc-ctrl-chip" style="font-family:inherit;font-size:.72rem;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${opts.address}">📍 ${opts.address.split(',').slice(0,2).join(',')}</span>` : ''}
      ${opts.inputMethod && opts.inputMethod !== 'map'
        ? `<span class="loc-ctrl-chip loc-method-chip">${opts.inputMethod.replace(/_/g,' ')}</span>`
        : ''}
    `;

    const ctrlTarget = opts.ctrlContainer
      ? (document.getElementById(opts.ctrlContainer) || el.parentNode)
      : el.parentNode;
    ctrlTarget.appendChild(ctrl);
  }
}
