// Central API client — all calls go through here
const API = (() => {
  function token() { return localStorage.getItem('sage_token') || ''; }

  async function req(method, path, data, isForm) {
    const headers = { Authorization: `Bearer ${token()}` };
    if (!isForm) headers['Content-Type'] = 'application/json';
    const opts = { method, headers };
    if (data) opts.body = isForm ? data : JSON.stringify(data);
    const res = await fetch(CONFIG.API_URL + path, opts);
    const json = await res.json().catch(() => ({ success: false, message: 'Invalid response' }));
    if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
    return json;
  }

  const get  = (path)        => req('GET',    path);
  const post = (path, body, isForm) => req('POST', path, body, isForm);
  const put  = (path, body, isForm) => req('PUT',  path, body, isForm);
  const del  = (path)        => req('DELETE', path);

  return {
    // Auth
    auth: {
      register:      (d) => post('/auth/register', d),
      login:         (d) => post('/auth/login', d),
      getMe:         ()  => get('/auth/me'),
      changePassword:(d) => put('/auth/change-password', d),
      lookup:        (slug) => get(`/auth/lookup/${slug}`)
    },

    // Branches
    branches: {
      list:   ()     => get('/branches'),
      get:    (id)   => get(`/branches/${id}`),
      create: (d)    => post('/branches', d),
      update: (id,d) => put(`/branches/${id}`, d),
      delete: (id)   => del(`/branches/${id}`)
    },

    // Roles
    roles: {
      list:   ()     => get('/roles'),
      create: (d)    => post('/roles', d),
      update: (id,d) => put(`/roles/${id}`, d),
      delete: (id)   => del(`/roles/${id}`)
    },

    // Schedules
    schedules: {
      list:   ()     => get('/schedules'),
      get:    (id)   => get(`/schedules/${id}`),
      create: (d)    => post('/schedules', d),
      update: (id,d) => put(`/schedules/${id}`, d),
      delete: (id)   => del(`/schedules/${id}`)
    },

    // Workers
    workers: {
      list:   (params) => get('/workers?' + new URLSearchParams(params || {})),
      search: (q)      => get(`/workers/search?q=${encodeURIComponent(q)}`),
      get:    (id)     => get(`/workers/${id}`),
      create: (fd)     => post('/workers', fd, true),
      update: (id, fd) => put(`/workers/${id}`, fd, true),
      delete: (id)     => del(`/workers/${id}`)
    },

    // Attendance
    attendance: {
      list:    (params)  => get('/attendance?' + new URLSearchParams(params || {})),
      today:   (branchId)=> get(`/attendance/today/${branchId}`),
      worker:  (wid, p)  => get(`/attendance/worker/${wid}?` + new URLSearchParams(p || {})),
      clockIn: (d)       => post('/attendance/clock-in', d),
      clockOut:(d)       => post('/attendance/clock-out', d),
      markAbsent:(d)     => post('/attendance/mark-absent', d)
    },

    // Payroll
    payroll: {
      list:          (params) => get('/payroll?' + new URLSearchParams(params || {})),
      worker:        (wid, p) => get(`/payroll/worker/${wid}?` + new URLSearchParams(p || {})),
      generate:      (d)      => post('/payroll/generate', d),
      addDeduction:  (id, d)  => post(`/payroll/${id}/manual-deduction`, d),
      updateStatus:  (id, d)  => put(`/payroll/${id}/status`, d)
    },

    // Shortages
    shortages: {
      list:    (params) => get('/shortages?' + new URLSearchParams(params || {})),
      create:  (d)      => post('/shortages', d),
      approve: (id, d)  => put(`/shortages/${id}/approve`, d),
      reject:  (id, d)  => put(`/shortages/${id}/reject`, d),
      delete:  (id)     => del(`/shortages/${id}`)
    },

    // Sales
    sales: {
      list:    (params) => get('/sales?' + new URLSearchParams(params || {})),
      summary: (params) => get('/sales/summary?' + new URLSearchParams(params || {})),
      create:  (d)      => post('/sales', d),
      update:  (id, d)  => put(`/sales/${id}`, d),
      delete:  (id)     => del(`/sales/${id}`)
    },

    // Dashboard
    dashboard: {
      get: (params) => get('/dashboard?' + new URLSearchParams(params || {}))
    }
  };
})();
