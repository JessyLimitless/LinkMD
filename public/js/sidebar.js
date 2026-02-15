'use strict';

function isMobile() {
  return window.innerWidth <= 768;
}

function toggleSidebar() {
  if (isMobile()) {
    toggleSidebarMobile();
    return;
  }
  AppState.sidebarOpen = !AppState.sidebarOpen;
  document.getElementById('sidebar').classList.toggle('collapsed', !AppState.sidebarOpen);
}

function toggleSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const isOpen = sidebar.classList.contains('mobile-open');
  if (isOpen) {
    closeSidebarMobile();
  } else {
    sidebar.classList.add('mobile-open');
    sidebar.classList.remove('collapsed');
    backdrop.classList.add('open');
  }
}

function closeSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar.classList.remove('mobile-open');
  backdrop.classList.remove('open');
}

function initSidebarMobile() {
  if (isMobile()) {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('collapsed');
    sidebar.classList.remove('mobile-open');
  }

  // Auto-close sidebar on item click (mobile)
  const sidebar = document.getElementById('sidebar');
  sidebar.addEventListener('click', (e) => {
    if (!isMobile()) return;
    const item = e.target.closest('.sidebar-item, .sidebar-add-btn, .search-history-item');
    if (item) {
      setTimeout(() => closeSidebarMobile(), 150);
    }
  });

  // Handle resize: clean up mobile classes when going to desktop
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      closeSidebarMobile();
      const sidebar = document.getElementById('sidebar');
      if (!AppState.sidebarOpen) {
        sidebar.classList.add('collapsed');
      }
    }
  });
}

function renderStatsSection() {
  const el = document.getElementById('stats-section');
  if (!el || !AppState.stats) return;
  el.innerHTML = `
    <div class="sidebar-stats">
      <span><i data-lucide="file-text" style="width:13px;height:13px"></i> 문서 <b>${AppState.stats.totalDocuments || 0}</b>개</span>
      <span><i data-lucide="folder" style="width:13px;height:13px"></i> 프로젝트 <b>${AppState.stats.totalProjects || 0}</b>개</span>
      <span><i data-lucide="hash" style="width:13px;height:13px"></i> 태그 <b>${AppState.stats.totalTags || 0}</b>개</span>
    </div>`;
  lucide.createIcons();
}
