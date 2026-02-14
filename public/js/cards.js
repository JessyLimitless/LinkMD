'use strict';

function renderWorkspace(main) {
  if (!AppState.currentProjectId) {
    main.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><i data-lucide="folder-open" style="width:48px;height:48px"></i></div>
      <div class="empty-state-text">프로젝트를 선택하거나 새로 만드세요</div>
      <div class="empty-state-sub">사이드바에서 프로젝트를 선택하세요</div>
    </div>`;
    lucide.createIcons();
    return;
  }

  const proj = AppState.projects.find(p => p.id === AppState.currentProjectId);
  const projName = proj ? escapeHtml(proj.name) : '';
  const selCount = AppState.selectedDocIds.size;

  main.innerHTML = `
    <div class="workspace-header">
      <div class="workspace-title"><span class="title-icon"><i data-lucide="folder" style="width:20px;height:20px"></i></span> ${projName}</div>
      <div class="workspace-actions">
        <button class="btn btn-secondary btn-sm" onclick="showCreateDocModal(null)"><i data-lucide="file-plus" style="width:14px;height:14px"></i> 새 파일</button>
        <button class="btn btn-secondary btn-sm" onclick="showCreateFolderModal(null)"><i data-lucide="folder-plus" style="width:14px;height:14px"></i> 새 폴더</button>
        ${selCount > 0 ? `<button class="btn btn-primary btn-sm" onclick="openExport()"><i data-lucide="download" style="width:14px;height:14px"></i> 내보내기 (${selCount})</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="showShareProjectModal('${escapeAttr(AppState.currentProjectId)}')"><i data-lucide="share-2" style="width:14px;height:14px"></i> 공유</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProject('${escapeAttr(AppState.currentProjectId)}')"><i data-lucide="trash-2" style="width:14px;height:14px"></i> 삭제</button>
      </div>
    </div>
    <div id="upload-zone" class="upload-zone">
      <div class="upload-zone-icon"><i data-lucide="upload-cloud" style="width:40px;height:40px"></i></div>
      <div class="upload-zone-text">MD / ZIP 파일을 드래그하거나 클릭하세요</div>
      <div class="upload-zone-sub">.md, .zip 지원 | 최대 100개</div>
      <input type="file" accept=".md,.zip" multiple>
    </div>
    <div class="filter-bar">
      <label>정렬:</label>
      <select id="sort-select" onchange="changeSort()">
        <option value="filename" ${AppState.sortBy==='filename'?'selected':''}>이름순</option>
        <option value="created_at" ${AppState.sortBy==='created_at'?'selected':''}>날짜순</option>
        <option value="file_size" ${AppState.sortBy==='file_size'?'selected':''}>크기순</option>
        <option value="heading_count" ${AppState.sortBy==='heading_count'?'selected':''}>헤딩수</option>
      </select>
      <select id="order-select" onchange="changeSort()">
        <option value="asc" ${AppState.sortOrder==='asc'?'selected':''}>오름차순</option>
        <option value="desc" ${AppState.sortOrder==='desc'?'selected':''}>내림차순</option>
      </select>
      <div class="tag-filters" id="tag-filters"></div>
    </div>
    <div class="card-grid" id="card-grid"></div>
  `;

  setupUploadZone();
  renderTagFilters();
  renderCards();
  lucide.createIcons();
}

function renderCards() {
  const grid = document.getElementById('card-grid');
  if (!grid) return;

  if (AppState.documents.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i data-lucide="file-text" style="width:48px;height:48px"></i></div><div class="empty-state-text">문서가 없습니다</div><div class="empty-state-sub">위에서 MD 파일을 업로드하세요</div></div>';
    lucide.createIcons();
    return;
  }

  grid.innerHTML = AppState.documents.map(d => {
    const sel = AppState.selectedDocIds.has(d.id);
    const tags = (d.tags || []).map(t => `<span class="card-tag" style="color:${escapeAttr(t.color)}">#${escapeHtml(t.name)}</span>`).join('');
    const date = d.created_at ? new Date(d.created_at).toLocaleDateString('ko-KR') : '';
    return `
      <div class="doc-card ${sel?'selected':''}" onclick="openViewer('${escapeAttr(d.id)}')">
        <input type="checkbox" class="card-checkbox" ${sel?'checked':''} onclick="event.stopPropagation();toggleSelect('${escapeAttr(d.id)}')">
        <div class="card-title">${escapeHtml(d.title || d.filename)}</div>
        <div class="card-filename">${escapeHtml(d.filename)}</div>
        <div class="card-tags">${tags}</div>
        <div class="card-stats">
          <span><i data-lucide="heading" style="width:12px;height:12px"></i> ${d.heading_count||0}</span>
          <span><i data-lucide="code-2" style="width:12px;height:12px"></i> ${d.code_block_count||0}</span>
          <span>${formatSize(d.file_size)}</span>
        </div>
        <div class="card-date">${date}</div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

function toggleSelect(id) {
  if (AppState.selectedDocIds.has(id)) AppState.selectedDocIds.delete(id);
  else AppState.selectedDocIds.add(id);
  renderMain();
}

function changeSort() {
  AppState.sortBy = document.getElementById('sort-select')?.value || 'filename';
  AppState.sortOrder = document.getElementById('order-select')?.value || 'asc';
  loadDocuments(AppState.currentProjectId);
}

function renderTagFilters() {
  const el = document.getElementById('tag-filters');
  if (!el) return;
  const projectTags = new Set();
  AppState.documents.forEach(d => (d.tags||[]).forEach(t => projectTags.add(t.name)));
  el.innerHTML = `<span class="tag-chip ${!AppState.filterTag?'active':''}" onclick="filterByTag(null)">전체</span>` +
    [...projectTags].map(t => `<span class="tag-chip ${AppState.filterTag===t?'active':''}" onclick="filterByTag('${escapeAttr(t)}')">#${escapeHtml(t)}</span>`).join('');
}

function filterByTag(tagName) {
  AppState.filterTag = tagName;
  loadDocuments(AppState.currentProjectId);
}

function formatSize(bytes) {
  if (!bytes) return '0B';
  if (bytes < 1024) return bytes + 'B';
  return (bytes / 1024).toFixed(1) + 'KB';
}
