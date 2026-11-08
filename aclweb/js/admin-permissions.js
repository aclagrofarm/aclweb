(() => {
  const token = sessionStorage.getItem('acl_admin_token');
  const nav = document.querySelector('.admin-sidebar nav');
  if (!token || !nav) return;

  const permissionByPage = {
    'dashboard.html': 'dashboard',
    'inventory.html': 'inventory',
    'agent-applications.html': 'agent_applications',
    'agent-applications.html': 'agent_applications',
    'database-backups.html': 'database_backup',
    'activity-logs.html': 'activity_logs',
    'user-management.html': 'customers',
    'customer-projects.html': 'project_approvals',
    'branches.html': 'branches',
    'services.html': 'services',
    'projects.html': 'projects',
    'blog.html': 'blog',
    'gallery.html': 'gallery',
    'inquiries.html': 'inquiries',
    'investment-applications.html': 'investment_applications',
    'settings.html': 'settings'
  };

  fetch('/api/admin/dashboard', {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then((response) => response.ok ? response.json() : null)
    .then((result) => {
      const profile = result?.profile;
      if (!profile) return;
      const isStaff = ['employee', 'agent'].includes(profile.role);
      const allowed = new Set(profile.permissions || []);
      const currentUrl = new URL(window.location.href);
      const currentPage = currentUrl.pathname.split('/').pop();
      const requiredRole = ['database-backups.html', 'activity-logs.html'].includes(currentPage) ? 'super_admin' : null;
      const currentPermission = currentPage === 'customer-projects.html' && currentUrl.searchParams.get('view') === 'completed'
        ? 'my_projects'
        : permissionByPage[currentPage];

      if ((requiredRole && profile.role !== requiredRole) || (isStaff && currentPermission && !allowed.has(currentPermission))) {
        if (currentPage !== 'dashboard.html' && (!isStaff || allowed.has('dashboard'))) {
          window.location.replace('dashboard.html');
        } else {
          sessionStorage.removeItem('acl_admin_token');
          sessionStorage.removeItem('acl_admin_user');
          window.location.replace('index.html');
        }
        return;
      }

      for (const link of nav.querySelectorAll('a[href]')) {
        const target = new URL(link.href, window.location.href);
        const page = target.pathname.split('/').pop();
        if (link.dataset.requiredRole) {
          link.hidden = profile.role !== link.dataset.requiredRole;
          continue;
        }
        const permission = link.dataset.staffPermission || (page === 'customer-projects.html' && target.searchParams.get('view') === 'completed'
          ? 'my_projects'
          : permissionByPage[page]);
        if (isStaff && permission) link.hidden = !allowed.has(permission);
      }

      for (const group of nav.querySelectorAll('details')) {
        const links = [...group.querySelectorAll('a[href]')];
        if (links.length) group.hidden = links.every((link) => link.hidden);
      }
    })
    .catch(() => {});
})();