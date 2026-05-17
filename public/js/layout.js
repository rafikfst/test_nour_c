// ============================================================
// AVÈNE PLATFORM - layout.js (Shared Navigation Layout)
// ============================================================

function renderLayout(activePage) {
  const nav = [
    { href: '/dashboard.html', icon: '🏠', label: 'Tableau de bord', section: 'principal' },
    { href: '/tournees.html', icon: '🗺️', label: 'Tournées', section: 'principal' },
    { href: '/pharmacies.html', icon: '🏥', label: 'Pharmacies', section: 'gestion' },
    { href: '/agents.html', icon: '👤', label: 'Agents', section: 'gestion' },
    { href: '/questions.html', icon: '❓', label: 'Questions', section: 'jeu', adminOnly: true },
    { href: '/game.html', icon: '🎮', label: 'Lancer le Jeu', section: 'jeu' },
    { href: '/reporting.html', icon: '📊', label: 'Rapports & Bilan', section: 'analyse' },
    { href: '/users.html', icon: '👥', label: 'Utilisateurs', section: 'admin', adminOnly: true },
  ];

  const sections = {
    principal: 'Principal',
    gestion: 'Gestion',
    jeu: 'Jeu',
    analyse: 'Analyse',
    admin: 'Administration'
  };

  const sectionGroups = {};
  nav.forEach(item => {
    if (!sectionGroups[item.section]) sectionGroups[item.section] = [];
    sectionGroups[item.section].push(item);
  });

  let navHTML = '';
  Object.entries(sectionGroups).forEach(([section, items]) => {
    const hasAdminItems = items.every(i => i.adminOnly);
    const dataAttr = hasAdminItems ? 'data-admin-only' : '';
    navHTML += `<div class="nav-section" ${dataAttr}>
      <div class="nav-section-label">${sections[section]}</div>`;
    items.forEach(item => {
      const isActive = window.location.pathname === item.href;
      const adminAttr = item.adminOnly ? 'data-admin-only' : '';
      navHTML += `<a href="${item.href}" class="nav-item${isActive ? ' active' : ''}" ${adminAttr}>
        <span class="icon">${item.icon}</span>${item.label}
      </a>`;
    });
    navHTML += `</div>`;
  });

  document.getElementById('sidebarNav').innerHTML = navHTML;
}

// ── Logout handler ───────────────────────────────────────────
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/login.html';
  }
}
