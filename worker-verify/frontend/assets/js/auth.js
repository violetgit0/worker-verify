// Session management + UI helpers
const Auth = (() => {
  const TOKEN_KEY = 'sage_token';
  const USER_KEY  = 'sage_user';

  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function getToken()  { return localStorage.getItem(TOKEN_KEY); }
  function getUser()   {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function requireAuth() {
    if (!getToken()) { window.location.href = '/index.html'; return false; }
    return true;
  }

  function logout() {
    clearSession();
    window.location.href = '/index.html';
  }

  return { saveSession, getToken, getUser, clearSession, requireAuth, logout };
})();

// Toast notifications
function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Populate sidebar user info
function populateSidebarUser() {
  const user = Auth.getUser();
  if (!user) return;
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (nameEl) nameEl.textContent = user.fullName || user.username || '';
  if (roleEl) roleEl.textContent = (user.role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  if (avatarEl) {
    if (user.photo) {
      avatarEl.innerHTML = `<img src="${user.photo}" alt="">`;
    } else {
      const initials = (user.fullName || user.username || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      avatarEl.textContent = initials;
    }
  }
}

// Format helpers
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function formatCurrency(n) {
  if (n === undefined || n === null) return '—';
  return '₦' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatMinutes(m) {
  if (!m) return '—';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m/60)}h ${m%60}m`;
}

// Status badge HTML
function statusBadge(status) {
  const map = {
    active:    ['green',  'Active'],
    inactive:  ['gray',   'Inactive'],
    suspended: ['red',    'Suspended'],
    pending:   ['amber',  'Pending'],
    present:   ['green',  'Present'],
    late:      ['amber',  'Late'],
    absent:    ['red',    'Absent'],
    off_day:   ['gray',   'Off Day'],
    on_leave:  ['blue',   'On Leave'],
    draft:     ['gray',   'Draft'],
    approved:  ['green',  'Approved'],
    paid:      ['blue',   'Paid'],
    rejected:  ['red',    'Rejected'],
    submitted: ['blue',   'Submitted']
  };
  const [color, label] = map[status] || ['gray', status || '—'];
  return `<span class="badge badge-${color}">${label}</span>`;
}

// Avatar HTML
function workerAvatar(worker, size = '') {
  const cls = `worker-thumb${size ? ' avatar-' + size : ''}`;
  if (worker?.photo) return `<img src="${worker.photo}" class="${cls}" alt="">`;
  const initials = (worker?.fullName || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return `<span class="worker-initials${size ? ' avatar-' + size : ''}">${initials}</span>`;
}

// Pagination renderer
function renderPagination(containerId, currentPage, totalPages, onPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  let html = '<div class="pagination">';
  html += `<button class="btn btn-ghost btn-sm" ${currentPage===1?'disabled':''} onclick="(${onPageChange})(${currentPage-1})">Previous</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
      html += `<button class="btn btn-sm ${i===currentPage?'btn-primary':'btn-ghost'}" onclick="(${onPageChange})(${i})">${i}</button>`;
    } else if (Math.abs(i - currentPage) === 2) {
      html += '<span class="px-1">…</span>';
    }
  }
  html += `<button class="btn btn-ghost btn-sm" ${currentPage===totalPages?'disabled':''} onclick="(${onPageChange})(${currentPage+1})">Next</button>`;
  html += '</div>';
  el.innerHTML = html;
}

// Simple debounce
function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
