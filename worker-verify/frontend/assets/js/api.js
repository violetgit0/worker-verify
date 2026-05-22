// ─── API Helper ──────────────────────────────────────────────────────────────

function getAuthHeaders(isFormData = false) {
  const token = localStorage.getItem('wv_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';
  return headers;
}

// Show/hide the global "server warming up" banner
function _showWakeUpBanner(show) {
  let banner = document.getElementById('_serverWakeUpBanner');
  if (show) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = '_serverWakeUpBanner';
      banner.style.cssText = [
        'position:fixed','top:0','left:0','width:100%','z-index:99999',
        'background:#f59e0b','color:#fff','text-align:center',
        'padding:10px 16px','font-size:14px','font-weight:600',
        'box-shadow:0 2px 8px rgba(0,0,0,.2)'
      ].join(';');
      banner.textContent = '⏳ Server is starting up — please wait up to 90 seconds…';
      document.body.prepend(banner);
    }
  } else if (banner) {
    banner.remove();
  }
}

let _activeRequests = 0;
let _wakeUpTimer    = null;

async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;

  // Show "warming up" banner if server takes >5s
  _activeRequests++;
  _wakeUpTimer = _wakeUpTimer || setTimeout(() => _showWakeUpBanner(true), 5000);

  const controller = new AbortController();
  // 100s timeout — longer than Render's worst-case 90s cold start
  const timer = setTimeout(() => controller.abort(), 100000);

  let res;
  try {
    res = await fetch(CONFIG.API_URL + path, {
      ...options,
      headers: { ...getAuthHeaders(isFormData), ...(options.headers || {}) },
      signal: options.signal || controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    if (--_activeRequests === 0) { clearTimeout(_wakeUpTimer); _wakeUpTimer = null; _showWakeUpBanner(false); }
    if (err.name === 'AbortError') throw new Error('Server did not respond in time. Please reload the page and try again.');
    throw new Error('Cannot connect to server. Please check your connection.');
  }
  clearTimeout(timer);
  if (--_activeRequests === 0) { clearTimeout(_wakeUpTimer); _wakeUpTimer = null; _showWakeUpBanner(false); }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Auto-logout on 401
    if (res.status === 401) {
      localStorage.removeItem('wv_token');
      localStorage.removeItem('wv_user');
      window.location.replace('/index.html');
    }
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }
  return data;
}

