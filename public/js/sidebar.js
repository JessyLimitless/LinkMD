'use strict';

function toggleSidebar() {
  AppState.sidebarOpen = !AppState.sidebarOpen;
  document.getElementById('sidebar').classList.toggle('collapsed', !AppState.sidebarOpen);
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
