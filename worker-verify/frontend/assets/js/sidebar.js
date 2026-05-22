/* Shared sidebar builder — inject into any admin page via <aside id="sidebar"></aside> */
(function () {
  const ICONS = {
    dashboard: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    workers:   `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    branches:  `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M3 21h18M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2M9 21V9M15 21V9M3 7h18"/></svg>`,
    roles:     `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    shifts:    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    attendance:`<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    payroll:   `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    security:  `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    staff:     `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    register:  `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
    logout:    `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  };

  const NAV = [
    { section: 'Overview' },
    { href: 'dashboard.html',  icon: 'dashboard',  label: 'Dashboard' },
    { section: 'Workforce' },
    { href: 'workers.html',    icon: 'workers',    label: 'Workers' },
    { href: 'roles.html',      icon: 'roles',      label: 'Worker Roles' },
    { href: 'shifts.html',     icon: 'shifts',     label: 'Shifts' },
    { href: 'attendance.html', icon: 'attendance', label: 'Attendance' },
    { section: 'Finance' },
    { href: 'payroll.html',    icon: 'payroll',    label: 'Payroll' },
    { section: 'Admin' },
    { href: 'branches.html',   icon: 'branches',   label: 'Branches' },
    { href: 'staff.html',      icon: 'staff',      label: 'Staff Accounts' },
    { section: 'Worker Entry' },
    { href: 'quick-register.html', icon: 'register', label: 'Quick Register' },
  ];

  function currentPage() {
    return location.pathname.split('/').pop() || 'dashboard.html';
  }

  function buildNav() {
    const page = currentPage();
    return NAV.map(item => {
      if (item.section) {
        return `<div class="nav-section-title">${item.section}</div>`;
      }
      const active = page === item.href ? 'active' : '';
      return `<a href="${item.href}" class="nav-link ${active}">
        <span class="nav-icon">${ICONS[item.icon] || ''}</span>
        <span>${item.label}</span>
      </a>`;
    }).join('');
  }

  function buildSidebar() {
    const el = document.getElementById('sidebar');
    if (!el) return;

    el.innerHTML = `
      <div class="sidebar-brand">
        <div class="brand-logo">
          <div class="brand-icon">
            <svg width="20" height="20" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <span id="sidebarBrandName">WorkerSave</span>
        </div>
      </div>
      <div class="sidebar-user">
        <img id="sidebarAvatar" class="sidebar-avatar" src="" alt=""
          onerror="this.src=''" style="object-fit:cover;" />
        <div class="sidebar-user-info">
          <div class="user-name" id="sidebarUserName">Loading…</div>
          <div class="user-role" id="sidebarUserRole"></div>
        </div>
      </div>
      <nav class="sidebar-nav">${buildNav()}</nav>
      <div class="sidebar-footer">
        <button class="logout-btn" onclick="logout()">
          ${ICONS.logout} Sign Out
        </button>
      </div>
    `;
  }

  function wireOverlay() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar || !overlay) return;
    sidebar.addEventListener('transitionend', () => {
      overlay.classList.toggle('active', sidebar.classList.contains('open'));
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }

  function init() {
    buildSidebar();
    wireOverlay();
    // Re-populate user info in case populateSidebarUser() ran before sidebar was built
    if (typeof populateSidebarUser === 'function') populateSidebarUser();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window._rebuildSidebar = buildSidebar;
})();
