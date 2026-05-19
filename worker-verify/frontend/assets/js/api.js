// ─── API Helper ──────────────────────────────────────────────────────────────

function getAuthHeaders(isFormData = false) {
  const token = localStorage.getItem('wv_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';
  return headers;
}

async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(CONFIG.API_URL + path, {
    ...options,
    headers: { ...getAuthHeaders(isFormData), ...(options.headers || {}) }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Auto-logout on 401
    if (res.status === 401) {
      localStorage.removeItem('wv_token');
      localStorage.removeItem('wv_user');
      window.location.href = '/index.html';
    }
    throw new Error(data.message || `HTTP ${res.status}`);
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
  getWorkers:    (params = '') => apiFetch('/workers' + params),
  getWorker:     (id)          => apiFetch(`/workers/${id}`),
  registerWorker:(fd)          => apiFetch('/workers', { method: 'POST', body: fd }),
  searchWorkers: (q)           => apiFetch(`/workers/search?q=${encodeURIComponent(q)}`),
  updateStatus:  (id, body)    => apiFetch(`/workers/${id}/status`, { method: 'PUT', body: JSON.stringify(body) }),
  flagDocument:  (id, body)    => apiFetch(`/workers/${id}/flag-document`, { method: 'PUT', body: JSON.stringify(body) }),

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
  getAllStaff:         ()        => apiFetch('/staff'),
  getStaff:           (id)      => apiFetch(`/staff/${id}`),
  createStaff:        (fd)      => apiFetch('/staff', { method: 'POST', body: fd }),
  updateStaff:        (id, fd)  => apiFetch(`/staff/${id}`, { method: 'PUT', body: fd }),
  deleteStaff:        (id)      => apiFetch(`/staff/${id}`, { method: 'DELETE' }),
  resetStaffPassword: (id, b)   => apiFetch(`/staff/${id}/reset-password`,  { method: 'PUT', body: JSON.stringify(b) }),
  suspendStaff:       (id, b)   => apiFetch(`/staff/${id}/suspend`,          { method: 'PUT', body: JSON.stringify(b) }),
  activateStaff:      (id)      => apiFetch(`/staff/${id}/activate`,         { method: 'PUT' }),
  getStaffLoginHistory:(id)     => apiFetch(`/staff/${id}/login-history`),
  assignStaffBranch:  (id, b)   => apiFetch(`/staff/${id}/assign-branch`,    { method: 'PUT', body: JSON.stringify(b) }),

  // Activity logs (super_admin only)
  getActivityLogs: (qs = '') => apiFetch(`/activity-logs${qs}`),

  // Permissions (super_admin only)
  updatePermissions: (id, perms) => apiFetch(`/staff/${id}/permissions`,                { method: 'PUT',  body: JSON.stringify({ permissions: perms }) }),
  applyPreset:       (id, preset) => apiFetch(`/staff/${id}/permissions/preset/${preset}`, { method: 'POST' })
};
