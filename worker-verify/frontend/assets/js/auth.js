// ─── Auth Utilities ───────────────────────────────────────────────────────────

function getUser() {
  try { return JSON.parse(localStorage.getItem('wv_user')); } catch { return null; }
}

function getToken() {
  return localStorage.getItem('wv_token');
}

function saveSession(token, user) {
  localStorage.setItem('wv_token', token);
  localStorage.setItem('wv_user', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('wv_token');
  localStorage.removeItem('wv_user');
  window.location.replace('/index.html');
}

// Call on every protected page – redirects to login if not authenticated
function requireAuth(allowedRoles = []) {
  const user = getUser();
  const token = getToken();

  if (!token || !user) {
    window.location.replace('/index.html');
    return null;
  }

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    if (user.role === 'super_admin' && !user.company) {
      window.location.href = '/superadmin/dashboard.html';
    } else if (['super_admin', 'company_admin'].includes(user.role)) {
      window.location.href = '/admin/dashboard.html';
    } else {
      window.location.href = '/staff/dashboard.html';
    }
    return null;
  }

  return user;
}

const ROLE_DISPLAY = {
  super_admin:          'Platform Admin',
  company_admin:        'Company Admin',
  branch_manager:       'Branch Manager',
  hr_staff:             'HR Staff',
  attendance_officer:   'Attendance Officer',
  verification_officer: 'Verification Officer',
  staff:                'Staff'
};

// Populate sidebar user info on any page that has #sidebarUserName / #sidebarUserRole
function populateSidebarUser() {
  const user = getUser();
  if (!user) return;

  const nameEl   = document.getElementById('sidebarUserName');
  const roleEl   = document.getElementById('sidebarUserRole');
  const avatarEl = document.getElementById('sidebarAvatar');

  if (nameEl)   nameEl.textContent = user.fullName;
  if (roleEl)   roleEl.textContent = ROLE_DISPLAY[user.role] || user.role;
  if (avatarEl && user.passportPhoto) avatarEl.src = user.passportPhoto;

  applyCompanyBranding();
}

// Apply stored company branding (name, colors) to the current page
function applyCompanyBranding() {
  try {
    const company = JSON.parse(localStorage.getItem('wv_company') || 'null');
    if (!company) return;

    const brandNameEl = document.getElementById('sidebarBrandName');
    if (brandNameEl) brandNameEl.textContent = company.name || 'WorkerSave';

    if (company.branding?.primaryColor) {
      document.documentElement.style.setProperty('--primary', company.branding.primaryColor);
    }
    if (company.branding?.accentColor) {
      document.documentElement.style.setProperty('--accent', company.branding.accentColor);
    }
  } catch (_) {}
}

// Toast notification system
function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('toast-show'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Format date nicely
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

// Status badge HTML
function statusBadge(status) {
  const map = {
    pending:    { cls: 'badge-warning',    label: 'Pending' },
    verified:   { cls: 'badge-success',    label: 'Verified' },
    rejected:   { cls: 'badge-danger',     label: 'Rejected' },
    incomplete: { cls: 'badge-incomplete', label: 'Incomplete' },
    legacy:     { cls: 'badge-legacy',     label: 'Legacy Worker' },
    temporary:  { cls: 'badge-temporary',  label: 'Temporary' },
  };
  const m = map[status] || { cls: '', label: status };
  return `<span class="badge ${m.cls}">${m.label}</span>`;
}
