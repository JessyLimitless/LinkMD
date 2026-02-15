'use strict';

const API = window.location.origin + '/api';

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

async function api(url, opts = {}) {
  try {
    const res = await fetch(API + url, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Error');
    return data;
  } catch (e) {
    toast(e.message, 'error');
    throw e;
  }
}

async function apiUpload(url, formData) {
  const res = await fetch(API + url, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
  return data;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadProjects();
  await loadTags();
  await loadStats();
  renderSidebar();
  renderMain();
  lucide.createIcons();
  initSidebarMobile();

  // Search
  const searchInput = document.getElementById('search-input');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = searchInput.value.trim();
      if (q.length >= 2) doSearch(q);
      else if (q.length === 0) { AppState.view = 'workspace'; renderMain(); }
    }, 300);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (q) doSearch(q);
    }
  });

  // Ctrl+K shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
});

async function loadProjects() {
  const data = await api('/projects');
  AppState.projects = data.projects || [];
}

async function loadTags() {
  const data = await api('/tags');
  AppState.tags = data.tags || [];
}

async function loadStats() {
  try {
    const data = await api('/stats');
    AppState.stats = data;
  } catch {}
}

async function loadDocuments(projectId) {
  try {
    const { sort, order, tag } = { sort: AppState.sortBy, order: AppState.sortOrder, tag: AppState.filterTag };
    let url = `/projects/${projectId}/docs?sort=${sort}&order=${order}`;
    if (tag) url += `&tag=${encodeURIComponent(tag)}`;
    const data = await api(url);
    AppState.documents = data.documents || [];
    AppState.currentProjectId = projectId;
    AppState.view = 'workspace';
    AppState.selectedDocIds = new Set();
    renderMain();
    highlightActiveProject();
  } catch (e) {
    console.error('[loadDocuments] renderMain error:', e);
  }

  // Load tree view (always attempt even if renderMain fails)
  if (projectId) {
    const treeActions = document.getElementById('tree-header-actions');
    if (treeActions) treeActions.style.display = '';
    loadProjectTree(projectId);
  }
}

async function doSearch(query) {
  AppState.searchQuery = query;
  AppState.loading.search = true;
  try {
    let url = `/search?q=${encodeURIComponent(query)}`;
    if (AppState.currentProjectId) url += `&project=${AppState.currentProjectId}`;
    const data = await api(url);
    AppState.searchResults = data.results || [];
    AppState.view = 'search-results';
    renderMain();
    loadSearchHistory();
  } finally { AppState.loading.search = false; }
}

async function loadSearchHistory() {
  try {
    const data = await api('/search/history');
    AppState.searchHistory = data.history || [];
    renderSearchHistory();
  } catch {}
}

function renderSidebar() { renderProjectList(); renderTagList(); renderStatsSection(); }
function renderMain() {
  const main = document.getElementById('main');
  if (AppState.view === 'universe') {
    main.classList.remove('editor-active');
    renderUniverse(main);
  } else if (AppState.view === 'editor') {
    main.classList.add('editor-active');
    renderEditor(main);
  } else {
    main.classList.remove('editor-active');
    if (AppState.view === 'viewer') renderViewer(main);
    else if (AppState.view === 'search-results') renderSearchResults(main);
    else renderWorkspace(main);
  }
}
