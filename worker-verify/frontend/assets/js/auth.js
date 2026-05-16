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
  window.location.href = '/index.html';
}

// Call on every protected page – redirects to login if not authenticated
function requireAuth(allowedRoles = []) {
  const user = getUser();
  const token = getToken();

  if (!token || !user) {
    window.location.href = '/index.html';
    return null;
  }

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    // Wrong role – send to their proper dashboard
    if (user.role === 'super_admin') {
      window.location.href = '/admin/dashboard.html';
    } else {
      window.location.href = '/staff/dashboard.html';
    }
    return null;
  }

  return user;
}

// Populate sidebar user info on any page that has #sidebarUserName / #sidebarUserRole
function populateSidebarUser() {
  const user = getUser();
  if (!user) return;

  const nameEl   = document.getElementById('sidebarUserName');
  const roleEl   = document.getElementById('sidebarUserRole');
  const avatarEl = document.getElementById('sidebarAvatar');

  if (nameEl)   nameEl.textContent = user.fullName;
  if (roleEl)   roleEl.textContent = user.role === 'super_admin' ? 'Super Admin' : 'Staff';
  if (avatarEl && user.passportPhoto) avatarEl.src = user.passportPhoto;
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
    pending:  'badge-warning',
    verified: 'badge-success',
    rejected: 'badge-danger'
  };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}
