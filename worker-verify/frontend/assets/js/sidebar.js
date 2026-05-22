// Sidebar builder
(function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const path = window.location.pathname;

  const navGroups = [
    {
      label: 'Overview',
      items: [
        { href: '/admin/dashboard.html', icon: iconGrid(), label: 'Dashboard' }
      ]
    },
    {
      label: 'Workforce',
      items: [
        { href: '/admin/workers.html',   icon: iconUsers(),    label: 'Workers'   },
        { href: '/admin/roles.html',     icon: iconTag(),      label: 'Roles'     },
        { href: '/admin/schedules.html', icon: iconClock(),    label: 'Schedules' }
      ]
    },
    {
      label: 'Operations',
      items: [
        { href: '/admin/attendance.html', icon: iconCheck(),  label: 'Attendance' },
        { href: '/admin/shortages.html',  icon: iconAlert(),  label: 'Shortages'  },
        { href: '/admin/sales.html',      icon: iconChart(),  label: 'Daily Sales'}
      ]
    },
    {
      label: 'Finance',
      items: [
        { href: '/admin/payroll.html', icon: iconMoney(), label: 'Payroll' }
      ]
    },
    {
      label: 'Admin',
      items: [
        { href: '/admin/branches.html', icon: iconBranch(), label: 'Branches' }
      ]
    }
  ];

  function isActive(href) {
    return path.endsWith(href.replace(/^\//, '')) || path === href;
  }

  let html = `
    <div class="sidebar-header">
      <div class="sidebar-brand">
        <div class="sidebar-logo">S</div>
        <span class="sidebar-brand-name">Sage Energy</span>
      </div>
    </div>
    <nav class="sidebar-nav">`;

  for (const group of navGroups) {
    html += `<div class="nav-group"><div class="nav-group-label">${group.label}</div>`;
    for (const item of group.items) {
      const active = isActive(item.href) ? ' active' : '';
      html += `<a href="${item.href}" class="nav-item${active}">${item.icon}<span>${item.label}</span></a>`;
    }
    html += `</div>`;
  }

  html += `</nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-user-avatar" id="sidebar-user-avatar"></div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name" id="sidebar-user-name"></div>
          <div class="sidebar-user-role" id="sidebar-user-role"></div>
        </div>
        <button class="btn btn-icon btn-ghost sidebar-logout" onclick="Auth.logout()" title="Logout">
          ${iconLogout()}
        </button>
      </div>
    </div>`;

  sidebar.innerHTML = html;
  if (typeof populateSidebarUser === 'function') populateSidebarUser();
})();

// Mobile toggle
function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  if (s) s.classList.toggle('open');
  if (o) o.classList.toggle('show');
}

// SVG icons
function iconGrid() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
}
function iconUsers() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
}
function iconTag() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
}
function iconClock() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
}
function iconCheck() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
}
function iconAlert() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
}
function iconChart() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
}
function iconMoney() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;
}
function iconBranch() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
}
function iconLogout() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
}