const API = {
  // Auth
  login:          (body) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getMe:          ()     => apiFetch('/auth/me'),
  changePassword: (body) => apiFetch('/auth/change-password', { method: 'PUT', body: JSON.stringify(body) }),

  // Dashboard
  adminStats: ()      => apiFetch('/dashboard/admin'),
  staffStats: ()      => apiFetch('/dashboard/staff'),

  // Workers
  getWorkers:          (params = '') => apiFetch('/workers' + params),
  getWorker:           (id)          => apiFetch(`/workers/${id}`),
  registerWorker:      (fd)          => apiFetch('/workers', { method: 'POST', body: fd }),
  quickRegisterWorker: (body)        => apiFetch('/workers/quick', { method: 'POST', body: JSON.stringify(body) }),
  searchWorkers:       (q)           => apiFetch(`/workers/search?q=${encodeURIComponent(q)}`),
  updateStatus:        (id, body)    => apiFetch(`/workers/${id}/status`, { method: 'PUT', body: JSON.stringify(body) }),
  flagDocument:        (id, body)    => apiFetch(`/workers/${id}/flag-document`, { method: 'PUT', body: JSON.stringify(body) }),
  getWorkerCompletion: (id)          => apiFetch(`/workers/${id}/completion`),
  updateRestrictions:  (id, body)    => apiFetch(`/workers/${id}/restrictions`, { method: 'PUT', body: JSON.stringify(body) }),

  // Worker workforce management (super_admin only)
  assignBranch:          (id, body) => apiFetch(`/workers/${id}/assign-branch`,     { method: 'PUT', body: JSON.stringify(body) }),
  assignShift:           (id, body) => apiFetch(`/workers/${id}/assign-shift`,      { method: 'PUT', body: JSON.stringify(body) }),
  updateEmploymentStatus:(id, body) => apiFetch(`/workers/${id}/employment-status`, { method: 'PUT', body: JSON.stringify(body) }),
  setSalary:             (id, body) => apiFetch(`/workers/${id}/salary`,            { method: 'PUT', body: JSON.stringify(body) }),

  // Attendance (admin)
  getAttendance:      (qs = '')       => apiFetch(`/attendance${qs}`),
  getTodayAttendance: (branchId)      => apiFetch(`/attendance/today/${branchId}`),
  getAttendanceReport:(qs = '')       => apiFetch(`/attendance/report${qs}`),
  getWorkerAttendance:(id, qs = '')   => apiFetch(`/attendance/worker/${id}${qs}`),
  adminClockIn:       (body)          => apiFetch('/attendance/admin-clock-in',  { method: 'POST', body: JSON.stringify(body) }),
  adminClockOut:      (body)          => apiFetch('/attendance/admin-clock-out', { method: 'POST', body: JSON.stringify(body) }),
  markAbsent:         (body)          => apiFetch('/attendance/mark-absent',     { method: 'POST', body: JSON.stringify(body) }),

  // Deductions
  getDeductionRules:    ()        => apiFetch('/deductions/rules'),
  createDeductionRule:  (body)    => apiFetch('/deductions/rules', { method: 'POST', body: JSON.stringify(body) }),
  updateDeductionRule:  (id, body)=> apiFetch(`/deductions/rules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDeductionRule:  (id)      => apiFetch(`/deductions/rules/${id}`, { method: 'DELETE' }),
  getDeductions:        (qs = '') => apiFetch(`/deductions${qs}`),
  getWorkerDeductions:  (id, qs='')=> apiFetch(`/deductions/worker/${id}${qs}`),
  createManualDeduction:(body)    => apiFetch('/deductions/manual', { method: 'POST', body: JSON.stringify(body) }),
  deleteDeduction:      (id)      => apiFetch(`/deductions/${id}`, { method: 'DELETE' }),

  // Payroll
  generatePayroll:     (body)     => apiFetch('/payroll/generate', { method: 'POST', body: JSON.stringify(body) }),
  getPayroll:          (qs = '')  => apiFetch(`/payroll${qs}`),
  getPayrollSummary:   (qs = '')  => apiFetch(`/payroll/summary${qs}`),
  getWorkerPayroll:    (id, qs='')=> apiFetch(`/payroll/worker/${id}${qs}`),
  updatePayrollStatus: (id, body) => apiFetch(`/payroll/${id}/status`, { method: 'PUT', body: JSON.stringify(body) }),

  // Worker portal auth
  workerLogin:  (body)    => apiFetch('/worker-auth/login', { method: 'POST', body: JSON.stringify(body) }),
  setWorkerPin: (body)    => apiFetch('/worker-auth/set-pin', { method: 'POST', body: JSON.stringify(body) }),

  // Security Alerts
  getAlertStats:  ()         => apiFetch('/alerts/stats'),
  getAlerts:      (qs = '')  => apiFetch(`/alerts${qs}`),
  resolveAlert:   (id, body) => apiFetch(`/alerts/${id}/resolve`,           { method: 'PUT', body: JSON.stringify(body) }),
  reviewFace:     (id, body) => apiFetch(`/alerts/face-review/${id}`,       { method: 'PUT', body: JSON.stringify(body) }),

  // Branches
  getBranches:   ()       => apiFetch('/branches'),
  getBranch:     (id)     => apiFetch(`/branches/${id}`),
  getBranchWorkers:(id, qs='') => apiFetch(`/branches/${id}/workers${qs}`),
  createBranch:  (body)   => apiFetch('/branches', { method: 'POST', body: JSON.stringify(body) }),
  updateBranch:  (id, body) => apiFetch(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteBranch:  (id)     => apiFetch(`/branches/${id}`, { method: 'DELETE' }),

  // Staff (super_admin only)
  getAllStaff:         (qs='')   => apiFetch(`/staff${qs}`),
  getDeletedStaff:    ()        => apiFetch('/staff?deleted=true'),
  getStaff:           (id)      => apiFetch(`/staff/${id}`),
  createStaff:        (fd)      => apiFetch('/staff', { method: 'POST', body: fd }),
  updateStaff:        (id, fd)  => apiFetch(`/staff/${id}`, { method: 'PUT', body: fd }),
  deleteStaff:        (id)      => apiFetch(`/staff/${id}`, { method: 'DELETE' }),
  restoreStaff:       (id)      => apiFetch(`/staff/${id}/restore`,          { method: 'PUT' }),
  resetAllStaff:      ()        => apiFetch('/staff/reset-all', { method: 'POST', body: JSON.stringify({ confirm: 'RESET_ALL_STAFF' }) }),
  resetStaffPassword: (id, b)   => apiFetch(`/staff/${id}/reset-password`,   { method: 'PUT', body: JSON.stringify(b) }),
  suspendStaff:       (id, b)   => apiFetch(`/staff/${id}/suspend`,          { method: 'PUT', body: JSON.stringify(b) }),
  activateStaff:      (id)      => apiFetch(`/staff/${id}/activate`,         { method: 'PUT' }),
  getStaffLoginHistory:(id)     => apiFetch(`/staff/${id}/login-history`),
  assignStaffBranch:  (id, b)   => apiFetch(`/staff/${id}/assign-branch`,    { method: 'PUT', body: JSON.stringify(b) }),

  // Shifts & Categories
  getCategories:       (qs='')    => apiFetch(`/shifts/categories${qs}`),
  getCategory:         (id)       => apiFetch(`/shifts/categories/${id}`),
  createCategory:      (body)     => apiFetch('/shifts/categories',    { method: 'POST',   body: JSON.stringify(body) }),
  updateCategory:      (id, body) => apiFetch(`/shifts/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory:      (id)       => apiFetch(`/shifts/categories/${id}`, { method: 'DELETE' }),
  getShifts:           (qs='')    => apiFetch(`/shifts${qs}`),
  getShift:            (id)       => apiFetch(`/shifts/${id}`),
  getShiftSummary:     ()         => apiFetch('/shifts/summary'),
  createShift:         (body)     => apiFetch('/shifts',    { method: 'POST',   body: JSON.stringify(body) }),
  updateShift:         (id, body) => apiFetch(`/shifts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteShift:         (id)       => apiFetch(`/shifts/${id}`, { method: 'DELETE' }),
  assignWorkersToShift:(body)     => apiFetch('/shifts/assign-workers', { method: 'POST', body: JSON.stringify(body) }),

  // Activity logs (super_admin only)
  getActivityLogs: (qs = '') => apiFetch(`/activity-logs${qs}`),

  // Permissions (super_admin only)
  updatePermissions: (id, perms) => apiFetch(`/staff/${id}/permissions`,                { method: 'PUT',  body: JSON.stringify({ permissions: perms }) }),
  applyPreset:       (id, preset) => apiFetch(`/staff/${id}/permissions/preset/${preset}`, { method: 'POST' }),

  // Companies (public + company admin)
  getPlans:             ()        => apiFetch('/companies/plans'),
  registerCompany:      (body)    => apiFetch('/companies/register', { method: 'POST', body: JSON.stringify(body) }),
  lookupCompany:        (slug)    => apiFetch(`/companies/lookup/${encodeURIComponent(slug)}`),
  getCompanyProfile:    ()        => apiFetch('/companies/profile'),
  updateCompanyProfile: (body)    => apiFetch('/companies/profile', { method: 'PUT', body: JSON.stringify(body) }),
  updateBranding:       (fd)      => apiFetch('/companies/branding', { method: 'PUT', body: fd }),

  // Billing
  getBillingInfo:  ()     => apiFetch('/billing/subscription'),
  initiateBilling: (body) => apiFetch('/billing/initiate', { method: 'POST', body: JSON.stringify(body) }),

  // Super Admin (platform owner only)
  getPlatformStats:           ()           => apiFetch('/superadmin/stats'),
  getAllCompanies:             (qs = '')    => apiFetch(`/superadmin/companies${qs}`),
  getSuperAdminCompany:       (id)         => apiFetch(`/superadmin/companies/${id}`),
  suspendCompany:             (id, body)   => apiFetch(`/superadmin/companies/${id}/suspend`,      { method: 'PUT', body: JSON.stringify(body) }),
  activateCompany:            (id)         => apiFetch(`/superadmin/companies/${id}/activate`,     { method: 'PUT' }),
  updateCompanySubscription:  (id, body)   => apiFetch(`/superadmin/companies/${id}/subscription`, { method: 'PUT', body: JSON.stringify(body) }),
  getSuperAdminPlans:         ()           => apiFetch('/superadmin/plans'),
  createPlan:                 (body)       => apiFetch('/superadmin/plans',      { method: 'POST', body: JSON.stringify(body) }),
  updatePlan:                 (id, body)   => apiFetch(`/superadmin/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  getPlatformLogs:            (qs = '')    => apiFetch(`/superadmin/logs${qs}`),
  resetSystem:                ()           => apiFetch('/superadmin/reset-all', { method: 'POST', body: JSON.stringify({ confirm: 'RESET_ALL_COMPANIES' }) })
};
